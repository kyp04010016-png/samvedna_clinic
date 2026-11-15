import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { Ticket, UserPlus, Share2, CheckCircle2, Printer, ExternalLink, X } from 'lucide-react';
import { db } from '../../firebase';
import { DoctorDoc } from '../public/Home';
import { AppointmentDoc } from '../doctor/DoctorDashboard';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';
import { useLiveDate } from '../../utils/liveDateEngine';
import { printElementById, openPrintWindow } from '../../utils/printEngine';
import { PrescriptionExplorer } from '../../components/PrescriptionExplorer';

export const ReceptionDashboard: React.FC = () => {
  const { todayStr, displayDate, displayTime } = useLiveDate();
  const [receptionTab, setReceptionTab] = useState<'walkin' | 'prescriptions'>('walkin');
  const [doctors, setDoctors] = useState<DoctorDoc[]>([]);
  const [todayAppointments, setTodayAppointments] = useState<AppointmentDoc[]>([]);

  const [patientName, setPatientName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [symptoms, setSymptoms] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [slot, setSlot] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [generatedToken, setGeneratedToken] = useState<number | null>(null);
  const [copiedFeedbackLink, setCopiedFeedbackLink] = useState(false);
  const [selectedTokenToPrint, setSelectedTokenToPrint] = useState<{
    tokenNo: number;
    patientName: string;
    phone: string;
    age: number | string;
    gender?: string;
    symptoms?: string;
    doctorName: string;
    slot: string;
    date: string;
  } | null>(null);


  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'doctors'), where('isActive', '==', true))
        );
        const list: DoctorDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DoctorDoc, 'id'>),
        }));
        setDoctors(list);
        if (list.length > 0) {
          setDoctorId(list[0].id);
          if (list[0].availableSlots?.length > 0) {
            setSlot(list[0].availableSlots[0]);
          }
        }
      } catch (err) {
        console.error('Error loading doctors:', err);
      }
    };
    loadDoctors();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'appointments'),
      where('date', '==', todayStr)
    );
    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: AppointmentDoc[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AppointmentDoc, 'id'>),
        }));
        list.sort((a, b) => a.slot.localeCompare(b.slot));
        setTodayAppointments(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'appointments');
      }
    );
    return () => unsubscribe();
  }, [todayStr]);

  const selectedDoctor = doctors.find((d) => d.id === doctorId);

  useEffect(() => {
    if (selectedDoctor && selectedDoctor.availableSlots?.length > 0) {
      if (!selectedDoctor.availableSlots.includes(slot)) {
        setSlot(selectedDoctor.availableSlots[0]);
      }
    }
  }, [doctorId]);

  const handleGenerateToken = () => {
    const nextToken = todayAppointments.length + 1;
    setGeneratedToken(nextToken);
  };

  const handleWalkInBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = phone.replace(/\D/g, '').slice(-10);
    if (!patientName.trim() || cleanPhone.length !== 10 || !age || !doctorId || !slot) {
      setErrorMsg('Please fill in all walk-in fields including a valid 10-digit Mobile Number.');
      return;
    }

    setSubmitting(true);
    try {
      // Slot clash check (doctorId == X && date == today && slot == Z && status != "cancelled")
      const clashSnap = await getDocs(
        query(
          collection(db, 'appointments'),
          where('doctorId', '==', doctorId),
          where('date', '==', todayStr),
          where('slot', '==', slot)
        )
      );
      const hasClash = clashSnap.docs.some(
        (d) => d.data().status !== 'cancelled'
      );
      if (hasClash) {
        setErrorMsg(`Slot ${slot} is already booked for ${selectedDoctor?.name}.`);
        setSubmitting(false);
        return;
      }

      const nextTokenNo = todayAppointments.length + 1;
      const nowIso = new Date().toISOString();
      const payload = {
        patientName: patientName.trim().slice(0, 120),
        phone: cleanPhone,
        age: Number(age),
        gender,
        symptoms: symptoms.trim().slice(0, 300),
        doctorId,
        doctorName: selectedDoctor?.name || 'Clinic Physician',
        date: todayStr,
        slot,
        status: 'booked' as const,
        bookedBy: 'reception' as const,
        tokenNo: nextTokenNo,
        createdAt: nowIso,
      };

      try {
        const docRef = await addDoc(collection(db, 'appointments'), payload);
        await saveRecordToSql('appointments', docRef.id, payload);

        const tokenId = `tok_${todayStr}_${String(nextTokenNo).padStart(3, '0')}`;
        const tokenPayload = {
          tokenNumber: nextTokenNo,
          appointmentId: docRef.id,
          patientName: payload.patientName,
          phone: payload.phone,
          doctorId: payload.doctorId,
          doctorName: payload.doctorName,
          date: payload.date,
          slot: payload.slot,
          status: 'waiting',
          createdAt: nowIso,
        };
        await setDoc(doc(db, 'tokens', tokenId), tokenPayload, { merge: true }).catch(() => {});
        await saveRecordToSql('tokens', tokenId, tokenPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'appointments');
      }

      setGeneratedToken(nextTokenNo);
      setSelectedTokenToPrint({
        tokenNo: nextTokenNo,
        patientName: payload.patientName,
        phone: payload.phone,
        age: payload.age,
        gender: payload.gender,
        symptoms: payload.symptoms,
        doctorName: payload.doctorName,
        slot: payload.slot,
        date: payload.date,
      });
      setPatientName('');
      setPhone('');
      setAge('');
      setSymptoms('');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Could not register walk-in patient.');
    } finally {
      setSubmitting(false);
    }
  };

  const feedbackUrl = `${window.location.origin}/feedback`;

  const handleCopyFeedbackUrl = async () => {
    try {
      await navigator.clipboard.writeText(feedbackUrl);
      setCopiedFeedbackLink(true);
      setTimeout(() => setCopiedFeedbackLink(false), 2500);
    } catch {
      setCopiedFeedbackLink(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Live Mode & Dynamic Date Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#0F2942] to-teal-950 text-white p-3.5 sm:p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-md border border-emerald-700/50">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <div>
            <p className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-1.5">
              <span>LIVE OPD DESK ACTIVE</span>
              <span>·</span>
              <span className="text-teal-200">Auto-Save &amp; Dual Sync: Active</span>
            </p>
            <p className="text-sm sm:text-base font-extrabold text-white">
              Today: {displayDate} <span className="text-amber-300 font-mono ml-2 font-bold">{displayTime}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono bg-emerald-900/60 text-emerald-200 px-3 py-1.5 rounded-xl border border-emerald-700/60">
            Daily Auto-Rollover &amp; Backup: Active
          </span>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-green-700">
            Sandana Clinic · Front Desk &amp; Token Counter
          </p>
          <h1 className="text-2xl font-bold text-slate-900">Reception Dashboard</h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateToken}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <Ticket size={15} />
            Generate Token (#{todayAppointments.length + 1})
          </button>

          <button
            type="button"
            onClick={handleCopyFeedbackUrl}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            <Share2 size={14} />
            {copiedFeedbackLink ? 'Feedback Link Copied!' : 'Copy Patient Feedback Link'}
          </button>
        </div>
      </div>

      {generatedToken !== null && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-600 text-white font-mono font-bold text-lg flex items-center justify-center shrink-0">
              #{generatedToken}
            </div>
            <div>
              <p className="text-xs font-semibold text-green-800">
                Active Walk-In Queue Token Issued
              </p>
              <p className="text-sm font-bold text-slate-900">
                Token Number: #{generatedToken} · Date: {todayStr}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (!selectedTokenToPrint) {
                  const doc = doctors.find((d) => d.id === doctorId);
                  setSelectedTokenToPrint({
                    tokenNo: generatedToken,
                    patientName: 'Walk-in Patient',
                    phone: '',
                    age: '',
                    doctorName: doc?.name || 'Duty Doctor',
                    slot: 'Walk-In Current',
                    date: todayStr,
                  });
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-sm cursor-pointer transition-colors"
            >
              <Printer size={15} />
              <span>🖨️ पर्ची प्रिंट करें (Print OPD Slip)</span>
            </button>
            <Link
              to="/feedback"
              className="text-xs font-semibold text-green-700 underline whitespace-nowrap px-2"
            >
              Feedback Form
            </Link>
          </div>
        </div>
      )}

      {/* Tab Switcher: Walk-in / OPD Queue vs Doctor Prescriptions & Parchi */}
      <div className="flex flex-wrap items-center gap-2 p-1 bg-emerald-900/10 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setReceptionTab('walkin')}
          className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
            receptionTab === 'walkin'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          🎫 Walk-in Queue &amp; New Patient ({todayAppointments.length})
        </button>
        <button
          type="button"
          onClick={() => setReceptionTab('prescriptions')}
          className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
            receptionTab === 'prescriptions'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          📋 Patient Prescriptions &amp; Parchi (डॉक्टर की पर्चियां व रिपोर्ट)
        </button>
      </div>

      {receptionTab === 'walkin' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* New Walk-in Patient Form */}
          <form
            onSubmit={handleWalkInBooking}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">
            New Walk-in Patient Registration
          </h2>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Patient Name *
            </label>
            <input
              type="text"
              required
              maxLength={120}
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="e.g. Senthil Nathan"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                required
                minLength={5}
                maxLength={20}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="98400 11223"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Age *
              </label>
              <input
                type="number"
                required
                min={0}
                max={120}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="42"
                className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Gender *
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full px-2.5 py-2 text-sm font-semibold border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Child">Child</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Chief Complaints / समस्या व लक्षण
            </label>
            <input
              type="text"
              maxLength={250}
              value={symptoms}
              onChange={(e) => setSymptoms(e.target.value)}
              placeholder="e.g. Fever, cough, body ache..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Doctor *
            </label>
            <select
              required
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} — {d.specialization}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Available Slot ({todayStr}) *
            </label>
            <select
              required
              value={slot}
              onChange={(e) => setSlot(e.target.value)}
              className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {(selectedDoctor?.availableSlots || []).map((s: string) => {
                const isTaken = todayAppointments.some(
                  (a) =>
                    a.doctorId === doctorId &&
                    a.slot === s &&
                    a.status !== 'cancelled'
                );
                return (
                  <option key={s} value={s}>
                    {s} {isTaken ? '(Booked)' : '(Available)'}
                  </option>
                );
              })}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <UserPlus size={15} />
            {submitting
              ? 'Booking Walk-In...'
              : `Register Walk-in & Issue Token #${todayAppointments.length + 1}`}
          </button>
        </form>

        {/* Today's Appointments List */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Today&apos;s Appointments (All Doctors)
            </h2>
            <span className="text-xs font-mono text-slate-500">
              {todayAppointments.length} total today
            </span>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No appointments booked for today yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <th className="py-3 px-4 font-semibold">Token</th>
                    <th className="py-3 px-4 font-semibold">Patient</th>
                    <th className="py-3 px-4 font-semibold">Doctor</th>
                    <th className="py-3 px-4 font-semibold">Slot</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Slip</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {todayAppointments.map((apt, idx) => (
                    <tr key={apt.id} className="hover:bg-slate-50">
                      <td className="py-3.5 px-4 font-mono font-bold text-green-700">
                        #{apt.tokenNo || idx + 1}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-900">{apt.patientName}</p>
                        <p className="font-mono text-slate-500">
                          {apt.phone} · {apt.age} yrs
                        </p>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">
                        {apt.doctorName}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-semibold text-slate-900">
                        {apt.slot}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={
                            apt.status === 'completed'
                              ? 'text-green-700 font-semibold'
                              : apt.status === 'cancelled'
                              ? 'text-red-600 font-medium'
                              : 'text-amber-700 font-semibold'
                          }
                        >
                          {apt.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedTokenToPrint({
                              tokenNo: apt.tokenNo || idx + 1,
                              patientName: apt.patientName,
                              phone: apt.phone,
                              age: apt.age,
                              doctorName: apt.doctorName,
                              slot: apt.slot,
                              date: apt.date,
                            })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-xs rounded-lg cursor-pointer"
                        >
                          <Printer size={13} />
                          <span>Print</span>
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
      ) : (
        <PrescriptionExplorer role="reception" showWriteButton={false} />
      )}

      {/* OPD Token Slip Print Modal */}
      {selectedTokenToPrint && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3">
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden animate-scale-in">
            {/* Modal Top Bar */}
            <div className="bg-[#0F2942] text-white px-5 py-3.5 flex items-center justify-between">
              <span className="font-extrabold text-sm flex items-center gap-2">
                <Ticket className="text-emerald-400" size={17} />
                <span>OPD Token Slip (मरीज टोकन पर्ची)</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedTokenToPrint(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Printable OPD Slip */}
            <div className="p-6 bg-slate-50">
              <div
                id="printable-opd-slip"
                className="bg-white border-2 border-slate-900 p-6 rounded-xl text-slate-900 space-y-4 shadow-sm"
              >
                <div className="text-center border-b border-slate-300 pb-3">
                  <h3 className="text-xl font-black text-[#0F2942] tracking-tight">
                    SANDANA CLINIC &amp; HEALTHCARE
                  </h3>
                  <p className="text-[11px] text-slate-600">
                    OPD Consultation Token · Front Desk Registration
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Phone: +91 98400 11224 · Anna Nagar, Chennai
                  </p>
                </div>

                <div className="text-center py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-widest block">
                    OPD TOKEN NUMBER
                  </span>
                  <span className="text-4xl font-black font-mono text-emerald-900">
                    #{selectedTokenToPrint.tokenNo}
                  </span>
                  <span className="text-[11px] font-bold text-slate-600 block mt-1">
                    Date: {selectedTokenToPrint.date} · Slot: {selectedTokenToPrint.slot}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-200 py-2.5">
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">
                      PATIENT
                    </span>
                    <span className="font-extrabold text-slate-900">
                      {selectedTokenToPrint.patientName}
                    </span>
                    {selectedTokenToPrint.age && (
                      <span className="text-slate-500 block">
                        Age: {selectedTokenToPrint.age} Yrs
                      </span>
                    )}
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 block font-bold">
                      CONSULTING DOCTOR
                    </span>
                    <span className="font-bold text-emerald-800">
                      {selectedTokenToPrint.doctorName}
                    </span>
                    <span className="text-slate-500 block font-mono">
                      {selectedTokenToPrint.phone || 'Walk-In'}
                    </span>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-500 pt-1">
                  कृपया अपना टोकन नंबर पुकारे जाने पर डॉक्टर चेंबर में जाएं।<br />
                  Please wait in the waiting lounge until your token number is called.
                </div>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="no-print bg-white px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSelectedTokenToPrint(null)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer"
              >
                Close
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    openPrintWindow(
                      'printable-opd-slip',
                      `OPD_Token_${selectedTokenToPrint.tokenNo}`
                    )
                  }
                  className="inline-flex items-center gap-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 cursor-pointer"
                >
                  <ExternalLink size={13} />
                  <span>Open Print Page</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printElementById('printable-opd-slip', {
                      title: `OPD_Token_${selectedTokenToPrint.tokenNo}`,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-sm cursor-pointer"
                >
                  <Printer size={15} />
                  <span>🖨️ पर्ची प्रिंट करें (Print Slip)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
