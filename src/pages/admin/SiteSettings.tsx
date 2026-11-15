import React, { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  Save,
  CheckCircle2,
  ImagePlus,
  Trash2,
  Globe,
  QrCode,
  Upload,
  Sparkles,
  Stethoscope,
  CreditCard,
  ShieldCheck,
  MapPin,
  Navigation,
  ExternalLink,
  Server,
  FileCode2,
  Download,
  Smartphone,
} from 'lucide-react';
import { db } from '../../firebase';
import {
  ClinicSettingsDoc,
  DEFAULT_CLINIC_SETTINGS,
  DEFAULT_SITE_SETTINGS,
  SiteSettingsDoc,
} from '../public/Home';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { logStaffActivity } from '../../utils/activityLogger';
import { useAuth } from '../../context/AuthContext';
import {
  DEFAULT_OTP_CONFIG,
  downloadHostingHtaccessFile,
  downloadStandalonePhpOtpFile,
  generateAndSendOTP,
} from '../../utils/emailOTP';
import { seedInitialClinicData } from '../../utils/seedData';
import { downloadSystemBackupJson } from '../../utils/backupRestore';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';

export const SiteSettings: React.FC = () => {
  const { firebaseUser, userProfile } = useAuth();

  const [clinicData, setClinicData] = useState<
    ClinicSettingsDoc & { gstNo?: string; logoUrl?: string }
  >({
    ...DEFAULT_CLINIC_SETTINGS,
    gstNo: '33AABCS1429B1Z5',
    logoUrl: '',
    otpConfig: { ...DEFAULT_OTP_CONFIG },
  });
  const [siteData, setSiteData] = useState<
    SiteSettingsDoc & { logoUrl?: string }
  >({
    ...DEFAULT_SITE_SETTINGS,
    logoUrl: '',
  });
  const [newSlideUrl, setNewSlideUrl] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seedingAll, setSeedingAll] = useState(false);
  const [testingOtp, setTestingOtp] = useState(false);
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);

  useEffect(() => {
    const loadAllSettings = async () => {
      setLoading(true);
      try {
        const [clinicSnap, siteSnap] = await Promise.all([
          getDoc(doc(db, 'settings', 'clinic')),
          getDoc(doc(db, 'settings', 'site')),
        ]);

        let loadedLogo = '';
        let loadedMapUrl = '';

        if (clinicSnap.exists()) {
          const cData = clinicSnap.data() as Partial<ClinicSettingsDoc> & {
            gstNo?: string;
            logoUrl?: string;
            name?: string;
            address?: string;
            phone?: string;
          };
          loadedLogo = cData.logoUrl || '';
          loadedMapUrl = cData.googleMapUrl || '';
          setClinicData((prev) => ({
            ...prev,
            ...cData,
            clinicName: cData.clinicName || cData.name || prev.clinicName,
            clinicAddress:
              cData.clinicAddress || cData.address || prev.clinicAddress,
            clinicPhone: cData.clinicPhone || cData.phone || prev.clinicPhone,
            googleMapUrl:
              cData.googleMapUrl ||
              prev.googleMapUrl ||
              DEFAULT_CLINIC_SETTINGS.googleMapUrl,
            gstNo: cData.gstNo || '33AABCS1429B1Z5',
            logoUrl: cData.logoUrl || '',
            razorpayEnabled:
              typeof cData.razorpayEnabled === 'boolean'
                ? cData.razorpayEnabled
                : true,
            razorpayKeyId:
              cData.razorpayKeyId || 'rzp_test_SandanaDudrucs99',
            razorpayMerchantName:
              cData.razorpayMerchantName ||
              'Sandana Clinic & Dudrucs Pharmacy',
            razorpayThemeColor: cData.razorpayThemeColor || '#0284C7',
            razorpayMode: cData.razorpayMode === 'test' ? 'test' : 'live',
            razorpayMethods: {
              upi: cData.razorpayMethods?.upi !== false,
              card: cData.razorpayMethods?.card !== false,
              netbanking: cData.razorpayMethods?.netbanking !== false,
              wallet: cData.razorpayMethods?.wallet !== false,
            },
            otpConfig: {
              ...DEFAULT_OTP_CONFIG,
              ...(cData.otpConfig || {}),
            },
            defaultMarginPercent:
              typeof cData.defaultMarginPercent === 'number'
                ? cData.defaultMarginPercent
                : 20,
          }));
        }

        if (siteSnap.exists()) {
          const sData = siteSnap.data() as Partial<SiteSettingsDoc> & {
            logoUrl?: string;
          };
          const effectiveLogo = sData.logoUrl || loadedLogo || '';
          const effectiveMapUrl =
            sData.googleMapUrl ||
            sData.socialLinks?.googleMapUrl ||
            loadedMapUrl ||
            DEFAULT_CLINIC_SETTINGS.googleMapUrl ||
            '';
          setSiteData({
            logoUrl: effectiveLogo,
            googleMapUrl: effectiveMapUrl,
            sliderImages:
              Array.isArray(sData.sliderImages) && sData.sliderImages.length > 0
                ? sData.sliderImages
                : DEFAULT_SITE_SETTINGS.sliderImages,
            socialLinks: {
              ...DEFAULT_SITE_SETTINGS.socialLinks,
              ...(sData.socialLinks || {}),
              googleMapUrl: effectiveMapUrl,
            },
            clinicInfo: sData.clinicInfo || DEFAULT_SITE_SETTINGS.clinicInfo,
          });
          setClinicData((prev) => ({
            ...prev,
            logoUrl: effectiveLogo || prev.logoUrl,
            googleMapUrl: effectiveMapUrl || prev.googleMapUrl,
          }));
        }
      } catch (err) {
        console.error('Error loading site/clinic settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAllSettings();
  }, []);

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 320;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png', 0.85);
          setClinicData((prev) => ({ ...prev, logoUrl: dataUrl }));
          setSiteData((prev) => ({ ...prev, logoUrl: dataUrl }));
        }
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddSlideUrl = () => {
    const url = newSlideUrl.trim();
    if (!url) return;
    if (siteData.sliderImages.length >= 15) return;
    setSiteData((prev) => ({
      ...prev,
      sliderImages: [...prev.sliderImages, url],
    }));
    setNewSlideUrl('');
  };

  // Compress uploaded slider image onto a canvas so it fits cleanly in Firestore settings/site
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 1000;
        const scale = Math.min(1, maxW / img.width);
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
          setSiteData((prev) => ({
            ...prev,
            sliderImages: [...prev.sliderImages.slice(0, 14), dataUrl],
          }));
        }
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleRemoveSlide = (index: number) => {
    setSiteData((prev) => ({
      ...prev,
      sliderImages: prev.sliderImages.filter((_, i) => i !== index),
    }));
  };

  const handleSaveAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setToastSuccess(null);

    const effectiveLogoUrl = (clinicData.logoUrl || siteData.logoUrl || '')
      .trim()
      .slice(0, 400000);

    const effectiveMapUrl = (
      clinicData.googleMapUrl ||
      siteData.googleMapUrl ||
      siteData.socialLinks?.googleMapUrl ||
      `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${clinicData.clinicName} ${clinicData.clinicAddress}`
      )}`
    )
      .trim()
      .slice(0, 600);

    const cleanClinic = {
      name: clinicData.clinicName.trim().slice(0, 120),
      address: clinicData.clinicAddress.trim().slice(0, 300),
      phone: clinicData.clinicPhone.trim().slice(0, 30),
      gstNo: (clinicData.gstNo || '33AABCS1429B1Z5').trim().slice(0, 40),
      logoUrl: effectiveLogoUrl,
      googleMapUrl: effectiveMapUrl,
      upiId: clinicData.upiId.trim().slice(0, 100),
      upiName: clinicData.upiName.trim().slice(0, 120),
      razorpayEnabled: clinicData.razorpayEnabled !== false,
      razorpayKeyId: (
        clinicData.razorpayKeyId || 'rzp_test_SandanaDudrucs99'
      )
        .trim()
        .slice(0, 120),
      razorpayMerchantName: (
        clinicData.razorpayMerchantName ||
        'Sandana Clinic & Dudrucs Pharmacy'
      )
        .trim()
        .slice(0, 120),
      razorpayThemeColor: (clinicData.razorpayThemeColor || '#0284C7')
        .trim()
        .slice(0, 30),
      razorpayMode: clinicData.razorpayMode === 'test' ? 'test' : 'live',
      razorpayMethods: {
        upi: clinicData.razorpayMethods?.upi !== false,
        card: clinicData.razorpayMethods?.card !== false,
        netbanking: clinicData.razorpayMethods?.netbanking !== false,
        wallet: clinicData.razorpayMethods?.wallet !== false,
      },
      clinicName: clinicData.clinicName.trim().slice(0, 120),
      clinicAddress: clinicData.clinicAddress.trim().slice(0, 300),
      clinicPhone: clinicData.clinicPhone.trim().slice(0, 30),
      clinicTimings: clinicData.clinicTimings.trim().slice(0, 150),
      medicalName: clinicData.medicalName.trim().slice(0, 120),
      medicalPhone: clinicData.medicalPhone.trim().slice(0, 30),
      defaultMarginPercent: Math.max(
        0,
        Math.min(500, Number(clinicData.defaultMarginPercent ?? 20))
      ),
      otpConfig: {
        enabled: clinicData.otpConfig?.enabled !== false,
        phpOtpEndpoint: (clinicData.otpConfig?.phpOtpEndpoint || '/otp.php')
          .trim()
          .slice(0, 300),
        fast2smsApiKey: (clinicData.otpConfig?.fast2smsApiKey || '')
          .trim()
          .slice(0, 200),
        msg91AuthKey: (clinicData.otpConfig?.msg91AuthKey || '')
          .trim()
          .slice(0, 200),
        msg91TemplateId: (clinicData.otpConfig?.msg91TemplateId || '')
          .trim()
          .slice(0, 120),
        emailJsServiceId: (clinicData.otpConfig?.emailJsServiceId || '')
          .trim()
          .slice(0, 120),
        emailJsTemplateId: (clinicData.otpConfig?.emailJsTemplateId || '')
          .trim()
          .slice(0, 120),
        emailJsPublicKey: (clinicData.otpConfig?.emailJsPublicKey || '')
          .trim()
          .slice(0, 120),
        customWebhookUrl: (clinicData.otpConfig?.customWebhookUrl || '')
          .trim()
          .slice(0, 300),
        showInstantOtpOnScreen:
          clinicData.otpConfig?.showInstantOtpOnScreen !== false,
      },
    };

    const cleanSite: SiteSettingsDoc & { logoUrl?: string } = {
      logoUrl: effectiveLogoUrl,
      googleMapUrl: effectiveMapUrl,
      sliderImages: siteData.sliderImages.slice(0, 20),
      socialLinks: {
        fb: (siteData.socialLinks?.fb || '').trim().slice(0, 300),
        insta: (siteData.socialLinks?.insta || '').trim().slice(0, 300),
        whatsapp: (siteData.socialLinks?.whatsapp || '').trim().slice(0, 100),
        googleMapUrl: effectiveMapUrl,
      },
      clinicInfo: (siteData.clinicInfo || '').trim().slice(0, 1900),
    };

    try {
      await Promise.all([
        setDoc(doc(db, 'settings', 'clinic'), cleanClinic, { merge: true }),
        setDoc(doc(db, 'settings', 'site'), cleanSite, { merge: true }),
        saveRecordToSql('settings', 'clinic', cleanClinic),
        saveRecordToSql('settings', 'site', cleanSite),
      ]);

      await logStaffActivity(
        firebaseUser?.uid || 'admin',
        userProfile?.name || 'Admin',
        'UPDATE_SETTINGS',
        `${userProfile?.name || 'Admin'} updated Domain OTP Gateway, Google Map Link, Razorpay Gateway (${
          cleanClinic.razorpayEnabled ? 'ENABLED' : 'DISABLED'
        }), Clinic Logo, GST No, and UPI Settings`
      );

      setToastSuccess(
        `Saved! Domain OTP Gateway, Clinic Google Maps Link, Razorpay Online Gateway (${
          cleanClinic.razorpayEnabled ? 'ACTIVE' : 'DISABLED'
        }), Brand Logo, Home Slider & UPI QR updated across Home Page & Pharmacy.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'settings/site');
    } finally {
      setSaving(false);
    }
  };

  const handleOneClickDomainStartAllData = async () => {
    setSeedingAll(true);
    setToastSuccess(null);
    try {
      await seedInitialClinicData();
      setToastSuccess(
        'ALL DOMAIN & HOSTING DATA INITIALIZED! Doctors, Pharmacy Medicines, FIFO Batches, Razorpay, Google Maps & OTP Gateway are 100% active.'
      );
    } catch (err: any) {
      setToastSuccess(err?.message || 'Could not initialize sample data.');
    } finally {
      setSeedingAll(false);
    }
  };

  const handleTestLiveOtpGateway = async () => {
    setTestingOtp(true);
    setToastSuccess(null);
    try {
      const testEmail =
        userProfile?.email || firebaseUser?.email || 'kyp04010016@gmail.com';
      const res = await generateAndSendOTP({
        identifier: testEmail,
        email: testEmail,
        recipientName: 'Admin Email OTP Test',
        purpose: 'staff_login',
        deliveryChannel: 'email',
      });
      setToastSuccess(
        `Email OTP Gateway Test Successful! Sent 6-Digit Email OTP: ${
          res.demoOtp || 'Sent'
        } to ${testEmail} via ${res.gatewayProvider || 'Email OTP Gateway'} (${res.message})`
      );
    } catch (err: any) {
      setToastSuccess(err?.message || 'Email OTP Gateway test failed.');
    } finally {
      setTestingOtp(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Marg ERP Style Top Title Bar */}
      <div className="bg-gradient-to-r from-[#000080] via-blue-900 to-indigo-950 text-white px-5 py-3.5 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
            DOMAIN &amp; HOSTING AUTO-START, EMAIL OTP GATEWAY (`otp.php`), GOOGLE MAPS, RAZORPAY &amp; SITE SETTINGS
          </h1>
          <p className="text-[11px] text-blue-200">
            1-Click Download Email OTP File (`otp.php`), `.htaccess`, Full Hosting Data Package, Razorpay Gateway &amp; Google Maps Control
          </p>
        </div>
      </div>

      {toastSuccess && (
        <div className="p-3.5 bg-green-50 border-2 border-green-400 rounded-xl shadow-sm flex items-center gap-2 text-xs font-bold text-green-800 animate-scale-in">
          <CheckCircle2 size={18} className="text-green-600 shrink-0" />
          <span>{toastSuccess}</span>
        </div>
      )}

      <form onSubmit={handleSaveAll} className="space-y-4">
        {/* SECTION: DOMAIN, HOSTING & EMAIL OTP GATEWAY FILE CENTER (otp.php + .htaccess + 1-CLICK DATA START) */}
        <div className="bg-gradient-to-br from-indigo-50/70 via-white to-emerald-50/50 border-2 border-indigo-500/40 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#000080] text-white flex items-center justify-center shrink-0 mt-0.5">
                <Server size={18} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[#000080] font-extrabold text-xs sm:text-sm uppercase tracking-wider">
                    Domain, Web Hosting &amp; Email OTP File Kit (`otp.php` + `.htaccess` + Full Data Auto-Start)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Email OTP Only — Ready for Any Domain / Hosting
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Upload the files below to your Domain / Hosting (cPanel, Hostinger, GoDaddy, VPS, or Cloud) — all data, login portals, Pharmacy ERP, Razorpay, and Email OTP start working immediately!
                </p>
              </div>
            </div>

            {/* 1-Click Hosting & OTP File Download Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => downloadStandalonePhpOtpFile(clinicData.otpConfig)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#000080] hover:bg-blue-900 text-white text-xs font-extrabold rounded-lg shadow-xs cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <FileCode2 size={14} />
                Download `otp.php` (Email OTP)
              </button>

              <button
                type="button"
                onClick={downloadHostingHtaccessFile}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <Download size={14} />
                Download `.htaccess`
              </button>

              <button
                type="button"
                onClick={() =>
                  downloadSystemBackupJson(userProfile?.name || 'Super Admin')
                }
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <Download size={14} />
                Download Full Hosting Data JSON
              </button>

              <button
                type="button"
                disabled={seedingAll}
                onClick={handleOneClickDomainStartAllData}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold rounded-lg shadow-xs cursor-pointer transition-all hover:-translate-y-0.5"
              >
                <Sparkles size={14} />
                {seedingAll
                  ? 'Starting All Data...'
                  : '1-Click Start All Data'}
              </button>
            </div>
          </div>

          {/* Email OTP Gateway Configuration Fields (Mobile & Social OTP Removed) */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Hosting Email OTP File URL (`otp.php`)
              </label>
              <input
                type="text"
                value={clinicData.otpConfig?.phpOtpEndpoint || '/otp.php'}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    otpConfig: {
                      ...DEFAULT_OTP_CONFIG,
                      ...(prev.otpConfig || {}),
                      phpOtpEndpoint: e.target.value,
                    },
                  }))
                }
                placeholder="/otp.php or https://yourdomain.com/otp.php"
                className="w-full px-3 py-2 text-xs font-mono font-bold text-indigo-950 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                EmailJS Service ID (Email OTP)
              </label>
              <input
                type="text"
                value={clinicData.otpConfig?.emailJsServiceId || ''}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    otpConfig: {
                      ...DEFAULT_OTP_CONFIG,
                      ...(prev.otpConfig || {}),
                      emailJsServiceId: e.target.value,
                    },
                  }))
                }
                placeholder="service_xxxxxxx (or uses otp.php mail)"
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                EmailJS Template ID (Email OTP)
              </label>
              <input
                type="text"
                value={clinicData.otpConfig?.emailJsTemplateId || ''}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    otpConfig: {
                      ...DEFAULT_OTP_CONFIG,
                      ...(prev.otpConfig || {}),
                      emailJsTemplateId: e.target.value,
                    },
                  }))
                }
                placeholder="template_xxxxxxx (optional)"
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                EmailJS Public Key (Email OTP)
              </label>
              <input
                type="text"
                value={clinicData.otpConfig?.emailJsPublicKey || ''}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    otpConfig: {
                      ...DEFAULT_OTP_CONFIG,
                      ...(prev.otpConfig || {}),
                      emailJsPublicKey: e.target.value,
                    },
                  }))
                }
                placeholder="public_key_xxxxxxx (optional)"
                className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={
                  clinicData.otpConfig?.showInstantOtpOnScreen !== false
                }
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    otpConfig: {
                      ...DEFAULT_OTP_CONFIG,
                      ...(prev.otpConfig || {}),
                      showInstantOtpOnScreen: e.target.checked,
                    },
                  }))
                }
                className="rounded text-indigo-600"
              />
              <span>
                Enable Instant On-Screen Email OTP Auto-Fill Fallback (Recommended so Email OTP Login works 100% on any domain/hosting)
              </span>
            </label>

            <button
              type="button"
              disabled={testingOtp}
              onClick={handleTestLiveOtpGateway}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border border-indigo-300 text-xs font-extrabold rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Globe size={13} />
              {testingOtp ? 'Testing Email OTP Gateway...' : 'Test Email OTP Now'}
            </button>
          </div>
        </div>

        {/* SECTION: RAZORPAY ONLINE PAYMENT GATEWAY CONTROL CENTER (FOR PHARMACY POS) */}
        <div className="bg-white border-2 border-sky-500/40 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
                <CreditCard size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[#000080] font-extrabold text-xs sm:text-sm uppercase tracking-wider">
                    Razorpay Online Payment Gateway Control (Pharmacy Billing)
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                      clinicData.razorpayEnabled !== false
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-red-100 text-red-700 border border-red-300'
                    }`}
                  >
                    {clinicData.razorpayEnabled !== false
                      ? 'Gateway Active in Pharmacy'
                      : 'Gateway Disabled'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Enable or disable Razorpay Online Checkout (UPI, Card, NetBanking, Wallets) inside Pharmacy POS Billing
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  setClinicData((prev) => ({
                    ...prev,
                    razorpayEnabled: prev.razorpayEnabled === false,
                  }))
                }
                className={`px-4 py-2 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  clinicData.razorpayEnabled !== false
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-slate-200 hover:bg-slate-300 text-slate-800'
                }`}
              >
                {clinicData.razorpayEnabled !== false
                  ? '✓ Razorpay Enabled (Click to Turn OFF)'
                  : 'Razorpay Disabled (Click to Turn ON)'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">
                  Razorpay Key ID *
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setClinicData((prev) => ({
                      ...prev,
                      razorpayKeyId: 'rzp_test_SandanaDudrucs99',
                    }))
                  }
                  className="text-[10px] font-bold text-sky-700 hover:underline"
                >
                  Default Key
                </button>
              </div>
              <input
                type="text"
                value={clinicData.razorpayKeyId || ''}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    razorpayKeyId: e.target.value,
                  }))
                }
                placeholder="rzp_live_xxxxxxxxxxxx"
                className="w-full px-3 py-2 text-xs font-mono font-bold text-sky-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Gateway Mode
              </label>
              <select
                value={clinicData.razorpayMode || 'live'}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    razorpayMode: e.target.value === 'test' ? 'test' : 'live',
                  }))
                }
                className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-600"
              >
                <option value="live">LIVE Production Mode</option>
                <option value="test">TEST / Sandbox Mode</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Merchant Display Name
              </label>
              <input
                type="text"
                value={clinicData.razorpayMerchantName || ''}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    razorpayMerchantName: e.target.value,
                  }))
                }
                placeholder="Sandana Clinic & Dudrucs Pharmacy"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Checkout Brand Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={clinicData.razorpayThemeColor || '#0284C7'}
                  onChange={(e) =>
                    setClinicData((prev) => ({
                      ...prev,
                      razorpayThemeColor: e.target.value,
                    }))
                  }
                  className="w-9 h-9 rounded border border-slate-300 cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={clinicData.razorpayThemeColor || '#0284C7'}
                  onChange={(e) =>
                    setClinicData((prev) => ({
                      ...prev,
                      razorpayThemeColor: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Allowed Online Payment Methods Checkboxes */}
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-sky-600" />
              <span>Allowed Online Payment Channels in Pharmacy POS:</span>
            </span>

            <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
              {(
                [
                  { key: 'upi', label: 'UPI / QR (GPay, PhonePe, Paytm)' },
                  { key: 'card', label: 'Debit & Credit Cards' },
                  { key: 'netbanking', label: 'NetBanking (All Banks)' },
                  { key: 'wallet', label: 'Mobile Wallets' },
                ] as const
              ).map((ch) => {
                const checked =
                  clinicData.razorpayMethods?.[ch.key] !== false;
                return (
                  <label
                    key={ch.key}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'bg-sky-50 border-sky-300 text-sky-900'
                        : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setClinicData((prev) => ({
                          ...prev,
                          razorpayMethods: {
                            upi: prev.razorpayMethods?.upi !== false,
                            card: prev.razorpayMethods?.card !== false,
                            netbanking:
                              prev.razorpayMethods?.netbanking !== false,
                            wallet: prev.razorpayMethods?.wallet !== false,
                            [ch.key]: e.target.checked,
                          },
                        }))
                      }
                      className="rounded text-sky-600"
                    />
                    <span>{ch.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* SECTION 0: CLINIC & PHARMACY BRAND LOGO UPLOAD / URL */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2 text-[#000080] font-extrabold text-xs uppercase tracking-wider">
              <Sparkles size={16} className="text-green-600" />
              <span>
                1. Clinic &amp; Pharmacy Brand Logo (Shown in Navbar, Login, ERP &amp; A4 GST Bill)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-all hover:-translate-y-0.5">
                <Upload size={14} />
                <span>Upload Logo from Phone / PC</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoFileUpload}
                  className="hidden"
                />
              </label>

              {clinicData.logoUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setClinicData((prev) => ({ ...prev, logoUrl: '' }));
                    setSiteData((prev) => ({ ...prev, logoUrl: '' }));
                  }}
                  className="inline-flex items-center gap-1 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold rounded-lg transition-colors"
                >
                  <Trash2 size={13} />
                  Remove Logo
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-3 flex flex-col items-center justify-center p-4 bg-gradient-to-br from-emerald-50 to-slate-50 border border-emerald-200 rounded-xl">
              {clinicData.logoUrl ? (
                <img
                  src={clinicData.logoUrl}
                  alt="Clinic Brand Logo"
                  className="w-20 h-20 object-contain rounded-xl bg-white p-1.5 border border-slate-200 shadow-sm"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-green-600 text-white flex items-center justify-center shadow-md">
                  <Stethoscope size={34} />
                </div>
              )}
              <span className="text-[11px] font-bold text-slate-600 mt-2">
                {clinicData.logoUrl ? 'Custom Brand Logo Active' : 'Default Icon Logo'}
              </span>
            </div>

            <div className="md:col-span-9 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Or Paste Logo Image URL (PNG / JPG / SVG):
              </label>
              <input
                type="text"
                value={clinicData.logoUrl || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setClinicData((prev) => ({ ...prev, logoUrl: val }));
                  setSiteData((prev) => ({ ...prev, logoUrl: val }));
                }}
                placeholder="https://example.com/clinic-logo.png (or click 'Upload Logo from Phone / PC' above)"
                className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
              <p className="text-[11px] text-slate-500">
                Your logo automatically appears on the Public Home Page Navbar, Login Portals, Marg ERP Top Bar, and Printed A4 GST Invoices.
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 2: HOME PAGE SLIDER IMAGES */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2 text-[#000080] font-extrabold text-xs uppercase tracking-wider">
              <ImagePlus size={16} />
              <span>2. Home Page Image Slider (`settings/site.sliderImages`)</span>
            </div>
            <label className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-all hover:-translate-y-0.5 self-start sm:self-auto">
              <Upload size={13} />
              <span>Upload Banner Photo from Device</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={newSlideUrl}
              onChange={(e) => setNewSlideUrl(e.target.value)}
              placeholder="Paste image URL (https://...) to add to Home Page Carousel"
              className="flex-1 px-3.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
            />
            <button
              type="button"
              onClick={handleAddSlideUrl}
              className="px-4 py-2 bg-[#000080] hover:bg-blue-900 text-white text-xs font-bold rounded-lg transition-colors shrink-0 shadow-xs"
            >
              + Add Image URL
            </button>
          </div>

          {siteData.sliderImages.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No custom slider images added yet. Default clinic banners will be shown.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {siteData.sliderImages.map((imgUrl, idx) => (
                <div
                  key={`${idx}-${imgUrl.slice(0, 24)}`}
                  className="relative group border border-slate-300 rounded-xl overflow-hidden bg-slate-100 h-32 shadow-xs"
                >
                  <img
                    src={imgUrl}
                    alt={`Slide ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between px-3">
                    <span className="text-xs font-mono font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded">
                      Slide #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveSlide(idx)}
                      className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                      title="Delete Slide"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 2B: CLINIC GOOGLE MAPS LOCATION LINK CONTROL (SHOWN PROMINENTLY ON HOME PAGE & FOOTER) */}
        <div className="bg-white border-2 border-emerald-500/40 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <MapPin size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[#000080] font-extrabold text-xs sm:text-sm uppercase tracking-wider">
                    Clinic Google Maps Location Link Control (Shown on Home Page)
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Live on Home Page &amp; Footer
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Paste your Clinic&apos;s Google Maps share link or auto-generate it from the Clinic Address so patients can get 1-click directions on the Home Page
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const autoUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${clinicData.clinicName} ${clinicData.clinicAddress}`
                  )}`;
                  setClinicData((prev) => ({ ...prev, googleMapUrl: autoUrl }));
                  setSiteData((prev) => ({
                    ...prev,
                    googleMapUrl: autoUrl,
                    socialLinks: {
                      ...prev.socialLinks,
                      googleMapUrl: autoUrl,
                    },
                  }));
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                <Navigation size={13} />
                Auto-Generate from Clinic Address
              </button>

              <a
                href={
                  clinicData.googleMapUrl ||
                  siteData.googleMapUrl ||
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${clinicData.clinicName} ${clinicData.clinicAddress}`
                  )}`
                }
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors"
              >
                <ExternalLink size={13} />
                Test Open Map
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
            <div className="lg:col-span-7 space-y-2.5">
              <label className="block text-xs font-bold text-slate-700">
                Clinic Google Maps Location Link (Share URL / Maps Link) *
              </label>
              <input
                type="url"
                value={clinicData.googleMapUrl || siteData.googleMapUrl || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setClinicData((prev) => ({ ...prev, googleMapUrl: val }));
                  setSiteData((prev) => ({
                    ...prev,
                    googleMapUrl: val,
                    socialLinks: { ...prev.socialLinks, googleMapUrl: val },
                  }));
                }}
                placeholder="https://maps.google.com/?q=Sandana+Clinic+Chennai or https://maps.app.goo.gl/..."
                className="w-full px-3.5 py-2.5 text-xs font-mono font-bold text-emerald-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Tip: Open Google Maps, search your clinic, click <strong>Share → Copy Link</strong>, and paste it here. Patients visiting the Home Page will see an interactive Clinic Location Map Card and a prominent <strong>&ldquo;Get Directions on Google Maps&rdquo;</strong> button.
              </p>
            </div>

            <div className="lg:col-span-5 rounded-xl overflow-hidden border border-emerald-200 bg-slate-100 h-36 relative shadow-xs">
              <iframe
                title="Admin Clinic Google Map Preview"
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  `${clinicData.clinicName} ${clinicData.clinicAddress}`
                )}&output=embed`}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <div className="absolute bottom-2 right-2 bg-slate-900/85 text-white text-[10px] font-bold px-2.5 py-1 rounded-md pointer-events-none">
                Home Page Map Preview
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 3: SOCIAL MEDIA LINKS & CLINIC INFO */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-[#000080] font-extrabold text-xs uppercase tracking-wider border-b border-slate-200 pb-3">
            <Globe size={16} />
            <span>
              3. Footer Social Media Links &amp; Public Clinic Info (`settings/site`)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Facebook Page URL
              </label>
              <input
                type="text"
                value={siteData.socialLinks?.fb || ''}
                onChange={(e) =>
                  setSiteData((prev) => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, fb: e.target.value },
                  }))
                }
                placeholder="https://facebook.com/sandanaclinic"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Instagram Profile URL
              </label>
              <input
                type="text"
                value={siteData.socialLinks?.insta || ''}
                onChange={(e) =>
                  setSiteData((prev) => ({
                    ...prev,
                    socialLinks: { ...prev.socialLinks, insta: e.target.value },
                  }))
                }
                placeholder="https://instagram.com/sandanaclinic"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                WhatsApp Number / Link
              </label>
              <input
                type="text"
                value={siteData.socialLinks?.whatsapp || ''}
                onChange={(e) =>
                  setSiteData((prev) => ({
                    ...prev,
                    socialLinks: {
                      ...prev.socialLinks,
                      whatsapp: e.target.value,
                    },
                  }))
                }
                placeholder="919840011224"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Home Page Hero &amp; Footer Description (`clinicInfo`)
            </label>
            <textarea
              rows={2}
              value={siteData.clinicInfo}
              onChange={(e) =>
                setSiteData((prev) => ({ ...prev, clinicInfo: e.target.value }))
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
            />
          </div>
        </div>

        {/* SECTION 4: DUDRUCS UPI QR & CLINIC CONTACT SETTINGS */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-[#000080] font-extrabold text-xs uppercase tracking-wider border-b border-slate-200 pb-3">
            <QrCode size={16} />
            <span>
              4. Dudrucs GSTIN, UPI QR ID, Default Margin % &amp; Clinic Contact (`settings/clinic`)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                GST Number (Printed on A4 Bill) *
              </label>
              <input
                type="text"
                required
                disabled={loading}
                value={clinicData.gstNo || ''}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    gstNo: e.target.value.toUpperCase(),
                  }))
                }
                placeholder="33AABCS1429B1Z5"
                className="w-full px-3 py-2 text-xs font-mono font-bold text-[#000080] border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Merchant UPI ID *
              </label>
              <input
                type="text"
                required
                disabled={loading}
                value={clinicData.upiId}
                onChange={(e) =>
                  setClinicData((prev) => ({ ...prev, upiId: e.target.value }))
                }
                placeholder="sandanaclinic@okaxis"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                UPI Payee Name *
              </label>
              <input
                type="text"
                required
                disabled={loading}
                value={clinicData.upiName}
                onChange={(e) =>
                  setClinicData((prev) => ({ ...prev, upiName: e.target.value }))
                }
                placeholder="Dudrucs"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Default Margin % (on Cost) *
              </label>
              <input
                type="number"
                required
                min={0}
                max={500}
                step="0.5"
                disabled={loading}
                value={clinicData.defaultMarginPercent ?? 20}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    defaultMarginPercent: Number(e.target.value),
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clinic Name *
              </label>
              <input
                type="text"
                required
                value={clinicData.clinicName}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    clinicName: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clinic Phone *
              </label>
              <input
                type="text"
                required
                value={clinicData.clinicPhone}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    clinicPhone: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Medical Store Name *
              </label>
              <input
                type="text"
                required
                value={clinicData.medicalName}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    medicalName: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clinic Address *
              </label>
              <input
                type="text"
                required
                value={clinicData.clinicAddress}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    clinicAddress: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Clinic Timings *
              </label>
              <input
                type="text"
                required
                value={clinicData.clinicTimings}
                onChange={(e) =>
                  setClinicData((prev) => ({
                    ...prev,
                    clinicTimings: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={saving || loading}
            className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 text-white text-xs sm:text-sm font-extrabold rounded-xl transition-all hover:-translate-y-0.5 inline-flex items-center justify-center gap-2 shadow-md"
          >
            <Save size={16} />
            {saving
              ? 'Saving Logo, Slider & Clinic Settings...'
              : 'Save Brand Logo, Website Slider & UPI Settings'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SiteSettings;
