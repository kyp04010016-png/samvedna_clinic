import React, { useEffect, useRef, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  setDoc,
} from 'firebase/firestore';
import {
  FileText,
  Search,
  Printer,
  Camera,
  Plus,
  ShoppingCart,
  Trash2,
  CheckCircle2,
  Pill,
  Download,
  X,
  History,
  ArrowRight,
  Edit3,
} from 'lucide-react';
import { db } from '../firebase';
import {
  PrescriptionModal,
  PrescriptionRecord,
} from './PrescriptionModal';
import { printElementById } from '../utils/printEngine';
import { saveRecordToSql } from '../utils/sqlSyncBridge';
import { logStaffActivity } from '../utils/activityLogger';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { useAuth } from '../context/AuthContext';

export interface PrescriptionExplorerProps {
  role: 'doctor' | 'pharmacy' | 'reception' | 'admin' | 'patient';
  onLoadIntoBill?: (prescription: PrescriptionRecord) => void;
  initialSearchQuery?: string;
  showWriteButton?: boolean;
  lockedDoctorId?: string;
  lockedDoctorName?: string;
}

export const PrescriptionExplorer: React.FC<PrescriptionExplorerProps> = ({
  role,
  onLoadIntoBill,
  initialSearchQuery = '',
  showWriteButton = true,
  lockedDoctorId,
  lockedDoctorName,
}) => {
  const { userProfile } = useAuth();
  const [prescriptions, setPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [bookedAppointments, setBookedAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery);
  const [viewMode, setViewMode] = useState<'all' | 'patient_timeline'>('all');
  const [filterWithParchiOnly, setFilterWithParchiOnly] = useState(false);
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState<string>('all');
  const [selectedPatientGroup, setSelectedPatientGroup] = useState<string | null>(
    null
  );

  // Modals
  const [activeRxModalOpen, setActiveRxModalOpen] = useState(false);
  const [modalInitialMode, setModalInitialMode] = useState<'form' | 'print'>('print');
  const [selectedRxForModal, setSelectedRxForModal] =
    useState<PrescriptionRecord | null>(null);
  const [selectedAptForModal, setSelectedAptForModal] = useState<any | null>(null);

  // Direct 1-click Parchi upload for any saved patient
  const quickParchiInputRef = useRef<HTMLInputElement | null>(null);
  const [quickUploadTarget, setQuickUploadTarget] = useState<{
    patientName: string;
    phone: string;
    age: number;
    gender?: string;
    symptoms?: string;
    appointmentId?: string;
    doctorId?: string;
    doctorName?: string;
    tokenNo?: number;
  } | null>(null);
  const [uploadingQuickParchi, setUploadingQuickParchi] = useState(false);

  // Parchi Image Fullscreen Lightbox
  const [lightboxParchi, setLightboxParchi] = useState<{
    url: string;
    patientName: string;
    date: string;
    fileName?: string;
  } | null>(null);

  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Real-time listener for all prescriptions + booked OPD appointments
  useEffect(() => {
    setLoading(true);
    const qRx = query(collection(db, 'prescriptions'));
    const qApt = query(collection(db, 'appointments'));

    const unsubRx = onSnapshot(
      qRx,
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
        setLoading(false);
      },
      (err) => {
        console.error('Error listening to prescriptions:', err);
        setLoading(false);
      }
    );

    const unsubApt = onSnapshot(
      qApt,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));
        setBookedAppointments(list);
      },
      () => {}
    );

    return () => {
      unsubRx();
      unsubApt();
    };
  }, []);

  const matchesLockedDoctor = React.useCallback(
    (docId?: string, docName?: string) => {
      if (!lockedDoctorId && !lockedDoctorName) return true;
      if (
        lockedDoctorId &&
        docId &&
        docId.trim().toLowerCase() === lockedDoctorId.trim().toLowerCase()
      ) {
        return true;
      }
      if (
        lockedDoctorName &&
        docName &&
        docName.trim().toLowerCase() === lockedDoctorName.trim().toLowerCase()
      ) {
        return true;
      }
      return false;
    },
    [lockedDoctorId, lockedDoctorName]
  );

  // Merge prescriptions and any booked OPD appointments that don't yet have a prescription record so every booked OPD patient is visible
  const unifiedRecords: PrescriptionRecord[] = React.useMemo(() => {
    const combined: PrescriptionRecord[] = prescriptions.filter((rx) =>
      matchesLockedDoctor(rx.doctorId, rx.doctorName)
    );
    bookedAppointments.forEach((apt) => {
      if (!matchesLockedDoctor(apt.doctorId, apt.doctorName)) {
        return;
      }
      const alreadyHasRx = prescriptions.some(
        (rx) =>
          rx.appointmentId === apt.id ||
          (apt.prescriptionId && rx.id === apt.prescriptionId)
      );
      if (!alreadyHasRx && apt.status !== 'cancelled') {
        combined.push({
          id: undefined,
          prescriptionNo: `OPD-TOK-${apt.tokenNo || '01'}`,
          appointmentId: apt.id,
          patientName: apt.patientName || 'OPD Patient',
          phone: apt.phone || '',
          age: Number(apt.age) || 30,
          gender: apt.gender || 'Male',
          doctorId: apt.doctorId || lockedDoctorId || 'doc_sandana_1',
          doctorName: apt.doctorName || lockedDoctorName || 'Dr. Sandana (MBBS)',
          date: apt.date || new Date().toISOString().split('T')[0],
          tokenNo: apt.tokenNo || 1,
          chiefComplaints: apt.symptoms || 'Booked OPD Appointment (Awaiting Doctor Rx)',
          diagnosis: apt.clinicalNotes || 'OPD Booked — Click "डेटा डालें / पर्ची अपलोड करें" to add Rx',
          medicines: [],
          parchiImageUrl: apt.parchiImageUrl || '',
          parchiFileName: apt.parchiFileName || '',
          createdAt: apt.createdAt || apt.date || new Date().toISOString(),
        });
      }
    });

    combined.sort((a, b) =>
      (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || '')
    );
    return combined;
  }, [
    prescriptions,
    bookedAppointments,
    matchesLockedDoctor,
    lockedDoctorId,
    lockedDoctorName,
  ]);

  const allDoctorNames = Array.from(
    new Set(unifiedRecords.map((p) => p.doctorName).filter(Boolean))
  );

  // Filtered list
  const filteredPrescriptions = unifiedRecords.filter((p) => {
    if (filterWithParchiOnly && !p.parchiImageUrl) return false;
    if (
      selectedDoctorFilter !== 'all' &&
      p.doctorName !== selectedDoctorFilter
    ) {
      return false;
    }
    if (selectedPatientGroup) {
      const cleanP = (p.phone || '').replace(/\D/g, '').slice(-10);
      const matchKey = (
        cleanP.length === 10 ? cleanP : (p.patientName || '').trim()
      ).toLowerCase();
      if (matchKey !== selectedPatientGroup.toLowerCase().trim()) return false;
    }

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (p.patientName && p.patientName.toLowerCase().includes(q)) ||
      (p.phone && p.phone.includes(q)) ||
      (p.doctorName && p.doctorName.toLowerCase().includes(q)) ||
      (p.diagnosis && p.diagnosis.toLowerCase().includes(q)) ||
      (p.chiefComplaints && p.chiefComplaints.toLowerCase().includes(q)) ||
      (p.date && p.date.includes(q)) ||
      (p.prescriptionNo && p.prescriptionNo.toLowerCase().includes(q))
    );
  });

  // Group records by Patient (10-digit Phone or Name) for Date-wise Medical History
  const patientGroups = React.useMemo(() => {
    const groups: Record<
      string,
      {
        patientKey: string;
        patientName: string;
        phone: string;
        age: number;
        gender?: string;
        latestSymptoms?: string;
        latestDoctorId?: string;
        latestDoctorName?: string;
        latestAppointmentId?: string;
        latestTokenNo?: number;
        records: PrescriptionRecord[];
        latestDate: string;
        totalVisits: number;
        hasParchi: boolean;
      }
    > = {};

    unifiedRecords.forEach((rx) => {
      const cleanP = (rx.phone || '').replace(/\D/g, '').slice(-10);
      const key = (
        cleanP.length === 10
          ? cleanP
          : (rx.patientName || 'patient').trim()
      ).toLowerCase();

      if (!groups[key]) {
        groups[key] = {
          patientKey: key,
          patientName: rx.patientName,
          phone: rx.phone || 'N/A',
          age: rx.age || 30,
          gender: rx.gender || 'Male',
          latestSymptoms: rx.chiefComplaints,
          latestDoctorId: rx.doctorId,
          latestDoctorName: rx.doctorName,
          latestAppointmentId: rx.appointmentId,
          latestTokenNo: rx.tokenNo,
          records: [],
          latestDate: rx.date,
          totalVisits: 0,
          hasParchi: false,
        };
      }

      groups[key].records.push(rx);
      groups[key].totalVisits += 1;
      if (rx.parchiImageUrl) groups[key].hasParchi = true;
      if (rx.date > groups[key].latestDate) {
        groups[key].latestDate = rx.date;
      }
    });

    return Object.values(groups).sort((a, b) =>
      (b.latestDate || '').localeCompare(a.latestDate || '')
    );
  }, [unifiedRecords]);

  const handleDeleteRx = async (e: React.MouseEvent, rx: PrescriptionRecord) => {
    e.stopPropagation();
    if (!rx.id) return;
    try {
      await deleteDoc(doc(db, 'prescriptions', rx.id));
      await logStaffActivity(
        'DELETE_PRESCRIPTION',
        `${userProfile?.name || 'Staff'} deleted prescription #${rx.prescriptionNo} for ${rx.patientName}`,
        userProfile?.name
      ).catch(() => {});
      setToastMsg(`Deleted prescription #${rx.prescriptionNo}.`);
      setTimeout(() => setToastMsg(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `prescriptions/${rx.id}`);
    }
  };

  const handlePrintRxDirect = (e: React.MouseEvent, rx: PrescriptionRecord) => {
    e.stopPropagation();
    setSelectedAptForModal(null);
    setSelectedRxForModal(rx);
    setModalInitialMode(rx.id ? 'print' : 'form');
    setActiveRxModalOpen(true);
  };

  const handleEditOrAddDataForRecord = (
    e: React.MouseEvent,
    rx: PrescriptionRecord
  ) => {
    e.stopPropagation();
    setSelectedAptForModal(
      rx.appointmentId
        ? {
            id: rx.appointmentId,
            patientName: rx.patientName,
            phone: rx.phone,
            age: rx.age,
            gender: rx.gender || 'Male',
            symptoms: rx.chiefComplaints,
            doctorId: rx.doctorId,
            doctorName: rx.doctorName,
            tokenNo: rx.tokenNo || 1,
            date: rx.date,
            slot: '10:00',
          }
        : null
    );
    setSelectedRxForModal(rx);
    setModalInitialMode('form');
    setActiveRxModalOpen(true);
  };

  const handleOpenNewPrescriptionForPatient = (groupKey: string) => {
    const group = patientGroups.find((g) => g.patientKey === groupKey);
    if (!group) return;

    const todayIso = new Date().toISOString().split('T')[0];
    setSelectedAptForModal({
      id: group.latestAppointmentId || '',
      patientName: group.patientName,
      phone: group.phone === 'N/A' ? '' : group.phone,
      age: group.age || 30,
      gender: group.gender || 'Male',
      symptoms: group.latestSymptoms || '',
      doctorId: group.latestDoctorId || 'doc_sandana_1',
      doctorName: group.latestDoctorName || 'Dr. Sandana (MBBS)',
      tokenNo: group.latestTokenNo || 1,
      date: todayIso,
      slot: new Date().toTimeString().slice(0, 5),
    });
    setSelectedRxForModal(null);
    setModalInitialMode('form');
    setActiveRxModalOpen(true);
  };

  // Direct 1-click Parchi upload handler
  const triggerDirectParchiUpload = (target: {
    patientName: string;
    phone: string;
    age: number;
    gender?: string;
    symptoms?: string;
    appointmentId?: string;
    doctorId?: string;
    doctorName?: string;
    tokenNo?: number;
  }) => {
    setQuickUploadTarget(target);
    setTimeout(() => {
      quickParchiInputRef.current?.click();
    }, 50);
  };

  const handleDirectParchiFileChange = (
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
          const todayIso = new Date().toISOString().split('T')[0];
          const nowIso = new Date().toISOString();
          const prescriptionId = `rx_${todayIso}_${Date.now().toString().slice(-6)}`;
          const prescriptionNo = `RX-${todayIso.replace(/-/g, '')}-${String(
            quickUploadTarget.tokenNo || Math.floor(100 + Math.random() * 900)
          ).padStart(3, '0')}`;

          const payload: PrescriptionRecord = {
            id: prescriptionId,
            prescriptionNo,
            appointmentId: quickUploadTarget.appointmentId || '',
            patientName: quickUploadTarget.patientName,
            phone:
              quickUploadTarget.phone === 'N/A' ? '' : quickUploadTarget.phone,
            age: quickUploadTarget.age || 30,
            gender: quickUploadTarget.gender || 'Male',
            doctorId: quickUploadTarget.doctorId || 'doc_sandana_1',
            doctorName: quickUploadTarget.doctorName || 'Dr. Sandana (MBBS)',
            date: todayIso,
            tokenNo: quickUploadTarget.tokenNo || 1,
            chiefComplaints:
              quickUploadTarget.symptoms || 'OPD Consultation & Uploaded Parchi',
            diagnosis: 'Uploaded Handwritten Doctor Parchi',
            medicines: [],
            parchiImageUrl: compressedDataUrl,
            parchiFileName: file.name,
            createdAt: nowIso,
          };

          try {
            await setDoc(doc(db, 'prescriptions', prescriptionId), payload, {
              merge: true,
            });
          } catch {
            // fallback
          }
          await saveRecordToSql('prescriptions', prescriptionId, payload);

          if (quickUploadTarget.appointmentId) {
            const aptUpdate = {
              patientName: quickUploadTarget.patientName,
              phone:
                quickUploadTarget.phone && quickUploadTarget.phone !== 'N/A'
                  ? quickUploadTarget.phone
                  : '0000000000',
              age: quickUploadTarget.age || 30,
              gender: quickUploadTarget.gender || 'Male',
              doctorId: quickUploadTarget.doctorId || 'doc_sandana_1',
              doctorName:
                quickUploadTarget.doctorName || 'Dr. Sandana (MBBS)',
              date: todayIso,
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

  return (
    <div className="space-y-4">
      <input
        ref={quickParchiInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleDirectParchiFileChange}
        className="hidden"
      />

      {/* Top Banner & Control Bar */}
      <div className="bg-gradient-to-r from-[#0F2942] via-emerald-950 to-[#0F2942] text-white p-4 sm:p-5 rounded-2xl shadow-md border border-emerald-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-wide text-emerald-300">
              CENTRAL PATIENT RECORDS, PRESCRIPTION &amp; PARCHI HUB (सभी मरीज व पर्चियां)
            </h2>
          </div>
          <p className="text-xs text-slate-200 mt-0.5">
            बुक किए गए ओपीडी मरीज, डॉक्टर की हाथ से लिखी पर्चियां (Handwritten Parchi) व मरीज का तारीखवार इतिहास — जब भी मरीज आए नया डेटा व पर्ची जोड़ें
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Mode switch: All vs Date-wise Patient Timeline */}
          <div className="flex bg-white/10 p-1 rounded-xl text-xs font-bold border border-white/20">
            <button
              type="button"
              onClick={() => {
                setViewMode('all');
                setSelectedPatientGroup(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'all' && !selectedPatientGroup
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              📋 All OPD &amp; Rx Records ({unifiedRecords.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode('patient_timeline');
                setSelectedPatientGroup(null);
              }}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'patient_timeline'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-200 hover:text-white'
              }`}
            >
              <History size={13} className="inline mr-1" />
              <span>मरीज तारीखवार इतिहास ({patientGroups.length} Patients)</span>
            </button>
          </div>

          {showWriteButton && (
            <button
              type="button"
              onClick={() => {
                setSelectedAptForModal(null);
                setSelectedRxForModal(null);
                setModalInitialMode('form');
                setActiveRxModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs rounded-xl shadow-md cursor-pointer transition-all"
            >
              <Plus size={15} />
              <span>+ नई पर्ची बनाएं व अपलोड करें</span>
            </button>
          )}
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 shadow-xs flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 p-3 sm:p-4 rounded-xl shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Patient Name, Mobile No, Doctor, Diagnosis, Date..."
            className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Doctor and Parchi Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {allDoctorNames.length > 1 && (
            <select
              value={selectedDoctorFilter}
              onChange={(e) => setSelectedDoctorFilter(e.target.value)}
              className="px-2.5 py-2 bg-slate-50 border border-slate-300 rounded-lg font-semibold text-slate-700"
            >
              <option value="all">All Doctors (सभी डॉक्टर)</option>
              {allDoctorNames.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => setFilterWithParchiOnly((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-bold border transition-colors cursor-pointer ${
              filterWithParchiOnly
                ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-xs'
                : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Camera
              size={14}
              className={
                filterWithParchiOnly ? 'text-amber-800' : 'text-slate-500'
              }
            />
            <span>
              📷 Only Uploaded Parchi (
              {unifiedRecords.filter((p) => p.parchiImageUrl).length})
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area based on View Mode */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
          Loading real-time patient OPD records, prescriptions &amp; uploaded parchis...
        </div>
      ) : viewMode === 'patient_timeline' && !selectedPatientGroup ? (
        /* ================= MODE: PATIENT GROUP TIMELINE ================= */
        <div className="space-y-3">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <span className="font-extrabold text-emerald-950 flex items-center gap-2">
              <History size={16} className="text-emerald-700" />
              <span>
                मरीज का तारीखवार इतिहास (Saved Patient Profile &amp; Multi-Visit Parchi Upload)
              </span>
            </span>
            <span className="text-[11px] font-mono text-emerald-800">
              Total {patientGroups.length} Saved Patients
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {patientGroups.map((group) => (
              <div
                key={group.patientKey}
                onClick={() => setSelectedPatientGroup(group.patientKey)}
                className="bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-md p-4 rounded-xl cursor-pointer transition-all space-y-2.5 relative group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-900 font-extrabold flex items-center justify-center text-sm shrink-0">
                      {group.patientName.slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {group.patientName}
                      </h4>
                      <p className="text-[11px] font-mono text-slate-500">
                        +91 {group.phone} · {group.age} Yrs ({group.gender || 'Male'})
                      </p>
                    </div>
                  </div>

                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono font-extrabold text-xs px-2.5 py-1 rounded-full whitespace-nowrap">
                    {group.totalVisits} Visit{group.totalVisits > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">Latest Visit Date:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {group.latestDate}
                    </span>
                  </div>
                  {group.latestSymptoms && (
                    <p className="text-[11px] text-slate-700 truncate">
                      <strong>समस्या:</strong> {group.latestSymptoms}
                    </p>
                  )}
                  {group.hasParchi && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-800">
                      <Camera size={12} />
                      <span>Handwritten Parchi Attached</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-1.5 text-xs pt-1 border-t border-slate-100">
                  <span className="text-emerald-700 font-bold group-hover:underline flex items-center gap-1">
                    <span>सभी विज़िट देखें</span>
                    <ArrowRight size={13} />
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenNewPrescriptionForPatient(group.patientKey);
                      }}
                      className="text-[11px] font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 px-2.5 py-1 rounded-md cursor-pointer"
                    >
                      + नया विज़िट / Rx
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerDirectParchiUpload({
                          patientName: group.patientName,
                          phone: group.phone,
                          age: group.age,
                          gender: group.gender,
                          symptoms: group.latestSymptoms,
                          appointmentId: group.latestAppointmentId,
                          doctorId: group.latestDoctorId,
                          doctorName: group.latestDoctorName,
                          tokenNo: group.latestTokenNo,
                        });
                      }}
                      disabled={uploadingQuickParchi}
                      className="text-[11px] font-extrabold text-slate-950 bg-amber-400 hover:bg-amber-500 px-2 py-1 rounded-md cursor-pointer"
                    >
                      📷 पर्ची अपलोड
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* ================= MODE: LIST / SELECTED PATIENT TIMELINE ================= */
        <div className="space-y-3">
          {selectedPatientGroup && (
            <div className="bg-emerald-100/70 border border-emerald-300 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPatientGroup(null)}
                  className="font-bold text-emerald-800 hover:underline cursor-pointer"
                >
                  ← Back to All Patients
                </button>
                <span>·</span>
                <span className="font-extrabold text-slate-900">
                  Showing All Saved Visits &amp; Parchis ({filteredPrescriptions.length}{' '}
                  Records)
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleOpenNewPrescriptionForPatient(selectedPatientGroup)
                  }
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-lg text-xs cursor-pointer"
                >
                  📝 + नया विज़िट डेटा डालें (Add New Visit)
                </button>
              </div>
            </div>
          )}

          {filteredPrescriptions.length === 0 ? (
            <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200 space-y-2">
              <FileText className="mx-auto text-slate-300" size={36} />
              <p className="font-bold text-slate-700">कोई पर्ची या मरीज रिकॉर्ड नहीं मिला।</p>
              <p className="text-[11px] text-slate-500">
                कृपया सर्च या फिल्टर बदलें अथवा नई पर्ची बनाएं।
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filteredPrescriptions.map((rx, idx) => (
                <div
                  key={rx.id || rx.appointmentId || rx.prescriptionNo || idx}
                  className="bg-white border border-slate-200 hover:border-emerald-500 rounded-xl p-4 shadow-xs transition-all flex flex-col md:flex-row md:items-start justify-between gap-4"
                >
                  {/* Left: Patient Details & Visit Date Badge */}
                  <div className="flex items-start gap-3 flex-1">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 flex flex-col items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-emerald-600 uppercase font-mono">
                        {rx.date ? rx.date.slice(5) : 'OPD'}
                      </span>
                      <span className="text-sm font-black font-mono">
                        {rx.tokenNo ? `#${rx.tokenNo}` : 'Rx'}
                      </span>
                    </div>

                    <div className="space-y-1.5 flex-1">
                      {/* Name & Phone */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm sm:text-base font-extrabold text-slate-900">
                          {rx.patientName}
                        </span>
                        <span className="text-xs text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded">
                          {rx.age} Yrs · {rx.gender || 'Male'}
                        </span>
                        <span className="font-mono text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 px-2 py-0.5 rounded">
                          📞 {rx.phone || 'Walk-In'}
                        </span>
                        <span className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full font-bold">
                          Date: {rx.date}
                        </span>
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
                            className="inline-flex items-center gap-1 text-[11px] font-extrabold bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-full cursor-pointer transition-colors"
                          >
                            <Camera size={12} />
                            <span>📷 View Uploaded Parchi</span>
                          </button>
                        )}
                      </div>

                      {/* Doctor & Diagnosis */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <p>
                          <span className="font-bold text-slate-700">Doctor:</span>{' '}
                          <span className="font-semibold text-slate-900">
                            {rx.doctorName}
                          </span>{' '}
                          <span className="text-slate-400">
                            ({rx.doctorSpecialization || 'Physician'})
                          </span>
                        </p>
                        <p>
                          <span className="font-bold text-slate-700">Diagnosis:</span>{' '}
                          <span className="font-bold text-emerald-800">
                            {rx.diagnosis || 'General Consultation'}
                          </span>
                        </p>
                      </div>

                      {/* Problem / Chief Complaints */}
                      {rx.chiefComplaints && (
                        <div className="text-xs bg-slate-50 border border-slate-200 p-2 rounded-lg">
                          <span className="font-bold text-slate-700">
                            मरीज की समस्या (Complaints):{' '}
                          </span>
                          <span className="text-slate-900 font-medium">
                            {rx.chiefComplaints}
                          </span>
                          {rx.vitals?.bp && (
                            <span className="ml-2 font-mono text-[11px] text-slate-600">
                              · BP: {rx.vitals.bp}
                            </span>
                          )}
                          {rx.vitals?.temperature && (
                            <span className="ml-2 font-mono text-[11px] text-slate-600">
                              · Temp: {rx.vitals.temperature}°F
                            </span>
                          )}
                        </div>
                      )}

                      {/* Medicines Pills Chips */}
                      {rx.medicines && rx.medicines.length > 0 && (
                        <div className="space-y-1 pt-1">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Prescribed Medicines ({rx.medicines.length}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {rx.medicines.map((m, mIdx) => (
                              <span
                                key={mIdx}
                                className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-950 border border-emerald-200 text-xs px-2.5 py-1 rounded-lg font-semibold"
                              >
                                <Pill size={12} className="text-emerald-700 shrink-0" />
                                <span>{m.name}</span>
                                <span className="text-slate-500 text-[10px] font-normal">
                                  ({m.frequency} · {m.timing})
                                </span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Uploaded Parchi Thumbnail + Role Actions */}
                  <div className="flex md:flex-col items-center md:items-end justify-between md:justify-start gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0">
                    {/* Thumbnail if parchi attached */}
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
                        className="w-20 h-16 border-2 border-emerald-400 rounded-lg overflow-hidden bg-slate-100 cursor-pointer shadow-xs hover:scale-105 transition-transform relative group shrink-0"
                        title="Click to view full handwritten parchi"
                      >
                        <img
                          src={rx.parchiImageUrl}
                          alt="Parchi Thumbnail"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] font-bold transition-opacity">
                          View
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Pharmacy Load Into Bill */}
                      {(role === 'pharmacy' || role === 'admin') && onLoadIntoBill && (
                        <button
                          type="button"
                          onClick={() => onLoadIntoBill(rx)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs rounded-lg shadow-xs cursor-pointer transition-colors"
                          title="Load this patient's medicines directly into Pharmacy Sale Bill"
                        >
                          <ShoppingCart size={13} />
                          <span>बिल में डालें (Load to Bill)</span>
                        </button>
                      )}

                      {/* Add New Visit Data / Edit Prescription */}
                      {(role === 'doctor' || role === 'admin' || role === 'reception') && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => handleEditOrAddDataForRecord(e, rx)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-lg cursor-pointer transition-colors"
                          >
                            <Edit3 size={12} />
                            <span>📝 डेटा/पर्ची जोड़ें</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerDirectParchiUpload({
                                patientName: rx.patientName,
                                phone: rx.phone,
                                age: rx.age,
                                gender: rx.gender,
                                symptoms: rx.chiefComplaints,
                                appointmentId: rx.appointmentId,
                                doctorId: rx.doctorId,
                                doctorName: rx.doctorName,
                                tokenNo: rx.tokenNo,
                              });
                            }}
                            disabled={uploadingQuickParchi}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-lg cursor-pointer transition-colors"
                          >
                            <Camera size={12} />
                            <span>📷 पर्ची अपलोड</span>
                          </button>
                        </>
                      )}

                      {/* Print Prescription / Parchi */}
                      <button
                        type="button"
                        onClick={(e) => handlePrintRxDirect(e, rx)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0F2942] hover:bg-slate-800 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors"
                      >
                        <Printer size={13} />
                        <span>🖨️ पर्ची प्रिंट (Print)</span>
                      </button>

                      {/* Admin delete */}
                      {role === 'admin' && rx.id && (
                        <button
                          type="button"
                          onClick={(e) => handleDeleteRx(e, rx)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg cursor-pointer"
                          title="Delete Prescription"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Full Prescription Slip & Print Viewer */}
      <PrescriptionModal
        isOpen={activeRxModalOpen}
        onClose={() => {
          setActiveRxModalOpen(false);
          setSelectedRxForModal(null);
          setSelectedAptForModal(null);
        }}
        appointment={selectedAptForModal}
        existingPrescription={selectedRxForModal}
        initialMode={modalInitialMode}
      />

      {/* Modal: Fullscreen Parchi Lightbox */}
      {lightboxParchi && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-scale-in">
          <div className="relative bg-white rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl border border-slate-300">
            {/* Header */}
            <div className="bg-[#0F2942] text-white px-5 py-3.5 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                  <Camera size={17} className="text-emerald-400" />
                  <span>
                    डॉक्टर की हाथ से लिखी मूल पर्ची (Handwritten Doctor Parchi)
                  </span>
                </h3>
                <p className="text-xs text-slate-300">
                  मरीज: {lightboxParchi.patientName} · दिनांक:{' '}
                  {lightboxParchi.date}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    printElementById('printable-lightbox-parchi', {
                      title: `Doctor_Parchi_${lightboxParchi.patientName}`,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  <Printer size={14} />
                  <span>Print Parchi</span>
                </button>

                <a
                  href={lightboxParchi.url}
                  download={`Parchi_${lightboxParchi.patientName}_${lightboxParchi.date}.jpg`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-bold rounded-lg cursor-pointer"
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

            {/* Image viewer */}
            <div
              id="printable-lightbox-parchi"
              className="flex-1 overflow-auto bg-slate-900 p-4 flex flex-col items-center justify-center"
            >
              <p className="text-xs font-bold text-white mb-2">
                SANDANA CLINIC · Patient: {lightboxParchi.patientName} · Date:{' '}
                {lightboxParchi.date}
              </p>
              <img
                src={lightboxParchi.url}
                alt="Doctor Handwritten Parchi"
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg border border-slate-700 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
