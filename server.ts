import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import {
  SQL_TABLES,
  SqlTableName,
  bulkSyncToSql,
  connectRemoteMySql,
  deleteSqlRecord,
  executeReadOnlySqlQuery,
  generateMySqlDump,
  generatePhpMysqlConnectorFile,
  getAllSqlCollections,
  getSqlEngineStatus,
  getSqlTableRows,
  initSqlEngineFromEnv,
  upsertSqlRecord,
  getSqliteDb,
} from './src/db/sqlEngine.ts';
import { streamManualPdfToResponse } from './src/utils/manualPdfGenerator.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ChatInventoryItem {
  name: string;
  genericName?: string;
  brand?: string;
  unit?: string;
  scheduleType?: string;
  sellPrice: number;
  mrp: number;
  totalStock: number;
  batchNo?: string;
  expiryDate?: string;
}

interface ChatDoctorItem {
  name: string;
  specialization: string;
  qualification: string;
  availableDays: string[];
  availableSlots: string[];
  consultationFee?: number;
  experience?: string;
  languages?: string;
  bio?: string;
}

interface ChatWebsiteContext {
  clinicName: string;
  medicalName: string;
  clinicPhone: string;
  medicalPhone: string;
  clinicAddress: string;
  clinicTimings: string;
  googleMapUrl: string;
  clinicInfo: string;
  websiteContent: string;
  inventory: ChatInventoryItem[];
  doctors: ChatDoctorItem[];
}

function buildSmartFallbackReply(
  message: string,
  ctx: ChatWebsiteContext
): string {
  const {
    inventory,
    doctors,
    clinicName,
    medicalName,
    clinicPhone,
    medicalPhone,
    clinicAddress,
    clinicTimings,
    googleMapUrl,
    clinicInfo,
    websiteContent,
  } = ctx;

  const q = message.toLowerCase().trim();
  const isHindiOrHinglish =
    /[अ-ह]/.test(message) ||
    /\b(kya|kaise|kaha|kab|hai|hain|namaste|dawa|dawai|bukhar|dard|doctor|fees|timing|rate|kitna|chahiye|milega|batao|bataiye|madad|appointment|dukan|store)\b/i.test(
      q
    );

  // 1. Polite Greetings & Small Talk ("namaste", "hi", "hello", "kaise ho")
  if (
    /^(hi|hello|hey|namaste|namaskar|pranam|good morning|good afternoon|good evening|hii+|helo|kaise ho|kya haal hai|help|madad)$/i.test(
      q.replace(/[!?.,]/g, '').trim()
    )
  ) {
    if (isHindiOrHinglish) {
      return `Namaste! 🙏 **${clinicName} & ${medicalName} Medical Store** me aapka swagat hai!\n\nMain aapki kya madad kar sakta hoon? Aap mujhse pooch sakte hain:\n• 💊 **Kisi bhi dawa (Medicine) ka Live Stock aur Price** (jaise *"Dolo 650 hai kya?"*)\n• 👨‍⚕️ **Specialist Doctors, OPD Timings aur Consultation Fee**\n• 📅 **Mobile OTP se Online Appointment kaise book karein**\n• 📍 **Clinic ka Address, Google Maps Location aur Contact Number**\n\nBataiye, aaj main aapki kya seva karoon? 😊`;
    }
    return `Namaste & Hello! 🙏 Welcome to **${clinicName} & ${medicalName} Medical Store**.\n\nI have read the live website data and can help you with:\n• 💊 **Live Medicine Stock, Batch & Prices** (e.g. *"Is Dolo 650 available?"*)\n• 👨‍⚕️ **Specialist Doctors, OPD Timings & Consultation Fees**\n• 📅 **Instant Mobile OTP Appointment Booking**\n• 📍 **Clinic Address, Google Maps Directions & WhatsApp Ordering**\n\nHow may I assist you today? 😊`;
  }

  // 2. Check if user is asking about a specific medicine in live inventory
  const matchedMeds = inventory.filter((m) => {
    const mName = m.name.toLowerCase();
    const firstWord = mName.split(/[\s\-()]+/)[0];
    return (
      q.includes(mName) ||
      (firstWord.length >= 3 && q.includes(firstWord)) ||
      (m.brand && q.includes(m.brand.toLowerCase())) ||
      (m.genericName &&
        m.genericName
          .toLowerCase()
          .split(/[+\s,]+/)
          .some((part) => part.length > 3 && q.includes(part)))
    );
  });

  if (matchedMeds.length > 0) {
    const lines = matchedMeds.map((m) => {
      const status =
        m.totalStock > 0
          ? `✅ **Available in Stock** (${m.totalStock} ${m.unit || 'units'} ready)`
          : '❌ Currently Out of Stock';
      const savings =
        m.mrp > m.sellPrice
          ? ` (Save ₹${(m.mrp - m.sellPrice).toFixed(2)} off MRP ₹${m.mrp})`
          : ` (MRP ₹${m.mrp})`;
      return `• **${m.name}** (${m.genericName || m.brand || 'Genuine Batch'})\n  ${status}\n  💰 **Price: ₹${m.sellPrice}**${savings}${m.batchNo ? ` | Batch: ${m.batchNo}` : ''}${m.expiryDate ? ` | Exp: ${m.expiryDate}` : ''}`;
    });

    return `Ji bilkul! **${medicalName} Medical Store (Live Marg ERP)** ke anusar aapki dawa ki jankari yahan hai:\n\n${lines.join(
      '\n\n'
    )}\n\n📲 Aap Home Page ke **"Check Medicine Availability"** box se bhi check kar sakte hain ya **WhatsApp (${medicalPhone || clinicPhone})** par turant order kar sakte hain!`;
  }

  // 3. Health Symptoms / Common Ailments ("bukhar", "fever", "cold", "pain", "sugar", "bp", "acidity")
  if (
    /\b(bukhar|fever|dard|pain|headache|sir dard|khansi|cough|cold|zukam|acidity|gas|pet|stomach|sugar|diabetes|bp|blood pressure|infection|allergy|weakness|kamzori|skin|child|bacha)\b/i.test(
      q
    )
  ) {
    const docLines = doctors
      .slice(0, 3)
      .map(
        (d) =>
          `• **${d.name}** (${d.specialization}, ${d.qualification}) — Fee: **₹${d.consultationFee ?? 300}** | Slots: ${d.availableSlots.slice(0, 3).join(', ')}`
      )
      .join('\n');

    return `Aapki sehat hamare liye sabse zaroori hai! 🙏\n\nAgar aapko **${message}** ki takleef hai, to kripya hamare Specialist Doctor se salah lein:\n\n${docLines}\n\n💊 **${medicalName} Medical Store** par Bukhar, Dard, Acidity, Infection aur BP/Sugar ki sabhi 100% genuine FIFO batch-tested dawaiyan (*Dolo 650, Pan-D, Augmentin 625, Azithral 500, Montair LC, Ascoril LS, Shelcal 500*) uplabdh hain.\n\n👉 Aap upar **"Book Appointment"** button daba kar 10-digit Mobile OTP se turant Doctor ka token book kar sakte hain!`;
  }

  // 4. Location, Address, Google Maps, Timings, Contact Number
  if (
    /\b(address|location|kaha|kahan|map|direction|rasta|jagah|phone|number|contact|call|whatsapp|timing|time|kab khulta|open|close|hours)\b/i.test(
      q
    )
  ) {
    return `📍 **${clinicName} & ${medicalName} Medical Store — Location & Contact Details:**\n\n• **Address:** ${clinicAddress}\n• **OPD & Store Timings:** ${clinicTimings}\n• **Clinic Reception Phone:** ${clinicPhone}\n• **Pharmacy / WhatsApp Order:** ${medicalPhone || clinicPhone}\n• **Google Maps Direction Link:** ${googleMapUrl || 'Available in Location Section on Home Page'}\n\nAap Home Page par **"Open in Google Maps"** ya **"Get Directions"** button par click karke seedhe clinic ka rasta dekh sakte hain! 😊`;
  }

  // 5. General Medicine / Pharmacy / Payment / Excel / Stock Inquiry
  if (
    /\b(medicine|dawa|dawai|stock|tablet|syrup|capsule|available|price|rate|pharmacy|medical|store|online payment|razorpay|upi|order|delivery)\b/i.test(
      q
    )
  ) {
    const inStockMeds = inventory.filter((m) => m.totalStock > 0).slice(0, 8);
    const listStr = inStockMeds
      .map(
        (m) =>
          `• **${m.name}** (${m.genericName || 'Genuine'}) — **₹${m.sellPrice}** (MRP ₹${m.mrp}, Stock: ${m.totalStock})`
      )
      .join('\n');

    return `💊 **${medicalName} Medical Store (Live Marg ERP Inventory)** me abhi **${inventory.length}+ genuine medicines** stock me hain:\n\n${listStr}\n\n✨ **Khaas Suvidhayein:**\n• 100% Genuine FIFO Batch & Expiry Tracked Medicines\n• **Razorpay Online Payment**, **UPI QR Code**, aur **Cash** ki suvidha\n• **WhatsApp (${medicalPhone || clinicPhone})** par parchi bhej kar dawa mangwane ki suvidha\n\nKisi bhi dawa ka naam likh kar mujhse uska exact rate aur stock poochiye!`;
  }

  // 6. Doctors, OPD Fees, Appointment Booking, OTP
  if (
    /\b(doctor|dr|specialist|appointment|book|token|opd|fee|fees|charges|slot|otp|consult)\b/i.test(
      q
    )
  ) {
    const docLines = doctors
      .map(
        (d) =>
          `• **${d.name}** — *${d.specialization}* (${d.qualification})\n  💰 Fee: **₹${d.consultationFee ?? 300}** | 🗓️ Days: ${d.availableDays.join(', ')}\n  ⏰ Slots: ${d.availableSlots.join(', ')}`
      )
      .join('\n\n');

    return `👨‍⚕️ **${clinicName} — Specialist Doctors & OPD Schedule:**\n\n${docLines}\n\n📲 **Appointment Kaise Book Karein?**\n1. Website par **"Book Appointment"** button par click karein.\n2. Apne Doctor aur Time Slot ko chunein.\n3. Apna 10-digit Mobile Number daal kar submit karein — bina OTP ke turant **Instant OPD Queue Token** mil jayega!`;
  }

  // 7. Website / About Us / Services / General Question using scraped websiteContent
  if (websiteContent && websiteContent.length > 40) {
    const docCount = doctors.length;
    const medCount = inventory.length;
    return `Namaste! 🙏 Main **${clinicName} & ${medicalName} Medical Store** ka AI Assistant hoon. Maine poori website padh li hai aur main aapko har jankari de sakta hoon:\n\n• 🏥 **About Clinic:** ${clinicInfo || `${clinicName} provides trusted outpatient care, specialist consultations, and 24/7 emergency support.`}\n• 👨‍⚕️ **Specialist Doctors (${docCount} Active):** ${doctors.map((d) => `${d.name} (${d.specialization})`).join(', ')}\n• 💊 **Live Pharmacy Stock (${medCount} Medicines):** Real-time Marg ERP batch & price check (*Dolo 650, Augmentin 625, Pan-D, Azithral 500, Telma 40*, etc.)\n• 📍 **Address:** ${clinicAddress}\n• ⏰ **Timings:** ${clinicTimings}\n• 📞 **Helpline:** ${clinicPhone} | **Pharmacy WhatsApp:** ${medicalPhone || clinicPhone}\n\nAap mujhse kisi bhi **Doctor ka samay/fees**, **Dawa ka price/stock**, ya **Appointment book karne** ke baare me Hindi ya English me pooch sakte hain! 😊`;
  }

  return `Namaste! 🙏 **${clinicName} & ${medicalName} Medical Store** me aapka swagat hai!\n\nMain aapki madad ke liye hamesha taiyar hoon:\n1. 💊 **Dawa ka Stock & Rate:** Kisi bhi medicine ka naam likhein (jaise *"Dolo 650 price"* ya *"Pan-D stock"*).\n2. 👨‍⚕️ **Doctor & Fees:** Poochiye *"Aaj kaun se doctor available hain?"*\n3. 📅 **Appointment Booking:** 10-digit Mobile Number se bina OTP ke turant OPD token book karein.\n4. 📍 **Address & Map:** ${clinicAddress} (Ph: **${clinicPhone}**)\n\nBataiye, main aapki kya madad karoon? 😊`;
}

async function startServer() {
  await initSqlEngineFromEnv();

  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '15mb' }));

  app.post('/api/chat', async (req, res) => {
    const {
      message = '',
      history = [],
      inventory = [],
      doctors = [],
      clinicName = 'Sandana Clinic',
      medicalName = 'Dudrucs',
      clinicPhone = '+91 98400 11223',
      medicalPhone = '+91 98400 99887',
      clinicAddress = '42, MG Healthcare Road, Anna Nagar, Chennai - 600040',
      clinicTimings = 'Mon - Sat: 09:00 AM - 09:00 PM | Sun: 10:00 AM - 02:00 PM',
      googleMapUrl = '',
      clinicInfo = '',
      websiteContent = '',
    } = req.body || {};

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Message is required' });
      return;
    }

    const ctx: ChatWebsiteContext = {
      clinicName,
      medicalName,
      clinicPhone,
      medicalPhone: medicalPhone || clinicPhone,
      clinicAddress,
      clinicTimings,
      googleMapUrl,
      clinicInfo,
      websiteContent: String(websiteContent || '').slice(0, 6000),
      inventory: Array.isArray(inventory) ? inventory : [],
      doctors: Array.isArray(doctors) ? doctors : [],
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const reply = buildSmartFallbackReply(message, ctx);
      res.json({ reply, source: 'clinic-assistant' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const inventorySummary =
        ctx.inventory.length > 0
          ? ctx.inventory
              .map(
                (m: ChatInventoryItem) =>
                  `- ${m.name} (Generic/Salt: ${m.genericName || 'N/A'}, Brand: ${m.brand || 'N/A'}, Batch: ${m.batchNo || 'FIFO'}, Stock: ${m.totalStock} ${m.unit || 'units'}, Selling Price: ₹${m.sellPrice}, MRP: ₹${m.mrp}, Expiry: ${m.expiryDate || 'Valid'})`
              )
              .join('\n')
          : 'No inventory loaded.';

      const doctorsSummary =
        ctx.doctors.length > 0
          ? ctx.doctors
              .map(
                (d: ChatDoctorItem) =>
                  `- ${d.name} (${d.specialization}, ${d.qualification}, Exp: ${d.experience || '15+ Yrs'}) | Consultation Fee: ₹${d.consultationFee ?? 300} | Available Days: ${(d.availableDays || []).join(', ')} | Slots: ${(d.availableSlots || []).join(', ')} | Bio: ${d.bio || 'Specialist Doctor'}`
              )
              .join('\n')
          : 'No doctors loaded.';

      const recentHistory = Array.isArray(history)
        ? history
            .slice(-8)
            .map(
              (h: { role: string; text: string }) =>
                `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`
            )
            .join('\n')
        : '';

      const systemInstruction = `You are the official, warm, polite, and highly knowledgeable AI Receptionist & Pharmacy Assistant for "${ctx.clinicName} & ${ctx.medicalName} Medical Store".
You have read the entire website and are connected live to the clinic's doctor schedule and the pharmacy's Marg ERP 9+ inventory.

COMPLETE WEBSITE & CLINIC INFORMATION:
- Clinic Name: ${ctx.clinicName}
- Pharmacy / Medical Store Name: ${ctx.medicalName} Medical Store
- Full Address: ${ctx.clinicAddress}
- Google Maps Link: ${ctx.googleMapUrl || 'Available in the Location section on the Home page'}
- Clinic OPD Timings: ${ctx.clinicTimings}
- Clinic Helpline Phone: ${ctx.clinicPhone}
- Pharmacy / WhatsApp Medicine Order Phone: ${ctx.medicalPhone}
- About Clinic: ${ctx.clinicInfo || 'Multi-specialty family healthcare clinic with instant digital appointments and genuine FIFO batch-tracked pharmacy.'}
- Online Payment Options at Pharmacy: Razorpay Online Payment Gateway (UPI, Cards, Netbanking, Wallets), Instant UPI QR Code, and Cash.
- Appointment Booking Process: Patients can click "Book Appointment" on the website, select their preferred Specialist Doctor and Time Slot, enter their mandatory 10-digit Mobile Number, and get an instant OPD Queue Token directly (no OTP required for appointment booking). Staff and Admin login portals use Email OTP verification.

LIVE ${ctx.medicalName.toUpperCase()} PHARMACY ERP INVENTORY (Real-time stock, batch, MRP & selling prices):
${inventorySummary}

LIVE ${ctx.clinicName.toUpperCase()} SPECIALIST DOCTORS & OPD SLOTS:
${doctorsSummary}

LIVE WEBSITE PAGE CONTENT SNAPSHOT:
${ctx.websiteContent || 'Home Page: We Care About Your Health, Specialist Doctors, Live Medicine Stock Search, Google Maps Location, Patient Reviews, and 24/7 Emergency Support.'}

HOW TO TALK TO THE USER:
1. Be extremely polite, warm, caring, and respectful (use "Namaste! 🙏", "Ji bilkul", "Aapka swagat hai" when conversing in Hindi/Hinglish, or warm professional English if the user writes in English).
2. Always match the user's language naturally (Hindi, Hinglish, or English).
3. Answer directly from the live website data above:
   - If asked about a medicine, state whether it is In Stock, exact quantity available, Selling Price (₹), MRP (₹), Batch No, and Expiry Date, and mention they can order via WhatsApp (${ctx.medicalPhone}).
   - If asked about doctors, fees, or timings, give the exact doctor names, qualifications, consultation fees (₹), available days, and time slots.
   - If asked about symptoms (fever, cold, pain, acidity, etc.), respond empathetically, suggest consulting the relevant specialist doctor at ${ctx.clinicName}, and mention relevant OTC/stock availability at ${ctx.medicalName} Medical Store (with a gentle reminder to consult a doctor for prescription medicines).
   - Keep responses well-structured with bullet points and bold highlights so they are easy to read.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: `${recentHistory ? `RECENT CONVERSATION:\n${recentHistory}\n\n` : ''}User Message: ${message}`,
        config: {
          systemInstruction,
        },
      });

      const replyText =
        response.text || buildSmartFallbackReply(message, ctx);

      res.json({ reply: replyText, source: 'gemini-3.8-flash' });
    } catch (error) {
      console.error('Gemini API error, using smart clinic fallback:', error);
      const reply = buildSmartFallbackReply(message, ctx);
      res.json({ reply, source: 'clinic-assistant' });
    }
  });

  // Social OAuth URL constructor for popup flow (Google+, Facebook, X, Instagram)
  app.get('/api/auth/social/url', (req, res) => {
    const provider = String(req.query.provider || 'google_plus').toLowerCase();
    const baseUrl =
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
    const redirectUri = `${baseUrl.replace(/\/$/, '')}/auth/callback`;

    const clientIdMap: Record<string, string | undefined> = {
      google_plus: process.env.GOOGLE_CLIENT_ID || process.env.CLIENT_ID,
      facebook: process.env.FACEBOOK_CLIENT_ID || process.env.CLIENT_ID,
      x: process.env.X_CLIENT_ID || process.env.TWITTER_CLIENT_ID || process.env.CLIENT_ID,
      instagram: process.env.INSTAGRAM_CLIENT_ID || process.env.CLIENT_ID,
    };

    const clientId = clientIdMap[provider];
    if (!clientId) {
      res.json({
        configured: false,
        provider,
        redirectUri,
        url: null,
      });
      return;
    }

    let authUrl = '';
    if (provider === 'facebook') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'public_profile,email',
        state: provider,
      });
      authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
    } else if (provider === 'x') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'tweet.read users.read',
        state: provider,
        code_challenge: 'challenge',
        code_challenge_method: 'plain',
      });
      authUrl = `https://twitter.com/i/oauth2/authorize?${params}`;
    } else if (provider === 'instagram') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'user_profile',
        state: provider,
      });
      authUrl = `https://api.instagram.com/oauth/authorize?${params}`;
    } else {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state: provider,
      });
      authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }

    res.json({
      configured: true,
      provider,
      redirectUri,
      url: authUrl,
    });
  });

  // OAuth Popup Callback Handler (posts message back to iframe window and closes popup)
  app.get(['/auth/callback', '/auth/callback/'], (req, res) => {
    const provider = String(req.query.state || 'social');
    const code = String(req.query.code || '');
    res.send(`
      <html>
        <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #0f172a; color: #fff;">
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                provider: ${JSON.stringify(provider)},
                code: ${JSON.stringify(code)}
              }, '*');
              window.close();
            } else {
              window.location.href = '/login';
            }
          </script>
          <p>Social Authentication successful. Sending 6-Digit OTP verification...</p>
        </body>
      </html>
    `);
  });

  // Universal Server-Side OTP Gateway Endpoint (/api/otp/send & /otp.php fallback for Node.js hosting)
  app.get('/api/otp/status', (req, res) => {
    res.json({
      success: true,
      service: 'Sandana Clinic & Dudrucs Pharmacy Universal OTP Gateway',
      status: 'READY',
      domain: req.get('host') || 'localhost',
      fast2smsConfigured: Boolean(process.env.FAST2SMS_API_KEY),
      msg91Configured: Boolean(process.env.MSG91_AUTH_KEY),
      time: new Date().toISOString(),
    });
  });

  app.post(['/api/otp/send', '/otp.php'], async (req, res) => {
    const {
      phone = '',
      email = '',
      otp = '',
      recipientName = 'Patient / Staff',
      purpose = 'appointment',
      clinicName = 'Sandana Clinic & Dudrucs Pharmacy',
      fast2smsApiKey = '',
      msg91AuthKey = '',
      msg91TemplateId = '',
      customWebhookUrl = '',
    } = req.body || {};

    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const finalOtp =
      String(otp).replace(/\D/g, '').length === 6
        ? String(otp).replace(/\D/g, '')
        : Math.floor(100000 + Math.random() * 900000).toString();

    const activeFast2SmsKey =
      String(fast2smsApiKey || process.env.FAST2SMS_API_KEY || '').trim();
    const activeMsg91Key =
      String(msg91AuthKey || process.env.MSG91_AUTH_KEY || '').trim();
    const activeMsg91Tpl =
      String(msg91TemplateId || process.env.MSG91_TEMPLATE_ID || '').trim();
    const activeWebhook =
      String(customWebhookUrl || process.env.OTP_WEBHOOK_URL || '').trim();

    let smsSent = false;
    let providerUsed = 'instant-gateway';
    const diagnostics: string[] = [];

    // 1. Try Fast2SMS if key is configured
    if (cleanPhone.length === 10 && activeFast2SmsKey) {
      try {
        const fRes = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            authorization: activeFast2SmsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            route: 'q',
            message: `Your ${clinicName} verification OTP is ${finalOtp}. Valid for 5 minutes. Do not share this code.`,
            language: 'english',
            flash: 0,
            numbers: cleanPhone,
          }),
        });
        const fJson: any = await fRes.json().catch(() => ({}));
        if (fJson?.return) {
          smsSent = true;
          providerUsed = 'Fast2SMS';
        } else {
          diagnostics.push(`Fast2SMS: ${JSON.stringify(fJson)}`);
        }
      } catch (err: any) {
        diagnostics.push(`Fast2SMS error: ${err?.message || 'failed'}`);
      }
    }

    // 2. Try MSG91 if configured and not yet sent
    if (!smsSent && cleanPhone.length === 10 && activeMsg91Key) {
      try {
        const url = `https://control.msg91.com/api/v5/otp?mobile=91${cleanPhone}&otp=${finalOtp}${
          activeMsg91Tpl ? `&template_id=${encodeURIComponent(activeMsg91Tpl)}` : ''
        }`;
        const mRes = await fetch(url, {
          method: 'POST',
          headers: {
            authkey: activeMsg91Key,
            'Content-Type': 'application/json',
          },
        });
        const mJson: any = await mRes.json().catch(() => ({}));
        if (mJson?.type === 'success') {
          smsSent = true;
          providerUsed = 'MSG91';
        } else {
          diagnostics.push(`MSG91: ${JSON.stringify(mJson)}`);
        }
      } catch (err: any) {
        diagnostics.push(`MSG91 error: ${err?.message || 'failed'}`);
      }
    }

    // 3. Try Custom Webhook / External PHP OTP Endpoint if configured
    if (!smsSent && activeWebhook && activeWebhook.startsWith('http')) {
      try {
        const wRes = await fetch(activeWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: cleanPhone,
            email,
            otp: finalOtp,
            recipientName,
            purpose,
            clinicName,
          }),
        });
        if (wRes.ok) {
          smsSent = true;
          providerUsed = 'Custom-Webhook';
        }
      } catch (err: any) {
        diagnostics.push(`Webhook error: ${err?.message || 'failed'}`);
      }
    }

    res.json({
      success: true,
      otp: finalOtp,
      phone: cleanPhone,
      email,
      smsSent,
      provider: providerUsed,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      message: `6-Digit OTP (${finalOtp}) processed via ${providerUsed}.`,
      diagnostics,
    });
  });

  // ============================================================================
  // RELATIONAL SQL & MYSQL DATABASE ENGINE ENDPOINTS (/api/sql/*)
  // ============================================================================
  app.get('/api/sql/status', (_req, res) => {
    try {
      res.json({
        success: true,
        ...getSqlEngineStatus(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to read SQL database status',
      });
    }
  });

  app.post('/api/sql/connect-mysql', async (req, res) => {
    const {
      host = '',
      port = 3306,
      user = '',
      password = '',
      database = '',
      ssl = false,
    } = req.body || {};

    if (!host || !user || !database) {
      res.status(400).json({
        success: false,
        error: 'MySQL Host, Username, and Database Name are required.',
      });
      return;
    }

    const result = await connectRemoteMySql({
      host: String(host).trim(),
      port: Number(port || 3306),
      user: String(user).trim(),
      password: String(password || ''),
      database: String(database).trim(),
      ssl: Boolean(ssl),
    });

    res.json({
      success: result.connected,
      message: result.message,
      status: getSqlEngineStatus(),
    });
  });

  app.get('/api/sql/collections', (_req, res) => {
    try {
      const collections = getAllSqlCollections();
      res.json({
        success: true,
        collections,
        status: getSqlEngineStatus(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to fetch SQL collections',
      });
    }
  });

  app.get('/api/sql/table/:table', (req, res) => {
    const table = String(req.params.table || '') as SqlTableName;
    if (!SQL_TABLES.includes(table)) {
      res.status(400).json({
        success: false,
        error: `Unknown SQL table: ${table}`,
      });
      return;
    }

    const limit = Math.min(Number(req.query.limit || 200), 1000);
    const rows = getSqlTableRows(table, limit);
    res.json({
      success: true,
      table,
      count: rows.length,
      rows,
    });
  });

  app.post('/api/sql/record', async (req, res) => {
    const { table = '', id = '', data = {} } = req.body || {};
    if (!SQL_TABLES.includes(table as SqlTableName) || !id) {
      res.status(400).json({
        success: false,
        error: 'Valid SQL table and record ID are required.',
      });
      return;
    }

    try {
      await upsertSqlRecord(table as SqlTableName, String(id), data || {});
      res.json({
        success: true,
        table,
        id,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to save SQL record',
      });
    }
  });

  app.delete('/api/sql/record/:table/:id', async (req, res) => {
    const table = String(req.params.table || '') as SqlTableName;
    const id = String(req.params.id || '');
    if (!SQL_TABLES.includes(table) || !id) {
      res.status(400).json({
        success: false,
        error: 'Valid SQL table and record ID are required.',
      });
      return;
    }

    try {
      await deleteSqlRecord(table, id);
      res.json({
        success: true,
        table,
        id,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to delete SQL record',
      });
    }
  });

  app.post('/api/sql/sync', async (req, res) => {
    const { collections = {}, replace = false } = req.body || {};
    try {
      const syncResult = await bulkSyncToSql(collections, Boolean(replace));
      res.json({
        success: true,
        ...syncResult,
        status: getSqlEngineStatus(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to bulk sync SQL database',
      });
    }
  });

  app.post('/api/sql/query', (req, res) => {
    const { sql = '' } = req.body || {};
    try {
      const result = executeReadOnlySqlQuery(String(sql || ''));
      res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err?.message || 'SQL query execution failed',
      });
    }
  });

  app.get('/api/sql/dump.sql', (req, res) => {
    try {
      const dbName = String(
        req.query.database || 'sandana_dudrucs_mysql'
      ).replace(/[^a-zA-Z0-9_]/g, '_');
      const sqlDump = generateMySqlDump(dbName);
      res.setHeader('Content-Type', 'application/sql; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Sandana_Dudrucs_MySQL_Database_${new Date()
          .toISOString()
          .slice(0, 10)}.sql"`
      );
      res.send(sqlDump);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to generate MySQL .sql dump',
      });
    }
  });

  app.get('/api/sql/mysql_api.php', (req, res) => {
    const phpCode = generatePhpMysqlConnectorFile({
      host: String(req.query.host || 'localhost'),
      port: Number(req.query.port || 3306),
      database: String(req.query.database || 'sandana_dudrucs_mysql'),
      user: String(req.query.user || 'root'),
      password: String(req.query.password || ''),
    });
    res.setHeader('Content-Type', 'application/x-httpd-php; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="mysql_api.php"'
    );
    res.send(phpCode);
  });

  // ============================================================================
  // AUTOMATED DAILY BACKUP & LIVE ROLLOVER ENGINE (/api/backup/*)
  // ============================================================================
  const BACKUPS_DIR = path.resolve(process.cwd(), 'backups');
  const MANIFEST_PATH = path.join(BACKUPS_DIR, 'backup_manifest.json');

  function ensureBackupDir() {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
  }

  interface BackupManifestRecord {
    date: string;
    timestamp: string;
    trigger: string;
    totalRows: number;
    sqlFileSize: string;
    jsonFileSize: string;
    sqlFile: string;
    jsonFile: string;
    status: 'completed' | 'verified';
  }

  function getBackupManifest(): BackupManifestRecord[] {
    ensureBackupDir();
    if (!fs.existsSync(MANIFEST_PATH)) return [];
    try {
      const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveBackupManifest(list: BackupManifestRecord[]) {
    ensureBackupDir();
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(list, null, 2), 'utf-8');
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  async function performDailyBackup(trigger = 'scheduled'): Promise<BackupManifestRecord> {
    ensureBackupDir();
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10);
    const timestamp = d.toISOString();

    // 1. Generate MySQL SQL Dump
    const sqlContent = generateMySqlDump('sandana_dudrucs_mysql');
    const sqlFileName = `sandana_backup_${dateStr}.sql`;
    const sqlFilePath = path.join(BACKUPS_DIR, sqlFileName);
    fs.writeFileSync(sqlFilePath, sqlContent, 'utf-8');

    // Also update public/database.sql and database.sql so the latest dump is always accessible
    try {
      fs.writeFileSync(path.resolve(process.cwd(), 'public/database.sql'), sqlContent, 'utf-8');
      fs.writeFileSync(path.resolve(process.cwd(), 'database.sql'), sqlContent, 'utf-8');
    } catch (err) {
      console.error('Error writing static database.sql:', err);
    }

    // 2. Generate JSON Snapshot of all collections
    const collections = getAllSqlCollections();
    const jsonContent = JSON.stringify(
      {
        meta: {
          date: dateStr,
          timestamp,
          trigger,
          database: 'sandana_dudrucs_mysql',
          engine: 'Dual-Engine MySQL + Embedded SQLite',
        },
        collections,
      },
      null,
      2
    );
    const jsonFileName = `sandana_backup_${dateStr}.json`;
    const jsonFilePath = path.join(BACKUPS_DIR, jsonFileName);
    fs.writeFileSync(jsonFilePath, jsonContent, 'utf-8');

    // Compute stats
    const sqlStat = fs.statSync(sqlFilePath);
    const jsonStat = fs.statSync(jsonFilePath);
    let totalRows = 0;
    for (const t of Object.keys(collections)) {
      totalRows += (collections as any)[t]?.length || 0;
    }

    const manifest = getBackupManifest();
    const record: BackupManifestRecord = {
      date: dateStr,
      timestamp,
      trigger,
      totalRows,
      sqlFileSize: formatBytes(sqlStat.size),
      jsonFileSize: formatBytes(jsonStat.size),
      sqlFile: sqlFileName,
      jsonFile: jsonFileName,
      status: 'completed',
    };

    const filtered = manifest.filter((m) => m.date !== dateStr);
    const updated = [record, ...filtered].slice(0, 60);
    saveBackupManifest(updated);

    console.log(
      `[DailyBackup] ✅ Daily backup saved for ${dateStr} (${totalRows} records, trigger: ${trigger})`
    );
    return record;
  }

  // Run initial daily backup check on server boot
  performDailyBackup('server_boot').catch((err) =>
    console.error('Initial daily backup error:', err)
  );

  // Background auto-backup scheduler (checks every 30 minutes)
  setInterval(() => {
    const today = new Date().toISOString().slice(0, 10);
    const manifest = getBackupManifest();
    const hasToday = manifest.some((m) => m.date === today);
    if (!hasToday) {
      console.log(`[DailyBackup] Auto-scheduler running daily backup for ${today}...`);
      performDailyBackup('auto_scheduler').catch(console.error);
    }
  }, 30 * 60 * 1000);

  // Endpoints: Status, Run, Download, Restore
  app.get('/api/backup/daily/status', (_req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const manifest = getBackupManifest();
    const lastBackup = manifest[0] || null;

    res.json({
      active: true,
      today,
      lastBackupTime: lastBackup?.timestamp || null,
      nextScheduledBackup: 'Tonight at 00:00:00 (Midnight) & periodic every 24h',
      totalBackups: manifest.length,
      backups: manifest,
    });
  });

  app.post('/api/backup/daily/run', async (req, res) => {
    try {
      const trigger = String(req.body?.trigger || 'manual');
      const record = await performDailyBackup(trigger);
      res.json({
        success: true,
        message: `Daily backup for ${record.date} created successfully.`,
        backup: record,
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Daily backup failed to execute.',
      });
    }
  });

  app.get('/api/backup/daily/download/:date/:format', (req, res) => {
    const date = String(req.params.date || '').replace(/[^0-9\-]/g, '');
    const format = String(req.params.format || 'sql').toLowerCase();

    if (!date) {
      res.status(400).send('Invalid backup date');
      return;
    }

    const fileName =
      format === 'json'
        ? `sandana_backup_${date}.json`
        : `sandana_backup_${date}.sql`;
    const filePath = path.join(BACKUPS_DIR, fileName);

    if (!fs.existsSync(filePath)) {
      res.status(404).send(`Backup file for date ${date} not found.`);
      return;
    }

    res.setHeader(
      'Content-Type',
      format === 'json' ? 'application/json' : 'application/sql'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${fileName}"`
    );
    res.sendFile(filePath);
  });

  app.post('/api/backup/daily/restore/:date', async (req, res) => {
    const date = String(req.params.date || '').replace(/[^0-9\-]/g, '');
    const jsonPath = path.join(BACKUPS_DIR, `sandana_backup_${date}.json`);

    if (!fs.existsSync(jsonPath)) {
      res.status(404).json({
        success: false,
        error: `Backup snapshot for ${date} does not exist.`,
      });
      return;
    }

    try {
      const raw = fs.readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(raw);
      const collections = parsed.collections || {};

      const syncResult = await bulkSyncToSql(collections, true);
      res.json({
        success: true,
        message: `Database restored from daily backup ${date}.`,
        syncResult,
        status: getSqlEngineStatus(),
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: err?.message || 'Restore from daily backup failed',
      });
    }
  });

  // Purge single dummy user from SQL database
  app.delete('/api/admin/clean-dummy-user/:id', async (req, res) => {
    try {
      const id = String(req.params.id || '').trim();
      if (!id) {
        res.status(400).json({ success: false, error: 'Missing user id' });
        return;
      }
      await deleteSqlRecord('users', id);
      res.json({ success: true, message: `Deleted ${id} from users table` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Delete failed' });
    }
  });

  // Purge all dummy & test accounts from SQL database
  app.post('/api/admin/clean-dummy-users', async (_req, res) => {
    try {
      const db = getSqliteDb();
      const stmt = db.prepare(`
        DELETE FROM users
        WHERE email != 'kyp04010016@gmail.com'
          AND (
            id LIKE 'portal_%'
            OR id IN ('reception_1', 'pharmacist_1', '9840011223', '9840022334', '9840033445', '9840099999', '9999999999')
            OR email IN (
              'pharmacy@sandanaclinic.com',
              'reception@sandanaclinic.com',
              'doctor@sandanaclinic.com',
              '9840011223@sandanaclinic.com',
              '9840022334@sandanaclinic.com',
              '9840033445@sandanaclinic.com',
              '9840099999@sandanaclinic.com',
              'puja@gmail.com'
            )
            OR name LIKE 'Operator (%'
          )
      `);
      const info = stmt.run();
      res.json({
        success: true,
        message: 'All dummy and test accounts purged from SQL database.',
        deletedCount: info.changes,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Purge failed' });
    }
  });

  // Official Hospital & Marg ERP Manual Direct PDF Download
  app.get('/api/manual/download-pdf', (req, res) => {
    try {
      streamManualPdfToResponse(res, __dirname);
    } catch (err: any) {
      console.error('Failed to stream manual PDF:', err);
      res.status(500).send('Error generating PDF document');
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
