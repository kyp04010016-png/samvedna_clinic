import React, { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Plus,
  Trash2,
  UserCheck,
  UserX,
  Stethoscope,
  Edit3,
  Printer,
  KeyRound,
  Lock,
  Mail,
} from 'lucide-react';
import { db, getSecondaryAuth } from '../../firebase';
import { DoctorRecord } from '../public/Home';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';
import { printElementById } from '../../utils/printEngine';
import { sanitizeOtpDocId } from '../../utils/emailOTP';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function buildDefaultDoctorCredentials(docName: string, index = 1): {
  email: string;
  password: string;
} {
  const cleanWords = docName
    .replace(/^dr\.?\s*/i, '')
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ''))
    .filter((w) => w.length >= 2);

  const primaryWord = (cleanWords[0] || `doctor${index}`).toLowerCase();
  const capWord =
    primaryWord.charAt(0).toUpperCase() + primaryWord.slice(1).toLowerCase();

  return {
    email: `dr.${primaryWord}@sandanaclinic.com`,
    password: `${capWord}@123`,
  };
}

export const Doctors: React.FC = () => {
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [qualification, setQualification] = useState('');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [experience, setExperience] = useState('12+ Years Experience');
  const [consultationFee, setConsultationFee] = useState('300');
  const [regNo, setRegNo] = useState('TNMC Reg. #75410');
  const [languages, setLanguages] = useState('Tamil, English');
  const [bio, setBio] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [slotsText, setSlotsText] = useState('10:00, 10:30, 11:00, 18:00, 18:30');
  const [selectedDays, setSelectedDays] = useState<string[]>([
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
  ]);
  const [saving, setSaving] = useState(false);

  const [selectedDoctorSlip, setSelectedDoctorSlip] = useState<{
    id: string;
    name: string;
    specialization: string;
    email: string;
    password: string;
    phone: string;
  } | null>(null);

  const syncDoctorAccountToAuthCollections = async (
    doctorId: string,
    docPayload: {
      name: string;
      specialization: string;
      email: string;
      staffKey: string;
      phone?: string;
      isActive: boolean;
    }
  ) => {
    const nowIso = new Date().toISOString();
    const cleanEmail = docPayload.email.trim().toLowerCase();
    const cleanPassword = docPayload.staffKey.trim();

    const userRecord = {
      uid: doctorId,
      doctorId,
      name: docPayload.name,
      email: cleanEmail,
      loginId: cleanEmail,
      phone: docPayload.phone || '',
      role: 'doctor' as const,
      specialization: docPayload.specialization,
      staffKey: cleanPassword,
      isActive: docPayload.isActive,
      createdAt: nowIso,
    };

    try {
      await setDoc(doc(db, 'users', doctorId), userRecord, { merge: true });
      await saveRecordToSql('users', doctorId, userRecord);
    } catch (err) {
      console.warn('Could not sync doctor user record:', err);
    }

    if (cleanEmail) {
      try {
        const otpDocId = sanitizeOtpDocId(cleanEmail, 'staff');
        await setDoc(
          doc(db, 'otp_verification', otpDocId),
          {
            otp: '000000',
            expiry: '2099-12-31T23:59:59.000Z',
            email: cleanEmail,
            phone: docPayload.phone || '',
            purpose: docPayload.isActive ? 'staff_active' : 'staff_blocked',
            staffKey: cleanPassword,
            staffName: docPayload.name,
            staffRole: 'doctor',
            doctorId,
            specialization: docPayload.specialization,
            createdAt: nowIso,
          },
          { merge: true }
        );
      } catch (err) {
        console.warn('Could not sync doctor OTP lookup doc:', err);
      }
    }
  };

  const loadDoctors = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'doctors'));
      let list: DoctorRecord[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<DoctorRecord, 'id'>),
      }));

      // If empty, seed the 3 default clinic doctors with individual Login IDs & Passwords
      if (list.length === 0) {
        const defaultDoctors: DoctorRecord[] = [
          {
            id: 'doc_sandana_1',
            uid: 'doc_sandana_1',
            name: 'Dr. S. Sandana Krishnan',
            specialization: 'Senior General Physician & Diabetologist',
            qualification: 'MBBS, MD (Internal Medicine)',
            email: 'dr.sandana@sandanaclinic.com',
            loginId: 'dr.sandana@sandanaclinic.com',
            staffKey: 'Sandana@123',
            phone: '9840011223',
            experience: '18+ Years Experience',
            consultationFee: 350,
            regNo: 'TNMC Reg. #68421',
            languages: 'Tamil, English, Hindi',
            bio: 'Chief Consultant Physician specializing in Diabetes, Hypertension, Thyroid, and Internal Medicine.',
            photoUrl: '',
            availableSlots: ['10:00', '10:30', '11:00', '18:00', '18:30', '19:00'],
            availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            isActive: true,
          },
          {
            id: 'doc_sandana_2',
            uid: 'doc_sandana_2',
            name: 'Dr. Priya Ramanathan',
            specialization: 'Consultant Pediatrician & Neonatologist',
            qualification: 'MBBS, DCH, DNB (Pediatrics)',
            email: 'dr.priya@sandanaclinic.com',
            loginId: 'dr.priya@sandanaclinic.com',
            staffKey: 'Priya@123',
            phone: '9840011225',
            experience: '12+ Years Experience',
            consultationFee: 300,
            regNo: 'TNMC Reg. #79104',
            languages: 'Tamil, English, Telugu',
            bio: 'Dedicated child health specialist covering newborn care, immunization, and pediatric nutrition.',
            photoUrl: '',
            availableSlots: ['10:30', '11:00', '11:30', '17:00', '17:30', '18:00'],
            availableDays: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat'],
            isActive: true,
          },
          {
            id: 'doc_sandana_3',
            uid: 'doc_sandana_3',
            name: 'Dr. Arvind Narayanan',
            specialization: 'Orthopedic, Spine & Joint Replacement Surgeon',
            qualification: 'MBBS, MS (Ortho)',
            email: 'dr.arvind@sandanaclinic.com',
            loginId: 'dr.arvind@sandanaclinic.com',
            staffKey: 'Arvind@123',
            phone: '9840011228',
            experience: '14+ Years Experience',
            consultationFee: 400,
            regNo: 'TNMC Reg. #74219',
            languages: 'Tamil, English',
            bio: 'Expert in arthritis management, sports injuries, fracture care, and joint rehabilitation.',
            photoUrl: '',
            availableSlots: ['16:30', '17:00', '17:30', '18:00', '19:30'],
            availableDays: ['Tue', 'Thu', 'Sat'],
            isActive: true,
          },
        ];

        for (const d of defaultDoctors) {
          const { id, ...docData } = d;
          await setDoc(doc(db, 'doctors', id), docData, { merge: true });
          await saveRecordToSql('doctors', id, docData);
          await syncDoctorAccountToAuthCollections(id, {
            name: d.name,
            specialization: d.specialization,
            email: d.email!,
            staffKey: d.staffKey!,
            phone: d.phone,
            isActive: d.isActive,
          });
        }
        list = defaultDoctors;
      } else {
        // Ensure every existing doctor has a personal Login ID & Password synced to `users`
        const updatedList: DoctorRecord[] = [];
        for (let i = 0; i < list.length; i++) {
          const docItem = list[i];
          const defaults = buildDefaultDoctorCredentials(docItem.name, i + 1);
          const resolvedEmail = (
            docItem.email ||
            docItem.loginId ||
            defaults.email
          )
            .trim()
            .toLowerCase();
          const resolvedPassword = (
            docItem.staffKey || defaults.password
          ).trim();

          if (!docItem.email || !docItem.staffKey) {
            try {
              await setDoc(
                doc(db, 'doctors', docItem.id),
                {
                  name: docItem.name,
                  specialization: docItem.specialization,
                  email: resolvedEmail,
                  loginId: resolvedEmail,
                  staffKey: resolvedPassword,
                  uid: docItem.id,
                },
                { merge: true }
              );
            } catch {
              // ignore
            }
          }

          await syncDoctorAccountToAuthCollections(docItem.id, {
            name: docItem.name,
            specialization: docItem.specialization,
            email: resolvedEmail,
            staffKey: resolvedPassword,
            phone: docItem.phone,
            isActive: docItem.isActive !== false,
          });

          updatedList.push({
            ...docItem,
            email: resolvedEmail,
            loginId: resolvedEmail,
            staffKey: resolvedPassword,
            uid: docItem.id,
          });
        }
        list = updatedList;
      }

      setDoctors(list);
    } catch (err) {
      console.error('Error loading doctors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDoctors();
  }, []);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSpecialization('');
    setQualification('');
    setLoginEmail('');
    setLoginPassword('');
    setPhone('');
    setExperience('12+ Years Experience');
    setConsultationFee('300');
    setRegNo('TNMC Reg. #75410');
    setLanguages('Tamil, English');
    setBio('');
    setPhotoUrl('');
    setSlotsText('10:00, 10:30, 11:00, 18:00, 18:30');
    setSelectedDays(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  };

  const handleNameChangeWithAutoCredentials = (newName: string) => {
    setName(newName);
    if (!editingId) {
      const suggested = buildDefaultDoctorCredentials(
        newName,
        doctors.length + 1
      );
      if (!loginEmail || loginEmail.endsWith('@sandanaclinic.com')) {
        setLoginEmail(suggested.email);
      }
      if (!loginPassword) {
        setLoginPassword(suggested.password);
      }
    }
  };

  const handleEditClick = (d: DoctorRecord) => {
    const fallbackCreds = buildDefaultDoctorCredentials(d.name, 1);
    setEditingId(d.id);
    setName(d.name);
    setSpecialization(d.specialization);
    setQualification(d.qualification || '');
    setLoginEmail(d.email || d.loginId || fallbackCreds.email);
    setLoginPassword(d.staffKey || fallbackCreds.password);
    setPhone(d.phone || '');
    setExperience(d.experience || '12+ Years Experience');
    setConsultationFee(String(d.consultationFee ?? 300));
    setRegNo(d.regNo || 'TNMC Reg. #75410');
    setLanguages(d.languages || 'Tamil, English');
    setBio(d.bio || '');
    setPhotoUrl(d.photoUrl || '');
    setSlotsText((d.availableSlots || []).join(', '));
    setSelectedDays(
      d.availableDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    );
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setToastMsg(null);
    setErrorMsg(null);
    if (!name.trim() || !specialization.trim()) {
      setErrorMsg('कृपया डॉक्टर का नाम और विशेषज्ञता (Specialization) दर्ज करें।');
      return;
    }

    const fallbackCreds = buildDefaultDoctorCredentials(
      name,
      doctors.length + 1
    );
    const cleanEmail = (loginEmail.trim() || fallbackCreds.email).toLowerCase();
    const cleanPassword =
      loginPassword.trim().length >= 4
        ? loginPassword.trim()
        : fallbackCreds.password;
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);

    setSaving(true);
    const parsedSlots = slotsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 30);

    const targetDoctorId = editingId || `doc_sandana_${Date.now()}`;

    const payload = {
      uid: targetDoctorId,
      name: name.trim().slice(0, 120),
      specialization: specialization.trim().slice(0, 120),
      qualification: qualification.trim().slice(0, 150),
      email: cleanEmail.slice(0, 150),
      loginId: cleanEmail.slice(0, 150),
      staffKey: cleanPassword.slice(0, 100),
      phone: cleanPhone || phone.trim().slice(0, 25),
      photoUrl: photoUrl.trim().slice(0, 500),
      experience: experience.trim().slice(0, 60),
      consultationFee: Math.max(0, Number(consultationFee) || 300),
      regNo: regNo.trim().slice(0, 80),
      languages: languages.trim().slice(0, 150),
      bio: bio.trim().slice(0, 1000),
      availableSlots: parsedSlots.length > 0 ? parsedSlots : ['10:00', '18:00'],
      availableDays:
        selectedDays.length > 0 ? selectedDays : ['Mon', 'Wed', 'Fri'],
      isActive: true,
    };

    try {
      // Optionally register in Firebase Auth so both Email+Password & OTP work seamlessly
      try {
        const secondaryAuth = getSecondaryAuth();
        await createUserWithEmailAndPassword(
          secondaryAuth,
          cleanEmail,
          cleanPassword.length >= 6 ? cleanPassword : `${cleanPassword}123`
        );
        await signOut(secondaryAuth);
      } catch {
        // Ignore if email already exists or auth provider disabled; Firestore lookup handles authentication
      }

      await setDoc(doc(db, 'doctors', targetDoctorId), payload, {
        merge: true,
      });
      await saveRecordToSql('doctors', targetDoctorId, payload);

      await syncDoctorAccountToAuthCollections(targetDoctorId, {
        name: payload.name,
        specialization: payload.specialization,
        email: cleanEmail,
        staffKey: cleanPassword,
        phone: payload.phone,
        isActive: true,
      });

      setSelectedDoctorSlip({
        id: targetDoctorId,
        name: payload.name,
        specialization: payload.specialization,
        email: cleanEmail,
        password: cleanPassword,
        phone: payload.phone,
      });

      setToastMsg(
        `✅ ${payload.name} का प्रोफाइल और पर्सनल Login ID (${cleanEmail}) व Password (${cleanPassword}) सफलतापूर्वक सेव हो गया! अब ${payload.name} के पास बुक किए गए मरीज केवल उन्हीं के लॉगिन पैनल में दिखेंगे।`
      );
      resetForm();
      await loadDoctors();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'doctors');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (docItem: DoctorRecord) => {
    const nextActive = !docItem.isActive;
    try {
      await updateDoc(doc(db, 'doctors', docItem.id), {
        name: docItem.name,
        specialization: docItem.specialization,
        qualification: docItem.qualification || '',
        photoUrl: docItem.photoUrl || '',
        availableSlots: docItem.availableSlots,
        availableDays: docItem.availableDays,
        isActive: nextActive,
      });
      await syncDoctorAccountToAuthCollections(docItem.id, {
        name: docItem.name,
        specialization: docItem.specialization,
        email: docItem.email || docItem.loginId || '',
        staffKey: docItem.staffKey || 'Doctor@123',
        phone: docItem.phone,
        isActive: nextActive,
      });
      await loadDoctors();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `doctors/${docItem.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'doctors', id));
      await deleteDoc(doc(db, 'users', id)).catch(() => {});
      await loadDoctors();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `doctors/${id}`);
    }
  };

  return (
    <div id="printable-doctors-master" className="space-y-4">
      <div className="bg-[#000080] text-white px-4 py-3 rounded-xl flex flex-wrap items-center justify-between gap-2 shadow-sm">
        <div className="flex items-center gap-2.5">
          <Stethoscope size={20} className="text-amber-300" />
          <div>
            <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
              SANDANA CLINIC — DOCTOR MASTER &amp; PERSONAL DOCTOR LOGIN ID / PASSWORD MANAGER
            </h1>
            <p className="text-[11px] text-blue-200">
              हर डॉक्टर के नाम से अलग Login ID और Password बनाएं — जिस डॉक्टर के पास अपॉइंटमेंट बुक होगा, वह केवल उसी डॉक्टर के लॉगिन पैनल में दिखेगा
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() =>
            printElementById('printable-doctors-master', {
              title: 'Sandana_Clinic_Doctors_Login_Directory',
            })
          }
          className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-extrabold rounded-lg shadow-2xs cursor-pointer"
        >
          <Printer size={13} />
          Print Doctors &amp; Login IDs
        </button>
      </div>

      {errorMsg && (
        <div className="no-print p-3 bg-red-50 border border-red-300 rounded-xl text-xs font-bold text-red-800">
          {errorMsg}
        </div>
      )}

      {toastMsg && (
        <div className="no-print p-3.5 bg-green-50 border-2 border-green-400 rounded-xl text-xs font-bold text-green-900 flex items-center justify-between gap-2">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() =>
              printElementById('printable-doctors-master', {
                title: 'Sandana_Clinic_Doctors_Directory',
              })
            }
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-700 hover:bg-green-800 text-white rounded text-[11px] shrink-0"
          >
            <Printer size={12} />
            Print
          </button>
        </div>
      )}

      {selectedDoctorSlip && (
        <div
          id="printable-doctor-login-slip"
          className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-4 space-y-3 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-emerald-950 font-extrabold text-xs sm:text-sm uppercase">
              <KeyRound size={16} className="text-emerald-700" />
              <span>
                Doctor Personal OPD Login Slip — {selectedDoctorSlip.name}
              </span>
            </div>
            <div className="flex items-center gap-2 no-print">
              <button
                type="button"
                onClick={() =>
                  printElementById('printable-doctor-login-slip', {
                    title: `Doctor_Login_Slip_${selectedDoctorSlip.name}`,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold rounded-lg cursor-pointer"
              >
                <Printer size={13} />
                <span>🖨️ Print Doctor Login Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedDoctorSlip(null)}
                className="px-2 py-1 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-white border border-emerald-200 rounded-lg p-3">
            <div>
              <p className="text-slate-500">Doctor Name &amp; Chamber</p>
              <p className="font-extrabold text-slate-900">
                {selectedDoctorSlip.name}
              </p>
              <p className="text-[11px] text-emerald-700 font-semibold">
                {selectedDoctorSlip.specialization}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Doctor Login Email / ID</p>
              <p className="font-mono font-extrabold text-[#000080] break-all">
                {selectedDoctorSlip.email}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Doctor Login Password</p>
              <p className="font-mono font-extrabold text-emerald-800 text-sm">
                {selectedDoctorSlip.password}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Assigned Portal &amp; Isolation</p>
              <p className="font-bold text-slate-900">
                DOCTOR OPD ONLY (Chamber ID: {selectedDoctorSlip.id})
              </p>
              <p className="text-[10px] text-slate-600">
                केवल इसी डॉक्टर के बुक किए गए मरीज पैनल में दिखेंगे
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        <form
          onSubmit={handleSaveDoctor}
          className="lg:col-span-5 bg-white border border-slate-300 rounded-xl p-4 space-y-3 shadow-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#000080]">
              {editingId
                ? 'Edit Doctor Profile, Login ID & Password'
                : 'Add New Doctor + Create Personal Login ID & Password'}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Doctor Name (डॉक्टर का नाम) *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) =>
                  handleNameChangeWithAutoCredentials(e.target.value)
                }
                placeholder="Dr. S. Sandana Krishnan"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-semibold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Specialization (विशेषज्ञता) *
              </label>
              <input
                type="text"
                required
                value={specialization}
                onChange={(e) => setSpecialization(e.target.value)}
                placeholder="General Physician & Diabetologist"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          {/* Dedicated Doctor Login ID & Password Box */}
          <div className="bg-blue-50/80 border-2 border-blue-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#000080] flex items-center gap-1.5">
                <KeyRound size={13} className="text-blue-700" />
                <span>
                  डॉक्टर का पर्सनल Login ID और Password (Doctor OPD Portal)
                </span>
              </span>
              {name.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    const creds = buildDefaultDoctorCredentials(
                      name,
                      doctors.length + 1
                    );
                    setLoginEmail(creds.email);
                    setLoginPassword(creds.password);
                  }}
                  className="text-[10px] font-bold text-blue-700 hover:underline cursor-pointer"
                >
                  Auto-Generate ID/Pass
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  <Mail size={11} className="inline mr-1 text-blue-700" />
                  Doctor Login Email / ID *
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="dr.sandana@sandanaclinic.com"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-blue-300 rounded-lg text-[#000080]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  <Lock size={11} className="inline mr-1 text-emerald-700" />
                  Doctor Login Password *
                </label>
                <input
                  type="text"
                  required
                  minLength={4}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Sandana@123"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold bg-white border border-blue-300 rounded-lg text-emerald-800"
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-600">
              ℹ️ इस Login ID और Password से लॉगिन करने पर डॉक्टर को केवल उन्हीं के नाम पर बुक हुए अपॉइंटमेंट और मरीज दिखेंगे।
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Qualification *
              </label>
              <input
                type="text"
                value={qualification}
                onChange={(e) => setQualification(e.target.value)}
                placeholder="MBBS, MD"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Registration No.
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="TNMC Reg. #68421"
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mobile No.
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
                }
                placeholder="9840011223"
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Experience
              </label>
              <input
                type="text"
                value={experience}
                onChange={(e) => setExperience(e.target.value)}
                placeholder="15+ Years"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                OPD Fee (₹)
              </label>
              <input
                type="number"
                value={consultationFee}
                onChange={(e) => setConsultationFee(e.target.value)}
                placeholder="300"
                className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Languages
              </label>
              <input
                type="text"
                value={languages}
                onChange={(e) => setLanguages(e.target.value)}
                placeholder="Tamil, English"
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Photo URL
            </label>
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://images.unsplash.com/..."
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Clinical Bio &amp; Specialties Treated (Shown on Home Page)
            </label>
            <textarea
              rows={2}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Specialist in diabetes management, thyroid care, and family medicine..."
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Available Time Slots (comma-separated)
            </label>
            <input
              type="text"
              value={slotsText}
              onChange={(e) => setSlotsText(e.target.value)}
              placeholder="10:00, 10:30, 11:00, 18:00"
              className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Available Days
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DAYS_OF_WEEK.map((day) => {
                const active = selectedDays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded border cursor-pointer ${
                      active
                        ? 'bg-[#000080] text-white border-[#000080]'
                        : 'bg-slate-50 text-slate-600 border-slate-300'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 px-4 bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Plus size={14} />
            {saving
              ? 'Saving Doctor Profile & Login ID...'
              : editingId
                ? 'Update Doctor Profile, Login ID & Password'
                : 'Save Doctor & Create Personal Login ID / Password'}
          </button>
        </form>

        <div className="lg:col-span-7 bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
          <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                Registered Clinic Doctors &amp; Individual Login Credentials ({doctors.length})
              </h2>
              <p className="text-[11px] text-slate-500">
                प्रत्येक डॉक्टर का अपना अलग Login ID और Password नीचे दिया गया है
              </p>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Loading doctors &amp; login credentials...
            </div>
          ) : doctors.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No doctors found in Firestore. Add a doctor on the left.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {doctors.map((d, idx) => {
                const fallback = buildDefaultDoctorCredentials(d.name, idx + 1);
                const docEmail = d.email || d.loginId || fallback.email;
                const docPass = d.staffKey || fallback.password;

                return (
                  <div
                    key={d.id}
                    className="p-4 flex flex-col justify-between gap-3 hover:bg-slate-50/80 transition-colors"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-extrabold text-slate-900">
                            {d.name}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                              d.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {d.isActive ? 'ACTIVE' : 'HIDDEN'}
                          </span>
                          <span className="text-[10px] font-mono bg-blue-50 text-[#000080] border border-blue-200 px-2 py-0.5 rounded font-bold">
                            Chamber ID: {d.id}
                          </span>
                        </div>
                        <p className="text-xs text-green-700 font-bold">
                          {d.specialization} · {d.qualification}
                        </p>
                        <p className="text-xs font-mono text-slate-600">
                          {d.experience || '12+ Yrs'} · Fee: ₹
                          {d.consultationFee ?? 300} · {d.regNo || 'TNMC Verified'}
                        </p>
                        <p className="text-[11px] font-mono text-slate-500">
                          Days: {(d.availableDays || []).join(', ')} | Slots:{' '}
                          {(d.availableSlots || []).join(', ')}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 shrink-0 no-print">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedDoctorSlip({
                              id: d.id,
                              name: d.name,
                              specialization: d.specialization,
                              email: docEmail,
                              password: docPass,
                              phone: d.phone || '',
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          <Printer size={12} />
                          <span>Login Slip</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditClick(d)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#000080] border border-blue-200 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          <Edit3 size={12} />
                          <span>Edit ID / Pass</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(d)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          {d.isActive ? (
                            <>
                              <UserX size={13} /> Hide
                            </>
                          ) : (
                            <>
                              <UserCheck size={13} /> Activate
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(d.id)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Doctor's Personal Login ID & Password Display Strip */}
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-bold text-slate-700 flex items-center gap-1">
                          <KeyRound size={12} className="text-[#000080]" />
                          <span>Doctor Login ID:</span>
                          <span className="font-mono font-extrabold text-[#000080]">
                            {docEmail}
                          </span>
                        </span>
                        <span className="font-bold text-slate-700">
                          Password:{' '}
                          <span className="font-mono font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            {docPass}
                          </span>
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-700">
                        ✓ {d.name} के अपॉइंटमेंट केवल इसी ID में दिखेंगे
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
