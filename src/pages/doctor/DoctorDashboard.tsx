import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  CheckCircle,
  XCircle,
  Stethoscope,
  Printer,
  FileText,
  Plus,
  Camera,
  Search,
  Eye,
  Calendar,
  Clock,
  User,
  HeartPulse,
  Pill,
  Upload,
  History,
  Phone,
  CheckCircle2,
  Download,
  X,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { ClinicSettingsDoc, DoctorRecord } from '../public/Home';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';
import { useLiveDate } from '../../utils/liveDateEngine';
import {
  PrescriptionModal,
  PrescriptionRecord,
} from '../../components/PrescriptionModal';
import { PrescriptionExplorer } from '../../components/PrescriptionExplorer';
import { logStaffActivity } from '../../utils/activityLogger';

export interface AppointmentDoc {
  id: string;
  patientName: string;
  phone: string;
  age: number;
  gender?: string;
  symptoms?: string;
  clinicalNotes?: string;
  parchiImageUrl?: string;
  parchiFileName?: string;
  doctorId: string;
  doctorName: string;
  date: string;
  slot: string;
  status: 'booked' | 'confirmed' | 'completed' | 'cancelled';
  bookedBy: 'patient' | 'reception' | 'admin';
  tokenNo?: number;
  prescriptionId?: string;
  createdAt: string;
  completedAt?: string;
}

type TabFilter = 'today' | 'upcoming' | 'completed' | 'prescriptions' | 'all';

export const DoctorDashboard: React.FC = () => {
  const { firebaseUser, userProfile, isTrueAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(() => {
    if (isTrueAdmin) return 'all';
    const savedDoc = localStorage.getItem('sandana_selected_doctor_chamber');
    if (savedDoc) {
      try {
        const parsed = JSON.parse(savedDoc);
        if (parsed?.id) return parsed.id;
      } catch {
        // ignore
      }
    }
    return userProfile?.doctorId || userProfile?.uid || 'doc_sandana_1';
  });
  const [appointments, setAppointments] = useState<AppointmentDoc[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [clinicSettings, setClinicSettings] = useState<Partial<ClinicSettingsDoc>>({});

  const tabParam = searchParams.get('tab') as TabFilter | null;
  const [activeTab, setActiveTab] = useState<TabFilter>(
    tabParam === 'upcoming' ||
      tabParam === 'completed' ||
      tabParam === 'prescriptions' ||
      tabParam === 'all'
      ? tabParam
      : 'today'
  );
  const [loading, setLoading] = useState(true);

  // Prescription Modal State
  const [isRxModalOpen, setIsRxModalOpen] = useState(false);
  const [rxModalInitialMode, setRxModalInitialMode] = useState<'form' | 'print'>('form');
  const [selectedAptForRx, setSelectedAptForRx] = useState<AppointmentDoc | null>(
    null
  );
  const [selectedExistingRx, setSelectedExistingRx] =
    useState<PrescriptionRecord | null>(null);

  // Direct Parchi Upload from Patient Tab / OPD Queue
  const quickUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [quickUploadTarget, setQuickUploadTarget] = useState<{
    patientName: string;
    phone: string;
    age: number;
    gender: string;
    symptoms?: string;
    appointmentId?: string;
    doctorId?: string;
    doctorName?: string;
    tokenNo?: number;
  } | null>(null);
  const [uploadingQuickParchi, setUploadingQuickParchi] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Lightbox for viewing uploaded Parchi fullscreen
  const [lightboxParchi, setLightboxParchi] = useState<{
    url: string;
    patientName: string;
    date: string;
    fileName?: string;
  } | null>(null);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (
      tabParam === 'today' ||
      tabParam === 'upcoming' ||
      tabParam === 'completed' ||
      tabParam === 'prescriptions' ||
      tabParam === 'all'
    ) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const activeUserUid = userProfile?.uid || firebaseUser?.uid || '';

  // 1. Load Doctors & Clinic Settings and lock logged-in doctor's chamber
  useEffect(() => {
    const loadInitialMetadata = async () => {
      try {
        const [docSnap, setSnap] = await Promise.all([
          getDocs(collection(db, 'doctors')),
          getDoc(doc(db, 'settings', 'clinic')),
        ]);

        const list: DoctorRecord[] = docSnap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<DoctorRecord, 'id'>),
        }));
        setDoctors(list);

        // If logged in as a specific Doctor (not Chief Admin), strictly lock to their Doctor Chamber
        if (!isTrueAdmin && list.length > 0) {
          const emailLower = (userProfile?.email || firebaseUser?.email || '').trim().toLowerCase();
          const nameLower = (userProfile?.name || '').trim().toLowerCase();
          const matchedDoc =
            list.find((d) => userProfile?.doctorId && d.id === userProfile.doctorId) ||
            list.find((d) => d.id === activeUserUid) ||
            list.find(
              (d) =>
                (d.email && d.email.trim().toLowerCase() === emailLower) ||
                (d.loginId && d.loginId.trim().toLowerCase() === emailLower)
            ) ||
            list.find(
              (d) =>
                nameLower &&
                (d.name.trim().toLowerCase() === nameLower ||
                  d.name.trim().toLowerCase().includes(nameLower) ||
                  nameLower.includes(d.name.trim().toLowerCase()))
            );

          if (matchedDoc) {
            setSelectedDoctorId(matchedDoc.id);
          } else if (selectedDoctorId === 'all') {
            setSelectedDoctorId(userProfile?.doctorId || list[0].id);
          }
        }

        if (setSnap.exists()) {
          setClinicSettings(setSnap.data() as Partial<ClinicSettingsDoc>);
        }
      } catch (err) {
        console.error('Error loading doctor profiles or settings:', err);
      }
    };
    loadInitialMetadata();
  }, [activeUserUid, userProfile?.name, userProfile?.email, userProfile?.doctorId, isTrueAdmin, firebaseUser?.email]);

  // 2. Real-time Appointments (Listen to ALL clinic appointments so no booked OPD patient is ever missed)
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'appointments'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: AppointmentDoc[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<AppointmentDoc, 'id'>),
        }));
        list.sort((a, b) =>
          `${b.date}_${b.createdAt || b.slot}`.localeCompare(
            `${a.date}_${a.createdAt || a.slot}`
          )
        );
        setAppointments(list);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'appointments');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // 3. Real-time Prescriptions (Listen to ALL prescriptions across clinic)
  useEffect(() => {
    const q = query(collection(db, 'prescriptions'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: PrescriptionRecord[] = snapshot.docs.map((d) => ({
          id: d.id,
          ...(d.data() as PrescriptionRecord),
        }));
        list.sort((a, b) =>
          (b.createdAt || b.date || '').localeCompare(
            a.createdAt || a.date || ''
          )
        );
        setPrescriptions(list);
      },
      (error) => {
        console.warn('Could not listen to prescriptions:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  const { todayStr, displayDate, displayTime } = useLiveDate();

  const currentDoctor: DoctorRecord | undefined =
    doctors.find((d) => d.id === selectedDoctorId) ||
    (!isTrueAdmin && userProfile
      ? {
          id: userProfile.doctorId || userProfile.uid,
          name: userProfile.name,
          specialization: userProfile.specialization || 'General Physician',
          qualification: 'MBBS, MD',
          experience: '10+ Years',
          consultationFee: 300,
          photoUrl: '',
          availableSlots: ['09:30', '10:00', '10:30', '11:00'],
          availableDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          isActive: true,
        }
      : doctors[0]);

  const handleUpdateStatus = async (
    aptId: string,
    newStatus: 'completed' | 'cancelled'
  ) => {
    try {
      const updateData = {
        status: newStatus,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'appointments', aptId), updateData);
      await saveRecordToSql('appointments', aptId, updateData);
      setToastMsg(`Appointment marked as ${newStatus}.`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `appointments/${aptId}`);
    }
  };

  // Open modal to write/edit prescription or add new visit data for an appointment
  const handleOpenWritePrescription = (
    apt: AppointmentDoc,
    mode: 'form' | 'print' = 'form',
    forceNewVisit = false
  ) => {
    const existing = !forceNewVisit
      ? prescriptions.find(
          (p) => p.appointmentId === apt.id || (apt.prescriptionId && p.id === apt.prescriptionId)
        )
      : null;
    setSelectedAptForRx(apt);
    setSelectedExistingRx(existing || null);
    setRxModalInitialMode(mode);
    setIsRxModalOpen(true);
  };

  // Open modal for a returning patient from the Patient Tab to enter new visit data & upload parchi
  const handleOpenNewVisitForSavedPatient = (patientGroup: {
    patientName: string;
    phone: string;
    age: number;
    gender: string;
    latestSymptoms?: string;
    latestAppointmentId?: string;
    latestTokenNo?: number;
    doctorId?: string;
    doctorName?: string;
  }) => {
    setSelectedAptForRx({
      id: patientGroup.latestAppointmentId || '',
      patientName: patientGroup.patientName,
      phone: patientGroup.phone === 'Walk-In' ? '' : patientGroup.phone,
      age: patientGroup.age || 30,
      gender: patientGroup.gender || 'Male',
      symptoms: patientGroup.latestSymptoms || '',
      doctorId: patientGroup.doctorId || currentDoctor?.id || 'doc_sandana_1',
      doctorName:
        patientGroup.doctorName || currentDoctor?.name || 'Dr. Sandana (MBBS)',
      date: todayStr,
      slot: new Date().toTimeString().slice(0, 5),
      status: 'booked',
      bookedBy: 'reception',
      tokenNo: patientGroup.latestTokenNo || appointments.length + 1,
      createdAt: new Date().toISOString(),
    });
    setSelectedExistingRx(null);
    setRxModalInitialMode('form');
    setIsRxModalOpen(true);
  };

  const handleOpenNewPrescription = () => {
    setSelectedAptForRx(null);
    setSelectedExistingRx(null);
    setRxModalInitialMode('form');
    setIsRxModalOpen(true);
  };

  const handleViewOrPrintPrescription = (
    rx: PrescriptionRecord,
    mode: 'form' | 'print' = 'print'
  ) => {
    setSelectedExistingRx(rx);
    setSelectedAptForRx(null);
    setRxModalInitialMode(mode);
    setIsRxModalOpen(true);
  };

  // Direct 1-click Parchi upload handler for any patient in OPD Queue or Patient Tab
  const triggerQuickParchiUpload = (target: {
    patientName: string;
    phone: string;
    age: number;
    gender: string;
    symptoms?: string;
    appointmentId?: string;
    doctorId?: string;
    doctorName?: string;
    tokenNo?: number;
  }) => {
    setQuickUploadTarget(target);
    setTimeout(() => {
      quickUploadInputRef.current?.click();
    }, 50);
  };

  const handleQuickParchiFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !quickUploadTarget) return;

    setUploadingQuickParchi(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1100;
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.78);

          const nowIso = new Date().toISOString();
          const prescriptionId = `rx_${todayStr}_${Date.now().toString().slice(-6)}`;
          const prescriptionNo = `RX-${todayStr.replace(/-/g, '')}-${String(
            quickUploadTarget.tokenNo || Math.floor(100 + Math.random() * 900)
          ).padStart(3, '0')}`;

          const newRxPayload: PrescriptionRecord = {
            id: prescriptionId,
            prescriptionNo,
            appointmentId: quickUploadTarget.appointmentId || '',
            patientName: quickUploadTarget.patientName,
            phone: quickUploadTarget.phone === 'Walk-In' ? '' : quickUploadTarget.phone,
            age: quickUploadTarget.age || 30,
            gender: quickUploadTarget.gender || 'Male',
            doctorId:
              quickUploadTarget.doctorId ||
              currentDoctor?.id ||
              'doc_sandana_1',
            doctorName:
              quickUploadTarget.doctorName ||
              currentDoctor?.name ||
              'Dr. Sandana (MBBS)',
            doctorSpecialization:
              currentDoctor?.specialization || 'General Physician',
            doctorQualification: currentDoctor?.qualification || 'MBBS, MD',
            date: todayStr,
            tokenNo: quickUploadTarget.tokenNo || 1,
            chiefComplaints:
              quickUploadTarget.symptoms || 'OPD Consultation & Handwritten Parchi',
            diagnosis: 'Uploaded Handwritten Doctor Parchi',
            medicines: [],
            parchiImageUrl: compressedDataUrl,
            parchiFileName: file.name,
            createdAt: nowIso,
          };

          try {
            await setDoc(doc(db, 'prescriptions', prescriptionId), newRxPayload, {
              merge: true,
            });
          } catch (err) {
            console.warn('Firestore quick parchi save warning:', err);
          }
          await saveRecordToSql('prescriptions', prescriptionId, newRxPayload);

          if (quickUploadTarget.appointmentId) {
            const aptUpdate = {
              patientName: quickUploadTarget.patientName,
              phone:
                quickUploadTarget.phone && quickUploadTarget.phone !== 'Walk-In'
                  ? quickUploadTarget.phone
                  : '0000000000',
              age: quickUploadTarget.age || 30,
              gender: quickUploadTarget.gender || 'Male',
              doctorId:
                quickUploadTarget.doctorId ||
                currentDoctor?.id ||
                'doc_sandana_1',
              doctorName:
                quickUploadTarget.doctorName ||
                currentDoctor?.name ||
                'Dr. Sandana (MBBS)',
              date: todayStr,
              slot: '10:00',
              status: 'completed' as const,
              prescriptionId,
              parchiImageUrl: compressedDataUrl,
              parchiFileName: file.name,
              completedAt: nowIso,
            };
            try {
              await setDoc(
                doc(db, 'appointments', quickUploadTarget.appointmentId),
                aptUpdate,
                { merge: true }
              );
            } catch {
              // ignore
            }
            await saveRecordToSql(
              'appointments',
              quickUploadTarget.appointmentId,
              aptUpdate
            );
          }

          await logStaffActivity(
            'PARCHI_UPLOADED',
            `Uploaded handwritten parchi (${file.name}) for patient ${quickUploadTarget.patientName}`,
            newRxPayload.doctorName
          ).catch(() => {});

          setToastMsg(
            `✓ ${quickUploadTarget.patientName} की पर्ची (${file.name}) सफलतापूर्वक अपलोड और सेव हो गई!`
          );
          setTimeout(() => setToastMsg(null), 4000);
        }
        setUploadingQuickParchi(false);
        setQuickUploadTarget(null);
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Strict per-doctor match helper: checks both doctorId and doctorName
  const doesBelongToSelectedDoctor = React.useCallback(
    (recordDoctorId?: string, recordDoctorName?: string) => {
      if (isTrueAdmin && selectedDoctorId === 'all') return true;
      const targetDocId =
        selectedDoctorId !== 'all'
          ? selectedDoctorId
          : userProfile?.doctorId || currentDoctor?.id || '';
      if (targetDocId && recordDoctorId && recordDoctorId === targetDocId) {
        return true;
      }
      const targetDocName = (currentDoctor?.name || userProfile?.name || '')
        .trim()
        .toLowerCase();
      const recName = (recordDoctorName || '').trim().toLowerCase();
      if (targetDocName && recName) {
        return (
          recName === targetDocName ||
          recName.includes(targetDocName) ||
          targetDocName.includes(recName)
        );
      }
      return false;
    },
    [isTrueAdmin, selectedDoctorId, userProfile?.doctorId, userProfile?.name, currentDoctor?.id, currentDoctor?.name]
  );

  // Doctor filter helper
  const doctorFilteredAppointments = React.useMemo(
    () =>
      appointments.filter((apt) =>
        doesBelongToSelectedDoctor(apt.doctorId, apt.doctorName)
      ),
    [appointments, doesBelongToSelectedDoctor]
  );

  const doctorFilteredPrescriptions = React.useMemo(
    () =>
      prescriptions.filter((rx) =>
        doesBelongToSelectedDoctor(rx.doctorId, rx.doctorName)
      ),
    [prescriptions, doesBelongToSelectedDoctor]
  );

  const filteredAppointments = doctorFilteredAppointments.filter((apt) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        (apt.patientName && apt.patientName.toLowerCase().includes(q)) ||
        (apt.phone && apt.phone.includes(q)) ||
        (apt.symptoms && apt.symptoms.toLowerCase().includes(q)) ||
        String(apt.tokenNo || '').includes(q);
      if (!match) return false;
    }

    if (activeTab === 'all') {
      return true;
    }
    if (activeTab === 'completed') {
      return apt.status === 'completed';
    }
    if (activeTab === 'today') {
      return apt.date === todayStr;
    }
    return apt.date > todayStr && apt.status !== 'cancelled';
  });

  // Group all saved patients (combining both OPD Appointments & Prescriptions) for the "All Patients (मरीज टैब)" view
  const masterPatientGroups = React.useMemo(() => {
    const groups: Record<
      string,
      {
        patientKey: string;
        patientName: string;
        phone: string;
        age: number;
        gender: string;
        latestDate: string;
        latestTokenNo?: number;
        latestSymptoms?: string;
        latestAppointmentId?: string;
        doctorId?: string;
        doctorName?: string;
        appointments: AppointmentDoc[];
        prescriptions: PrescriptionRecord[];
      }
    > = {};

    // 1. Add all booked OPD appointments for this doctor
    doctorFilteredAppointments.forEach((apt) => {
      const cleanPhone = (apt.phone || '').replace(/\D/g, '').slice(-10);
      const key = (
        cleanPhone.length === 10
          ? cleanPhone
          : (apt.patientName || 'patient').trim().toLowerCase()
      ).toLowerCase();

      if (!groups[key]) {
        groups[key] = {
          patientKey: key,
          patientName: apt.patientName,
          phone: apt.phone || 'Walk-In',
          age: apt.age || 30,
          gender: apt.gender || 'Male',
          latestDate: apt.date || todayStr,
          latestTokenNo: apt.tokenNo,
          latestSymptoms: apt.symptoms,
          latestAppointmentId: apt.id,
          doctorId: apt.doctorId,
          doctorName: apt.doctorName,
          appointments: [],
          prescriptions: [],
        };
      }
      groups[key].appointments.push(apt);
      if (apt.gender && groups[key].gender === 'Male') {
        groups[key].gender = apt.gender;
      }
      if (apt.symptoms && !groups[key].latestSymptoms) {
        groups[key].latestSymptoms = apt.symptoms;
      }
      if (apt.date >= groups[key].latestDate) {
        groups[key].latestDate = apt.date;
        groups[key].latestAppointmentId = apt.id;
        if (apt.tokenNo) groups[key].latestTokenNo = apt.tokenNo;
      }
    });

    // 2. Merge all saved prescriptions & uploaded parchis for this doctor
    doctorFilteredPrescriptions.forEach((rx) => {
      const cleanPhone = (rx.phone || '').replace(/\D/g, '').slice(-10);
      const key = (
        cleanPhone.length === 10
          ? cleanPhone
          : (rx.patientName || 'patient').trim().toLowerCase()
      ).toLowerCase();

      if (!groups[key]) {
        groups[key] = {
          patientKey: key,
          patientName: rx.patientName,
          phone: rx.phone || 'Walk-In',
          age: rx.age || 30,
          gender: rx.gender || 'Male',
          latestDate: rx.date || todayStr,
          latestTokenNo: rx.tokenNo,
          latestSymptoms: rx.chiefComplaints,
          doctorId: rx.doctorId,
          doctorName: rx.doctorName,
          appointments: [],
          prescriptions: [],
        };
      }
      groups[key].prescriptions.push(rx);
      if (rx.gender) groups[key].gender = rx.gender;
      if (rx.age) groups[key].age = rx.age;
      if (rx.chiefComplaints && !groups[key].latestSymptoms) {
        groups[key].latestSymptoms = rx.chiefComplaints;
      }
      if (rx.date && rx.date >= groups[key].latestDate) {
        groups[key].latestDate = rx.date;
      }
    });

    let list = Object.values(groups).sort((a, b) =>
      (b.latestDate || '').localeCompare(a.latestDate || '')
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (g) =>
          g.patientName.toLowerCase().includes(q) ||
          g.phone.toLowerCase().includes(q) ||
          (g.latestSymptoms && g.latestSymptoms.toLowerCase().includes(q))
      );
    }

    return list;
  }, [doctorFilteredAppointments, doctorFilteredPrescriptions, searchQuery, todayStr]);

  const handleSelectTab = (next: TabFilter) => {
    setActiveTab(next);
    setSearchParams({ tab: next });
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6 space-y-6 animate-fade-in-up">
      {/* Hidden input for 1-click direct Parchi Upload */}
      <input
        ref={quickUploadInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleQuickParchiFileChange}
        className="hidden"
      />

      {/* Live Mode & Doctor Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-950 via-[#0F2942] to-teal-950 text-white rounded-2xl p-5 shadow-md border border-emerald-700/50">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm border border-emerald-400/40">
            <Stethoscope size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                Doctor OPD Chamber · Live Consultations &amp; Digital Rx
              </p>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {isTrueAdmin && selectedDoctorId === 'all'
                ? 'All OPD Chambers (सभी डॉक्टर चेंबर)'
                : currentDoctor
                ? currentDoctor.name
                : userProfile?.name || 'Dr. Sandana (MBBS)'}
            </h1>
            <p className="text-xs text-teal-200">
              {currentDoctor?.qualification || 'MBBS, MD'} ·{' '}
              {currentDoctor?.specialization || userProfile?.specialization || 'General Physician'} ·{' '}
              <span className="text-amber-300 font-mono font-bold">
                {displayDate} ({displayTime})
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* New Prescription / Consultation Button */}
          <button
            type="button"
            onClick={handleOpenNewPrescription}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-lg transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus size={16} />
            <span>+ नई पर्ची बनाएं व अपलोड करें (New Rx &amp; Parchi)</span>
          </button>

          {isTrueAdmin ? (
            <div className="flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl border border-white/20">
              <label className="text-[11px] font-bold text-emerald-200 whitespace-nowrap">
                Admin Chamber View:
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="px-2.5 py-1 text-xs font-bold bg-slate-900 text-white border border-emerald-400/60 rounded-lg focus:outline-none"
              >
                <option value="all">All Clinic Doctors (सभी ओपीडी मरीज)</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-emerald-900/60 px-3.5 py-2 rounded-xl border border-emerald-400/50">
              <span className="text-[11px] font-extrabold text-emerald-200">
                🔒 Personal Doctor Panel:
              </span>
              <span className="text-xs font-black text-white">
                {currentDoctor?.name || userProfile?.name} (केवल आपके अपॉइंटमेंट व मरीज)
              </span>
            </div>
          )}
        </div>
      </div>

      {toastMsg && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-extrabold text-emerald-950 flex items-center justify-between shadow-xs">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{toastMsg}</span>
          </span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 font-bold px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Interactive Filter Tabs & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-emerald-900/10 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => handleSelectTab('today')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'today'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/60'
            }`}
          >
            Today&apos;s OPD Queue ({doctorFilteredAppointments.filter((a) => a.date === todayStr).length})
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('all')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/60'
            }`}
          >
            👥 Patient Records &amp; Parchi Tab ({masterPatientGroups.length} Patients)
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('prescriptions')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'prescriptions'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/60'
            }`}
          >
            📜 All Prescriptions &amp; Parchi Hub ({doctorFilteredPrescriptions.length})
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('upcoming')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/60'
            }`}
          >
            Upcoming Bookings
          </button>
          <button
            type="button"
            onClick={() => handleSelectTab('completed')}
            className={`px-3.5 py-2 text-xs font-extrabold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-slate-700 hover:bg-white/60'
            }`}
          >
            Completed Consultations
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full lg:w-72">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patient name, phone, token, problem..."
            className="w-full pl-8 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'prescriptions' ? (
        /* ================= TAB: PRESCRIPTIONS & PARCHI ARCHIVE & TIMELINE ================= */
        <PrescriptionExplorer
          role="doctor"
          initialSearchQuery={searchQuery}
          showWriteButton={true}
          lockedDoctorId={
            isTrueAdmin && selectedDoctorId === 'all'
              ? undefined
              : selectedDoctorId !== 'all'
              ? selectedDoctorId
              : userProfile?.doctorId || currentDoctor?.id
          }
          lockedDoctorName={
            isTrueAdmin && selectedDoctorId === 'all'
              ? undefined
              : currentDoctor?.name || userProfile?.name
          }
        />
      ) : activeTab === 'all' ? (
        /* ================= TAB: PATIENT RECORDS & MULTI-VISIT PARCHI TAB ================= */
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-emerald-950 flex items-center gap-2">
                <User size={18} className="text-emerald-700" />
                <span>
                  मरीज मास्टर रिकॉर्ड व पर्ची टैब (Saved Patient Directory &amp; Multi-Visit Parchi Upload)
                </span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                एक बार मरीज का डेटा सेव होने के बाद जब भी मरीज दोबारा आए, यहीं से नया परामर्श डेटा डालें और अपनी हाथ से लिखी पर्ची (Parchi) अपलोड करें।
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenNewPrescription}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-xs cursor-pointer shrink-0"
            >
              <Plus size={15} />
              <span>+ नया मरीज / नई पर्ची जोड़ें</span>
            </button>
          </div>

          {masterPatientGroups.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
              <User className="mx-auto text-slate-300" size={36} />
              <p className="text-sm font-bold text-slate-700">
                अभी कोई मरीज रिकॉर्ड नहीं मिला।
              </p>
              <p className="text-xs text-slate-500">
                जब भी कोई ओपीडी अपॉइंटमेंट बुक होगा या पर्ची बनेगी, मरीज का पूरा डेटा यहाँ सुरक्षित दिखेगा।
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {masterPatientGroups.map((group) => {
                const totalVisits =
                  group.prescriptions.length +
                  group.appointments.filter(
                    (a) =>
                      !group.prescriptions.some(
                        (p) => p.appointmentId === a.id || p.id === a.prescriptionId
                      )
                  ).length;
                const uploadedParchisCount = group.prescriptions.filter(
                  (p) => Boolean(p.parchiImageUrl)
                ).length;

                return (
                  <div
                    key={group.patientKey}
                    className="bg-white border-2 border-slate-200 hover:border-emerald-500 rounded-2xl p-4 sm:p-5 shadow-xs transition-all space-y-4"
                  >
                    {/* Patient Master Header & Action Buttons */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-lg flex items-center justify-center shrink-0">
                          {group.patientName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base sm:text-lg font-black text-slate-900">
                              {group.patientName}
                            </h3>
                            <span className="bg-slate-100 text-slate-800 font-bold text-xs px-2.5 py-0.5 rounded-md">
                              {group.age} Yrs · {group.gender || 'Male'}
                            </span>
                            <span className="bg-emerald-50 text-emerald-900 border border-emerald-200 font-mono font-bold text-xs px-2.5 py-0.5 rounded-md">
                              📞 +91 {group.phone}
                            </span>
                            {group.latestTokenNo && (
                              <span className="bg-amber-100 text-amber-900 border border-amber-300 font-mono font-extrabold text-xs px-2 py-0.5 rounded-md">
                                Latest Token #{group.latestTokenNo}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                            <span>
                              <strong className="text-slate-800">Doctor:</strong>{' '}
                              {group.doctorName || 'Dr. Sandana'}
                            </span>
                            <span>
                              <strong className="text-slate-800">Latest Visit:</strong>{' '}
                              <span className="font-mono font-bold text-emerald-800">
                                {group.latestDate}
                              </span>
                            </span>
                            <span>
                              <strong className="text-slate-800">Total Visits:</strong>{' '}
                              <span className="font-extrabold text-slate-900">
                                {Math.max(1, totalVisits)} Visit(s)
                              </span>
                            </span>
                            {uploadedParchisCount > 0 && (
                              <span className="text-amber-800 font-bold">
                                📷 {uploadedParchisCount} Uploaded Parchi(s)
                              </span>
                            )}
                          </div>

                          {group.latestSymptoms && (
                            <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg mt-1">
                              <strong className="text-slate-900">
                                मरीज की मुख्य समस्या (Saved Symptoms/Complaints):
                              </strong>{' '}
                              {group.latestSymptoms}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Doctor Action Buttons whenever patient visits again */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenNewVisitForSavedPatient(group)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold rounded-xl shadow-xs cursor-pointer transition-all"
                        >
                          <Plus size={14} />
                          <span>📝 + नया विज़िट डेटा व पर्ची डालें (Add Visit &amp; Rx)</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            triggerQuickParchiUpload({
                              patientName: group.patientName,
                              phone: group.phone,
                              age: group.age,
                              gender: group.gender,
                              symptoms: group.latestSymptoms,
                              appointmentId: group.latestAppointmentId,
                              doctorId: group.doctorId,
                              doctorName: group.doctorName,
                              tokenNo: group.latestTokenNo,
                            })
                          }
                          disabled={uploadingQuickParchi}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl shadow-xs cursor-pointer transition-all"
                        >
                          <Camera size={14} />
                          <span>
                            {uploadingQuickParchi
                              ? 'Uploading...'
                              : '📷 सीधे पर्ची फोटो अपलोड करें (Upload Parchi)'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* All Saved Visits, Booked Appointments & Uploaded Parchis for this Patient */}
                    <div className="space-y-2.5">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <History size={13} className="text-emerald-700" />
                        <span>
                          मरीज का पूरा विज़िट इतिहास व अपलोड की गई पर्चियां (All Saved Visits &amp; Uploaded Parchis)
                        </span>
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Render all prescriptions / uploaded parchis */}
                        {group.prescriptions.map((rx, rIdx) => (
                          <div
                            key={rx.id || rIdx}
                            className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3 text-xs"
                          >
                            <div className="space-y-1 flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="bg-emerald-600 text-white font-mono font-bold text-[10px] px-2 py-0.5 rounded">
                                  Visit Date: {rx.date}
                                </span>
                                {rx.tokenNo && (
                                  <span className="font-mono font-bold text-slate-700 text-[11px]">
                                    Token #{rx.tokenNo}
                                  </span>
                                )}
                                <span className="font-bold text-emerald-900">
                                  {rx.diagnosis || 'OPD Consultation'}
                                </span>
                              </div>

                              {rx.chiefComplaints && (
                                <p className="text-slate-700">
                                  <strong>समस्या:</strong> {rx.chiefComplaints}
                                </p>
                              )}

                              {rx.medicines && rx.medicines.length > 0 && (
                                <p className="text-slate-600 text-[11px]">
                                  <strong>दवाइयां ({rx.medicines.length}):</strong>{' '}
                                  {rx.medicines.map((m) => m.name).join(', ')}
                                </p>
                              )}

                              <div className="flex flex-wrap items-center gap-2 pt-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleViewOrPrintPrescription(rx, 'print')
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#0F2942] hover:bg-slate-800 text-white font-bold text-[11px] rounded-md cursor-pointer"
                                >
                                  <Printer size={11} />
                                  <span>प्रिंट करें (Print)</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleViewOrPrintPrescription(rx, 'form')
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[11px] rounded-md cursor-pointer"
                                >
                                  <FileText size={11} />
                                  <span>बदलाव / पर्ची जोड़ें (Edit)</span>
                                </button>
                                {rx.parchiImageUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLightboxParchi({
                                        url: rx.parchiImageUrl!,
                                        patientName: rx.patientName,
                                        date: rx.date,
                                        fileName: rx.parchiFileName,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-bold text-[11px] rounded-md cursor-pointer"
                                  >
                                    <Eye size={11} />
                                    <span>पर्ची फोटो देखें</span>
                                  </button>
                                )}
                              </div>
                            </div>

                            {rx.parchiImageUrl && (
                              <div
                                onClick={() =>
                                  setLightboxParchi({
                                    url: rx.parchiImageUrl!,
                                    patientName: rx.patientName,
                                    date: rx.date,
                                    fileName: rx.parchiFileName,
                                  })
                                }
                                className="w-20 h-20 rounded-lg border-2 border-emerald-500 overflow-hidden bg-white shrink-0 cursor-pointer shadow-xs hover:scale-105 transition-transform"
                                title="Click to view full Parchi"
                              >
                                <img
                                  src={rx.parchiImageUrl}
                                  alt="Uploaded Parchi"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Also show any booked OPD appointments that don't have a prescription yet */}
                        {group.appointments
                          .filter(
                            (apt) =>
                              !group.prescriptions.some(
                                (p) =>
                                  p.appointmentId === apt.id ||
                                  (apt.prescriptionId && p.id === apt.prescriptionId)
                              )
                          )
                          .map((apt) => (
                            <div
                              key={apt.id}
                              className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 flex items-start justify-between gap-3 text-xs"
                            >
                              <div className="space-y-1 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="bg-amber-500 text-slate-950 font-mono font-extrabold text-[10px] px-2 py-0.5 rounded">
                                    Booked OPD: {apt.date} ({apt.slot})
                                  </span>
                                  {apt.tokenNo && (
                                    <span className="font-mono font-bold text-slate-800 text-[11px]">
                                      Token #{apt.tokenNo}
                                    </span>
                                  )}
                                  <span className="uppercase text-[10px] font-extrabold text-amber-800">
                                    Status: {apt.status}
                                  </span>
                                </div>
                                <p className="text-slate-700">
                                  <strong>डॉक्टर:</strong> {apt.doctorName}
                                </p>
                                {apt.symptoms && (
                                  <p className="text-slate-700">
                                    <strong>बुक की गई समस्या:</strong> {apt.symptoms}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 pt-1.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenWritePrescription(apt, 'form')
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-md cursor-pointer"
                                  >
                                    <FileText size={11} />
                                    <span>📝 डेटा डालें व पर्ची बनाएं (Write Rx)</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      triggerQuickParchiUpload({
                                        patientName: apt.patientName,
                                        phone: apt.phone,
                                        age: apt.age,
                                        gender: apt.gender || 'Male',
                                        symptoms: apt.symptoms,
                                        appointmentId: apt.id,
                                        doctorId: apt.doctorId,
                                        doctorName: apt.doctorName,
                                        tokenNo: apt.tokenNo,
                                      })
                                    }
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] rounded-md cursor-pointer"
                                  >
                                    <Camera size={11} />
                                    <span>📷 पर्ची अपलोड करें</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* ================= TAB: APPOINTMENTS QUEUE (TODAY / UPCOMING / COMPLETED) ================= */
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Listening for real-time OPD appointments...
            </div>
          ) : filteredAppointments.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 space-y-2">
              <p className="font-bold text-slate-700">
                No appointments in the {activeTab} queue.
              </p>
              <p className="text-[11px] text-slate-500">
                मरीज का पूरा रिकॉर्ड देखने या पुरानी पर्ची में नया विज़िट जोड़ने के लिए &quot;👥 Patient Records &amp; Parchi Tab&quot; पर क्लिक करें।
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Token &amp; Patient Details</th>
                    <th className="py-3 px-4">Mobile &amp; Age/Gender</th>
                    <th className="py-3 px-4">Symptoms / Problem &amp; Rx</th>
                    <th className="py-3 px-4">Date, Slot &amp; Doctor</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">
                      Doctor Data Entry &amp; Parchi Upload
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAppointments.map((apt) => {
                    const matchedRx = prescriptions.find(
                      (p) =>
                        p.appointmentId === apt.id ||
                        (apt.prescriptionId && p.id === apt.prescriptionId)
                    );
                    const parchiUrl =
                      matchedRx?.parchiImageUrl || apt.parchiImageUrl;

                    return (
                      <tr
                        key={apt.id}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="py-3.5 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2.5">
                            {apt.tokenNo ? (
                              <span className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-mono font-black flex items-center justify-center text-xs shrink-0">
                                #{apt.tokenNo}
                              </span>
                            ) : (
                              <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 font-mono font-bold flex items-center justify-center text-xs shrink-0">
                                #--
                              </span>
                            )}
                            <div>
                              <span className="font-extrabold text-slate-900 text-sm block">
                                {apt.patientName}
                              </span>
                              {matchedRx ? (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold">
                                  ✓ Saved Rx ({matchedRx.medicines?.length || 0}{' '}
                                  Meds)
                                  {parchiUrl && ' · 📷 Parchi Uploaded'}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500">
                                  Booked via {apt.bookedBy || 'OPD'}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <p className="font-mono font-bold text-slate-900">
                            +91 {apt.phone}
                          </p>
                          <p className="text-[11px] text-slate-600 font-semibold">
                            {apt.age} Yrs · {apt.gender || matchedRx?.gender || 'Male'}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 max-w-xs">
                          {apt.symptoms || matchedRx?.chiefComplaints ? (
                            <p className="text-slate-800 font-medium line-clamp-2">
                              <span className="font-bold text-slate-600">
                                समस्या:
                              </span>{' '}
                              {apt.symptoms || matchedRx?.chiefComplaints}
                            </p>
                          ) : (
                            <span className="text-slate-400 italic">
                              No symptoms noted yet
                            </span>
                          )}
                          {(matchedRx?.diagnosis || apt.clinicalNotes) && (
                            <p className="text-[11px] font-bold text-emerald-800 mt-0.5">
                              Rx: {matchedRx?.diagnosis || apt.clinicalNotes}
                            </p>
                          )}
                          {parchiUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxParchi({
                                  url: parchiUrl,
                                  patientName: apt.patientName,
                                  date: apt.date,
                                  fileName:
                                    matchedRx?.parchiFileName ||
                                    apt.parchiFileName,
                                })
                              }
                              className="mt-1 inline-flex items-center gap-1 text-[10px] font-extrabold bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-md cursor-pointer"
                            >
                              <Eye size={11} />
                              <span>📷 अपलोड की गई पर्ची देखें</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono tabular-nums text-slate-900">
                          <p className="font-bold">
                            {apt.date} ·{' '}
                            <span className="text-emerald-800">{apt.slot}</span>
                          </p>
                          <p className="text-[11px] font-sans text-slate-500">
                            {apt.doctorName}
                          </p>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                              apt.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : apt.status === 'cancelled'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {apt.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* 1. Enter Data / Write or Edit Prescription */}
                          <button
                            type="button"
                            onClick={() =>
                              handleOpenWritePrescription(apt, 'form')
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-extrabold rounded-lg shadow-xs cursor-pointer transition-all"
                          >
                            <FileText size={13} />
                            <span>
                              {matchedRx
                                ? '✏️ डेटा/पर्ची अपडेट करें'
                                : '📝 डेटा डालें व पर्ची बनाएं'}
                            </span>
                          </button>

                          {/* 2. Direct 1-Click Upload Parchi Photo */}
                          <button
                            type="button"
                            onClick={() =>
                              triggerQuickParchiUpload({
                                patientName: apt.patientName,
                                phone: apt.phone,
                                age: apt.age,
                                gender: apt.gender || 'Male',
                                symptoms: apt.symptoms,
                                appointmentId: apt.id,
                                doctorId: apt.doctorId,
                                doctorName: apt.doctorName,
                                tokenNo: apt.tokenNo,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-lg shadow-xs cursor-pointer transition-all"
                            title="हाथ से लिखी पर्ची का फोटो सीधे अपलोड करें"
                          >
                            <Camera size={13} />
                            <span>📷 पर्ची अपलोड</span>
                          </button>

                          {/* 3. Print Prescription if written */}
                          {matchedRx && (
                            <button
                              type="button"
                              onClick={() =>
                                handleOpenWritePrescription(apt, 'print')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#0F2942] hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                            >
                              <Printer size={13} />
                              <span>प्रिंट</span>
                            </button>
                          )}

                          {/* 4. Cancel button if booked */}
                          {apt.status === 'booked' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateStatus(apt.id, 'cancelled')
                              }
                              className="inline-flex items-center gap-1 px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-bold text-xs cursor-pointer"
                            >
                              <XCircle size={13} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Prescription Writing & Printable Parchi Modal */}
      <PrescriptionModal
        isOpen={isRxModalOpen}
        onClose={() => {
          setIsRxModalOpen(false);
          setSelectedAptForRx(null);
          setSelectedExistingRx(null);
        }}
        appointment={selectedAptForRx}
        doctor={currentDoctor}
        existingPrescription={selectedExistingRx}
        initialMode={rxModalInitialMode}
        clinicSettings={clinicSettings}
        onSaved={(newRx) => {
          setPrescriptions((prev) => {
            const idx = prev.findIndex((p) => p.id === newRx.id);
            if (idx >= 0) {
              const updated = [...prev];
              updated[idx] = newRx;
              return updated;
            }
            return [newRx, ...prev];
          });
        }}
      />

      {/* Fullscreen Parchi Lightbox Modal */}
      {lightboxParchi && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-scale-in">
          <div className="relative bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-300">
            <div className="bg-[#0F2942] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <Camera size={17} className="text-emerald-400" />
                  <span>
                    डॉक्टर की अपलोड की गई पर्ची (Uploaded Doctor Parchi)
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  मरीज: {lightboxParchi.patientName} · दिनांक:{' '}
                  {lightboxParchi.date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxParchi.url}
                  download={`Parchi_${lightboxParchi.patientName}_${lightboxParchi.date}.jpg`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  <Download size={14} />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxParchi(null)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-900 p-4 flex items-center justify-center">
              <img
                src={lightboxParchi.url}
                alt="Doctor Handwritten Parchi"
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg border border-slate-700"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
