import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User as FirebaseUser,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  facebookProvider,
  twitterProvider,
} from '../firebase';
import { seedInitialClinicData } from '../utils/seedData';
import { logStaffActivity } from '../utils/activityLogger';
import { sanitizeOtpDocId, verifyOTPCode } from '../utils/emailOTP';
import { saveRecordToSql } from '../utils/sqlSyncBridge';

export type StaffRole = 'admin' | 'doctor' | 'pharmacy' | 'reception';
export type SocialProviderType =
  | 'google_plus'
  | 'facebook'
  | 'x'
  | 'instagram';

export interface StaffProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  isActive: boolean;
  staffKey?: string;
  doctorId?: string;
  specialization?: string;
  createdAt: string;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  user: FirebaseUser | null;
  userProfile: StaffProfile | null;
  profile: StaffProfile | null;
  role: StaffRole | null;
  isTrueAdmin: boolean;
  loading: boolean;
  inactivityMinutesLeft: number;
  verifyStaffEmailForPortal: (
    emailOrId: string,
    targetPortal: StaffRole
  ) => Promise<StaffProfile>;
  loginWithEmail: (
    emailOrId: string,
    password: string,
    expectedPortal?: StaffRole
  ) => Promise<StaffRole>;
  loginWithEmailOTP: (
    emailInput: string,
    otpCode: string,
    expectedPortal?: StaffRole
  ) => Promise<StaffRole>;
  loginWithStaffOTP: (
    emailOrPhone: string,
    otpCode: string,
    expectedPortal?: StaffRole
  ) => Promise<StaffRole>;
  loginWithPhoneOTP: (
    phone10: string,
    otpCode: string,
    expectedPortal?: StaffRole
  ) => Promise<StaffRole>;
  loginWithGoogle: (expectedPortal?: StaffRole) => Promise<StaffRole>;
  connectSocialAccountPopup: (provider: SocialProviderType) => Promise<{
    socialId: string;
    name: string;
    email: string;
    phone: string;
    connectedViaPopup: boolean;
  }>;
  loginOrSignupWithSocialOTP: (params: {
    provider: SocialProviderType;
    socialId: string;
    fullName?: string;
    phone10?: string;
    otpCode: string;
    targetRole: StaffRole;
    isSignup?: boolean;
  }) => Promise<StaffRole>;
  signupWithEmailAndOTP: (params: {
    fullName: string;
    email: string;
    phone10: string;
    password: string;
    otpCode: string;
    targetRole: StaffRole;
  }) => Promise<StaffRole>;
  loginAsRolePortal: (
    targetRole: StaffRole,
    customName?: string,
    customUid?: string
  ) => Promise<StaffRole>;
  logout: () => Promise<void>;
  setPreviewRole: (role: StaffRole) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const BOOTSTRAPPED_ADMIN_EMAIL = 'kyp04010016@gmail.com';
const OTP_SESSION_STORAGE_KEY = 'sandana_persistent_staff_session_v2';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<StaffProfile | null>(() => {
    try {
      const saved =
        localStorage.getItem(OTP_SESSION_STORAGE_KEY) ||
        sessionStorage.getItem('sandana_otp_staff_session');
      if (saved) {
        return JSON.parse(saved) as StaffProfile;
      }
    } catch {
      // Ignore parse error
    }
    return null;
  });
  const [overrideRole, setOverrideRole] = useState<StaffRole | null>(null);
  const [isTrueAdmin, setIsTrueAdmin] = useState<boolean>(() => {
    try {
      const saved =
        localStorage.getItem(OTP_SESSION_STORAGE_KEY) ||
        sessionStorage.getItem('sandana_otp_staff_session');
      if (saved) {
        const parsed = JSON.parse(saved) as StaffProfile;
        return (
          parsed.role === 'admin' ||
          parsed.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
        );
      }
    } catch {
      // Ignore
    }
    return false;
  });
  const [loading, setLoading] = useState(true);
  const [inactivityMinutesLeft] = useState<number>(999);

  /**
   * Looks up a registered staff, doctor, or admin account in Firestore (`users`, `doctors`, and `otp_verification`).
   * Strictly rejects any email/ID that was NOT created by Admin (except Chief Admin kyp04010016@gmail.com).
   */
  const lookupRegisteredStaffAccount = async (
    rawIdentifier: string
  ): Promise<StaffProfile> => {
    const cleanInput = rawIdentifier.trim().toLowerCase();
    if (!cleanInput) {
      throw new Error('कृपया अपना रजिस्टर्ड Login Email या Staff/Doctor ID दर्ज करें।');
    }

    // 1. Chief Admin Bootstrapped Email
    if (cleanInput === BOOTSTRAPPED_ADMIN_EMAIL) {
      const adminProfile: StaffProfile = {
        uid: 'admin_chief_owner',
        name: 'Chief Administrator',
        email: BOOTSTRAPPED_ADMIN_EMAIL,
        phone: '9840099999',
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      return adminProfile;
    }

    // Load doctors list to resolve doctorId & doctor-specific login credentials
    const doctorsSnap = await getDocs(collection(db, 'doctors')).catch(() => null);
    const doctorsList: Array<Record<string, any>> = doctorsSnap
      ? doctorsSnap.docs.map((d) => ({
          ...(d.data() as Record<string, any>),
          id: d.id,
        }))
      : [];

    const findMatchingDoctor = (
      candidateId?: string,
      candidateEmail?: string,
      candidateName?: string,
      candidatePhone?: string
    ) => {
      const cId = (candidateId || '').trim().toLowerCase();
      const cEmail = (candidateEmail || '').trim().toLowerCase();
      const cName = (candidateName || '').trim().toLowerCase();
      const cPhone = (candidatePhone || '').replace(/\D/g, '').slice(-10);

      return doctorsList.find((docItem) => {
        const dId = String(docItem.id || '').trim().toLowerCase();
        const dUid = String(docItem.uid || '').trim().toLowerCase();
        const dEmail = String(docItem.email || docItem.loginId || '')
          .trim()
          .toLowerCase();
        const dName = String(docItem.name || '').trim().toLowerCase();
        const dPhone = String(docItem.phone || '').replace(/\D/g, '').slice(-10);

        if (cId && (dId === cId || (dUid && dUid === cId))) return true;
        if (cEmail && dEmail && dEmail === cEmail) return true;
        if (cName && dName && dName === cName) return true;
        if (cPhone.length === 10 && dPhone === cPhone) return true;
        return false;
      });
    };

    // 2. Check otp_verification/staff_* lookup record (written by Admin StaffManager / Doctors Manager)
    const staffOtpDocId = sanitizeOtpDocId(cleanInput, 'staff');
    const staffOtpSnap = await getDoc(
      doc(db, 'otp_verification', staffOtpDocId)
    ).catch(() => null);

    let otpStaffData: Record<string, any> | null = null;
    if (staffOtpSnap && staffOtpSnap.exists()) {
      otpStaffData = staffOtpSnap.data();
      if (otpStaffData.purpose === 'staff_blocked') {
        throw new Error(
          'आपकी लॉगिन आईडी एडमिन द्वारा ब्लॉक (Blocked) कर दी गई है। कृपया एडमिन से संपर्क करें।'
        );
      }
    }

    const inputPhone = cleanInput.replace(/\D/g, '').slice(-10);

    // 3. Search `users` collection for matching email, loginId, uid, doctorId, or phone
    const usersSnap = await getDocs(collection(db, 'users')).catch(() => null);
    if (usersSnap) {
      for (const d of usersSnap.docs) {
        const data = d.data();
        const docEmail = String(data.email || data.loginId || '')
          .trim()
          .toLowerCase();
        const docUid = String(d.id || '').trim().toLowerCase();
        const docDoctorId = String(data.doctorId || '').trim().toLowerCase();
        const docPhone = String(data.phone || '').replace(/\D/g, '').slice(-10);

        const isMatch =
          (docEmail && docEmail === cleanInput) ||
          docUid === cleanInput ||
          (docDoctorId && docDoctorId === cleanInput) ||
          (inputPhone.length === 10 && docPhone === inputPhone);

        if (isMatch) {
          if (data.isActive === false) {
            throw new Error(
              'आपकी लॉगिन आईडी एडमिन द्वारा ब्लॉक (Deactivated) कर दी गई है।'
            );
          }
          const resolvedRole =
            (data.role as StaffRole) ||
            (otpStaffData?.staffRole as StaffRole) ||
            'pharmacy';

          const matchedDoc =
            resolvedRole === 'doctor'
              ? findMatchingDoctor(
                  data.doctorId || d.id,
                  docEmail,
                  data.name,
                  docPhone
                )
              : undefined;

          return {
            uid: d.id,
            name: String(
              matchedDoc?.name ||
                data.name ||
                otpStaffData?.staffName ||
                'Clinic Staff'
            ),
            email: String(data.email || matchedDoc?.email || cleanInput),
            phone: String(
              data.phone || matchedDoc?.phone || otpStaffData?.phone || ''
            ),
            role: resolvedRole,
            isActive: data.isActive !== false,
            staffKey: String(
              data.staffKey ||
                data.password ||
                matchedDoc?.staffKey ||
                otpStaffData?.staffKey ||
                ''
            ),
            doctorId:
              resolvedRole === 'doctor'
                ? String(data.doctorId || matchedDoc?.id || d.id)
                : undefined,
            specialization:
              resolvedRole === 'doctor'
                ? String(
                    data.specialization ||
                      matchedDoc?.specialization ||
                      'General Physician'
                  )
                : undefined,
            createdAt: String(data.createdAt || new Date().toISOString()),
          };
        }
      }
    }

    // 4. Search `doctors` collection directly for Doctor-specific Login ID / Email & Password
    const matchedDoctorDirect = findMatchingDoctor(
      cleanInput,
      cleanInput,
      cleanInput,
      inputPhone
    );
    if (matchedDoctorDirect) {
      if (matchedDoctorDirect.isActive === false) {
        throw new Error(
          `डॉक्टर प्रोफाइल (${matchedDoctorDirect.name}) वर्तमान में एडमिन द्वारा निष्क्रिय (Hidden/Blocked) किया गया है।`
        );
      }
      return {
        uid: String(matchedDoctorDirect.id),
        doctorId: String(matchedDoctorDirect.id),
        name: String(matchedDoctorDirect.name),
        email: String(
          matchedDoctorDirect.email ||
            matchedDoctorDirect.loginId ||
            cleanInput
        ),
        phone: String(matchedDoctorDirect.phone || ''),
        role: 'doctor',
        specialization: String(
          matchedDoctorDirect.specialization || 'General Physician'
        ),
        isActive: true,
        staffKey: String(
          matchedDoctorDirect.staffKey ||
            matchedDoctorDirect.password ||
            otpStaffData?.staffKey ||
            ''
        ),
        createdAt: String(
          matchedDoctorDirect.createdAt || new Date().toISOString()
        ),
      };
    }

    // 5. If found in otp_verification/staff_* even if users/doctors doc wasn't matched
    if (otpStaffData && otpStaffData.staffRole) {
      const otpRole = otpStaffData.staffRole as StaffRole;
      const matchedDoc =
        otpRole === 'doctor'
          ? findMatchingDoctor(
              otpStaffData.doctorId,
              otpStaffData.email || cleanInput,
              otpStaffData.staffName,
              otpStaffData.phone
            )
          : undefined;

      return {
        uid: String(otpStaffData.doctorId || matchedDoc?.id || staffOtpDocId),
        doctorId:
          otpRole === 'doctor'
            ? String(otpStaffData.doctorId || matchedDoc?.id || staffOtpDocId)
            : undefined,
        specialization:
          otpRole === 'doctor'
            ? String(
                otpStaffData.specialization ||
                  matchedDoc?.specialization ||
                  'General Physician'
              )
            : undefined,
        name: String(
          matchedDoc?.name || otpStaffData.staffName || 'Clinic Staff'
        ),
        email: String(otpStaffData.email || cleanInput),
        phone: String(otpStaffData.phone || ''),
        role: otpRole,
        isActive: otpStaffData.purpose !== 'staff_blocked',
        staffKey: String(otpStaffData.staffKey || matchedDoc?.staffKey || ''),
        createdAt: String(otpStaffData.createdAt || new Date().toISOString()),
      };
    }

    throw new Error(
      `अमान्य लॉगिन आईडी (${rawIdentifier})! यह ईमेल/आईडी Admin Panel में रजिस्टर्ड नहीं है। केवल Admin Panel (Doctor Manager / Staff Manager) से बनाए गए लॉगिन आईडी और पासवर्ड से ही लॉगिन हो सकता है।`
    );
  };

  /**
   * Validates that the staff account's assigned role matches the selected login portal tab.
   * Only 'admin' role can log into any portal tab; pharmacy/doctor/reception staff can ONLY log into their own portal.
   */
  const enforcePortalRoleMatch = (
    profile: StaffProfile,
    expectedPortal?: StaffRole
  ) => {
    const isAdminUser =
      profile.role === 'admin' ||
      profile.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

    if (!expectedPortal || isAdminUser) {
      return;
    }

    if (profile.role !== expectedPortal) {
      const roleLabels: Record<StaffRole, string> = {
        admin: 'ADMIN PANEL',
        pharmacy: 'PHARMACY ERP',
        doctor: 'DOCTOR OPD',
        reception: 'RECEPTION DESK',
      };
      throw new Error(
        `Access Denied! आपकी लॉगिन आईडी (${profile.email}) केवल "${
          roleLabels[profile.role]
        }" विभाग के लिए बनाई गई है। आप "${
          roleLabels[expectedPortal]
        }" में लॉगिन नहीं कर सकते। कृपया ऊपर "${
          roleLabels[profile.role]
        }" टैब चुनकर लॉगिन करें।`
      );
    }
  };

  const verifyStaffEmailForPortal = async (
    emailOrId: string,
    targetPortal: StaffRole
  ): Promise<StaffProfile> => {
    const profile = await lookupRegisteredStaffAccount(emailOrId);
    enforcePortalRoleMatch(profile, targetPortal);
    return profile;
  };

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        const savedOtpSession =
          localStorage.getItem(OTP_SESSION_STORAGE_KEY) ||
          sessionStorage.getItem('sandana_otp_staff_session');
        if (savedOtpSession) {
          try {
            const parsed = JSON.parse(savedOtpSession) as StaffProfile;
            localStorage.setItem(
              OTP_SESSION_STORAGE_KEY,
              JSON.stringify(parsed)
            );
            setUserProfile(parsed);
            setIsTrueAdmin(
              parsed.role === 'admin' ||
                parsed.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
            );
            setLoading(false);
            return;
          } catch {
            localStorage.removeItem(OTP_SESSION_STORAGE_KEY);
          }
        }
        setUserProfile(null);
        setOverrideRole(null);
        setIsTrueAdmin(false);
        setLoading(false);
        return;
      }

      try {
        // Check if we already have an active verified staff session in localStorage
        const existingSaved = localStorage.getItem(OTP_SESSION_STORAGE_KEY);
        if (existingSaved) {
          const parsed = JSON.parse(existingSaved) as StaffProfile;
          if (
            parsed &&
            parsed.email &&
            (!user.email ||
              parsed.email.toLowerCase() === user.email.toLowerCase())
          ) {
            setUserProfile(parsed);
            setIsTrueAdmin(
              parsed.role === 'admin' ||
                parsed.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL
            );
            setLoading(false);
            return;
          }
        }

        const profile = await lookupRegisteredStaffAccount(
          user.email || user.uid
        );
        localStorage.setItem(OTP_SESSION_STORAGE_KEY, JSON.stringify(profile));
        setUserProfile(profile);
        const adminCheck =
          profile.role === 'admin' ||
          user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;
        setIsTrueAdmin(Boolean(adminCheck));
        if (adminCheck) {
          await seedInitialClinicData().catch(() => {});
        }
      } catch (err) {
        console.warn('Unregistered Firebase Auth user:', err);
        setUserProfile(null);
        setFirebaseUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (
    emailOrId: string,
    password: string,
    expectedPortal?: StaffRole
  ): Promise<StaffRole> => {
    const cleanInput = emailOrId.trim();
    const cleanPassword = password.trim();

    if (!cleanInput || !cleanPassword) {
      throw new Error('कृपया अपना रजिस्टर्ड Email/ID और Password दर्ज करें।');
    }

    // 1. Strictly verify account exists in Admin-created staff records (or Chief Admin)
    const staffProfile = await lookupRegisteredStaffAccount(cleanInput);

    // 2. Enforce that staff can ONLY log into their assigned department portal
    enforcePortalRoleMatch(staffProfile, expectedPortal);

    // 3. Verify password against Admin-assigned password (staffKey) OR Firebase Auth
    let passwordVerified = false;

    if (
      staffProfile.staffKey &&
      staffProfile.staffKey === cleanPassword
    ) {
      passwordVerified = true;
    }

    try {
      await setPersistence(auth, browserLocalPersistence).catch(() => {});
      await signInWithEmailAndPassword(
        auth,
        staffProfile.email || cleanInput,
        cleanPassword
      );
      passwordVerified = true;
    } catch (firebaseErr: any) {
      // If password was already verified against Admin's Firestore staffKey, allow login even if Firebase Auth Email/Password provider wasn't used
      if (!passwordVerified) {
        throw new Error(
          'गलत पासवर्ड! कृपया Admin Panel से जारी किया गया सही Password दर्ज करें।'
        );
      }
    }

    if (!passwordVerified) {
      throw new Error(
        'गलत पासवर्ड! कृपया Admin Panel से जारी किया गया सही Password दर्ज करें।'
      );
    }

    const adminCheck =
      staffProfile.role === 'admin' ||
      staffProfile.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

    if (staffProfile.role === 'doctor') {
      try {
        localStorage.setItem(
          'sandana_selected_doctor_chamber',
          JSON.stringify({
            id: staffProfile.doctorId || staffProfile.uid,
            name: staffProfile.name,
            specialization:
              staffProfile.specialization || 'General Physician',
          })
        );
      } catch {
        // ignore storage error
      }
    }

    localStorage.setItem(OTP_SESSION_STORAGE_KEY, JSON.stringify(staffProfile));
    setUserProfile(staffProfile);
    setIsTrueAdmin(adminCheck);
    setOverrideRole(adminCheck && expectedPortal ? expectedPortal : null);

    await logStaffActivity(
      staffProfile.uid,
      staffProfile.name,
      'LOGIN',
      `${staffProfile.name} (${staffProfile.role.toUpperCase()}) logged in via Email & Password`
    );

    return adminCheck && expectedPortal ? expectedPortal : staffProfile.role;
  };

  const loginWithEmailOTP = async (
    emailInput: string,
    otpCode: string,
    expectedPortal?: StaffRole
  ): Promise<StaffRole> => {
    const cleanEmail = emailInput.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('कृपया सही रजिस्टर्ड Email Address दर्ज करें।');
    }

    // 1. Strictly verify email is registered by Admin (or Chief Admin)
    const staffProfile = await lookupRegisteredStaffAccount(cleanEmail);

    // 2. Strictly enforce department portal match
    enforcePortalRoleMatch(staffProfile, expectedPortal);

    // 3. Verify 6-digit OTP
    const verifyResult = await verifyOTPCode(
      cleanEmail,
      otpCode,
      'staff_login'
    );
    if (!verifyResult.valid) {
      throw new Error(
        verifyResult.error || 'गलत या एक्सपायर 6-अंकों का Email OTP कोड।'
      );
    }

    // Try signing into Firebase Auth if staffKey exists so Firebase Auth state is also synced
    if (staffProfile.staffKey) {
      try {
        await signInWithEmailAndPassword(
          auth,
          cleanEmail,
          String(staffProfile.staffKey)
        );
      } catch {
        // Continue with verified staff profile session
      }
    }

    const adminCheck =
      staffProfile.role === 'admin' ||
      cleanEmail === BOOTSTRAPPED_ADMIN_EMAIL;

    if (staffProfile.role === 'doctor') {
      try {
        localStorage.setItem(
          'sandana_selected_doctor_chamber',
          JSON.stringify({
            id: staffProfile.doctorId || staffProfile.uid,
            name: staffProfile.name,
            specialization:
              staffProfile.specialization || 'General Physician',
          })
        );
      } catch {
        // ignore storage error
      }
    }

    localStorage.setItem(OTP_SESSION_STORAGE_KEY, JSON.stringify(staffProfile));
    setUserProfile(staffProfile);
    setIsTrueAdmin(adminCheck);
    setOverrideRole(adminCheck && expectedPortal ? expectedPortal : null);

    await logStaffActivity(
      staffProfile.uid,
      staffProfile.name,
      'EMAIL_OTP_LOGIN',
      `${staffProfile.name} (${staffProfile.role.toUpperCase()}) logged in via 6-digit Email OTP (${cleanEmail})`
    );

    return adminCheck && expectedPortal ? expectedPortal : staffProfile.role;
  };

  const loginWithPhoneOTP = async (
    phoneInput: string,
    otpCode: string,
    expectedPortal?: StaffRole
  ): Promise<StaffRole> => {
    return loginWithEmailOTP(phoneInput, otpCode, expectedPortal);
  };

  const loginWithStaffOTP = async (
    emailOrPhone: string,
    otpCode: string,
    expectedPortal?: StaffRole
  ): Promise<StaffRole> => {
    return loginWithEmailOTP(emailOrPhone, otpCode, expectedPortal);
  };

  const loginWithGoogle = async (
    expectedPortal?: StaffRole
  ): Promise<StaffRole> => {
    await setPersistence(auth, browserLocalPersistence).catch(() => {});
    const cred = await signInWithPopup(auth, googleProvider);
    const googleEmail = (cred.user.email || '').trim().toLowerCase();

    if (!googleEmail) {
      await signOut(auth).catch(() => {});
      throw new Error('Google खाते से ईमेल प्राप्त नहीं हो सका।');
    }

    let staffProfile: StaffProfile;
    try {
      staffProfile = await lookupRegisteredStaffAccount(googleEmail);
      enforcePortalRoleMatch(staffProfile, expectedPortal);
    } catch (err) {
      await signOut(auth).catch(() => {});
      throw err;
    }

    // Ensure Chief Admin doc exists in Firestore if Chief Admin logged in
    if (googleEmail === BOOTSTRAPPED_ADMIN_EMAIL) {
      const adminDoc = {
        name: cred.user.displayName || 'Chief Administrator',
        email: BOOTSTRAPPED_ADMIN_EMAIL,
        phone: '9840099999',
        role: 'admin' as const,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', cred.user.uid), adminDoc, {
        merge: true,
      }).catch(() => {});
      await saveRecordToSql('users', cred.user.uid, {
        uid: cred.user.uid,
        ...adminDoc,
      });
      await seedInitialClinicData().catch(() => {});
      staffProfile = {
        uid: cred.user.uid,
        ...adminDoc,
      };
    }

    const adminCheck =
      staffProfile.role === 'admin' ||
      googleEmail === BOOTSTRAPPED_ADMIN_EMAIL;

    localStorage.setItem(OTP_SESSION_STORAGE_KEY, JSON.stringify(staffProfile));
    setUserProfile(staffProfile);
    setIsTrueAdmin(adminCheck);
    setOverrideRole(adminCheck && expectedPortal ? expectedPortal : null);

    await logStaffActivity(
      staffProfile.uid,
      staffProfile.name,
      'LOGIN',
      `${staffProfile.name} (${staffProfile.role.toUpperCase()}) logged in via Google (${googleEmail})`
    );

    return adminCheck && expectedPortal ? expectedPortal : staffProfile.role;
  };

  const connectSocialAccountPopup = async (
    provider: SocialProviderType
  ): Promise<{
    socialId: string;
    name: string;
    email: string;
    phone: string;
    connectedViaPopup: boolean;
  }> => {
    try {
      if (provider === 'google_plus') {
        const cred = await signInWithPopup(auth, googleProvider);
        const u = cred.user;
        return {
          socialId: u.email || u.uid,
          name: u.displayName || 'Google User',
          email: u.email || '',
          phone: (u.phoneNumber || '').replace(/\D/g, '').slice(-10),
          connectedViaPopup: true,
        };
      }
      if (provider === 'facebook') {
        const cred = await signInWithPopup(auth, facebookProvider);
        const u = cred.user;
        return {
          socialId: u.email || u.uid,
          name: u.displayName || 'Facebook User',
          email: u.email || '',
          phone: (u.phoneNumber || '').replace(/\D/g, '').slice(-10),
          connectedViaPopup: true,
        };
      }
      if (provider === 'x') {
        const cred = await signInWithPopup(auth, twitterProvider);
        const u = cred.user;
        return {
          socialId: u.email || u.uid,
          name: u.displayName || 'X Account User',
          email: u.email || '',
          phone: (u.phoneNumber || '').replace(/\D/g, '').slice(-10),
          connectedViaPopup: true,
        };
      }
    } catch {
      // ignore
    }

    return {
      socialId: '',
      name: '',
      email: '',
      phone: '',
      connectedViaPopup: false,
    };
  };

  const loginOrSignupWithSocialOTP = async (params: {
    provider: SocialProviderType;
    socialId: string;
    fullName?: string;
    phone10?: string;
    otpCode: string;
    targetRole: StaffRole;
    isSignup?: boolean;
  }): Promise<StaffRole> => {
    return loginWithEmailOTP(params.socialId, params.otpCode, params.targetRole);
  };

  const signupWithEmailAndOTP = async (params: {
    fullName: string;
    email: string;
    phone10: string;
    password: string;
    otpCode: string;
    targetRole: StaffRole;
  }): Promise<StaffRole> => {
    return loginWithEmailOTP(params.email, params.otpCode, params.targetRole);
  };

  const loginAsRolePortal = async (
    targetRole: StaffRole
  ): Promise<StaffRole> => {
    if (!isTrueAdmin) {
      throw new Error(
        'केवल मुख्य एडमिन (Chief Admin) ही पोर्टल स्विच कर सकते हैं।'
      );
    }
    setOverrideRole(targetRole);
    return targetRole;
  };

  const logout = async () => {
    localStorage.removeItem(OTP_SESSION_STORAGE_KEY);
    sessionStorage.removeItem('sandana_otp_staff_session');
    if (userProfile) {
      await logStaffActivity(
        userProfile.uid,
        userProfile.name,
        'LOGOUT',
        `${userProfile.name} signed out`
      );
    }
    await signOut(auth).catch(() => {});
    setUserProfile(null);
    setOverrideRole(null);
    setIsTrueAdmin(false);
  };

  const setPreviewRole = (newRole: StaffRole) => {
    // Strictly allow role preview switching ONLY for True Admin!
    // Regular staff (pharmacy, doctor, reception) are locked to their Admin-assigned role.
    if (isTrueAdmin || userProfile?.role === 'admin') {
      setOverrideRole(newRole);
    } else {
      setOverrideRole(null);
    }
  };

  const activeRole: StaffRole | null =
    isTrueAdmin || userProfile?.role === 'admin'
      ? overrideRole || userProfile?.role || null
      : userProfile?.role || null;

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        user: firebaseUser,
        userProfile,
        profile: userProfile,
        role: activeRole,
        isTrueAdmin,
        loading,
        inactivityMinutesLeft,
        verifyStaffEmailForPortal,
        loginWithEmail,
        loginWithEmailOTP,
        loginWithStaffOTP,
        loginWithPhoneOTP,
        loginWithGoogle,
        connectSocialAccountPopup,
        loginOrSignupWithSocialOTP,
        signupWithEmailAndOTP,
        loginAsRolePortal,
        logout,
        setPreviewRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return ctx;
}

export function getRoleHomeRoute(role: StaffRole | null): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'doctor':
      return '/doctor';
    case 'pharmacy':
      return '/pharmacy';
    case 'reception':
      return '/reception';
    default:
      return '/login';
  }
}
