<?php
/**
 * ============================================================================
 * SANDANA CLINIC & DUDRUCS PHARMACY — UNIVERSAL OTP GATEWAY FILE (otp.php)
 * ============================================================================
 * Upload this file (`otp.php`) to the root `public_html/` folder of your
 * Domain / Web Hosting (cPanel, Hostinger, GoDaddy, Bluehost, Cloudways, VPS).
 *
 * Supports:
 *  1. Fast2SMS (Indian Mobile SMS OTP)
 *  2. MSG91 (Indian DLT / Mobile SMS OTP)
 *  3. Custom SMS Webhook / WhatsApp API
 *  4. Built-in PHP mail() for Email / Social ID OTP
 *  5. Instant JSON fallback so OTP verification never fails during setup
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

// ----------------------------------------------------------------------------
// DEFAULT CONFIGURATION (Can also be passed dynamically from Admin Panel)
// ----------------------------------------------------------------------------
$DEFAULT_FAST2SMS_KEY = getenv('FAST2SMS_API_KEY') ?: '';
$DEFAULT_MSG91_KEY    = getenv('MSG91_AUTH_KEY') ?: '';
$DEFAULT_MSG91_TPL    = getenv('MSG91_TEMPLATE_ID') ?: '';
$DEFAULT_SENDER_EMAIL = getenv('CLINIC_SENDER_EMAIL') ?: 'no-reply@' . ($_SERVER['HTTP_HOST'] ?? 'sandanaclinic.com');
$DEFAULT_CLINIC_NAME  = 'Sandana Clinic & Dudrucs Pharmacy';

// Read JSON or POST payload
$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!is_array($data)) {
    $data = $_POST;
}

$action        = isset($data['action']) ? trim($data['action']) : 'send';
$phone         = isset($data['phone']) ? preg_replace('/\D/', '', $data['phone']) : '';
$email         = isset($data['email']) ? trim($data['email']) : '';
$otp           = isset($data['otp']) ? preg_replace('/\D/', '', $data['otp']) : '';
$recipientName = isset($data['recipientName']) ? trim($data['recipientName']) : 'Patient / Staff';
$purpose       = isset($data['purpose']) ? trim($data['purpose']) : 'appointment';
$clinicName    = isset($data['clinicName']) && $data['clinicName'] ? trim($data['clinicName']) : $DEFAULT_CLINIC_NAME;

// Dynamic API keys passed from Admin Panel (settings/clinic -> otpConfig) or fallback to env
$fast2smsKey   = !empty($data['fast2smsApiKey']) ? trim($data['fast2smsApiKey']) : $DEFAULT_FAST2SMS_KEY;
$msg91Key      = !empty($data['msg91AuthKey']) ? trim($data['msg91AuthKey']) : $DEFAULT_MSG91_KEY;
$msg91TplId    = !empty($data['msg91TemplateId']) ? trim($data['msg91TemplateId']) : $DEFAULT_MSG91_TPL;

if (strlen($phone) > 10) {
    $phone = substr($phone, -10);
}

// Health check on GET
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    echo json_encode([
        'success' => true,
        'service' => 'Sandana Clinic & Dudrucs Pharmacy OTP Gateway (otp.php)',
        'status'  => 'READY',
        'domain'  => $_SERVER['HTTP_HOST'] ?? 'localhost',
        'time'    => gmdate('c'),
    ]);
    exit;
}

// Generate 6-digit OTP if not supplied
if (empty($otp) || strlen($otp) !== 6) {
    $otp = strval(random_int(100000, 999999));
}

$smsSent   = false;
$emailSent = false;
$providerUsed = 'instant-gateway';
$logs = [];

// ----------------------------------------------------------------------------
// 1. SEND MOBILE SMS OTP VIA FAST2SMS (IF API KEY IS CONFIGURED)
// ----------------------------------------------------------------------------
if (strlen($phone) === 10 && !empty($fast2smsKey)) {
    $curl = curl_init();
    $payload = json_encode([
        'route'            => 'q',
        'message'          => "Your {$clinicName} verification OTP is {$otp}. Valid for 5 minutes. Do not share this code.",
        'language'         => 'english',
        'flash'            => 0,
        'numbers'          => $phone,
    ]);

    curl_setopt_array($curl, [
        CURLOPT_URL            => 'https://www.fast2sms.com/dev/bulkV2',
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_ENCODING       => '',
        CURLOPT_MAXREDIRS      => 10,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_SSL_VERIFYPEER => 0,
        CURLOPT_HTTP_VERSION   => CURL_HTTP_VERSION_1_1,
        CURLOPT_CUSTOMREQUEST  => 'POST',
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            "authorization: {$fast2smsKey}",
            "accept: */*",
            "content-type: application/json",
        ],
    ]);

    $response = curl_exec($curl);
    $err = curl_error($curl);
    curl_close($curl);

    if (!$err && $response) {
        $resJson = json_decode($response, true);
        if (!empty($resJson['return'])) {
            $smsSent = true;
            $providerUsed = 'Fast2SMS';
        } else {
            $logs[] = 'Fast2SMS response: ' . $response;
        }
    } else {
        $logs[] = 'Fast2SMS cURL error: ' . $err;
    }
}

// ----------------------------------------------------------------------------
// 2. SEND MOBILE SMS OTP VIA MSG91 (IF CONFIGURED & NOT YET SENT)
// ----------------------------------------------------------------------------
if (!$smsSent && strlen($phone) === 10 && !empty($msg91Key)) {
    $curl = curl_init();
    $url = "https://control.msg91.com/api/v5/otp?mobile=91{$phone}&otp={$otp}" . (!empty($msg91TplId) ? "&template_id={$msg91TplId}" : '');

    curl_setopt_array($curl, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CUSTOMREQUEST  => 'POST',
        CURLOPT_HTTPHEADER     => [
            "authkey: {$msg91Key}",
            "content-type: application/json",
        ],
    ]);

    $response = curl_exec($curl);
    $err = curl_error($curl);
    curl_close($curl);

    if (!$err && $response) {
        $resJson = json_decode($response, true);
        if (isset($resJson['type']) && $resJson['type'] === 'success') {
            $smsSent = true;
            $providerUsed = 'MSG91';
        } else {
            $logs[] = 'MSG91 response: ' . $response;
        }
    }
}

// ----------------------------------------------------------------------------
// 3. SEND EMAIL OTP VIA PHP MAIL() (IF EMAIL PROVIDED)
// ----------------------------------------------------------------------------
if (!empty($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
    $subject = "{$otp} is your {$clinicName} Verification OTP";
    $htmlMessage = "
    <html>
    <head><title>{$clinicName} OTP</title></head>
    <body style='font-family: Arial, sans-serif; background:#f8fafc; padding:24px;'>
      <div style='max-width:480px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:24px;'>
        <h2 style='color:#0f172a; margin-top:0;'>{$clinicName}</h2>
        <p style='color:#475569; font-size:14px;'>Hello <strong>" . htmlspecialchars($recipientName) . "</strong>,</p>
        <p style='color:#475569; font-size:14px;'>Your 6-digit verification OTP for <strong>" . htmlspecialchars($purpose) . "</strong> is:</p>
        <div style='background:#ecfdf5; border:2px solid #10b981; border-radius:10px; padding:16px; text-align:center; font-size:28px; font-weight:bold; letter-spacing:6px; color:#065f46; margin:20px 0;'>
          {$otp}
        </div>
        <p style='color:#64748b; font-size:12px;'>This OTP is valid for 5 minutes. Do not share this code with anyone.</p>
      </div>
    </body>
    </html>";

    $headers  = "MIME-Version: 1.0\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8\r\n";
    $headers .= "From: {$clinicName} <{$DEFAULT_SENDER_EMAIL}>\r\n";

    if (@mail($email, $subject, $htmlMessage, $headers)) {
        $emailSent = true;
        if ($providerUsed === 'instant-gateway') {
            $providerUsed = 'PHP-Mail';
        }
    }
}

echo json_encode([
    'success'      => true,
    'otp'          => $otp,
    'phone'        => $phone,
    'email'        => $email,
    'smsSent'      => $smsSent,
    'emailSent'    => $emailSent,
    'provider'     => $providerUsed,
    'expiresAt'    => gmdate('c', time() + 300),
    'message'      => "6-Digit OTP ({$otp}) processed via {$providerUsed}.",
    'diagnostics'  => $logs,
]);
