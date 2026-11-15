import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SliderLib from 'react-slick';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import {
  Award,
  BadgeCheck,
  CalendarPlus,
  Clock,
  ExternalLink,
  Eye,
  Globe2,
  IndianRupee,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Pill,
  ShieldCheck,
  Sparkles,
  Star,
  Stethoscope,
  UserRound,
  X,
  ClipboardList,
} from 'lucide-react';
import { db } from '../../firebase';
import { Slider } from '../../components/Slider';
import { Footer, SocialLinksConfig } from '../../components/Footer';
import {
  FALLBACK_ERP_MEDICINES,
  MedicineAvailabilitySearch,
  PublicMedicineSummary,
} from '../../components/MedicineAvailabilitySearch';
import { AiClinicChat } from '../../components/AiClinicChat';
import { openBookOpdModal } from '../../components/BookOpdModal';
import {
  FacebookLogoSvg,
  InstagramLogoSvg,
  WhatsAppLogoSvg,
} from '../../components/PublicNavbar';

const SlickSlider: any = (SliderLib as any).default || SliderLib;

export interface DoctorRecord {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  photoUrl: string;
  availableSlots: string[];
  availableDays: string[];
  isActive: boolean;
  uid?: string;
  email?: string;
  loginId?: string;
  staffKey?: string;
  experience?: string;
  consultationFee?: number;
  bio?: string;
  regNo?: string;
  languages?: string;
  phone?: string;
}

export interface FeedbackRecord {
  id: string;
  patientName: string;
  rating: number;
  comment: string;
  doctorId?: string;
  isApproved: boolean;
  createdAt: string;
}

export type DoctorDoc = DoctorRecord;
export type FeedbackDoc = FeedbackRecord;

export interface RazorpayMethodsConfig {
  upi: boolean;
  card: boolean;
  netbanking: boolean;
  wallet: boolean;
}

export interface ClinicSettingsDoc {
  upiId: string;
  upiName: string;
  razorpayEnabled?: boolean;
  razorpayKeyId?: string;
  razorpayMerchantName?: string;
  razorpayThemeColor?: string;
  razorpayMode?: 'test' | 'live';
  razorpayMethods?: RazorpayMethodsConfig;
  clinicName: string;
  clinicAddress: string;
  clinicPhone: string;
  clinicTimings: string;
  medicalName: string;
  medicalPhone: string;
  defaultMarginPercent?: number;
  logoUrl?: string;
  googleMapUrl?: string;
  otpConfig?: {
    enabled?: boolean;
    phpOtpEndpoint?: string;
    fast2smsApiKey?: string;
    msg91AuthKey?: string;
    msg91TemplateId?: string;
    emailJsServiceId?: string;
    emailJsTemplateId?: string;
    emailJsPublicKey?: string;
    customWebhookUrl?: string;
    showInstantOtpOnScreen?: boolean;
  };
}

export interface SiteSettingsDoc {
  sliderImages: string[];
  socialLinks: SocialLinksConfig;
  clinicInfo: string;
  logoUrl?: string;
  googleMapUrl?: string;
}

export const DEFAULT_CLINIC_SETTINGS: ClinicSettingsDoc = {
  upiId: 'sandanaclinic@okaxis',
  upiName: 'Dudrucs',
  razorpayEnabled: true,
  razorpayKeyId: 'rzp_test_SandanaDudrucs99',
  razorpayMerchantName: 'Sandana Clinic & Dudrucs Pharmacy',
  razorpayThemeColor: '#0284C7',
  razorpayMode: 'live',
  razorpayMethods: {
    upi: true,
    card: true,
    netbanking: true,
    wallet: true,
  },
  clinicName: 'Sandana Clinic',
  clinicAddress: '42, MG Healthcare Road, Anna Nagar, Chennai - 600040',
  clinicPhone: '+91 98400 11223',
  clinicTimings: 'Mon - Sat: 09:00 AM - 09:00 PM | Sun: 10:00 AM - 02:00 PM',
  medicalName: 'Dudrucs',
  medicalPhone: '919840011224',
  defaultMarginPercent: 20,
  logoUrl: '',
  googleMapUrl:
    'https://www.google.com/maps/search/?api=1&query=Sandana+Clinic+42+MG+Healthcare+Road+Anna+Nagar+Chennai+600040',
  otpConfig: {
    enabled: true,
    phpOtpEndpoint: '/otp.php',
    fast2smsApiKey: '',
    msg91AuthKey: '',
    msg91TemplateId: '',
    emailJsServiceId: '',
    emailJsTemplateId: '',
    emailJsPublicKey: '',
    customWebhookUrl: '',
    showInstantOtpOnScreen: true,
  },
};

export const DEFAULT_SITE_SETTINGS: SiteSettingsDoc = {
  sliderImages: [
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1400&q=80',
  ],
  socialLinks: {
    fb: 'https://facebook.com',
    insta: 'https://instagram.com',
    whatsapp: '919840011224',
    googleMapUrl:
      'https://www.google.com/maps/search/?api=1&query=Sandana+Clinic+42+MG+Healthcare+Road+Anna+Nagar+Chennai+600040',
  },
  clinicInfo:
    'Sandana Clinic & Dudrucs Pharmacy offers specialist outpatient care, OTP-verified digital appointments, and 100% genuine FIFO batch-tracked medicines.',
  logoUrl: '',
  googleMapUrl:
    'https://www.google.com/maps/search/?api=1&query=Sandana+Clinic+42+MG+Healthcare+Road+Anna+Nagar+Chennai+600040',
};

const FALLBACK_DOCTORS: DoctorRecord[] = [
  {
    id: 'doc_sandana_1',
    name: 'Dr. S. Sandana Krishnan',
    specialization: 'Senior General Physician & Diabetologist',
    qualification: 'MBBS, MD (Internal Medicine), Fellowship in Diabetology',
    photoUrl:
      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?auto=format&fit=crop&w=500&q=80',
    availableSlots: ['10:00', '10:30', '11:00', '18:00', '18:30', '19:00'],
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    isActive: true,
    experience: '18+ Years Experience',
    consultationFee: 350,
    regNo: 'TNMC Reg. #68421',
    languages: 'Tamil, English, Hindi',
    phone: '+91 98400 11223',
    bio: 'Chief Consultant Physician specializing in Type-1/Type-2 Diabetes reversal, Hypertension, Thyroid disorders, Infectious diseases, and preventive geriatric care.',
  },
  {
    id: 'doc_sandana_2',
    name: 'Dr. Priya Ramanathan',
    specialization: 'Consultant Pediatrician & Neonatologist',
    qualification: 'MBBS, DCH, DNB (Pediatrics)',
    photoUrl:
      'https://images.unsplash.com/photo-1594824476967-48c8b964273f?auto=format&fit=crop&w=500&q=80',
    availableSlots: ['10:30', '11:00', '11:30', '17:00', '17:30', '18:00'],
    availableDays: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat'],
    isActive: true,
    experience: '12+ Years Experience',
    consultationFee: 300,
    regNo: 'TNMC Reg. #79104',
    languages: 'Tamil, English, Telugu',
    phone: '+91 98400 11225',
    bio: 'Dedicated child health specialist covering newborn care, complete childhood immunization schedules, pediatric asthma, nutrition, and developmental milestones.',
  },
  {
    id: 'doc_sandana_3',
    name: 'Dr. Arvind Narayanan',
    specialization: 'Orthopedic, Spine & Joint Replacement Surgeon',
    qualification: 'MBBS, MS (Orthopedics), FIJR',
    photoUrl:
      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=500&q=80',
    availableSlots: ['16:30', '17:00', '17:30', '18:00', '19:30'],
    availableDays: ['Tue', 'Thu', 'Sat'],
    isActive: true,
    experience: '14+ Years Experience',
    consultationFee: 400,
    regNo: 'TNMC Reg. #74219',
    languages: 'Tamil, English',
    phone: '+91 98400 11228',
    bio: 'Expert in arthritis management, sports ligament injuries, fracture trauma care, cervical/lumbar spondyloarthropathy, and non-surgical joint rehabilitation.',
  },
];

const FALLBACK_FEEDBACK: FeedbackRecord[] = [
  {
    id: 'fb_1',
    patientName: 'Ramesh Kumar',
    rating: 5,
    comment:
      'Very clean clinic and prompt OTP token system. Dr. Sandana explained my diabetes care clearly and Dudrucs had all medicines ready.',
    isApproved: true,
    createdAt: '2026-10-20T10:00:00.000Z',
  },
  {
    id: 'fb_2',
    patientName: 'Lakshmi Narayanan',
    rating: 5,
    comment:
      'Booked an appointment online in 1 minute with email OTP. No waiting in long queues and Dudrucs UPI QR billing was super fast.',
    isApproved: true,
    createdAt: '2026-10-22T15:30:00.000Z',
  },
  {
    id: 'fb_3',
    patientName: 'Anitha Selvam',
    rating: 5,
    comment:
      'Dr. Priya is wonderful with children. The pharmacy prints proper batch and expiry details on every bill.',
    isApproved: true,
    createdAt: '2026-10-24T11:15:00.000Z',
  },
];

export const Home: React.FC = () => {
  const [settings, setSettings] = useState<ClinicSettingsDoc>(
    DEFAULT_CLINIC_SETTINGS
  );
  const [siteSettings, setSiteSettings] = useState<SiteSettingsDoc>(
    DEFAULT_SITE_SETTINGS
  );
  const [doctors, setDoctors] = useState<DoctorRecord[]>(FALLBACK_DOCTORS);
  const [feedbacks, setFeedbacks] = useState<FeedbackRecord[]>(FALLBACK_FEEDBACK);
  const [selectedDoctorModal, setSelectedDoctorModal] =
    useState<DoctorRecord | null>(null);
  const [erpInventory, setErpInventory] = useState<PublicMedicineSummary[]>(
    FALLBACK_ERP_MEDICINES
  );
  const [aiPromptTrigger, setAiPromptTrigger] = useState<string | null>(null);

  useEffect(() => {
    const loadHomeData = async () => {
      try {
        const [clinicSnap, siteSnap, docSnap, fbSnap] = await Promise.all([
          getDoc(doc(db, 'settings', 'clinic')),
          getDoc(doc(db, 'settings', 'site')),
          getDocs(collection(db, 'doctors')),
          getDocs(collection(db, 'feedback')),
        ]);

        if (clinicSnap.exists()) {
          setSettings({
            ...DEFAULT_CLINIC_SETTINGS,
            ...(clinicSnap.data() as Partial<ClinicSettingsDoc>),
          });
        }

        if (siteSnap.exists()) {
          const sData = siteSnap.data() as Partial<SiteSettingsDoc>;
          setSiteSettings({
            sliderImages:
              Array.isArray(sData.sliderImages) && sData.sliderImages.length > 0
                ? sData.sliderImages
                : DEFAULT_SITE_SETTINGS.sliderImages,
            socialLinks: {
              ...DEFAULT_SITE_SETTINGS.socialLinks,
              ...(sData.socialLinks || {}),
            },
            clinicInfo: sData.clinicInfo || DEFAULT_SITE_SETTINGS.clinicInfo,
            logoUrl: sData.logoUrl || '',
            googleMapUrl:
              sData.googleMapUrl ||
              sData.socialLinks?.googleMapUrl ||
              DEFAULT_SITE_SETTINGS.googleMapUrl,
          });
        }

        const activeDocs = docSnap.docs
          .map((d, idx) => {
            const raw = d.data() as Omit<DoctorRecord, 'id'>;
            const fallbackItem = FALLBACK_DOCTORS[idx % FALLBACK_DOCTORS.length];
            return {
              id: d.id,
              ...raw,
              experience: raw.experience || fallbackItem.experience,
              consultationFee:
                typeof raw.consultationFee === 'number'
                  ? raw.consultationFee
                  : fallbackItem.consultationFee,
              regNo: raw.regNo || fallbackItem.regNo,
              languages: raw.languages || fallbackItem.languages,
              bio: raw.bio || fallbackItem.bio,
              photoUrl: raw.photoUrl || fallbackItem.photoUrl,
            };
          })
          .filter((docItem) => docItem.isActive);
        if (activeDocs.length > 0) {
          setDoctors(activeDocs);
        }

        const approvedFeedback = fbSnap.docs
          .map((f) => ({
            id: f.id,
            ...(f.data() as Omit<FeedbackRecord, 'id'>),
          }))
          .filter((item) => item.isApproved);
        if (approvedFeedback.length > 0) {
          setFeedbacks(approvedFeedback);
        }
      } catch (err) {
        console.error('Error loading public home data:', err);
      }
    };

    loadHomeData();
  }, []);

  const [heroSlideIdx, setHeroSlideIdx] = useState(0);

  const activeLogoUrl = settings.logoUrl || siteSettings.logoUrl || '';
  const activeMapUrl =
    settings.googleMapUrl?.trim() ||
    siteSettings.googleMapUrl?.trim() ||
    siteSettings.socialLinks?.googleMapUrl?.trim() ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${settings.clinicName} ${settings.clinicAddress}`
    )}`;

  // Prevent duplicate "Medical Store Medical Store" or "Medical Store Pharmacy"
  const rawMedical = (settings.medicalName || 'Dudrucs').trim();
  const cleanMedicalBase =
    rawMedical.replace(/\b(medical\s+store|pharmacy)\b/gi, '').trim() ||
    'Dudrucs';
  const medicalStoreDisplay = `${cleanMedicalBase} Medical Store`;
  const medicalPharmacyDisplay = `${cleanMedicalBase} Pharmacy`;

  const heroSlides = [
    {
      preTitle: `${settings.clinicName} & ${medicalStoreDisplay}`,
      word1: 'We ',
      highlight1: 'Care',
      word2: ' About',
      word3: 'Your ',
      highlight2: 'Health.',
      subtitle:
        siteSettings.clinicInfo ||
        `${settings.clinicName} & ${medicalPharmacyDisplay} offers specialist outpatient consultations, OTP-verified digital appointments, and 100% genuine FIFO batch-tracked medicines.`,
      bgImage:
        'https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=1400&q=85',
      ctaText: 'Book Appointment',
      ctaLink: '/book',
    },
    {
      preTitle: `100% Genuine FIFO Batch-Tracked Pharmacy`,
      word1: 'Trusted ',
      highlight1: 'Medical',
      word2: ' Store',
      word3: '& ',
      highlight2: `${cleanMedicalBase}.`,
      subtitle: `Search live medicine availability, batch numbers & MRP online at ${medicalStoreDisplay}, or order prescriptions directly via WhatsApp & Razorpay.`,
      bgImage:
        'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1400&q=85',
      ctaText: 'Check Medicines',
      ctaLink: '#medicine-search',
    },
    {
      preTitle: `Specialist Outpatient OPD & Diagnostics`,
      word1: 'Expert ',
      highlight1: 'Doctors',
      word2: ' For',
      word3: 'Your ',
      highlight2: 'Family.',
      subtitle: `Consult senior specialists with instant OPD tokens and complete digital prescription records.`,
      bgImage:
        'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=1400&q=85',
      ctaText: 'Meet Doctors',
      ctaLink: '#doctors',
    },
    {
      preTitle: `Easy Navigation & Clinic Directions`,
      word1: 'Visit ',
      highlight1: 'Our',
      word2: ' Clinic',
      word3: 'On ',
      highlight2: 'Google Maps.',
      subtitle: `Located at ${settings.clinicAddress}. Open ${settings.clinicTimings} with 1-click Google Maps directions and emergency helpline.`,
      bgImage:
        'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1400&q=85',
      ctaText: 'Contact us',
      ctaLink: '#location',
    },
    {
      preTitle: `24/7 AI Assistant & Emergency Support`,
      word1: 'Always ',
      highlight1: 'Ready',
      word2: ' For',
      word3: 'Your ',
      highlight2: 'Safety.',
      subtitle: `Ask our AI Clinic & Pharmacy Assistant about medicine stock, salt compositions, or doctor timings anytime.`,
      bgImage:
        'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?auto=format&fit=crop&w=1400&q=85',
      ctaText: 'Book OPD Slot',
      ctaLink: '/book',
    },
  ];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroSlideIdx((prev) => (prev + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  const activeHero = heroSlides[heroSlideIdx] || heroSlides[0];

  const testimonialSliderSettings = {
    dots: true,
    infinite: feedbacks.length > 1,
    speed: 550,
    slidesToShow: Math.min(2, feedbacks.length),
    slidesToScroll: 1,
    autoplay: feedbacks.length > 1,
    autoplaySpeed: 4800,
    arrows: false,
    responsive: [
      {
        breakpoint: 768,
        settings: {
          slidesToShow: 1,
        },
      },
    ],
  };

  return (
    <div className="bg-gradient-to-b from-[#DFF4F0] via-[#E8F3FE] to-[#DCF2F0] min-h-screen">
      {/* 1. "WE CARE ABOUT YOUR HEALTH." RESPONSIVE HERO SECTION (DESKTOP, TABLET, MOBILE) */}
      <section className="relative bg-gradient-to-br from-[#D9F2EE] via-[#EBF6FF] to-[#D6EEF8] overflow-hidden shadow-lg border-b border-teal-200/80">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 min-h-[540px] lg:min-h-[640px] relative">
          {/* LEFT CLINICAL COLUMN (7 Cols) — Large Clinic Title Banner, Headlines & Responsive Action Buttons */}
          <div className="lg:col-span-7 relative px-4 sm:px-8 lg:px-12 py-7 sm:py-10 lg:py-12 flex flex-col justify-between bg-gradient-to-br from-[#E2F6F3]/95 via-[#F0F8FF]/95 to-[#DCF1F9]/95 z-10 overflow-hidden">
            {/* Soft Watermark Medical Crosses Behind Headline */}
            <div className="pointer-events-none select-none absolute top-24 left-8 text-teal-500/10 font-black text-[100px] sm:text-[130px] leading-none z-0">
              +
            </div>
            <div className="pointer-events-none select-none absolute top-48 right-6 text-blue-500/10 font-black text-[90px] sm:text-[120px] leading-none z-0">
              +
            </div>
            <div className="pointer-events-none select-none absolute bottom-16 right-20 text-teal-500/10 font-black text-[80px] sm:text-[110px] leading-none z-0">
              +
            </div>

            {/* Small Crisp Floating Royal Blue & Teal '+' Accents */}
            <span className="pointer-events-none select-none absolute top-28 right-8 text-[#0D9488] font-bold text-xl animate-float-slow">
              +
            </span>
            <span className="pointer-events-none select-none absolute top-1/2 left-4 text-[#2B59C3] font-bold text-lg animate-float-slow">
              +
            </span>
            <span className="pointer-events-none select-none absolute bottom-24 left-1/2 text-[#0D9488] font-bold text-lg animate-float-slow">
              +
            </span>

            {/* TOP PROMINENT CLINIC & MEDICAL STORE IDENTITY BANNER (Clean & Crisp across all screens) */}
            <div className="relative z-10 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="grid grid-cols-5 gap-1.5 w-fit">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <span
                      key={idx}
                      className="w-1.5 h-1.5 rounded-full bg-[#2B59C3]"
                    />
                  ))}
                </div>
                <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-emerald-900 bg-emerald-100/95 px-3 py-1 rounded-full border border-emerald-300 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                  Open Today &middot; OPD &amp; Pharmacy
                </span>
              </div>

              <div className="bg-white/95 backdrop-blur-xs border border-teal-200/90 rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {activeLogoUrl ? (
                    <img
                      src={activeLogoUrl}
                      alt={settings.clinicName}
                      className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl object-contain bg-white border border-teal-200 p-1 shrink-0 shadow-2xs"
                    />
                  ) : (
                    <div className="w-11 h-11 sm:w-13 sm:h-13 rounded-2xl bg-gradient-to-br from-[#0F2942] to-[#0D9488] text-white flex items-center justify-center shrink-0 shadow-sm">
                      <Stethoscope size={24} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-2xl font-black tracking-tight text-[#0F2942] leading-snug break-words">
                      {settings.clinicName}{' '}
                      <span className="text-[#0D9488]">
                        &amp; {medicalStoreDisplay}
                      </span>
                    </h2>
                    <p className="text-xs font-semibold text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="inline-flex items-center gap-1 text-[#2B59C3]">
                        <MapPin size={13} className="shrink-0" />
                        <span>{settings.clinicAddress}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-emerald-800 font-mono shrink-0 font-bold">
                        <Phone size={12} className="shrink-0" />
                        {settings.clinicPhone}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Clickable Social Media Logos */}
                <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                  <a
                    href={siteSettings.socialLinks?.fb?.trim() || 'https://facebook.com'}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Facebook"
                    className="w-8 h-8 rounded-full bg-[#1877F2] hover:bg-[#1464cf] text-white flex items-center justify-center shadow-xs transition-transform hover:scale-110"
                  >
                    <FacebookLogoSvg className="w-4 h-4" />
                  </a>
                  <a
                    href={siteSettings.socialLinks?.insta?.trim() || 'https://instagram.com'}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Instagram"
                    className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 text-white flex items-center justify-center shadow-xs transition-transform hover:scale-110"
                  >
                    <InstagramLogoSvg className="w-4 h-4" />
                  </a>
                  <a
                    href={`https://wa.me/${(
                      siteSettings.socialLinks?.whatsapp || settings.medicalPhone
                    ).replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="WhatsApp"
                    className="w-8 h-8 rounded-full bg-[#25D366] hover:bg-[#1ebe57] text-white flex items-center justify-center shadow-xs transition-transform hover:scale-110"
                  >
                    <WhatsAppLogoSvg className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Center Animated Hero Typography */}
            <div
              key={heroSlideIdx}
              className="relative z-10 my-4 sm:my-6 space-y-3.5 sm:space-y-4 animate-slide-in-left"
            >
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[54px] font-black tracking-tight text-[#0F2942] leading-[1.14]">
                <span className="block">
                  {activeHero.word1}
                  <span className="text-[#2B59C3]">
                    {activeHero.highlight1}
                  </span>
                  {activeHero.word2}
                </span>
                <span className="block mt-0.5">
                  {activeHero.word3}
                  <span className="text-[#0D9488]">
                    {activeHero.highlight2}
                  </span>
                </span>
              </h1>

              {/* Signature Divider Bar */}
              <div className="w-20 sm:w-24 h-1.5 bg-gradient-to-r from-[#2B59C3] to-[#0D9488] rounded-full animate-expand-bar" />

              {/* Clean Subtitle */}
              <p className="text-xs sm:text-sm md:text-base text-slate-700 leading-relaxed max-w-xl font-medium">
                {activeHero.subtitle}
              </p>

              {/* CTA Action Buttons (Grid on mobile, flex on tablet/desktop) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 pt-2">
                {activeHero.ctaLink.startsWith('#') ? (
                  <a
                    href={activeHero.ctaLink}
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 bg-[#2B59C3] hover:bg-[#1e46a8] text-white text-xs sm:text-sm font-extrabold rounded-full shadow-md shadow-[#2B59C3]/25 transition-all hover:-translate-y-0.5 text-center"
                  >
                    <span>+</span>
                    <span>{activeHero.ctaText}</span>
                    <span>+</span>
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => openBookOpdModal()}
                    className="inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-3 sm:py-3.5 bg-[#2B59C3] hover:bg-[#1e46a8] text-white text-xs sm:text-sm font-extrabold rounded-full shadow-md shadow-[#2B59C3]/25 transition-all hover:-translate-y-0.5 text-center cursor-pointer"
                  >
                    <span>+</span>
                    <span>{activeHero.ctaText}</span>
                    <span>+</span>
                  </button>
                )}

                <Link
                  to="/patient-prescriptions"
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white text-xs sm:text-sm font-extrabold rounded-full shadow-md transition-all hover:-translate-y-0.5 text-center"
                >
                  <ClipboardList size={16} className="shrink-0" />
                  <span>मरीज पर्ची (Doctor Rx)</span>
                </Link>

                <a
                  href={activeMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-3.5 bg-[#0D9488] hover:bg-teal-700 text-white text-xs sm:text-sm font-extrabold rounded-full shadow-md transition-all hover:-translate-y-0.5 text-center"
                >
                  <Navigation size={15} className="shrink-0" />
                  <span>Google Maps</span>
                </a>

                <button
                  type="button"
                  onClick={() =>
                    setAiPromptTrigger(
                      'Show me available medicines in stock and today doctor OPD timings'
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-3 sm:py-3.5 bg-white hover:bg-teal-50 text-[#0F2942] border border-teal-300 text-xs sm:text-sm font-extrabold rounded-full shadow-2xs transition-all hover:-translate-y-0.5 cursor-pointer text-center"
                >
                  <Sparkles size={15} className="text-[#0D9488] shrink-0" />
                  <span>Ask AI Assistant</span>
                </button>
              </div>
            </div>

            {/* Bottom 5 Slider Dots + Bottom-Right 2x5 Blue Dot-Matrix */}
            <div className="relative z-10 flex items-center justify-between pt-3">
              <div className="flex items-center gap-2.5">
                {heroSlides.map((slide, idx) => (
                  <button
                    key={slide.preTitle}
                    type="button"
                    onClick={() => setHeroSlideIdx(idx)}
                    aria-label={`Hero Slide ${idx + 1}`}
                    className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer ${
                      idx === heroSlideIdx
                        ? 'bg-[#2B59C3] scale-125'
                        : 'bg-teal-600/30 hover:bg-[#0D9488]'
                    }`}
                  />
                ))}
              </div>

              <div className="grid grid-cols-5 gap-1.5 w-fit mr-4 sm:mr-10">
                {Array.from({ length: 10 }).map((_, idx) => (
                  <span
                    key={idx}
                    className="w-1.5 h-1.5 rounded-full bg-[#0D9488]"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT PHOTO COLUMN (5 Cols) — High-Resolution Doctor Care Photo & Clean Self-Contained Feature Cards */}
          <div className="lg:col-span-5 relative min-h-[380px] sm:min-h-[460px] lg:min-h-full bg-[#CDE8E5] flex items-end pb-8 sm:pb-12 px-4 sm:px-6 lg:px-8">
            {/* Full-Bleed Animated Clinical Doctor & Patient Photo */}
            <div className="absolute inset-0 overflow-hidden">
              {heroSlides.map((slide, idx) => (
                <img
                  key={slide.bgImage}
                  src={slide.bgImage}
                  alt={`${settings.clinicName} Doctor Care`}
                  referrerPolicy="no-referrer"
                  className={`absolute inset-0 w-full h-full object-cover object-center animate-ken-burns transition-opacity duration-1000 ${
                    idx === heroSlideIdx ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F2942]/70 via-[#0F2942]/20 to-transparent" />
            </div>

            {/* 3 High-Contrast Feature Cards — Perfectly aligned and contained with no text collision */}
            <div className="relative z-20 w-full max-w-md mx-auto space-y-2.5 sm:space-y-3">
              {/* Feature 1: Medical Advices & Check Ups */}
              <a
                href="#doctors"
                className="flex items-center rounded-2xl sm:rounded-full overflow-hidden shadow-lg bg-[#1E40AF]/95 backdrop-blur-md hover:bg-[#1e3a8a] text-white transition-all duration-300 hover:-translate-y-0.5 group border border-white/30"
              >
                <div className="w-11 sm:w-14 lg:w-16 h-11 sm:h-14 lg:h-16 bg-[#38BDF8] flex items-center justify-center shrink-0">
                  <span className="text-[#0F2942] text-xl sm:text-2xl font-black leading-none group-hover:scale-110 transition-transform">
                    +
                  </span>
                </div>
                <div className="px-3.5 sm:px-5 py-2 sm:py-2.5 min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold tracking-wide text-white leading-tight truncate">
                    Medical Advices &amp; Check Ups
                  </p>
                  <p className="text-[10px] sm:text-xs text-sky-100 font-medium truncate mt-0.5">
                    Specialist OPD Consultations at {settings.clinicName}
                  </p>
                </div>
              </a>

              {/* Feature 2: Trusted Medical Treatment */}
              <a
                href="#medicine-search"
                className="flex items-center rounded-2xl sm:rounded-full overflow-hidden shadow-lg bg-[#0F766E]/95 backdrop-blur-md hover:bg-[#115e59] text-white transition-all duration-300 hover:-translate-y-0.5 group border border-white/30"
              >
                <div className="w-11 sm:w-14 lg:w-16 h-11 sm:h-14 lg:h-16 bg-[#2DD4BF] flex items-center justify-center shrink-0">
                  <span className="text-[#0F2942] text-xl sm:text-2xl font-black leading-none group-hover:scale-110 transition-transform">
                    +
                  </span>
                </div>
                <div className="px-3.5 sm:px-5 py-2 sm:py-2.5 min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold tracking-wide text-white leading-tight truncate">
                    Trusted Medical Treatment
                  </p>
                  <p className="text-[10px] sm:text-xs text-teal-100 font-medium truncate mt-0.5">
                    100% Genuine Stock at {medicalStoreDisplay}
                  </p>
                </div>
              </a>

              {/* Feature 3: Emergency Help Available 24/7 */}
              <button
                type="button"
                onClick={() => openBookOpdModal()}
                className="w-full text-left flex items-center rounded-2xl sm:rounded-full overflow-hidden shadow-lg bg-[#1E40AF]/95 backdrop-blur-md hover:bg-[#1e3a8a] text-white transition-all duration-300 hover:-translate-y-0.5 group border border-white/30 cursor-pointer"
              >
                <div className="w-11 sm:w-14 lg:w-16 h-11 sm:h-14 lg:h-16 bg-[#38BDF8] flex items-center justify-center shrink-0">
                  <span className="text-[#0F2942] text-xl sm:text-2xl font-black leading-none group-hover:scale-110 transition-transform">
                    +
                  </span>
                </div>
                <div className="px-3.5 sm:px-5 py-2 sm:py-2.5 min-w-0">
                  <p className="text-xs sm:text-sm font-extrabold tracking-wide text-white leading-tight truncate">
                    Emergency Help Available 24/7
                  </p>
                  <p className="text-[10px] sm:text-xs text-sky-100 font-medium truncate mt-0.5">
                    Instant OPD Booking &middot; Ph: {settings.clinicPhone}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Signature Bottom Clinical Teal-Sky Bar */}
        <div className="h-4 sm:h-5 w-full bg-gradient-to-r from-[#0F2942] via-[#0D9488] to-[#2B59C3]" />
      </section>

      {/* 1A. ABOUT OUR CARE & ADMIN-CONTROLLED CLINIC PHOTO SHOWCASE */}
      <section
        id="about-care"
        className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-6 space-y-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#74A3F7]/25 text-[#2B59C3] flex items-center justify-center shrink-0 font-black text-2xl">
              +
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">
                Instant Online OPD Appointments
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Book your consultation slot directly with your 10-digit mobile
                number for instant OPD token generation (no OTP delay).
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#74A3F7]/25 text-[#2B59C3] flex items-center justify-center shrink-0 font-black text-2xl">
              +
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">
                {medicalStoreDisplay} (Marg ERP)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                100% genuine batch-tracked medicines with live stock search,
                WhatsApp ordering, and Razorpay online payments.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 border border-blue-100 shadow-sm hover:shadow-md transition-all flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#74A3F7]/25 text-[#2B59C3] flex items-center justify-center shrink-0 font-black text-2xl">
              +
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-slate-900">
                Live Google Maps &amp; Timings
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Open {settings.clinicTimings}. Visit us easily at{' '}
                {settings.clinicAddress}.
              </p>
            </div>
          </div>
        </div>

        {/* Admin-Controlled Automatic Clinic & Pharmacy Showcase Slider */}
        <Slider
          images={siteSettings.sliderImages}
          clinicName={settings.clinicName}
          medicalName={cleanMedicalBase}
        />
      </section>

      {/* 1B. CHECK MEDICINE AVAILABILITY (CONNECTED LIVE TO PHARMACY ERP) + 3 TRUST BADGES */}
      <MedicineAvailabilitySearch
        medicalName={cleanMedicalBase}
        whatsappNumber={
          siteSettings.socialLinks?.whatsapp || settings.medicalPhone
        }
        onInventoryLoaded={setErpInventory}
        onAskAiAboutMedicine={(med) =>
          setAiPromptTrigger(
            `Tell me about ${med.name} (${med.genericName}) — is it in stock, what is its price, batch, and usage?`
          )
        }
      />

      {/* 2. TODAY'S DOCTORS — FULL CLINICAL PROFILE CARDS & SCHEDULE IN ROYAL BLUE THEME */}
      <section
        id="doctors"
        className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest text-[#2B59C3]">
              <span className="text-base font-black">+</span>
              <span>Complete Doctor Profiles, Qualifications &amp; OPD Timings</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
              Meet Our <span className="text-[#2B59C3]">Specialist</span> Doctors
            </h2>
            <div className="w-20 h-1.5 bg-[#2B59C3] rounded-full" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/login/doctor"
              className="px-4 py-2.5 bg-white hover:bg-blue-50 text-[#2B59C3] border border-blue-200 rounded-full text-xs font-extrabold transition-colors"
            >
              Doctor OPD Login →
            </Link>
            <button
              type="button"
              onClick={() => openBookOpdModal()}
              className="px-6 py-2.5 bg-[#2B59C3] hover:bg-[#1e46a8] text-white rounded-full text-xs font-extrabold inline-flex items-center gap-2 shadow-md shadow-[#2B59C3]/25 transition-all hover:-translate-y-0.5 cursor-pointer"
            >
              <span>+</span>
              <span>Book Consultation Slot</span>
              <span>+</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {doctors.map((docItem) => (
            <div
              key={docItem.id}
              className="group bg-white border border-blue-100 hover:border-[#2B59C3] rounded-3xl overflow-hidden flex flex-col justify-between shadow-xs hover:shadow-xl transition-all duration-300 hover:-translate-y-1 animate-fade-in-up"
            >
              <div>
                {/* Top Doctor Banner & Photo */}
                <div className="p-4 sm:p-6 bg-gradient-to-br from-[#EFF5FF] via-white to-blue-50/60 border-b border-blue-100/80 flex items-start gap-3.5 sm:gap-4">
                  {docItem.photoUrl ? (
                    <img
                      src={docItem.photoUrl}
                      alt={docItem.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#2B59C3] shadow-xs shrink-0 group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-blue-100 border border-blue-300 text-[#2B59C3] flex items-center justify-center shrink-0">
                      <UserRound size={30} className="sm:w-8 sm:h-8" />
                    </div>
                  )}

                  <div className="space-y-1 min-w-0">
                    <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#2B59C3]/10 text-[#2B59C3] text-[10px] font-mono font-bold">
                      <BadgeCheck size={12} className="text-[#2B59C3] shrink-0" />
                      <span className="truncate">{docItem.regNo || 'TNMC Verified'}</span>
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 group-hover:text-[#2B59C3] transition-colors leading-snug truncate">
                      {docItem.name}
                    </h3>
                    <p className="text-xs font-bold text-[#2B59C3] truncate">
                      {docItem.specialization}
                    </p>
                    <p className="text-xs font-semibold text-slate-600 truncate">
                      {docItem.qualification || 'MBBS, MD'}
                    </p>
                  </div>
                </div>

                {/* Full Doctor Details Body */}
                <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 text-xs">
                  {/* Experience, Fee, Status */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 bg-[#F8FAFF] border border-blue-100 rounded-2xl p-2.5 sm:p-3 text-center">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-semibold">
                        Experience
                      </p>
                      <p className="font-bold text-slate-900 mt-0.5 flex items-center justify-center gap-1">
                        <Award size={12} className="text-[#2B59C3] shrink-0" />
                        <span className="truncate">{docItem.experience || '12+ Yrs'}</span>
                      </p>
                    </div>
                    <div className="border-x border-blue-100">
                      <p className="text-[10px] text-slate-500 uppercase font-semibold">
                        OPD Fee
                      </p>
                      <p className="font-mono font-extrabold text-[#2B59C3] mt-0.5 flex items-center justify-center">
                        <IndianRupee size={11} className="shrink-0" />
                        {docItem.consultationFee ?? 300}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase font-semibold">
                        Status
                      </p>
                      <p className="font-bold text-emerald-600 mt-0.5">
                        Available
                      </p>
                    </div>
                  </div>

                  {/* Clinical Bio */}
                  {docItem.bio && (
                    <p className="text-slate-600 leading-relaxed">
                      {docItem.bio}
                    </p>
                  )}

                  {/* Languages & Days */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium flex items-center gap-1">
                        <Globe2 size={12} className="text-slate-400" />
                        Languages:
                      </span>
                      <span className="font-semibold text-slate-800">
                        {docItem.languages || 'Hindi, English'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500 font-medium">
                        OPD Days:
                      </span>
                      <span className="font-mono font-bold text-slate-900">
                        {docItem.availableDays.join(', ')}
                      </span>
                    </div>
                  </div>

                  {/* Available Time Slots */}
                  <div className="space-y-1.5">
                    <span className="text-slate-500 font-medium block">
                      Today&apos;s Consultation Slots:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {docItem.availableSlots.map((slot) => (
                        <button
                          key={slot}
                          type="button"
                          onClick={() =>
                            openBookOpdModal({ doctorId: docItem.id, slot })
                          }
                          className="text-xs font-mono px-2.5 py-1 rounded-full bg-[#EFF5FF] hover:bg-[#2B59C3] hover:text-white text-[#2B59C3] border border-blue-200 font-bold transition-colors cursor-pointer"
                        >
                          {slot}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Bottom Actions */}
              <div className="px-6 pb-6 pt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedDoctorModal(docItem)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-full transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye size={14} />
                  Full Profile
                </button>
                <button
                  type="button"
                  onClick={() => openBookOpdModal({ doctorId: docItem.id })}
                  className="flex-1 py-2.5 px-4 bg-[#2B59C3] hover:bg-[#1e46a8] text-white text-xs font-extrabold rounded-full text-center transition-colors inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  <span>+</span>
                  <span>Book Appointment</span>
                  <span>+</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 2B. VISIT OUR CLINIC & MEDICAL STORE — GOOGLE MAPS LOCATION & DIRECTIONS (ROYAL BLUE THEME) */}
      <section id="location" className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-white border-2 border-[#74A3F7]/60 rounded-3xl p-6 sm:p-10 shadow-lg space-y-6 relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-blue-100 pb-5">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#EFF5FF] text-[#2B59C3] text-xs font-extrabold uppercase tracking-wider">
                <MapPin size={14} className="text-[#2B59C3]" />
                <span>Clinic &amp; Pharmacy Location on Google Maps</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                Visit <span className="text-[#2B59C3]">{settings.clinicName}</span> &amp;{' '}
                {medicalPharmacyDisplay}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Easy navigation &amp; 1-click Google Maps directions to our outpatient clinic and medical store.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <a
                href={activeMapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#2B59C3] hover:bg-[#1e46a8] text-white text-xs sm:text-sm font-extrabold rounded-full shadow-lg shadow-[#2B59C3]/25 transition-all hover:-translate-y-0.5"
              >
                <Navigation size={16} />
                Open in Google Maps (Get Directions)
                <ExternalLink size={14} />
              </a>

              <a
                href={`https://wa.me/${(
                  siteSettings.socialLinks?.whatsapp || settings.medicalPhone
                ).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                  `Hello ${settings.clinicName}, please share clinic location and appointment details.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-[#EFF5FF] hover:bg-blue-100 text-[#2B59C3] border border-blue-200 text-xs sm:text-sm font-bold rounded-full transition-all"
              >
                <MessageCircle size={16} className="text-[#2B59C3]" />
                Ask Location on WhatsApp
              </a>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left Info Column */}
            <div className="lg:col-span-5 flex flex-col justify-between space-y-4 bg-[#F8FAFF] border border-blue-100 rounded-2xl p-5 shadow-2xs">
              <div className="space-y-4">
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#2B59C3] text-white flex items-center justify-center shrink-0">
                    <MapPin size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-[#2B59C3]">
                      Complete Clinic &amp; Medical Store Address
                    </p>
                    <p className="text-sm sm:text-base font-extrabold text-slate-900 leading-snug">
                      {settings.clinicName} &amp; {medicalStoreDisplay}
                    </p>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                      {settings.clinicAddress}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 pt-3 border-t border-blue-100">
                  <div className="w-10 h-10 rounded-xl bg-[#74A3F7]/25 text-[#2B59C3] flex items-center justify-center shrink-0">
                    <Clock size={20} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-[#2B59C3]">
                      Outpatient OPD &amp; Pharmacy Timings
                    </p>
                    <p className="text-xs sm:text-sm font-semibold text-slate-800">
                      {settings.clinicTimings}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3.5 pt-3 border-t border-blue-100">
                  <div className="w-10 h-10 rounded-xl bg-[#74A3F7]/25 text-[#2B59C3] flex items-center justify-center shrink-0">
                    <Phone size={20} />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-[#2B59C3]">
                      Reception &amp; Pharmacy Helpline
                    </p>
                    <p className="text-xs sm:text-sm font-mono font-bold text-slate-900">
                      {settings.clinicPhone} / +{settings.medicalPhone}
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-blue-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                <a
                  href={activeMapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-3 px-4 bg-[#2B59C3] hover:bg-[#1e46a8] text-white text-xs font-extrabold rounded-full text-center inline-flex items-center justify-center gap-2 shadow-sm transition-colors"
                >
                  <Navigation size={15} />
                  Start Google Maps Navigation
                </a>
                <button
                  type="button"
                  onClick={() => openBookOpdModal()}
                  className="py-3 px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-extrabold rounded-full text-center inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <CalendarPlus size={15} />
                  Book OPD Slot
                </button>
              </div>
            </div>

            {/* Right Interactive Map Preview Column */}
            <div className="lg:col-span-7 rounded-2xl overflow-hidden border-2 border-[#74A3F7] bg-slate-100 min-h-[290px] sm:min-h-[340px] relative shadow-md group">
              <iframe
                title={`${settings.clinicName} Google Maps Location`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  `${settings.clinicName} ${settings.clinicAddress}`
                )}&output=embed`}
                className="w-full h-full min-h-[290px] sm:min-h-[340px] border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              <a
                href={activeMapUrl}
                target="_blank"
                rel="noreferrer"
                className="absolute bottom-3.5 right-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#2B59C3] hover:bg-[#1e46a8] text-white text-xs font-extrabold shadow-lg transition-colors"
              >
                <Navigation size={13} />
                <span>Open Full Map &amp; Directions</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* 3. SEPARATE DEPARTMENT LOGIN PORTALS SHOWCASE */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="bg-gradient-to-r from-[#1e3a8a] via-[#2B59C3] to-[#1d4ed8] text-white rounded-3xl p-6 sm:p-10 space-y-6 shadow-xl relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#93C5FD] uppercase tracking-wider">
                <Pill size={15} />
                <span>4 Separate Department Login Portals &amp; Menus</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black">
                Dedicated Login &amp; Workspace for Every Department
              </h2>
              <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
                Each department has its own isolated login page and persistent session — Marg ERP 9+ for Pharmacy, Executive Control for Admin, OPD Chamber for Doctors, and Token Desk for Reception.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
            <Link
              to="/login/pharmacy"
              className="p-5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all hover:-translate-y-1 space-y-1.5 shadow-md"
            >
              <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950">
                MARG ERP 9+ DESKTOP
              </span>
              <p className="text-base font-extrabold text-white pt-1">
                1. Pharmacy Login →
              </p>
              <p className="text-xs text-blue-100">
                Sale Billing, Razorpay Online Pay, Batch/Expiry &amp; A4 GST Bills
              </p>
            </Link>

            <Link
              to="/login/admin"
              className="p-5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all hover:-translate-y-1 space-y-1.5 shadow-md"
            >
              <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-[#74A3F7] text-slate-950">
                CHIEF ADMIN CONTROL
              </span>
              <p className="text-base font-extrabold text-white pt-1">
                2. Admin Login →
              </p>
              <p className="text-xs text-blue-100">
                Website Settings, Razorpay, Google Maps, Staff IDs &amp; Hosting Kit
              </p>
            </Link>

            <Link
              to="/login/doctor"
              className="p-5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all hover:-translate-y-1 space-y-1.5 shadow-md"
            >
              <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-300 text-slate-950">
                CLINICAL OPD CHAMBER
              </span>
              <p className="text-base font-extrabold text-white pt-1">
                3. Doctor Login →
              </p>
              <p className="text-xs text-blue-100">
                Dedicated Doctor Menu for Today&apos;s OPD Queue &amp; Prescriptions
              </p>
            </Link>

            <Link
              to="/login/reception"
              className="p-5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/20 transition-all hover:-translate-y-1 space-y-1.5 shadow-md"
            >
              <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-0.5 rounded-full bg-sky-300 text-slate-950">
                FRONT DESK &amp; TOKENS
              </span>
              <p className="text-base font-extrabold text-white pt-1">
                4. Reception Login →
              </p>
              <p className="text-xs text-blue-100">
                Walk-In Patient Registration, OTP Verification &amp; OPD Tokens
              </p>
            </Link>
          </div>
        </div>
      </section>

      {/* 4. PATIENT FEEDBACK SLIDING TESTIMONIALS */}
      <section
        id="feedback"
        className="max-w-7xl mx-auto px-4 sm:px-6 py-14 space-y-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1.5">
            <p className="text-xs font-extrabold uppercase tracking-widest text-[#2B59C3]">
              + Verified Patient Testimonials +
            </p>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
              What Patients Say About{' '}
              <span className="text-[#2B59C3]">{settings.clinicName}</span>
            </h2>
          </div>
          <Link
            to="/feedback"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2B59C3] hover:bg-[#1e46a8] text-white rounded-full text-xs font-extrabold shadow-sm transition-colors self-start sm:self-auto"
          >
            <Star size={14} className="fill-amber-300 text-amber-300" />
            Share Your Rating &amp; Review
          </Link>
        </div>

        <div className="px-1">
          <SlickSlider {...testimonialSliderSettings}>
            {feedbacks.map((item) => (
              <div key={item.id} className="px-2.5 py-2">
                <div className="bg-white border border-blue-100 rounded-3xl p-6 space-y-3 h-full shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-slate-900">
                      {item.patientName}
                    </span>
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          size={14}
                          className={
                            idx < item.rating
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-200'
                          }
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    &ldquo;{item.comment}&rdquo;
                  </p>
                </div>
              </div>
            ))}
          </SlickSlider>
        </div>
      </section>

      {/* FULL DOCTOR PROFILE MODAL */}
      {selectedDoctorModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedDoctorModal(null)}
        >
          <div
            className="bg-white border-2 border-[#2B59C3] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[#2B59C3] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-wider text-blue-200">
                  {selectedDoctorModal.regNo || 'Verified Clinic Specialist'}
                </p>
                <h3 className="text-lg font-extrabold">
                  {selectedDoctorModal.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDoctorModal(null)}
                className="p-1 rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="flex items-center gap-4">
                {selectedDoctorModal.photoUrl && (
                  <img
                    src={selectedDoctorModal.photoUrl}
                    alt={selectedDoctorModal.name}
                    className="w-20 h-20 rounded-2xl object-cover border-2 border-[#2B59C3]"
                  />
                )}
                <div className="space-y-1">
                  <p className="text-sm font-bold text-[#2B59C3]">
                    {selectedDoctorModal.specialization}
                  </p>
                  <p className="font-semibold text-slate-700">
                    {selectedDoctorModal.qualification}
                  </p>
                  <p className="font-mono text-slate-600">
                    {selectedDoctorModal.experience || '15+ Years Experience'} ·
                    Fee: ₹{selectedDoctorModal.consultationFee ?? 300}
                  </p>
                </div>
              </div>

              <div className="p-3.5 bg-[#F8FAFF] border border-blue-100 rounded-2xl space-y-1">
                <p className="font-bold text-slate-900">
                  Clinical Biography &amp; Expertise
                </p>
                <p className="text-slate-600 leading-relaxed">
                  {selectedDoctorModal.bio ||
                    'Senior specialist at Sandana Clinic providing comprehensive outpatient care and diagnostics.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#EFF5FF] border border-blue-200 rounded-2xl">
                  <p className="text-slate-500 font-semibold">Available Days</p>
                  <p className="font-mono font-bold text-slate-900 mt-0.5">
                    {selectedDoctorModal.availableDays.join(', ')}
                  </p>
                </div>
                <div className="p-3 bg-[#EFF5FF] border border-blue-200 rounded-2xl">
                  <p className="text-slate-500 font-semibold">Languages</p>
                  <p className="font-bold text-slate-900 mt-0.5">
                    {selectedDoctorModal.languages || 'Hindi, English'}
                  </p>
                </div>
              </div>

              <div>
                <p className="font-bold text-slate-800 mb-1.5">
                  Select a Time Slot to Book Appointment:
                </p>
                <div className="flex flex-wrap gap-2">
                  {selectedDoctorModal.availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => {
                        const docId = selectedDoctorModal.id;
                        setSelectedDoctorModal(null);
                        openBookOpdModal({ doctorId: docId, slot });
                      }}
                      className="px-3.5 py-1.5 bg-[#2B59C3] hover:bg-[#1e46a8] text-white font-mono font-bold rounded-full cursor-pointer"
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ADMIN-CONTROLLED FOOTER */}
      <Footer
        clinicName={settings.clinicName}
        medicalName={cleanMedicalBase}
        clinicAddress={settings.clinicAddress}
        clinicPhone={settings.clinicPhone}
        clinicTimings={settings.clinicTimings}
        medicalPhone={settings.medicalPhone}
        clinicInfo={siteSettings.clinicInfo}
        googleMapUrl={activeMapUrl}
        socialLinks={siteSettings.socialLinks}
      />

      {/* 6. INTERACTIVE AI CLINIC & PHARMACY CHAT ASSISTANT */}
      <AiClinicChat
        clinicName={settings.clinicName}
        medicalName={cleanMedicalBase}
        clinicPhone={settings.clinicPhone}
        medicalPhone={settings.medicalPhone}
        clinicAddress={settings.clinicAddress}
        clinicTimings={settings.clinicTimings}
        googleMapUrl={activeMapUrl}
        clinicInfo={siteSettings.clinicInfo}
        inventory={erpInventory}
        doctors={doctors}
        externalPrompt={aiPromptTrigger}
        onClearExternalPrompt={() => setAiPromptTrigger(null)}
      />
    </div>
  );
};
