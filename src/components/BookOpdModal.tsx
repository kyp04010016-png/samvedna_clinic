import React, { useEffect, useState } from 'react';
import { addDoc, collection, doc, getDocs, setDoc } from 'firebase/firestore';
import {
  CalendarCheck,
  CalendarPlus,
  Printer,
  ShieldCheck,
  Database,
  X,
  Stethoscope,
  Clock,
  User,
  Phone,
  FileText,
} from 'lucide-react';
import { db } from '../firebase';
import { DoctorRecord } from '../pages/public/Home';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { saveRecordToSql } from '../utils/sqlSyncBridge';
import { openPrintWindow, printElementById } from '../utils/printEngine';

export interface OpenBookOpdDetail {
  doctorId?: string;
  slot?: string;
}

export function openBookOpdModal(detail?: OpenBookOpdDetail) {
  window.dispatchEvent(
    new CustomEvent<OpenBookOpdDetail>('open-book-opd-modal', {
      detail: detail || {},
    })
  );
}

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

const FALLBACK_MODAL_DOCTORS: DoctorRecord[] = [
  {
    id: 'doc_sandana_1',
    name: 'Dr. S. Sandana Krishnan',
    specialization: 'Senior General Physician & Diabetologist',
    qualification: 'MBBS, MD',
    photoUrl: '',
    availableSlots: ['10:00', '10:30', '11:00', '18:00', '18:30', '19:00'],
    availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    isActive: true,
    consultationFee: 350,
  },
  {
    id: 'doc_sandana_2',
    name: 'Dr. Priya Ramanathan',
    specialization: 'Consultant Pediatrician & Neonatologist',
    qualification: 'MBBS, DCH, DNB',
    photoUrl: '',
    availableSlots: ['10:30', '11:00', '11:30', '17:00', '17:30', '18:00'],
    availableDays: ['Mon', 'Tue', 'Wed', 'Fri', 'Sat'],
    isActive: true,
    consultationFee: 300,
  },
  {
    id: 'doc_sandana_3',
    name: 'Dr. Arvind Narayanan',
    specialization: 'Orthopedic, Spine & Joint Surgeon',
    qualification: 'MBBS, MS (Ortho)',
    photoUrl: '',
    availableSlots: ['16:30', '17:00', '17:30', '18:00', '19:30'],
    availableDays: ['Tue', 'Thu', 'Sat'],
    isActive: true,
    consultationFee: 400,
  },
];

export const BookOpdModal: React.FC<{
  clinicName?: string;
}> = ({ clinicName = 'Sandana Clinic' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [doctors, setDoctors] = useState<DoctorRecord[]>(FALLBACK_MODAL_DOCTORS);

  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [symptoms, setSymptoms] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState(
    FALLBACK_MODAL_DOCTORS[0].id
  );
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [slot, setSlot] = useState(FALLBACK_MODAL_DOCTORS[0].availableSlots[0]);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedAppointment | null>(null);
  const [returningPatientBanner, setReturningPatientBanner] = useState<string | null>(null);

  // Load active doctors from Firestore
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
          setSelectedDoctorId((prev) =>
            list.some((d) => d.id === prev) ? prev : list[0].id
          );
          const firstDoc = list[0];
          if (firstDoc.availableSlots?.length > 0) {
            setSlot((prev) => prev || firstDoc.availableSlots[0]);
          }
        }
      } catch {
        // Fallback doctors remain active
      }
    };
    loadDoctors();
  }, []);

  // Listen for global 'open-book-opd-modal' custom event
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const customEv = e as CustomEvent<OpenBookOpdDetail>;
      const detail = customEv.detail || {};
      setErrorMsg(null);
      setConfirmed(null);

      if (detail.doctorId) {
        setSelectedDoctorId(detail.doctorId);
        const foundDoc = doctors.find((d) => d.id === detail.doctorId);
        if (detail.slot) {
          setSlot(detail.slot);
        } else if (foundDoc && foundDoc.availableSlots?.length > 0) {
          setSlot(foundDoc.availableSlots[0]);
        }
      } else if (detail.slot) {
        setSlot(detail.slot);
      }

      setIsOpen(true);
    };

    window.addEventListener('open-book-opd-modal', handleOpen);
    return () => window.removeEventListener('open-book-opd-modal', handleOpen);
  }, [doctors]);

  if (!isOpen) return null;

  const currentDoctor =
    doctors.find((d) => d.id === selectedDoctorId) || doctors[0];

  const handleDoctorChange = (newDocId: string) => {
    setSelectedDoctorId(newDocId);
    const found = doctors.find((d) => d.id === newDocId);
    if (found && found.availableSlots?.length > 0) {
      setSlot(found.availableSlots[0]);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setErrorMsg(null);
  };

  const handleResetForNewBooking = () => {
    setConfirmed(null);
    setPatientName('');
    setPhone('');
    setAge('');
    setSymptoms('');
    setErrorMsg(null);
    setReturningPatientBanner(null);
  };

  const handlePhoneChangeWithLookup = async (rawVal: string) => {
    const cleaned = rawVal.replace(/\D/g, '').slice(0, 10);
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
          setReturningPatientBanner(
            `✓ पुराना मरीज रिकॉर्ड मिला: ${matched.patientName} (${matched.age || ''} Yrs, ${matched.gender || 'Male'}) — डेटा अपने-आप भर गया है!`
          );
        }
      } catch {
        // ignore
      }
    } else {
      setReturningPatientBanner(null);
    }
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!patientName.trim()) {
      setErrorMsg('कृपया मरीज का पूरा नाम दर्ज करें (Please enter Patient Full Name).');
      return;
    }
    if (cleanPhone.length !== 10) {
      setErrorMsg(
        'कृपया 10-अंकों का सही मोबाइल नंबर दर्ज करें (10-digit Mobile Number is mandatory).'
      );
      return;
    }

    const numericAge = Number(age);
    if (!age || Number.isNaN(numericAge) || numericAge < 0 || numericAge > 150) {
      setErrorMsg('कृपया मरीज की सही उम्र दर्ज करें (Please enter valid age).');
      return;
    }

    if (!selectedDoctorId || !date || !slot) {
      setErrorMsg('कृपया डॉक्टर, तारीख और समय चुनें।');
      return;
    }

    setSubmitting(true);
    try {
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

      await saveRecordToSql('appointments', createdId, appointmentData);

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
      await setDoc(doc(db, 'tokens', tokenId), tokenPayload, {
        merge: true,
      }).catch(() => {});
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="book-opd-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto animate-fade-in"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-3xl max-w-xl w-full overflow-hidden shadow-2xl border-2 border-teal-500/80 my-auto animate-scale-in text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="bg-gradient-to-r from-[#0F2942] via-[#133B5C] to-[#0D9488] text-white px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-teal-400 text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
              <CalendarPlus size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-teal-200 truncate">
                {clinicName} · Instant Outpatient Token
              </p>
              <h2
                id="book-opd-modal-title"
                className="text-base sm:text-lg font-black tracking-tight text-white truncate"
              >
                Book OPD Appointment (डॉक्टर अपॉइंटमेंट बुक करें)
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/25 text-white transition-colors cursor-pointer shrink-0"
            aria-label="Close Book OPD Popup"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 max-h-[82vh] overflow-y-auto">
          {confirmed ? (
            <div className="space-y-5">
              <div
                id="printable-modal-opd-token"
                className="space-y-4 bg-white border-2 border-emerald-500 rounded-2xl p-4 sm:p-5"
              >
                <div className="border-b border-slate-200 pb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                      {clinicName} — Official OPD Token Slip
                    </p>
                    <p className="text-xs text-slate-600">
                      Outpatient Consultation &amp; Queue Receipt
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                    <ShieldCheck size={14} />
                    Confirmed
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-emerald-900">
                      Your OPD Queue Token Number
                    </p>
                    <p className="text-3xl sm:text-4xl font-black font-mono text-emerald-700 tabular-nums">
                      #{String(confirmed.tokenNo).padStart(2, '0')}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center ml-auto shadow-sm">
                      <CalendarCheck size={20} />
                    </div>
                    <p className="text-xs font-mono font-bold text-slate-900">
                      Date: {confirmed.date}
                    </p>
                    <p className="text-xs font-mono font-extrabold text-emerald-800 bg-emerald-200/70 px-2.5 py-0.5 rounded-full inline-block">
                      Slot: {confirmed.slot}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs">
                  <div>
                    <p className="text-slate-500">Patient Name &amp; Age</p>
                    <p className="font-bold text-slate-900 text-sm mt-0.5">
                      {confirmed.patientName} ({confirmed.age} Yrs, {confirmed.gender})
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Mobile Number</p>
                    <p className="font-mono font-bold text-slate-900 text-sm mt-0.5">
                      +91 {confirmed.phone}
                    </p>
                  </div>
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200/80">
                    <p className="text-slate-500">Consulting Specialist Doctor</p>
                    <p className="font-bold text-[#0F2942] text-sm mt-0.5">
                      {confirmed.doctorName}
                    </p>
                  </div>
                  {confirmed.symptoms && (
                    <div className="sm:col-span-2 pt-2 border-t border-slate-200/80">
                      <p className="text-slate-500">Symptoms / Notes</p>
                      <p className="font-medium text-slate-800 mt-0.5">
                        {confirmed.symptoms}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>कृपया अपने समय से 10 मिनट पहले क्लिनिक रिसेप्शन पर पहुँचें।</span>
                  <span className="inline-flex items-center gap-1 text-emerald-700 font-bold shrink-0">
                    <Database size={12} />
                    Saved to Database
                  </span>
                </div>
              </div>

              <div className="no-print flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() =>
                    printElementById('printable-modal-opd-token', {
                      title: `OPD_Token_${confirmed.tokenNo}_${confirmed.patientName}`,
                    })
                  }
                  className="flex-1 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-sm transition-colors inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer size={15} />
                  <span>Print Token Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openPrintWindow(
                      'printable-modal-opd-token',
                      `OPD Token #${confirmed.tokenNo} - ${confirmed.patientName}`
                    )
                  }
                  className="py-3 px-3.5 bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-300 text-xs font-bold rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Open Print Page</span>
                </button>
                <button
                  type="button"
                  onClick={handleResetForNewBooking}
                  className="py-3 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Book Another
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  className="py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleBookAppointment} className="space-y-4">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700">
                  {errorMsg}
                </div>
              )}

              {returningPatientBanner && (
                <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900">
                  {returningPatientBanner}
                </div>
              )}

              {/* Patient Name, Age & Gender */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-6">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Patient Full Name (मरीज का नाम) *
                  </label>
                  <div className="relative">
                    <User
                      size={14}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={patientName}
                      onChange={(e) => setPatientName(e.target.value)}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Age (उम्र) *
                  </label>
                  <input
                    type="number"
                    required
                    min={0}
                    max={150}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="32"
                    className="w-full px-3 py-2.5 text-xs sm:text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Gender *
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full px-2.5 py-2.5 text-xs sm:text-sm font-semibold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Child">Child</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* 10-Digit Mobile Number */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  10-Digit Mobile Number (मोबाइल नंबर) *
                </label>
                <div className="relative">
                  <Phone
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <span className="absolute left-9 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                    +91
                  </span>
                  <input
                    type="tel"
                    required
                    minLength={10}
                    maxLength={10}
                    pattern="[0-9]{10}"
                    value={phone}
                    onChange={(e) => handlePhoneChangeWithLookup(e.target.value)}
                    placeholder="9840011223"
                    className="w-full pl-17 pr-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Specialist Doctor Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Select Specialist Doctor (डॉक्टर चुनें) *
                </label>
                <div className="relative">
                  <Stethoscope
                    size={14}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-600"
                  />
                  <select
                    value={selectedDoctorId}
                    onChange={(e) => handleDoctorChange(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-bold border border-slate-300 rounded-xl bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {doctors.map((docItem) => (
                      <option key={docItem.id} value={docItem.id}>
                        {docItem.name} — {docItem.specialization}
                        {docItem.consultationFee
                          ? ` (₹${docItem.consultationFee})`
                          : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date & Preferred Time Slot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Appointment Date (तारीख) *
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs sm:text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Time Slot (समय) *
                  </label>
                  <div className="relative">
                    <Clock
                      size={14}
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-600"
                    />
                    <select
                      value={slot}
                      onChange={(e) => setSlot(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs sm:text-sm font-mono font-bold border border-slate-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                    >
                      {(
                        currentDoctor?.availableSlots || [
                          '10:00',
                          '10:30',
                          '11:00',
                          '18:00',
                        ]
                      ).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Optional Symptoms / Problem Description */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Symptoms / Reason for Visit (समस्या / लक्षण - वैकल्पिक)
                </label>
                <div className="relative">
                  <FileText
                    size={14}
                    className="absolute left-3.5 top-3 text-slate-400"
                  />
                  <input
                    type="text"
                    maxLength={250}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="e.g. Fever, Blood Sugar Checkup, General Consultation"
                    className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              {/* Submit & Cancel Buttons */}
              <div className="flex items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-3 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    submitting || phone.replace(/\D/g, '').length !== 10
                  }
                  className="flex-1 py-3 px-5 rounded-xl bg-gradient-to-r from-[#0D9488] to-emerald-600 hover:from-teal-700 hover:to-emerald-700 disabled:opacity-50 text-white text-xs sm:text-sm font-black uppercase tracking-wide shadow-md transition-all cursor-pointer"
                >
                  {submitting
                    ? 'Generating Instant OPD Token...'
                    : 'Confirm & Generate OPD Token'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
