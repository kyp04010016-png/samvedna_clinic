import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { addDoc, collection, doc, getDocs, setDoc } from 'firebase/firestore';
import {
  CalendarCheck,
  Printer,
  ArrowLeft,
  ShieldCheck,
  Smartphone,
  Database,
} from 'lucide-react';
import { db } from '../../firebase';
import { DoctorRecord } from './Home';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';
import { openPrintWindow, printElementById } from '../../utils/printEngine';

interface ConfirmedAppointment {
  id: string;
  patientName: string;
  phone: string;
  age: number;
  gender: string;
  symptoms: string;
  doctorId: string;
  doctorName: string;
  date: string;
  slot: string;
  tokenNo: number;
}

export const BookAppointment: React.FC = () => {
  const [searchParams] = useSearchParams();
  const preselectedDoctorId = searchParams.get('doctorId') || '';

  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [symptoms, setSymptoms] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState(preselectedDoctorId);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [slot, setSlot] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedAppointment | null>(null);
  const [returningPatientNote, setReturningPatientNote] = useState<string | null>(null);

  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const snap = await getDocs(collection(db, 'doctors'));
        const list = snap.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<DoctorRecord, 'id'>),
          }))
          .filter((docItem) => docItem.isActive);

        if (list.length > 0) {
          setDoctors(list);
          const initialDoc =
            list.find((d) => d.id === preselectedDoctorId) || list[0];
          setSelectedDoctorId(initialDoc.id);
          setSlot(initialDoc.availableSlots[0] || '10:00');
        } else {
          const fallback: DoctorRecord[] = [
            {
              id: 'doc_sandana_1',
              name: 'Dr. S. Sandana Krishnan',
              specialization: 'General Physician & Diabetologist',
              qualification: 'MBBS, MD',
              photoUrl: '',
              availableSlots: ['10:00', '10:30', '11:00', '18:00', '18:30'],
              availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
              isActive: true,
            },
          ];
          setDoctors(fallback);
          setSelectedDoctorId(fallback[0].id);
          setSlot(fallback[0].availableSlots[0]);
        }
      } catch (err) {
        console.error('Error loading doctors for booking:', err);
      }
    };
    loadDoctors();
  }, [preselectedDoctorId]);

  const currentDoctor = doctors.find((d) => d.id === selectedDoctorId);

  const handleDoctorChange = (newDocId: string) => {
    setSelectedDoctorId(newDocId);
    const found = doctors.find((d) => d.id === newDocId);
    if (found && found.availableSlots.length > 0) {
      setSlot(found.availableSlots[0]);
    }
  };

  const handlePhoneChangeAndLookup = async (rawPhone: string) => {
    const cleaned = rawPhone.replace(/\D/g, '').slice(0, 10);
    setPhone(cleaned);
    if (cleaned.length === 10) {
      try {
        const snap = await getDocs(collection(db, 'appointments'));
        const matched = snap.docs
          .map((d) => d.data())
          .find((a) => (a.phone || '').replace(/\D/g, '').slice(-10) === cleaned);
        if (matched) {
          if (!patientName.trim() && matched.patientName) {
            setPatientName(matched.patientName);
          }
          if (!age && matched.age) {
            setAge(String(matched.age));
          }
          if (matched.gender) {
            setGender(matched.gender);
          }
          setReturningPatientNote(
            `✓ पुराना मरीज रिकॉर्ड मिला: ${matched.patientName} (${matched.age || ''} Yrs, ${matched.gender || 'Male'})`
          );
        }
      } catch {
        // ignore
      }
    } else {
      setReturningPatientNote(null);
    }
  };

  // Direct Instant Appointment Booking (10-digit Mobile Number Mandatory, No OTP required)
  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!patientName.trim()) {
      setErrorMsg('Please enter the Patient Full Name.');
      return;
    }
    if (cleanPhone.length !== 10) {
      setErrorMsg('10-digit Mobile Number is mandatory. Please enter a valid 10-digit number.');
      return;
    }

    const numericAge = Number(age);
    if (!age || Number.isNaN(numericAge) || numericAge < 0 || numericAge > 150) {
      setErrorMsg('Please enter a valid patient age.');
      return;
    }

    if (!selectedDoctorId || !date || !slot) {
      setErrorMsg('Please select a Doctor, Appointment Date, and Time Slot.');
      return;
    }

    setSubmitting(true);
    try {
      // Compute next token number for that date
      const snap = await getDocs(collection(db, 'appointments')).catch(() => null);
      const sameDateDocs = snap ? snap.docs.filter((d) => d.data().date === date) : [];
      const tokenNo = sameDateDocs.length + 1;

      const doctorName = currentDoctor?.name || 'Clinic Doctor';
      const nowIso = new Date().toISOString();
      const appointmentData = {
        patientName: patientName.trim().slice(0, 120),
        phone: cleanPhone,
        age: numericAge,
        gender,
        symptoms: symptoms.trim().slice(0, 300),
        doctorId: selectedDoctorId,
        doctorName: doctorName.slice(0, 120),
        date,
        slot,
        status: 'booked' as const,
        bookedBy: 'patient' as const,
        tokenNo,
        createdAt: nowIso,
      };

      let createdId = `apt_${Date.now()}`;
      try {
        const docRef = await addDoc(
          collection(db, 'appointments'),
          appointmentData
        );
        createdId = docRef.id;
      } catch (fsErr) {
        console.error('Firestore appointment write error:', fsErr);
      }

      // Save to SQL relational database (appointments table)
      await saveRecordToSql('appointments', createdId, appointmentData);

      // Also create/sync OPD Queue Token in Firestore + SQL database (tokens table)
      const tokenId = `tok_${date}_${String(tokenNo).padStart(3, '0')}`;
      const tokenPayload = {
        tokenNumber: tokenNo,
        appointmentId: createdId,
        patientName: appointmentData.patientName,
        phone: appointmentData.phone,
        doctorId: appointmentData.doctorId,
        doctorName: appointmentData.doctorName,
        date: appointmentData.date,
        slot: appointmentData.slot,
        status: 'waiting',
        createdAt: nowIso,
      };
      await setDoc(doc(db, 'tokens', tokenId), tokenPayload, { merge: true }).catch(
        () => {}
      );
      await saveRecordToSql('tokens', tokenId, tokenPayload);

      setConfirmed({
        id: createdId,
        patientName: appointmentData.patientName,
        phone: appointmentData.phone,
        age: appointmentData.age,
        gender: appointmentData.gender,
        symptoms: appointmentData.symptoms,
        doctorId: appointmentData.doctorId,
        doctorName: appointmentData.doctorName,
        date: appointmentData.date,
        slot: appointmentData.slot,
        tokenNo,
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'appointments');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 animate-scale-in">
        <div
          id="printable-page-opd-token"
          className="bg-white border-2 border-green-600 rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-green-600 flex items-center gap-1">
                <ShieldCheck size={14} />
                Instant Confirmed OPD Appointment
              </p>
              <h1 className="text-xl font-extrabold text-slate-900">
                Sandana Clinic — Outpatient Token
              </h1>
            </div>
            <div className="w-12 h-12 rounded-xl bg-green-50 border border-green-200 flex items-center justify-center text-green-700 shadow-2xs">
              <CalendarCheck size={24} />
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-green-800 font-medium">Token Number</p>
              <p className="text-3xl font-extrabold font-mono text-green-700">
                #{String(confirmed.tokenNo).padStart(2, '0')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-green-800 font-medium">Date &amp; Slot</p>
              <p className="text-sm font-bold font-mono text-slate-900">
                {confirmed.date} · {confirmed.slot}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-slate-500">Patient Name, Age &amp; Gender</p>
              <p className="font-bold text-slate-900 text-sm">
                {confirmed.patientName} ({confirmed.age} yrs, {confirmed.gender})
              </p>
            </div>
            <div>
              <p className="text-slate-500">Registered Mobile Number</p>
              <p className="font-mono font-bold text-slate-900 text-sm">
                +91 {confirmed.phone}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-slate-500">Consulting Doctor</p>
              <p className="font-bold text-slate-900 text-sm">
                {confirmed.doctorName}
              </p>
            </div>
            {confirmed.symptoms && (
              <div className="col-span-2 border-t border-slate-100 pt-2">
                <p className="text-slate-500">Chief Complaints / Symptoms</p>
                <p className="font-semibold text-slate-800 text-xs mt-0.5">
                  {confirmed.symptoms}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 pt-4">
            <span>Please arrive 10 minutes prior to your slot at reception.</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
              <Database size={12} />
              Saved to Database
            </span>
          </div>

          <div className="no-print flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() =>
                printElementById('printable-page-opd-token', {
                  title: `OPD_Token_${confirmed.tokenNo}_${confirmed.patientName}`,
                })
              }
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Printer size={15} />
              Print Token Slip
            </button>
            <button
              type="button"
              onClick={() =>
                openPrintWindow(
                  'printable-page-opd-token',
                  `OPD Token #${confirmed.tokenNo} - ${confirmed.patientName}`
                )
              }
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <Printer size={14} />
              Open Print Page
            </button>
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
            >
              <ArrowLeft size={14} />
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8 sm:py-10 animate-fade-in-up">
      <div className="bg-white border-2 border-emerald-100 rounded-2xl p-5 sm:p-8 space-y-6 shadow-xl">
        <div className="space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-wider text-green-600 flex items-center gap-1.5">
            <Smartphone size={14} />
            Sandana Clinic Outpatient Desk (Instant OPD Token)
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Book Doctor Appointment
          </h1>
          <p className="text-xs text-slate-500">
            Enter patient details and your mandatory 10-digit Mobile Number to instantly generate your OPD Queue Token (no OTP required).
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-700">
            {errorMsg}
          </div>
        )}

        {returningPatientNote && (
          <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900">
            {returningPatientNote}
          </div>
        )}

        <form onSubmit={handleBookAppointment} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Patient Full Name *
              </label>
              <input
                type="text"
                required
                maxLength={100}
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Karthik Subramanian"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Age (Years) *
              </label>
              <input
                type="number"
                required
                min={0}
                max={150}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="34"
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Gender *
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-3 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Child">Child</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              10-Digit Mobile Number (Mandatory) *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                +91
              </span>
              <input
                type="tel"
                required
                minLength={10}
                maxLength={10}
                pattern="[0-9]{10}"
                value={phone}
                onChange={(e) => handlePhoneChangeAndLookup(e.target.value)}
                placeholder="9840011223"
                className="w-full pl-12 pr-3.5 py-2.5 text-sm font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Mobile number is required for patient registration &amp; OPD records (auto-fills returning patient details).
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Select Specialist Doctor *
            </label>
            <select
              value={selectedDoctorId}
              onChange={(e) => handleDoctorChange(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm font-semibold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {doctors.map((docItem) => (
                <option key={docItem.id} value={docItem.id}>
                  {docItem.name} — {docItem.specialization}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Appointment Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Preferred Time Slot *
              </label>
              <select
                value={slot}
                onChange={(e) => setSlot(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-mono font-bold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                {(currentDoctor?.availableSlots || ['10:00', '10:30', '18:00']).map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Chief Complaints / मुख्य समस्या व लक्षण (Optional)
            </label>
            <input
              type="text"
              maxLength={300}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. Fever, cough, headache, BP checkup..."
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting || phone.replace(/\D/g, '').length !== 10}
              className="w-full py-3.5 px-5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-extrabold rounded-xl transition-all shadow-md cursor-pointer"
            >
              {submitting
                ? 'Booking Appointment & Saving to Database...'
                : 'Confirm & Book Appointment (Instant OPD Token)'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

