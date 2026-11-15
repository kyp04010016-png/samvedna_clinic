import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { collection, doc, getDocs, onSnapshot } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import {
  KeyRound,
  Send,
  ShieldCheck,
  Stethoscope,
  Pill,
  Ticket,
  CheckCircle2,
  AtSign,
  Eye,
  EyeOff,
  ShieldAlert,
  ArrowRight,
  LogOut,
} from 'lucide-react';
import { db } from '../../firebase';
import {
  useAuth,
  getRoleHomeRoute,
  StaffRole,
} from '../../context/AuthContext';
import { generateAndSendOTP } from '../../utils/emailOTP';
import { NumericCaptcha } from '../../components/NumericCaptcha';

/**
 * Medigraph Capsule Pill Logo (Matches reference image_7892dea9.png)
 * variant="dark" -> dark outline for white form side
 * variant="light" -> white outline for left photo side
 */
const MedigraphCapsuleLogo: React.FC<{
  variant?: 'dark' | 'light';
  className?: string;
}> = ({ variant = 'dark', className = 'w-14 h-7' }) => {
  const strokeColor = variant === 'light' ? '#FFFFFF' : '#1E252B';
  return (
    <svg
      viewBox="0 0 64 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Left Half: Steel Blue Capsule */}
      <path
        d="M15 2H32V28H15C7.8203 28 2 22.1797 2 15C2 7.8203 7.8203 2 15 2Z"
        fill="#467FA3"
      />
      {/* Subtle left highlight */}
      <path
        d="M14 5C8.5 5 4.5 9.4 4.5 15C4.5 20.6 8.5 25 14 25"
        stroke="#6FA3C4"
        strokeWidth="2.2"
        strokeLinecap="round"
      />

      {/* Right Half: Mosaic Segments */}
      <path
        d="M32 2H49C56.1797 2 62 7.8203 62 15C62 22.1797 56.1797 28 49 28H32V2Z"
        fill="#F8FAFC"
      />
      {/* Top-left mosaic (Golden Amber) */}
      <path d="M32 2H46C43 8 38 12 32 13V2Z" fill="#E8A838" />
      {/* Bottom-left mosaic (Warm Coral Orange) */}
      <path d="M32 16C38 17 42 21 44 28H32V16Z" fill="#DE6B35" />
      {/* Center-right mosaic (Steel Sky Blue) */}
      <path
        d="M48 3C53 4.5 57 8 59 13C53 14 47 12 44 8C45 5.5 46.5 4 48 3Z"
        fill="#5B92B5"
      />
      {/* Bottom-right tip mosaic (Warm Orange-Gold) */}
      <path
        d="M46 16C51 15.5 56 17 60 20C57.5 24.8 53.5 27.5 48 27.8C46.5 23 46 19 46 16Z"
        fill="#E58938"
      />

      {/* Internal Mosaic Divider Ribs */}
      <path
        d="M32 14.5C40 14.5 46 9.5 49 2.5"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M39 12.5C44 16 46 21.5 46.5 27.5"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M45.5 16C51 14.5 56.5 15.5 61 18.5"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Center vertical divider & outer capsule border */}
      <line
        x1="32"
        y1="2"
        x2="32"
        y2="28"
        stroke={strokeColor}
        strokeWidth="2.2"
      />
      <rect
        x="2"
        y="2"
        width="60"
        height="26"
        rx="13"
        stroke={strokeColor}
        strokeWidth="2.2"
      />
    </svg>
  );
};

/**
 * Official Multicolor Google "G" SVG Icon for "Log in with Google" button
 */
const GoogleGIcon: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export const Login: React.FC = () => {
  const { portal } = useParams<{ portal?: string }>();
  const {
    userProfile,
    role: currentLoggedRole,
    verifyStaffEmailForPortal,
    loginWithEmail,
    loginWithEmailOTP,
    loginWithGoogle,
    logout,
  } = useAuth();
  const navigate = useNavigate();

  const initialPortal: StaffRole =
    portal === 'admin' ||
    portal === 'pharmacy' ||
    portal === 'doctor' ||
    portal === 'reception'
      ? portal
      : 'pharmacy';

  const [selectedPortal, setSelectedPortal] =
    useState<StaffRole>(initialPortal);

  // Only Email Login (password) and Email OTP are supported (No Mobile OTP, No Social OTP)
  const [loginMode, setLoginMode] = useState<'password' | 'email_otp'>(
    'password'
  );

  // Anti-Brute-Force Security State (5 max attempts -> 30s lockout)
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);

  // OTP 5-Minute Validity Countdown Timer (tabular-nums)
  const [otpExpirySeconds, setOtpExpirySeconds] = useState(0);

  const [brandInfo, setBrandInfo] = useState<{
    clinicName: string;
    medicalName: string;
    logoUrl: string;
    clinicAddress: string;
    clinicPhone: string;
  }>({
    clinicName: 'Sandana Clinic',
    medicalName: 'Dudrucs',
    logoUrl: '',
    clinicAddress: '42, MG Healthcare Road, Anna Nagar, Chennai - 600040',
    clinicPhone: '+91 98400 11223',
  });

  useEffect(() => {
    const unsubClinic = onSnapshot(
      doc(db, 'settings', 'clinic'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data() as any;
          setBrandInfo((prev) => ({
            ...prev,
            clinicName: d.clinicName || 'Sandana Clinic',
            medicalName: d.medicalName || 'Dudrucs',
            logoUrl: d.logoUrl || prev.logoUrl,
            clinicAddress:
              d.clinicAddress ||
              d.address ||
              '42, MG Healthcare Road, Anna Nagar, Chennai - 600040',
            clinicPhone: d.clinicPhone || d.phone || '+91 98400 11223',
          }));
        }
      },
      () => {}
    );

    const unsubSite = onSnapshot(
      doc(db, 'settings', 'site'),
      (snap) => {
        if (snap.exists()) {
          const s = snap.data() as any;
          setBrandInfo((prev) => ({
            ...prev,
            logoUrl: prev.logoUrl || s.logoUrl || '',
          }));
        }
      },
      () => {}
    );

    return () => {
      unsubClinic();
      unsubSite();
    };
  }, []);

  useEffect(() => {
    if (
      portal === 'admin' ||
      portal === 'pharmacy' ||
      portal === 'doctor' ||
      portal === 'reception'
    ) {
      setSelectedPortal(portal);
    }
  }, [portal]);

  // Countdown interval for OTP validity & anti-brute-force lockout
  useEffect(() => {
    const timer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          if (prev === 1) setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
      setOtpExpirySeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Email 6-Digit OTP Login state (No Mobile OTP)
  const [otpEmailAddress, setOtpEmailAddress] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpBanner, setOtpBanner] = useState<string | null>(null);
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);

  // Email / ID & Password Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Doctor selector for Doctor Login (loaded live from Firestore `doctors`)
  const [doctorOptions, setDoctorOptions] = useState<
    Array<{
      id: string;
      name: string;
      specialization: string;
      email: string;
    }>
  >([
    {
      id: 'doc_sandana_1',
      name: 'Dr. S. Sandana Krishnan',
      specialization: 'General Physician & Diabetologist',
      email: 'dr.sandana@sandanaclinic.com',
    },
    {
      id: 'doc_sandana_2',
      name: 'Dr. Priya Ramanathan',
      specialization: 'Consultant Pediatrician',
      email: 'dr.priya@sandanaclinic.com',
    },
    {
      id: 'doc_sandana_3',
      name: 'Dr. Arvind Narayanan',
      specialization: 'Orthopedic Surgeon',
      email: 'dr.arvind@sandanaclinic.com',
    },
  ]);
  const [selectedDoctorProfile, setSelectedDoctorProfile] =
    useState('doc_sandana_1');

  useEffect(() => {
    const loadDoctorsForLogin = async () => {
      try {
        const snap = await getDocs(collection(db, 'doctors'));
        const list = snap.docs
          .map((d, idx) => {
            const data = d.data() as Record<string, any>;
            const cleanFirstWord = String(data.name || `doctor${idx + 1}`)
              .replace(/^dr\.?\s*/i, '')
              .trim()
              .split(/\s+/)[0]
              ?.replace(/[^a-zA-Z0-9]/g, '')
              .toLowerCase();
            return {
              id: d.id,
              name: String(data.name || 'Clinic Doctor'),
              specialization: String(
                data.specialization || 'General Physician'
              ),
              email: String(
                data.email ||
                  data.loginId ||
                  `dr.${cleanFirstWord || 'doctor'}@sandanaclinic.com`
              )
                .trim()
                .toLowerCase(),
              isActive: data.isActive !== false,
            };
          })
          .filter((d) => d.isActive);

        if (list.length > 0) {
          setDoctorOptions(list);
          setSelectedDoctorProfile((prev) =>
            list.some((d) => d.id === prev) ? prev : list[0].id
          );
        }
      } catch {
        // Fallback doctor options remain active
      }
    };
    loadDoctorsForLogin();
  }, []);

  const handleDoctorSelectionChange = (docId: string) => {
    setSelectedDoctorProfile(docId);
    const chosen = doctorOptions.find((d) => d.id === docId);
    if (chosen && chosen.email) {
      setEmail(chosen.email);
      setOtpEmailAddress(chosen.email);
    }
  };

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 6-Digit Numeric Security Captcha State (Locked until user clicks Change Captcha)
  const [currentCaptcha, setCurrentCaptcha] = useState(() =>
    Math.floor(100000 + Math.random() * 900000).toString()
  );
  const [enteredCaptcha, setEnteredCaptcha] = useState('');
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  const validateCaptcha = (): boolean => {
    if (!enteredCaptcha.trim()) {
      setCaptchaError('सुरक्षा कैप्चा अनिवार्य है! कृपया नीचे दिखाया गया 6-अंकों का कोड दर्ज करें।');
      return false;
    }
    if (enteredCaptcha.trim().length !== 6 || enteredCaptcha.trim() !== currentCaptcha.trim()) {
      setCaptchaError('गलत कैप्चा कोड! कृपया दिखाया गया 6-अंकों का सही कोड दर्ज करें।');
      return false;
    }
    setCaptchaError(null);
    return true;
  };

  const registerFailedAttempt = (customMessage: string) => {
    const next = failedAttempts + 1;
    setFailedAttempts(next);
    if (next >= 5) {
      setLockoutSeconds(30);
      setErrorMsg(
        'Security Lockout: 5 failed login attempts detected. Access locked for 30 seconds.'
      );
    } else {
      setErrorMsg(`${customMessage} (${5 - next} attempts remaining)`);
    }
  };

  const portalMeta: Record<
    StaffRole,
    {
      title: string;
      shortTitle: string;
      loginSubtext: string;
      leftBrandHeading: string;
      leftTagline: string;
      placeholderEmail: string;
      defaultPhone: string;
      instantLabel: string;
      targetRoute: string;
      icon: React.ComponentType<{ size?: number; className?: string }>;
    }
  > = {
    pharmacy: {
      title: 'Pharmacy ERP Login',
      shortTitle: 'Pharmacy ERP',
      loginSubtext: `Log in to your ${brandInfo.medicalName} Pharmacy ERP account.`,
      leftBrandHeading: 'MEDIGRAPH · PHARMACY ERP',
      leftTagline:
        'Empowering Healthcare, One Click at a Time: Your Pharmacy Inventory, GST Billing, Your Control.',
      placeholderEmail: 'pharmacy@sandanaclinic.com',
      defaultPhone: '9840011223',
      instantLabel: 'Instant Launch Pharmacy ERP Console',
      targetRoute: '/pharmacy',
      icon: Pill,
    },
    admin: {
      title: 'Admin Panel Login',
      shortTitle: 'Admin Panel',
      loginSubtext: `Log in to your ${brandInfo.clinicName} Chief Admin account.`,
      leftBrandHeading: 'MEDIGRAPH · ADMIN CONTROL',
      leftTagline:
        'Empowering Healthcare, One Click at a Time: Your Staff IDs, Clinic Analytics, Your Control.',
      placeholderEmail: 'kyp04010016@gmail.com',
      defaultPhone: '9840099999',
      instantLabel: 'Instant Launch Chief Admin Panel',
      targetRoute: '/admin',
      icon: ShieldCheck,
    },
    doctor: {
      title: 'Doctor OPD Login',
      shortTitle: 'Doctor OPD',
      loginSubtext: `Log in with your personal Doctor Login ID & Password created from the Admin Panel.`,
      leftBrandHeading: 'MEDIGRAPH · DOCTOR OPD',
      leftTagline:
        'Empowering Healthcare, One Click at a Time: Your Personal OPD Queue, Your Patient Records, Your Control.',
      placeholderEmail: 'dr.sandana@sandanaclinic.com',
      defaultPhone: '9840022334',
      instantLabel: 'Instant Launch Doctor OPD Console',
      targetRoute: '/doctor',
      icon: Stethoscope,
    },
    reception: {
      title: 'Reception Desk Login',
      shortTitle: 'Reception Desk',
      loginSubtext: `Log in to your ${brandInfo.clinicName} Reception & Token Desk account.`,
      leftBrandHeading: 'MEDIGRAPH · RECEPTION DESK',
      leftTagline:
        'Empowering Healthcare, One Click at a Time: Your Walk-In Queue, Token Desk, Your Control.',
      placeholderEmail: 'reception@sandanaclinic.com',
      defaultPhone: '9840033445',
      instantLabel: 'Instant Launch Reception Desk Console',
      targetRoute: '/reception',
      icon: Ticket,
    },
  };

  const currentMeta = portalMeta[selectedPortal];

  const formatCountdown = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSendEmailOtp = async (overrideEmail?: string) => {
    if (lockoutSeconds > 0) return;
    setErrorMsg(null);
    setOtpBanner(null);
    setDemoOtpHint(null);

    if (!validateCaptcha()) return;

    const rawTarget = (overrideEmail ?? otpEmailAddress).trim().toLowerCase();
    if (!rawTarget || !rawTarget.includes('@')) {
      setErrorMsg('Please enter a valid Email Address to receive your 6-digit OTP.');
      return;
    }

    setSendingOtp(true);
    try {
      const verifiedStaff = await verifyStaffEmailForPortal(
        rawTarget,
        selectedPortal
      );
      if (
        selectedPortal === 'doctor' &&
        verifiedStaff.role === 'doctor' &&
        verifiedStaff.doctorId &&
        selectedDoctorProfile &&
        verifiedStaff.doctorId !== selectedDoctorProfile
      ) {
        setSelectedDoctorProfile(verifiedStaff.doctorId);
      }

      await generateAndSendOTP({
        identifier: rawTarget,
        email: rawTarget,
        recipientName: `${verifiedStaff.name} (${rawTarget})`,
        purpose: 'staff_login',
        deliveryChannel: 'email',
      });

      setOtpSent(true);
      setOtpExpirySeconds(300);
      setOtpBanner(
        `6-Digit Security OTP sent to Email (${rawTarget}). Valid for 5 minutes.`
      );
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not send Email OTP.');
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyEmailOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    setErrorMsg(null);

    if (!validateCaptcha()) return;

    if (!otpSent) {
      await handleSendEmailOtp();
      return;
    }

    const cleanEmail = otpEmailAddress.trim().toLowerCase();
    setLoading(true);
    try {
      const roleAssigned = await loginWithEmailOTP(
        cleanEmail,
        otpCode,
        selectedPortal
      );
      setFailedAttempts(0);
      navigate(getRoleHomeRoute(roleAssigned));
    } catch (err: any) {
      registerFailedAttempt(err?.message || 'Email OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    setErrorMsg(null);

    if (!validateCaptcha()) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !password.trim()) {
      setErrorMsg('Please enter your registered Login ID / Email and password.');
      return;
    }

    setLoading(true);
    try {
      if (selectedPortal === 'doctor') {
        const verifiedProfile = await verifyStaffEmailForPortal(
          cleanEmail,
          'doctor'
        );
        if (
          verifiedProfile.role === 'doctor' &&
          verifiedProfile.doctorId &&
          selectedDoctorProfile &&
          verifiedProfile.doctorId !== selectedDoctorProfile
        ) {
          setSelectedDoctorProfile(verifiedProfile.doctorId);
        }
      }

      const verifiedRole = await loginWithEmail(
        cleanEmail,
        password,
        selectedPortal
      );
      setFailedAttempts(0);
      navigate(getRoleHomeRoute(verifiedRole));
    } catch (err: any) {
      registerFailedAttempt(
        err?.code === 'auth/invalid-credential' ||
          err?.code === 'auth/wrong-password' ||
          err?.code === 'auth/user-not-found'
          ? 'Invalid Login ID or password. Please use the exact Login ID & Password created by Admin.'
          : err?.message || 'Login failed. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleButtonLogin = async () => {
    if (lockoutSeconds > 0) return;
    setErrorMsg(null);

    if (!validateCaptcha()) return;

    setLoading(true);
    try {
      const verifiedRole = await loginWithGoogle(selectedPortal);
      setFailedAttempts(0);
      navigate(getRoleHomeRoute(verifiedRole));
    } catch (err: any) {
      registerFailedAttempt(
        err?.message || 'Google login could not be completed. Please try again or use Email OTP.'
      );
    } finally {
      setLoading(false);
    }
  };

  const switchDepartment = (role: StaffRole) => {
    setSelectedPortal(role);
    setErrorMsg(null);
    setOtpSent(false);
    navigate(`/login/${role}`);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-[#EEF2F6] py-6 sm:py-10 px-4 sm:px-6 flex flex-col items-center justify-center">
      <div className="w-full max-w-[1080px] mx-auto space-y-4">
        {/* PERSISTENT LOGIN ACTIVE BANNER (Shown when already signed in) */}
        {userProfile && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-[#467FA3]/30 rounded-2xl p-3.5 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#467FA3]/10 text-[#467FA3] flex items-center justify-center shrink-0">
                <ShieldCheck size={19} />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#467FA3]">
                  Active Persistent Session (Stays Logged In Until You Click
                  Logout)
                </p>
                <p className="text-xs sm:text-sm font-bold text-slate-900">
                  Signed in as {userProfile.name} &middot;{' '}
                  <span className="uppercase text-[#467FA3]">
                    {currentLoggedRole || userProfile.role}
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  navigate(
                    getRoleHomeRoute(currentLoggedRole || userProfile.role)
                  )
                }
                className="px-4 py-2 rounded-full bg-[#467FA3] hover:bg-[#386B8C] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0"
              >
                <span>
                  Open {(currentLoggedRole || userProfile.role).toUpperCase()}{' '}
                  Portal
                </span>
                <ArrowRight size={13} />
              </button>
              <button
                type="button"
                onClick={() => logout()}
                className="px-3.5 py-2 rounded-full border border-slate-300 hover:border-red-300 hover:bg-red-50 text-slate-700 hover:text-red-700 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* DEPARTMENT PORTAL SWITCHER BAR (All 4 Portals Share This Medigraph Split Design) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/90 backdrop-blur-xs px-4 py-3 rounded-2xl shadow-xs border border-slate-200/80">
          <div className="flex items-center gap-2.5">
            <MedigraphCapsuleLogo variant="dark" className="w-10 h-5 shrink-0" />
            <span className="text-xs font-bold text-slate-800">
              {brandInfo.clinicName} &middot; Select Department Login Panel
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {(
              [
                { id: 'pharmacy', label: 'Pharmacy ERP', icon: Pill },
                { id: 'admin', label: 'Admin Panel', icon: ShieldCheck },
                { id: 'doctor', label: 'Doctor OPD', icon: Stethoscope },
                { id: 'reception', label: 'Reception', icon: Ticket },
              ] as const
            ).map((tab) => {
              const active = selectedPortal === tab.id;
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => switchDepartment(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[#467FA3] text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <TabIcon size={13} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* =================================================================== */}
        {/* MEDIGRAPH SPLIT-CARD LOGIN PANEL (EXACT MATCH TO image_7892dea9.png) */}
        {/* =================================================================== */}
        <AnimatePresence mode="wait">
          <motion.div
            key={selectedPortal}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 lg:grid-cols-2 bg-white shadow-[0_25px_70px_-15px_rgba(15,23,42,0.14)] overflow-hidden min-h-[640px]"
          >
            {/* =============================================================== */}
            {/* LEFT PANEL: DOCTOR STETHOSCOPE PHOTO + STEEL-BLUE GRADIENT      */}
            {/* =============================================================== */}
            <div className="relative min-h-[340px] lg:min-h-[640px] overflow-hidden bg-[#D9E6F0] select-none">
              {/* Cropped Left Half of Reference Image (/assets/aistudio/image_7892dea9.png) */}
              <img
                src="/assets/aistudio/image_7892dea9.png"
                alt="Doctor holding stethoscope clinical backdrop"
                className="absolute max-w-none pointer-events-none"
                style={{
                  width: '228.05%',
                  height: '120.48%',
                  left: '-14.02%',
                  top: '-10.24%',
                  objectFit: 'cover',
                }}
              />

              {/* Bottom Steel-Blue Gradient Overlay for Crisp Dynamic Department Branding */}
              <div className="absolute inset-x-0 bottom-0 h-[52%] bg-gradient-to-t from-[#457EA2] via-[#457EA2]/95 to-transparent flex flex-col justify-end p-8 sm:p-12 text-white">
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08, duration: 0.25 }}
                  className="space-y-3 max-w-md"
                >
                  {/* White-outlined Medigraph Capsule Emblem */}
                  <MedigraphCapsuleLogo
                    variant="light"
                    className="w-14 h-7 mb-2"
                  />

                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-[0.14em] uppercase text-white">
                    {currentMeta.leftBrandHeading}
                  </h2>

                  <p className="text-sm sm:text-[15px] text-white/95 leading-relaxed font-normal">
                    {currentMeta.leftTagline}
                  </p>
                </motion.div>
              </div>
            </div>

            {/* =============================================================== */}
            {/* RIGHT PANEL: PURE WHITE MINIMALIST MEDIGRAPH LOGIN FORM         */}
            {/* =============================================================== */}
            <div className="bg-white px-7 sm:px-14 py-10 sm:py-12 flex flex-col justify-center">
              <div className="w-full max-w-[360px] mx-auto space-y-6">
                {/* Top Capsule Icon + "Login" Heading */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    {brandInfo.logoUrl ? (
                      <div className="flex items-center gap-2.5">
                        <MedigraphCapsuleLogo
                          variant="dark"
                          className="w-13 h-6"
                        />
                        <img
                          src={brandInfo.logoUrl}
                          alt={brandInfo.clinicName}
                          referrerPolicy="no-referrer"
                          className="h-7 w-auto object-contain rounded"
                        />
                      </div>
                    ) : (
                      <MedigraphCapsuleLogo
                        variant="dark"
                        className="w-13 h-6"
                      />
                    )}

                    <span className="text-[11px] font-semibold text-[#467FA3] bg-[#467FA3]/10 px-2.5 py-1 rounded-full">
                      {currentMeta.shortTitle}
                    </span>
                  </div>

                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                      Login
                    </h1>
                    <p className="text-xs text-slate-400 mt-1">
                      {currentMeta.loginSubtext}
                    </p>
                  </div>
                </div>

                {/* Mode Switcher: Only Email Login & Email OTP (No Mobile OTP, No Social OTP) */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-full text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode('password');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-2 px-3 rounded-full transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      loginMode === 'password'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <AtSign size={13} className="text-[#467FA3]" />
                    <span>Email Login</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginMode('email_otp');
                      setErrorMsg(null);
                    }}
                    className={`flex-1 py-2 px-3 rounded-full transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer ${
                      loginMode === 'email_otp'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <KeyRound size={13} className="text-[#467FA3]" />
                    <span>Email OTP</span>
                  </button>
                </div>

                {/* Doctor Selector (Only when Doctor OPD is selected) */}
                {selectedPortal === 'doctor' && (
                  <div className="space-y-1.5 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                    <label className="block text-[11px] font-bold text-slate-800">
                      Select Doctor Profile (अपना डॉक्टर नाम चुनें)
                    </label>
                    <select
                      value={selectedDoctorProfile}
                      onChange={(e) =>
                        handleDoctorSelectionChange(e.target.value)
                      }
                      className="w-full px-4 py-2.5 text-xs font-bold border border-slate-300 rounded-full bg-white text-slate-900 focus:outline-none focus:border-[#467FA3]"
                    >
                      {doctorOptions.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.specialization}) — Login: {d.email}
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-slate-500 px-1">
                      ℹ️ प्रत्येक डॉक्टर का अपना अलग Login ID और Password है। लॉगिन करने पर केवल आपके नाम से बुक किए गए मरीज ही दिखेंगे।
                    </p>
                  </div>
                )}

                {/* Lockout or Error Alert */}
                {lockoutSeconds > 0 && (
                  <div className="p-3 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-2 text-xs font-semibold text-red-700">
                    <div className="flex items-center gap-2">
                      <ShieldAlert size={15} className="shrink-0" />
                      <span>Locked for security cooldown</span>
                    </div>
                    <span className="font-mono tabular-nums px-2 py-0.5 rounded-full bg-red-600 text-white text-[11px]">
                      {lockoutSeconds}s
                    </span>
                  </div>
                )}

                {errorMsg && lockoutSeconds === 0 && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-xs font-medium text-red-700 flex items-center gap-2">
                    <ShieldAlert size={14} className="text-red-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* =========================================================== */}
                {/* MODE 1: EMAIL & PASSWORD + GOOGLE LOGIN (EXACT REFERENCE UI) */}
                {/* =========================================================== */}
                {loginMode === 'password' && (
                  <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-800">
                        Email
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        className="w-full px-5 py-3 text-xs sm:text-sm border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-[#467FA3] transition-colors"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-800">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full pl-5 pr-11 py-3 text-xs sm:text-sm border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-[#467FA3] transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          aria-label={
                            showPassword ? 'Hide password' : 'Show password'
                          }
                        >
                          {showPassword ? (
                            <Eye size={16} />
                          ) : (
                            <EyeOff size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-end pt-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          const targetEmail =
                            email.trim() || currentMeta.placeholderEmail;
                          setLoginMode('email_otp');
                          setOtpEmailAddress(targetEmail);
                          handleSendEmailOtp(targetEmail);
                        }}
                        className="text-xs font-semibold text-[#467FA3] hover:text-[#356685] transition-colors"
                      >
                        Forgot Password (Email OTP)?
                      </button>
                    </div>

                    {/* 6-Digit Numeric Security CAPTCHA (Niche ke side) */}
                    <NumericCaptcha
                      code={currentCaptcha}
                      onCaptchaChange={setCurrentCaptcha}
                      inputVal={enteredCaptcha}
                      onInputChange={(val) => {
                        setEnteredCaptcha(val);
                        if (captchaError) setCaptchaError(null);
                      }}
                      error={captchaError}
                      disabled={loading || lockoutSeconds > 0}
                    />

                    <div className="space-y-3 pt-2">
                      <button
                        type="submit"
                        disabled={loading || lockoutSeconds > 0 || enteredCaptcha.length !== 6}
                        className="w-full py-3.5 rounded-full bg-[#467FA3] hover:bg-[#386B8C] text-white font-semibold text-xs sm:text-sm shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {loading ? 'Signing in...' : 'Log In'}
                      </button>

                      <button
                        type="button"
                        onClick={handleGoogleButtonLogin}
                        disabled={loading || lockoutSeconds > 0 || enteredCaptcha.length !== 6}
                        className="w-full py-3.5 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <GoogleGIcon className="w-4 h-4 shrink-0" />
                        <span>Log in with Google</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* =========================================================== */}
                {/* MODE 2: EMAIL ADDRESS 6-DIGIT OTP LOGIN (NO MOBILE OTP)     */}
                {/* =========================================================== */}
                {loginMode === 'email_otp' && (
                  <form
                    onSubmit={handleVerifyEmailOtpLogin}
                    className="space-y-4"
                  >
                    {otpBanner && (
                      <div className="p-3 bg-[#467FA3]/10 border border-[#467FA3]/30 rounded-2xl text-xs text-slate-800 flex items-center justify-between font-bold text-[#356685]">
                        <span>{otpBanner}</span>
                        {otpExpirySeconds > 0 && (
                          <span className="font-mono tabular-nums px-2 py-0.5 rounded-full bg-[#467FA3] text-white text-[10px]">
                            {formatCountdown(otpExpirySeconds)}
                          </span>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-800">
                        Registered Email Address (for OTP)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          required
                          value={otpEmailAddress}
                          onChange={(e) => setOtpEmailAddress(e.target.value)}
                          placeholder={currentMeta.placeholderEmail}
                          className="w-full px-5 py-3 text-xs sm:text-sm border border-slate-200 rounded-full text-slate-900 placeholder:text-slate-300 focus:outline-none focus:border-[#467FA3]"
                        />
                        <button
                          type="button"
                          onClick={() => handleSendEmailOtp()}
                          disabled={sendingOtp || lockoutSeconds > 0 || enteredCaptcha.length !== 6}
                          className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-full shrink-0 inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                          <Send size={12} />
                          <span>{sendingOtp ? '...' : 'Send OTP'}</span>
                        </button>
                      </div>
                    </div>

                    {otpSent && (
                      <div className="space-y-1.5">
                        <label className="block text-xs font-semibold text-slate-800">
                          6-Digit Email OTP
                        </label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={otpCode}
                          onChange={(e) =>
                            setOtpCode(
                              e.target.value.replace(/\D/g, '').slice(0, 6)
                            )
                          }
                          placeholder="6-digit Email OTP"
                          className="w-full px-5 py-3 text-sm font-mono font-bold tracking-[0.3em] text-center border border-[#467FA3] rounded-full bg-slate-50 text-slate-900 focus:outline-none tabular-nums"
                        />
                      </div>
                    )}

                    {/* 6-Digit Numeric Security CAPTCHA (Niche ke side) */}
                    <NumericCaptcha
                      code={currentCaptcha}
                      onCaptchaChange={setCurrentCaptcha}
                      inputVal={enteredCaptcha}
                      onInputChange={(val) => {
                        setEnteredCaptcha(val);
                        if (captchaError) setCaptchaError(null);
                      }}
                      error={captchaError}
                      disabled={loading || sendingOtp || lockoutSeconds > 0}
                    />

                    <div className="space-y-2.5 pt-1">
                      <button
                        type="submit"
                        disabled={loading || sendingOtp || lockoutSeconds > 0 || enteredCaptcha.length !== 6}
                        className="w-full py-3.5 rounded-full bg-[#467FA3] hover:bg-[#386B8C] text-white font-semibold text-xs sm:text-sm shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {loading
                          ? 'Verifying Email OTP...'
                          : otpSent
                          ? 'Verify Email OTP & Log In'
                          : 'Send 6-Digit OTP to Email'}
                      </button>

                      <button
                        type="button"
                        onClick={handleGoogleButtonLogin}
                        disabled={loading || lockoutSeconds > 0 || enteredCaptcha.length !== 6}
                        className="w-full py-3 rounded-full border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 font-semibold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <GoogleGIcon className="w-4 h-4 shrink-0" />
                        <span>Log in with Google</span>
                      </button>
                    </div>
                  </form>
                )}

                {/* Bottom Quick Access Footer (Login Only — No Signup) */}
                <div className="pt-3 border-t border-slate-100 text-center space-y-2.5">
                  <div className="flex items-center justify-center gap-4 text-[11px] text-slate-400">
                    <Link
                      to="/"
                      className="hover:text-slate-700 transition-colors"
                    >
                      &larr; Clinic Home
                    </Link>
                    <span>&middot;</span>
                    <span className="text-emerald-600 font-medium inline-flex items-center gap-1">
                      <CheckCircle2 size={11} />
                      Secure Encrypted Session
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};
