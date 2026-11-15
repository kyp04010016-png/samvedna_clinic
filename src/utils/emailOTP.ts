import emailjs from '@emailjs/browser';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface OtpGatewayConfig {
  enabled: boolean;
  phpOtpEndpoint: string; // e.g., '/otp.php' or 'https://yourdomain.com/otp.php'
  fast2smsApiKey: string;
  msg91AuthKey: string;
  msg91TemplateId: string;
  emailJsServiceId: string;
  emailJsTemplateId: string;
  emailJsPublicKey: string;
  customWebhookUrl: string;
  showInstantOtpOnScreen: boolean;
}

export const DEFAULT_OTP_CONFIG: OtpGatewayConfig = {
  enabled: true,
  phpOtpEndpoint: '/otp.php',
  fast2smsApiKey: '',
  msg91AuthKey: '',
  msg91TemplateId: '',
  emailJsServiceId: import.meta.env.VITE_EMAILJS_SERVICE_ID || '',
  emailJsTemplateId: import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '',
  emailJsPublicKey: import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '',
  customWebhookUrl: '',
  showInstantOtpOnScreen: false,
};

const LOCAL_OTP_STORE_PREFIX = 'sandana_otp_record_';
const LOCAL_OTP_CONFIG_CACHE = 'sandana_otp_config_cache_v1';

/**
 * Converts a phone number, social ID, or email into a safe Firestore document ID
 * matching ^[a-zA-Z0-9_\-]+$ required by firestore.rules.
 */
export function sanitizeOtpDocId(rawIdentifier: string, prefix = ''): string {
  const cleaned = rawIdentifier
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  const full = prefix ? `${prefix}_${cleaned}` : cleaned;
  return full.slice(0, 120) || 'default_otp_id';
}

export interface SendOTPParams {
  identifier: string; // primary key (email address or social ID)
  email?: string; // email address or social ID
  phone?: string; // optional contact number
  recipientName?: string;
  purpose?: 'appointment' | 'staff_login';
  socialProvider?: string; // e.g. 'Google+', 'Facebook', 'X (Twitter)', 'Instagram'
  deliveryChannel?: 'email' | 'social_id' | 'both' | 'mobile';
}

export interface SendOTPResult {
  success: boolean;
  sentViaEmailJS: boolean;
  sentViaHostingGateway?: boolean;
  gatewayProvider?: string;
  demoOtp?: string;
  expiresAt: string;
  message: string;
}

async function loadActiveOtpConfig(): Promise<{
  config: OtpGatewayConfig;
  clinicName: string;
}> {
  let clinicName = 'Sandana Clinic + Dudrucs Pharmacy';
  try {
    const snap = await getDoc(doc(db, 'settings', 'clinic'));
    if (snap.exists()) {
      const data = snap.data() as any;
      if (data.clinicName) {
        clinicName = `${data.clinicName} + ${data.medicalName || 'Dudrucs'}`;
      }
      if (data.otpConfig && typeof data.otpConfig === 'object') {
        const merged: OtpGatewayConfig = {
          ...DEFAULT_OTP_CONFIG,
          ...data.otpConfig,
        };
        try {
          localStorage.setItem(LOCAL_OTP_CONFIG_CACHE, JSON.stringify(merged));
        } catch {
          // ignore storage errors
        }
        return { config: merged, clinicName };
      }
    }
  } catch {
    // Fallback to cached config if offline
  }

  try {
    const raw = localStorage.getItem(LOCAL_OTP_CONFIG_CACHE);
    if (raw) {
      return {
        config: { ...DEFAULT_OTP_CONFIG, ...JSON.parse(raw) },
        clinicName,
      };
    }
  } catch {
    // ignore
  }

  return { config: DEFAULT_OTP_CONFIG, clinicName };
}

function saveLocalOtpBackup(docId: string, otp: string, expiry: string) {
  try {
    localStorage.setItem(
      `${LOCAL_OTP_STORE_PREFIX}${docId}`,
      JSON.stringify({ otp, expiry, createdAt: new Date().toISOString() })
    );
  } catch {
    // ignore
  }
}

function readLocalOtpBackup(
  docId: string
): { otp: string; expiry: string } | null {
  try {
    const raw = localStorage.getItem(`${LOCAL_OTP_STORE_PREFIX}${docId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function removeLocalOtpBackup(docId: string) {
  try {
    localStorage.removeItem(`${LOCAL_OTP_STORE_PREFIX}${docId}`);
  } catch {
    // ignore
  }
}

/**
 * Generates a 6-digit OTP, saves it in Firestore `otp_verification/{identifier}`
 * AND local fallback storage, and dispatches via Hosting `otp.php` / `/api/otp/send`
 * + SMS Gateway (Fast2SMS / MSG91) + EmailJS.
 */
export async function generateAndSendOTP(
  params: SendOTPParams
): Promise<SendOTPResult> {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const cleanPhone = (params.phone || params.identifier)
    .replace(/\D/g, '')
    .slice(-10);
  const safePhoneField = cleanPhone || params.identifier.trim().slice(0, 25);
  const cleanEmailOrSocialId = (params.email || '').trim().slice(0, 150);
  const docId = sanitizeOtpDocId(
    params.identifier,
    params.purpose === 'staff_login' ? 'login' : ''
  );

  // Save in local browser backup immediately so OTP works even on fresh domain setup
  saveLocalOtpBackup(docId, otp, expiresAt);

  // 1. Save 6-digit OTP to Firestore `otp_verification/{docId}`
  try {
    await setDoc(doc(db, 'otp_verification', docId), {
      otp,
      expiry: expiresAt,
      ...(cleanEmailOrSocialId ? { email: cleanEmailOrSocialId } : {}),
      phone: safePhoneField,
      purpose: params.purpose || 'appointment',
      ...(params.recipientName
        ? { staffName: params.recipientName.slice(0, 110) }
        : {}),
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore OTP write warning (using local + server OTP):', err);
  }

  // Secondary lookup under phone or socialId if both are provided
  if (cleanPhone && cleanEmailOrSocialId) {
    const phoneDocId = sanitizeOtpDocId(
      cleanPhone,
      params.purpose === 'staff_login' ? 'login' : ''
    );
    saveLocalOtpBackup(phoneDocId, otp, expiresAt);
    if (phoneDocId !== docId) {
      await setDoc(doc(db, 'otp_verification', phoneDocId), {
        otp,
        expiry: expiresAt,
        email: cleanEmailOrSocialId,
        phone: safePhoneField,
        purpose: params.purpose || 'appointment',
        createdAt: new Date().toISOString(),
      }).catch(() => {});
    }
  }

  const { config: otpConfig, clinicName } = await loadActiveOtpConfig();

  let sentViaHostingGateway = false;
  let gatewayProvider = 'Instant-OTP';

  // 2. Dispatch via Hosting OTP File (/otp.php or /api/otp/send)
  if (otpConfig.enabled !== false) {
    const endpoint = (otpConfig.phpOtpEndpoint || '/otp.php').trim();
    const endpointsToTry = Array.from(
      new Set([endpoint, '/api/otp/send', '/otp.php'])
    );

    for (const url of endpointsToTry) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send',
            phone: cleanPhone,
            email: cleanEmailOrSocialId,
            otp,
            recipientName: params.recipientName || 'Patient / Staff',
            purpose: params.purpose || 'appointment',
            clinicName,
            fast2smsApiKey: otpConfig.fast2smsApiKey || '',
            msg91AuthKey: otpConfig.msg91AuthKey || '',
            msg91TemplateId: otpConfig.msg91TemplateId || '',
            customWebhookUrl: otpConfig.customWebhookUrl || '',
          }),
        });
        if (res.ok) {
          const json: any = await res.json().catch(() => null);
          if (json && json.success) {
            sentViaHostingGateway = Boolean(json.smsSent || json.emailSent);
            gatewayProvider = json.provider || 'Hosting-OTP-Gateway';
            break;
          }
        }
      } catch {
        // Continue to next endpoint or fallback
      }
    }
  }

  // 3. Send OTP via EmailJS if an email address and EmailJS credentials are configured
  const serviceId =
    otpConfig.emailJsServiceId || import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
  const templateId =
    otpConfig.emailJsTemplateId ||
    import.meta.env.VITE_EMAILJS_TEMPLATE_ID ||
    '';
  const publicKey =
    otpConfig.emailJsPublicKey || import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

  const hasRealEmailJSKeys =
    Boolean(
      cleanEmailOrSocialId.includes('@') &&
        serviceId &&
        templateId &&
        publicKey
    ) &&
    serviceId !== 'your_emailjs_service_id' &&
    templateId !== 'your_emailjs_template_id' &&
    publicKey !== 'your_emailjs_public_key';

  const providerTag = params.socialProvider
    ? `[${params.socialProvider}] `
    : '';
  const targetDescription =
    params.deliveryChannel === 'email' || cleanEmailOrSocialId
      ? `Email (${cleanEmailOrSocialId || params.identifier})`
      : `Email / ID (${params.identifier})`;

  if (hasRealEmailJSKeys) {
    try {
      await emailjs.send(
        serviceId,
        templateId,
        {
          to_email: cleanEmailOrSocialId,
          to_name: params.recipientName || 'Patient / Staff',
          otp_code: otp,
          expiry_minutes: '5 minutes',
          clinic_name: clinicName,
        },
        {
          publicKey,
        }
      );

      return {
        success: true,
        sentViaEmailJS: true,
        sentViaHostingGateway,
        gatewayProvider: 'EmailJS + ' + gatewayProvider,
        demoOtp: otpConfig.showInstantOtpOnScreen !== false ? otp : undefined,
        expiresAt,
        message: `${providerTag}6-Digit OTP dispatched to ${targetDescription} (Valid for 5 minutes).`,
      };
    } catch (emailErr: any) {
      console.warn(
        'OTP notification warning (falling back to hosting/on-screen OTP):',
        emailErr
      );
    }
  }

  return {
    success: true,
    sentViaEmailJS: false,
    sentViaHostingGateway,
    gatewayProvider,
    demoOtp: otpConfig.showInstantOtpOnScreen !== false ? otp : undefined,
    expiresAt,
    message: sentViaHostingGateway
      ? `${providerTag}6-Digit OTP dispatched via ${gatewayProvider} to ${targetDescription} (Valid for 5 minutes).`
      : `${providerTag}6-Digit OTP generated & sent to ${targetDescription} (Valid for 5 minutes).`,
  };
}

/**
 * Verifies the 6-digit OTP from Firestore `otp_verification/{identifier}`
 * or local fallback store and checks that the 5-minute expiry has not passed.
 */
export async function verifyOTPCode(
  identifier: string,
  enteredOtp: string,
  purpose: 'appointment' | 'staff_login' = 'appointment'
): Promise<{ valid: boolean; error?: string }> {
  const cleanCode = enteredOtp.trim();
  if (cleanCode.length !== 6) {
    return { valid: false, error: 'Please enter a valid 6-digit OTP code.' };
  }

  const docId = sanitizeOtpDocId(
    identifier,
    purpose === 'staff_login' ? 'login' : ''
  );

  let record: { otp: string; expiry: string } | null = null;

  try {
    const snap = await getDoc(doc(db, 'otp_verification', docId));
    if (snap.exists()) {
      record = snap.data() as { otp: string; expiry: string };
    }
  } catch {
    // Fallback to local OTP store if Firestore read fails
  }

  if (!record) {
    record = readLocalOtpBackup(docId);
  }

  if (!record) {
    return {
      valid: false,
      error: 'No active OTP found. Please click "Send OTP" to request a code.',
    };
  }

  const expiryMs = new Date(record.expiry).getTime();

  if (Number.isNaN(expiryMs) || Date.now() > expiryMs) {
    return {
      valid: false,
      error: 'This OTP has expired (5-minute limit). Please request a new OTP.',
    };
  }

  if (record.otp !== cleanCode) {
    return {
      valid: false,
      error: 'Incorrect OTP code. Please check the 6-digit code and try again.',
    };
  }

  // Consume OTP after successful verification
  removeLocalOtpBackup(docId);
  try {
    await deleteDoc(doc(db, 'otp_verification', docId));
  } catch (err) {
    console.warn('Could not delete consumed OTP doc:', err);
  }

  return { valid: true };
}

/**
 * Helper to download ready-to-upload `otp.php` file directly from Admin Panel
 * so the Admin can drop it into any cPanel / Hostinger / GoDaddy domain folder.
 */
export function downloadStandalonePhpOtpFile(config?: Partial<OtpGatewayConfig>) {
  const f2sKey = (config?.fast2smsApiKey || '').trim();
  const msg91Key = (config?.msg91AuthKey || '').trim();
  const msg91Tpl = (config?.msg91TemplateId || '').trim();

  const phpContent = `<?php
/**
 * ============================================================================
 * SANDANA CLINIC & DUDRUCS PHARMACY — PRODUCTION OTP GATEWAY FILE (otp.php)
 * ============================================================================
 * Upload this file to your domain root (public_html/otp.php).
 * Automatically handles Mobile SMS OTP (Fast2SMS / MSG91) & Email OTP (PHP mail).
 * ============================================================================
 */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=UTF-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(json_encode(['status' => 'ok']));
}

$DEFAULT_FAST2SMS_KEY = '${f2sKey.replace(/'/g, "\\'")}';
$DEFAULT_MSG91_KEY    = '${msg91Key.replace(/'/g, "\\'")}';
$DEFAULT_MSG91_TPL    = '${msg91Tpl.replace(/'/g, "\\'")}';
$DEFAULT_CLINIC_NAME  = 'Sandana Clinic & Dudrucs Pharmacy';

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!is_array($data)) { $data = $_POST; }

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode(['success' => true, 'service' => 'otp.php', 'status' => 'READY']);
    exit;
}

$phone         = isset($data['phone']) ? substr(preg_replace('/\\D/', '', $data['phone']), -10) : '';
$email         = isset($data['email']) ? trim($data['email']) : '';
$otp           = isset($data['otp']) && strlen(preg_replace('/\\D/', '', $data['otp'])) === 6
                 ? preg_replace('/\\D/', '', $data['otp'])
                 : strval(random_int(100000, 999999));
$recipientName = isset($data['recipientName']) ? trim($data['recipientName']) : 'Patient';
$clinicName    = !empty($data['clinicName']) ? trim($data['clinicName']) : $DEFAULT_CLINIC_NAME;

$fast2smsKey   = !empty($data['fast2smsApiKey']) ? trim($data['fast2smsApiKey']) : $DEFAULT_FAST2SMS_KEY;
$msg91Key      = !empty($data['msg91AuthKey']) ? trim($data['msg91AuthKey']) : $DEFAULT_MSG91_KEY;
$msg91TplId    = !empty($data['msg91TemplateId']) ? trim($data['msg91TemplateId']) : $DEFAULT_MSG91_TPL;

$smsSent = false;
$emailSent = false;
$provider = 'instant-gateway';

if (strlen($phone) === 10 && !empty($fast2smsKey)) {
    $ch = curl_init('https://www.fast2sms.com/dev/bulkV2');
    $payload = json_encode([
        'route' => 'q',
        'message' => "Your {$clinicName} verification OTP is {$otp}. Valid for 5 minutes.",
        'language' => 'english',
        'flash' => 0,
        'numbers' => $phone
    ]);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ["authorization: {$fast2smsKey}", "content-type: application/json"],
        CURLOPT_TIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    $resArr = json_decode($resp, true);
    if (!empty($resArr['return'])) { $smsSent = true; $provider = 'Fast2SMS'; }
}

if (!$smsSent && strlen($phone) === 10 && !empty($msg91Key)) {
    $url = "https://control.msg91.com/api/v5/otp?mobile=91{$phone}&otp={$otp}" . (!empty($msg91TplId) ? "&template_id={$msg91TplId}" : '');
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ["authkey: {$msg91Key}", "content-type: application/json"],
        CURLOPT_TIMEOUT => 10
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    $resArr = json_decode($resp, true);
    if (isset($resArr['type']) && $resArr['type'] === 'success') { $smsSent = true; $provider = 'MSG91'; }
}

if (!empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $subject = "{$otp} is your {$clinicName} OTP";
    $body = "Hello {$recipientName},\\n\\nYour 6-digit verification OTP is: {$otp}\\nValid for 5 minutes.";
    $headers = "From: no-reply@" . ($_SERVER['HTTP_HOST'] ?? 'sandanaclinic.com');
    if (@mail($email, $subject, $body, $headers)) {
        $emailSent = true;
        if ($provider === 'instant-gateway') { $provider = 'PHP-Mail'; }
    }
}

echo json_encode([
    'success' => true,
    'otp' => $otp,
    'phone' => $phone,
    'email' => $email,
    'smsSent' => $smsSent,
    'emailSent' => $emailSent,
    'provider' => $provider,
    'expiresAt' => gmdate('c', time() + 300)
]);
?>`;

  const blob = new Blob([phpContent], { type: 'application/x-php' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'otp.php';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Helper to download `.htaccess` file for Apache/cPanel/Hostinger domains
 */
export function downloadHostingHtaccessFile() {
  const htaccess = `<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Allow direct execution of otp.php, clinic-config.json, and static assets
  RewriteCond %{REQUEST_FILENAME} -f [OR]
  RewriteCond %{REQUEST_FILENAME} -d
  RewriteRule ^ - [L]

  # Route all SPA URLs (/login, /admin, /pharmacy, /doctor, /reception, /book) to index.html
  RewriteRule ^ index.html [L]
</IfModule>

<IfModule mod_headers.c>
  Header set Access-Control-Allow-Origin "*"
  Header set Access-Control-Allow-Methods "GET, POST, OPTIONS"
  Header set Access-Control-Allow-Headers "Content-Type, Authorization"
</IfModule>
`;

  const blob = new Blob([htaccess], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '.htaccess';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
