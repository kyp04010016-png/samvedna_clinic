import React, { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import {
  UserPlus,
  Trash2,
  KeyRound,
  ShieldBan,
  ShieldCheck,
  Users,
  Printer,
} from 'lucide-react';
import { db, getSecondaryAuth } from '../../firebase';
import { StaffProfile, StaffRole, useAuth } from '../../context/AuthContext';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { logStaffActivity } from '../../utils/activityLogger';
import { sanitizeOtpDocId } from '../../utils/emailOTP';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';
import { purgeAllDummyAccounts } from '../../utils/domainPrivacy';
import { printElementById } from '../../utils/printEngine';

export const StaffManager: React.FC = () => {
  const { userProfile, firebaseUser } = useAuth();
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffRole>('pharmacy');
  const [linkedDoctorId, setLinkedDoctorId] = useState<string>('new');
  const [specialization, setSpecialization] = useState<string>('General Physician');
  const [editingStaffUid, setEditingStaffUid] = useState<string | null>(null);
  const [clinicDoctors, setClinicDoctors] = useState<
    Array<{
      id: string;
      name: string;
      specialization: string;
      email?: string;
      staffKey?: string;
      phone?: string;
    }>
  >([]);

  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    phone: string;
    password: string;
    role: StaffRole;
    uid: string;
    doctorId?: string;
    note?: string;
  } | null>(null);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const [snap, docSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'doctors')),
      ]);

      const docs = docSnap.docs.map((d) => {
        const data = d.data() as Record<string, any>;
        return {
          id: d.id,
          name: String(data.name || 'Doctor'),
          specialization: String(data.specialization || 'General Physician'),
          email: data.email || data.loginId || '',
          staffKey: data.staffKey || '',
          phone: data.phone || '',
        };
      });
      setClinicDoctors(docs);

      const list: StaffProfile[] = snap.docs.map((d) => {
        const data = d.data() as Omit<StaffProfile, 'uid'>;
        return {
          uid: d.id,
          ...data,
          isActive: data.isActive !== false,
        };
      });
      setStaffList(list);
    } catch (err) {
      console.error('Error loading staff:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleSelectDoctorForStaff = (docId: string) => {
    setLinkedDoctorId(docId);
    if (docId !== 'new') {
      const found = clinicDoctors.find((d) => d.id === docId);
      if (found) {
        setName(found.name);
        setSpecialization(found.specialization || 'General Physician');
        if (found.email) setEmail(found.email);
        if (found.staffKey) setPassword(found.staffKey);
        if (found.phone) setPhone(found.phone.replace(/\D/g, '').slice(-10));
      }
    }
  };

  const handleEditStaffRow = (u: StaffProfile) => {
    setEditingStaffUid(u.uid);
    setName(u.name);
    setEmail(u.email || '');
    setPassword(u.staffKey || 'Dudrucs@123');
    setPhone((u.phone || '').replace(/\D/g, '').slice(-10));
    setRole(u.role);
    if (u.role === 'doctor') {
      setLinkedDoctorId(u.doctorId || u.uid);
      setSpecialization(u.specialization || 'General Physician');
    } else {
      setLinkedDoctorId('new');
    }
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setToastMsg(null);
    setCreatedCredentials(null);

    if (!name.trim() || !email.trim()) {
      setErrorMsg('कृपया स्टाफ/डॉक्टर का नाम और लॉगिन ईमेल दर्ज करें।');
      return;
    }

    const cleanPhone10 = phone.replace(/\D/g, '').slice(-10);
    const effectiveEmail = email.trim().toLowerCase();
    const effectivePassword =
      password.trim().length >= 4 ? password.trim() : 'Dudrucs@123';

    setCreating(true);
    let generatedUid =
      editingStaffUid ||
      (role === 'doctor' && linkedDoctorId !== 'new'
        ? linkedDoctorId
        : cleanPhone10.length === 10
        ? cleanPhone10
        : role === 'doctor'
        ? `doc_sandana_${Date.now()}`
        : `staff_${Date.now()}`);
    let authNote: string | undefined;

    try {
      const secondaryAuth = getSecondaryAuth();
      try {
        const userCred = await createUserWithEmailAndPassword(
          secondaryAuth,
          effectiveEmail,
          effectivePassword.length >= 6
            ? effectivePassword
            : `${effectivePassword}123`
        );
        if (
          !editingStaffUid &&
          role !== 'doctor' &&
          cleanPhone10.length !== 10
        ) {
          generatedUid = userCred.user.uid;
        }
        await signOut(secondaryAuth);
      } catch (authErr: any) {
        if (authErr?.code === 'auth/operation-not-allowed') {
          authNote =
            'Login ID & Password saved in Firestore & SQL. Staff/Doctor can log in immediately using this Email & Password or Email OTP.';
        } else if (authErr?.code === 'auth/email-already-in-use') {
          authNote =
            'Updated Firestore role & password record for this Login ID.';
        }
      }

      const resolvedDoctorId =
        role === 'doctor'
          ? linkedDoctorId !== 'new'
            ? linkedDoctorId
            : generatedUid
          : undefined;

      const staffDoc: Record<string, any> = {
        uid: generatedUid,
        name: name.trim().slice(0, 100),
        email: effectiveEmail.slice(0, 150),
        loginId: effectiveEmail.slice(0, 150),
        phone: (cleanPhone10 || phone.trim()).slice(0, 25),
        role,
        staffKey: effectivePassword.slice(0, 200),
        isActive: true,
        createdAt: new Date().toISOString(),
      };

      if (role === 'doctor' && resolvedDoctorId) {
        staffDoc.doctorId = resolvedDoctorId;
        staffDoc.specialization = (
          specialization.trim() || 'General Physician'
        ).slice(0, 120);
      }

      try {
        await setDoc(doc(db, 'users', generatedUid), staffDoc, { merge: true });
        await saveRecordToSql('users', generatedUid, staffDoc);
        // Also register staff OTP & Password login lookup record
        const staffOtpDocId = sanitizeOtpDocId(staffDoc.email, 'staff');
        const otpRecord: Record<string, any> = {
          otp: '000000',
          expiry: '2099-12-31T23:59:59.000Z',
          email: staffDoc.email,
          phone: staffDoc.phone,
          purpose: 'staff_active',
          staffKey: effectivePassword.slice(0, 200),
          staffName: staffDoc.name,
          staffRole: role,
          createdAt: staffDoc.createdAt,
        };
        if (role === 'doctor' && resolvedDoctorId) {
          otpRecord.doctorId = resolvedDoctorId;
          otpRecord.specialization = staffDoc.specialization;
        }
        await setDoc(doc(db, 'otp_verification', staffOtpDocId), otpRecord, {
          merge: true,
        });
      } catch (writeErr) {
        handleFirestoreError(
          writeErr,
          OperationType.WRITE,
          `users/${generatedUid}`
        );
      }

      if (role === 'doctor' && resolvedDoctorId) {
        try {
          const doctorPayload = {
            uid: resolvedDoctorId,
            name: staffDoc.name,
            specialization: staffDoc.specialization || 'General Physician',
            qualification: 'MBBS, MD',
            email: staffDoc.email,
            loginId: staffDoc.email,
            staffKey: effectivePassword.slice(0, 100),
            phone: staffDoc.phone,
            photoUrl: '',
            availableSlots: ['10:00', '10:30', '11:00', '17:30', '18:00'],
            availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            isActive: true,
          };
          await setDoc(doc(db, 'doctors', resolvedDoctorId), doctorPayload, {
            merge: true,
          });
          await saveRecordToSql('doctors', resolvedDoctorId, doctorPayload);
        } catch (docErr) {
          console.error('Could not sync doctor profile doc:', docErr);
        }
      }

      await logStaffActivity(
        firebaseUser?.uid || 'admin',
        userProfile?.name || 'Admin',
        'CREATE_STAFF',
        `${userProfile?.name || 'Admin'} saved ${role.toUpperCase()} Login ID for ${staffDoc.name} (Email: ${staffDoc.email})`
      );

      setCreatedCredentials({
        name: staffDoc.name,
        email: staffDoc.email,
        phone: staffDoc.phone,
        password: effectivePassword,
        role,
        uid: generatedUid,
        doctorId: resolvedDoctorId,
        note: authNote,
      });
      setToastMsg(
        `✅ Login ID & Password Saved! ${staffDoc.name} (${role.toUpperCase()}) can now log into the ${role.toUpperCase()} panel using ${staffDoc.email} and password "${effectivePassword}".`
      );

      setEditingStaffUid(null);
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setLinkedDoctorId('new');
      await loadStaff();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create staff member.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (staff: StaffProfile) => {
    setErrorMsg(null);
    setToastMsg(null);
    const nextActive = staff.isActive === false ? true : false;
    try {
      const updatedUserPayload: Record<string, any> = {
        name: staff.name,
        email: staff.email,
        phone: staff.phone || '',
        role: staff.role,
        isActive: nextActive,
        createdAt: staff.createdAt || new Date().toISOString(),
      };
      if (staff.staffKey) {
        updatedUserPayload.staffKey = staff.staffKey;
      }
      await setDoc(doc(db, 'users', staff.uid), updatedUserPayload, {
        merge: true,
      });
      await saveRecordToSql('users', staff.uid, updatedUserPayload);

      // Also sync block/unblock state to staff OTP login lookup doc
      const staffOtpDocId = sanitizeOtpDocId(staff.email, 'staff');
      await setDoc(
        doc(db, 'otp_verification', staffOtpDocId),
        {
          otp: '000000',
          expiry: '2099-12-31T23:59:59.000Z',
          email: staff.email,
          phone: staff.phone || '',
          purpose: nextActive ? 'staff_active' : 'staff_blocked',
          staffName: staff.name,
          staffRole: staff.role,
          createdAt: staff.createdAt || new Date().toISOString(),
        },
        { merge: true }
      );

      await logStaffActivity(
        firebaseUser?.uid || 'admin',
        userProfile?.name || 'Admin',
        nextActive ? 'UNBLOCK_STAFF' : 'BLOCK_STAFF',
        `${userProfile?.name || 'Admin'} ${nextActive ? 'unblocked' : 'blocked'} staff member ${staff.name} (Login ID: ${staff.uid})`
      );

      setToastMsg(
        `${staff.name} (Login ID: ${staff.uid}) is now ${
          nextActive ? 'ACTIVE (Unblocked)' : 'BLOCKED from logging in'
        }.`
      );
      await loadStaff();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${staff.uid}`);
    }
  };

  const handleDeleteStaff = async (staff: StaffProfile) => {
    setErrorMsg(null);
    setToastMsg(null);
    try {
      await deleteDoc(doc(db, 'users', staff.uid));

      // Also clean up OTP login lookup docs if they exist
      if (staff.email) {
        try {
          const staffOtpDocId = sanitizeOtpDocId(staff.email, 'staff');
          await deleteDoc(doc(db, 'otp_verification', staffOtpDocId));
        } catch {
          // ignore if not found
        }
      }
      if (staff.phone) {
        try {
          const phoneOtpDocId = sanitizeOtpDocId(staff.phone, 'staff_login');
          await deleteDoc(doc(db, 'otp_verification', phoneOtpDocId));
        } catch {
          // ignore if not found
        }
      }

      await logStaffActivity(
        firebaseUser?.uid || 'admin',
        userProfile?.name || 'Admin',
        'DELETE_STAFF',
        `${userProfile?.name || 'Admin'} deleted staff Login ID ${staff.uid} (${staff.name})`
      );
      setToastMsg(
        `Deleted Staff Login ID "${staff.uid}" (${staff.name}) permanently.`
      );
      await loadStaff();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${staff.uid}`);
    }
  };

  const handlePurgeDummies = async () => {
    if (!window.confirm('Are you sure you want to remove all dummy/test accounts? This will delete all temporary demo accounts from Firestore and SQL while keeping real staff and administrator.')) {
      return;
    }
    setPurging(true);
    setErrorMsg(null);
    setToastMsg(null);
    try {
      const res = await purgeAllDummyAccounts();
      if (res.success) {
        setToastMsg(
          `✅ Privacy Enforced: Purged ${res.deletedFirestoreCount} dummy accounts from Firestore and ${res.deletedSqlCount} from MySQL database.`
        );
        await loadStaff();
      } else {
        setErrorMsg(`Failed to purge some dummy records: ${res.details.join(', ')}`);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Purge failed');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Marg ERP Style Top Title Bar */}
      <div className="bg-gradient-to-r from-[#000080] via-blue-900 to-indigo-950 text-white px-5 py-3.5 rounded-xl shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Users size={20} className="text-amber-300 shrink-0" />
          <div>
            <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
              MARG OPERATOR / STAFF MANAGER — CREATE, BLOCK &amp; DELETE LOGIN IDs
            </h1>
            <p className="text-[11px] text-blue-200">
              Create Department-Locked Staff Accounts (Email &amp; Password / Email OTP), Block/Unblock, or Print Login Slip
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={handlePurgeDummies}
            disabled={purging}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/25 hover:bg-red-500/40 text-red-200 border border-red-400/40 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Clean out all dummy test logins from Firestore and SQL for complete domain privacy"
          >
            <ShieldBan size={14} className="text-red-300" />
            <span>{purging ? 'Purging Dummies...' : '🧹 Remove All Dummy Accounts (डमी हटाएं)'}</span>
          </button>
          <span className="text-xs font-mono font-bold bg-white/15 px-3 py-1.5 rounded-lg border border-white/20">
            Total Staff IDs: {staffList.length}
          </span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-xs font-bold text-red-700 shadow-xs">
          {errorMsg}
        </div>
      )}

      {toastMsg && (
        <div className="p-3.5 bg-green-50 border-2 border-green-400 rounded-xl text-xs font-bold text-green-800 shadow-xs animate-scale-in">
          {toastMsg}
        </div>
      )}

      {createdCredentials && (
        <div
          id="printable-staff-credentials"
          className="bg-green-50 border-2 border-green-400 rounded-xl p-4 space-y-2.5 shadow-sm animate-scale-in"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-green-900 font-extrabold text-xs uppercase">
              <KeyRound size={15} />
              <span>
                Staff Login ID Saved — Authorized Only for{' '}
                {createdCredentials.role.toUpperCase()} Portal
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                printElementById('printable-staff-credentials', {
                  title: `Staff_Login_${createdCredentials.name}`,
                })
              }
              className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-xs cursor-pointer"
            >
              <Printer size={13} />
              <span>🖨️ Print Staff Login Slip</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-white border border-green-200 rounded-lg p-3">
            <div>
              <p className="text-slate-500">Staff Name</p>
              <p className="font-bold text-slate-900">{createdCredentials.name}</p>
            </div>
            <div>
              <p className="text-slate-500">Login ID / Mobile</p>
              <p className="font-mono font-extrabold text-[#000080]">
                {createdCredentials.uid}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Authorized Department Role</p>
              <p className="font-mono font-bold uppercase text-green-700">
                {createdCredentials.role} ONLY
              </p>
            </div>
            <div>
              <p className="text-slate-500">Login Email &amp; Password</p>
              <p className="font-mono font-bold text-slate-900 break-all">
                {createdCredentials.email} · Pass: {createdCredentials.password}
              </p>
            </div>
          </div>
          {createdCredentials.note && (
            <p className="text-xs text-amber-800">{createdCredentials.note}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Form to Create / Edit Staff or Doctor Login ID */}
        <form
          onSubmit={handleCreateStaff}
          className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-3.5"
        >
          <div className="border-b border-slate-200 pb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <UserPlus size={16} className="text-green-600" />
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#000080]">
                {editingStaffUid
                  ? 'Update Staff / Doctor Login ID & Password'
                  : 'Create Staff / Doctor Login ID & Password'}
              </h2>
            </div>
            {editingStaffUid && (
              <button
                type="button"
                onClick={() => {
                  setEditingStaffUid(null);
                  setName('');
                  setEmail('');
                  setPassword('');
                  setPhone('');
                  setLinkedDoctorId('new');
                }}
                className="text-[11px] font-bold text-red-600 hover:underline cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Assign Department Role (Strict Portal Lock) *
            </label>
            <select
              value={role}
              onChange={(e) => {
                const nextRole = e.target.value as StaffRole;
                setRole(nextRole);
                if (nextRole === 'doctor' && clinicDoctors.length > 0 && !editingStaffUid) {
                  handleSelectDoctorForStaff(clinicDoctors[0].id);
                }
              }}
              className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#000080]"
            >
              <option value="doctor">
                doctor — Personal Doctor OPD Chamber (डॉक्टर का अलग लॉगिन पैनल)
              </option>
              <option value="pharmacy">
                pharmacy — Billing, Masters, Stock &amp; Reports Only
              </option>
              <option value="reception">
                reception — Clinic Registration &amp; Tokens Only
              </option>
              <option value="admin">admin — Full ERP Control</option>
            </select>
          </div>

          {role === 'doctor' && (
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 space-y-2.5">
              <div>
                <label className="block text-[11px] font-extrabold text-emerald-950 mb-1">
                  Select Doctor Chamber (किस डॉक्टर के नाम से लॉगिन आईडी बनानी है?) *
                </label>
                <select
                  value={linkedDoctorId}
                  onChange={(e) => handleSelectDoctorForStaff(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-bold border border-emerald-400 rounded-lg bg-white text-emerald-950"
                >
                  <option value="new">
                    + Create New Doctor Chamber (नए डॉक्टर के नाम से लॉगिन बनाएं)
                  </option>
                  {clinicDoctors.map((docItem) => (
                    <option key={docItem.id} value={docItem.id}>
                      {docItem.name} ({docItem.specialization}) — ID: {docItem.id}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Doctor Specialization (विशेषज्ञता)
                </label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  placeholder="General Physician & Diabetologist"
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-emerald-300 rounded-lg"
                />
              </div>
              <p className="text-[10px] text-emerald-800 font-semibold">
                ✓ इस डॉक्टर के नाम से बुक किए गए अपॉइंटमेंट केवल इसी डॉक्टर के लॉगिन पैनल में दिखेंगे।
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {role === 'doctor' ? 'Doctor Full Name *' : 'Staff Full Name *'}
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                role === 'doctor'
                  ? 'e.g. Dr. S. Sandana Krishnan'
                  : 'e.g. Raju Pharmacist'
              }
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Contact Mobile Number (10 Digits) *
            </label>
            <input
              type="tel"
              required
              maxLength={10}
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
              }
              placeholder="9840011223"
              className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Login Email / ID *
              </label>
              <input
                type="email"
                required
                maxLength={150}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={
                  role === 'doctor'
                    ? 'dr.sandana@sandanaclinic.com'
                    : 'raju@sandanaclinic.com'
                }
                className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Login Password *
              </label>
              <input
                type="text"
                minLength={4}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={role === 'doctor' ? 'Sandana@123' : 'Dudrucs@123'}
                className="w-full px-2.5 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 disabled:opacity-50 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all hover:-translate-y-0.5 inline-flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <UserPlus size={15} />
            {creating
              ? 'Saving Login ID & Password...'
              : editingStaffUid
                ? 'Update Login ID & Password'
                : role === 'doctor'
                  ? 'Save Doctor Personal Login ID & Password'
                  : 'Save & Create Staff Login ID'}
          </button>
        </form>

        {/* Staff Directory with Block / Unblock & Delete Login ID */}
        <div
          id="printable-staff-directory"
          className="lg:col-span-8 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden"
        >
          <div className="px-4 py-3 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                All Doctor &amp; Staff Login IDs (`users` Collection)
              </h2>
              <span className="text-[11px] font-mono text-slate-600">
                प्रत्येक डॉक्टर और स्टाफ का पर्सनल Login ID और Password यहाँ सुरक्षित है
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                printElementById('printable-staff-directory', {
                  title: 'Sandana_Clinic_Staff_Login_Directory',
                })
              }
              className="no-print px-3 py-1.5 bg-[#000080] hover:bg-blue-900 text-white text-[11px] font-bold rounded-lg shadow-2xs transition-colors"
            >
              🖨️ Print Staff Directory
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Loading staff directory...
            </div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No staff accounts found. Create an operator on the left.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#000080] text-white">
                    <th className="py-2.5 px-3 font-bold">Doctor / Staff Name</th>
                    <th className="py-2.5 px-3 font-bold">Login Email / ID &amp; Password</th>
                    <th className="py-2.5 px-3 font-bold">Assigned Portal / Chamber</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold text-right no-print">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {staffList.map((u) => {
                    const active = u.isActive !== false;
                    return (
                      <tr
                        key={u.uid}
                        className={
                          active
                            ? 'hover:bg-blue-50/40 transition-colors'
                            : 'bg-red-50/70'
                        }
                      >
                        <td className="py-3 px-3 font-bold text-slate-900">
                          <p>{u.name}</p>
                          {u.specialization && (
                            <p className="text-[10px] font-semibold text-emerald-700">
                              {u.specialization}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          {u.email && (
                            <p className="font-mono font-bold text-[#000080]">
                              Email: {u.email}
                            </p>
                          )}
                          <p className="font-mono text-[11px] text-slate-600">
                            ID: {u.uid}
                          </p>
                          {u.staffKey && (
                            <p className="font-mono text-[11px] font-bold text-emerald-800">
                              Pass: {u.staffKey}
                            </p>
                          )}
                          {u.phone && u.phone !== u.uid && (
                            <p className="font-mono text-[11px] text-slate-500">
                              Mob: {u.phone}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-bold uppercase text-green-700 block">
                            {u.role}
                          </span>
                          {u.role === 'doctor' && (
                            <span className="inline-block mt-0.5 text-[10px] font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                              Chamber: {u.doctorId || u.uid}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`font-mono text-[11px] font-bold ${
                              active ? 'text-green-700' : 'text-red-700'
                            }`}
                          >
                            {active ? 'ACTIVE' : 'BLOCKED'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right no-print">
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditStaffRow(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              ✏️ Edit Pass
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setCreatedCredentials({
                                  name: u.name,
                                  phone: u.phone || u.uid,
                                  email: u.email || '',
                                  password: u.staffKey || 'Dudrucs@123',
                                  role: u.role,
                                  uid: u.uid,
                                  doctorId: u.doctorId,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#000080] border border-blue-200 rounded-lg text-[11px] font-bold cursor-pointer"
                            >
                              🖨️ Slip
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all ${
                                active
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                                  : 'bg-green-600 hover:bg-green-700 text-white border-green-700'
                              }`}
                            >
                              {active ? (
                                <>
                                  <ShieldBan size={12} />
                                  Block
                                </>
                              ) : (
                                <>
                                  <ShieldCheck size={12} />
                                  Unblock
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteStaff(u)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold shadow-2xs transition-all"
                              title="Delete Staff Login ID permanently"
                            >
                              <Trash2 size={12} />
                              <span>Delete ID</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
