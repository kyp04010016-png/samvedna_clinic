import React, { useEffect, useState } from 'react';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { UserPlus, Trash2, KeyRound, Printer } from 'lucide-react';
import { db, getSecondaryAuth } from '../../firebase';
import { StaffProfile, StaffRole } from '../../context/AuthContext';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';
import { printElementById } from '../../utils/printEngine';

export const Staff: React.FC = () => {
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<StaffRole>('pharmacy');

  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [createdCredentials, setCreatedCredentials] = useState<{
    name: string;
    email: string;
    password: string;
    role: StaffRole;
    uid: string;
    note?: string;
  } | null>(null);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'users'));
      const list: StaffProfile[] = snap.docs
        .map((d) => ({
          uid: d.id,
          ...(d.data() as Omit<StaffProfile, 'uid'>),
        }))
        .filter((u) => u.role !== 'admin');
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

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setCreatedCredentials(null);

    if (!name.trim() || !email.trim() || password.length < 6) {
      setErrorMsg('Please enter name, email, and a password of at least 6 characters.');
      return;
    }

    setCreating(true);
    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    let generatedUid = cleanPhone.length === 10 ? cleanPhone : `staff_${Date.now()}`;
    let authNote: string | undefined;

    try {
      const secondaryAuth = getSecondaryAuth();
      try {
        const userCred = await createUserWithEmailAndPassword(
          secondaryAuth,
          email.trim(),
          password
        );
        generatedUid = userCred.user.uid;
        await signOut(secondaryAuth);
      } catch (authErr: any) {
        if (authErr?.code === 'auth/operation-not-allowed') {
          authNote =
            'Staff record & password saved in database. Staff can log in immediately using Email + Password or Email OTP.';
        } else if (authErr?.code === 'auth/email-already-in-use') {
          authNote =
            'Email already exists in Auth; updated Firestore role & password.';
        } else {
          authNote = 'Saved staff login credentials to database.';
        }
      }

      const nowIso = new Date().toISOString();
      const staffDoc = {
        uid: generatedUid,
        name: name.trim().slice(0, 100),
        email: email.trim().toLowerCase().slice(0, 150),
        phone: cleanPhone || phone.trim().slice(0, 25),
        role,
        isActive: true,
        staffKey: password,
        createdAt: nowIso,
      };

      try {
        await setDoc(doc(db, 'users', generatedUid), staffDoc, { merge: true });
      } catch (writeErr) {
        handleFirestoreError(writeErr, OperationType.WRITE, `users/${generatedUid}`);
      }

      await saveRecordToSql('users', generatedUid, staffDoc);

      await setDoc(
        doc(db, 'otp_verification', `staff_${generatedUid}`),
        {
          phone: staffDoc.phone || staffDoc.email,
          email: staffDoc.email,
          name: staffDoc.name,
          role,
          uid: generatedUid,
          staffKey: password,
          isActive: true,
          updatedAt: nowIso,
        },
        { merge: true }
      ).catch(() => {});

      if (role === 'doctor') {
        try {
          const doctorPayload = {
            name: staffDoc.name,
            specialization: 'General Physician',
            qualification: 'MBBS',
            photoUrl: '',
            availableSlots: ['10:00', '10:30', '11:00', '17:30', '18:00'],
            availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            isActive: true,
            uid: generatedUid,
          };
          await setDoc(doc(db, 'doctors', generatedUid), doctorPayload, {
            merge: true,
          });
          await saveRecordToSql('doctors', generatedUid, doctorPayload);
        } catch (docErr) {
          console.error('Could not auto-create doctor schedule doc:', docErr);
        }
      }

      setCreatedCredentials({
        name: staffDoc.name,
        email: staffDoc.email,
        password,
        role,
        uid: generatedUid,
        note: authNote,
      });

      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      await loadStaff();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create staff member.');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteStaff = async (uid: string) => {
    try {
      await deleteDoc(doc(db, 'users', uid));
      await deleteDoc(doc(db, 'otp_verification', `staff_${uid}`)).catch(() => {});
      await loadStaff();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <p className="text-xs font-semibold text-green-700">Admin · Access Control</p>
        <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Create and manage accounts for Doctors, Dudrucs Pharmacy staff, and Receptionists.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
          {errorMsg}
        </div>
      )}

      {createdCredentials && (
        <div
          id="printable-staff-slip"
          className="bg-green-50 border border-green-200 rounded-xl p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-green-800 font-bold text-sm">
              <KeyRound size={17} />
              <span>Staff Account Created — Share Login Credentials</span>
            </div>
            <button
              type="button"
              onClick={() =>
                printElementById('printable-staff-slip', {
                  title: `Staff_Credentials_${createdCredentials.name}`,
                })
              }
              className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded-lg shadow-xs"
            >
              <Printer size={14} />
              Print Staff Login Slip
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-white border border-green-200 rounded-lg p-3.5">
            <div>
              <p className="text-slate-500">Staff Name</p>
              <p className="font-semibold text-slate-900">{createdCredentials.name}</p>
            </div>
            <div>
              <p className="text-slate-500">Assigned Department Portal</p>
              <p className="font-mono font-semibold uppercase text-green-700">
                {createdCredentials.role} ONLY
              </p>
            </div>
            <div>
              <p className="text-slate-500">Login Email / ID</p>
              <p className="font-mono font-semibold text-slate-900">
                {createdCredentials.email}
              </p>
            </div>
            <div>
              <p className="text-slate-500">Assigned Password</p>
              <p className="font-mono font-semibold text-slate-900">
                {createdCredentials.password}
              </p>
            </div>
          </div>
          {createdCredentials.note && (
            <p className="text-xs text-amber-800">{createdCredentials.note}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={handleCreateStaff}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            Add Staff Account
          </h2>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Karthik Pharmacist"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Login Email *
            </label>
            <input
              type="email"
              required
              maxLength={150}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pharmacy@sandanaclinic.com"
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Password (min 6 chars) *
              </label>
              <input
                type="text"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Dudrucs@123"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                maxLength={25}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98400 11223"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Staff Role *
            </label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as StaffRole)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="pharmacy">pharmacy — Dudrucs Billing, UPI QR &amp; Stock</option>
              <option value="reception">reception — Walk-in Registration &amp; Tokens</option>
              <option value="doctor">doctor — View &amp; Complete Own Appointments</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={creating}
            className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <UserPlus size={15} />
            {creating ? 'Creating Staff Account...' : 'Create Staff Account'}
          </button>
        </form>

        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Active Staff Directory</h2>
            <span className="text-xs font-mono text-slate-500">
              {staffList.length} staff members
            </span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Loading staff accounts...
            </div>
          ) : staffList.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No non-admin staff accounts created yet. Add a doctor, pharmacy, or reception user on the left.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-3 px-4 font-semibold">Name</th>
                    <th className="py-3 px-4 font-semibold">Email &amp; Phone</th>
                    <th className="py-3 px-4 font-semibold">Role</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staffList.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        {u.name}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-mono text-slate-800">{u.email}</p>
                        {u.phone && (
                          <p className="font-mono text-slate-500">{u.phone}</p>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold uppercase text-green-700">
                        {u.role}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteStaff(u.uid)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-md font-medium"
                        >
                          <Trash2 size={13} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
