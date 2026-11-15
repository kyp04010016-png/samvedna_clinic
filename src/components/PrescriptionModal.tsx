import React, { useState, useRef, useEffect } from 'react';
import {
  Printer,
  X,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  FileText,
  Camera,
  Image as ImageIcon,
  ExternalLink,
  Stethoscope,
  HeartPulse,
  Pill,
  Calendar,
  User,
  Phone,
  Clock,
  Sparkles,
} from 'lucide-react';
import { addDoc, collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { saveRecordToSql } from '../utils/sqlSyncBridge';
import { printElementById, openPrintWindow } from '../utils/printEngine';
import { logStaffActivity } from '../utils/activityLogger';
import { handleFirestoreError, OperationType } from '../utils/firestoreError';
import { ClinicSettingsDoc, DoctorRecord } from '../pages/public/Home';

export interface PrescribedMedicine {
  name: string;
  dosage: string;
  frequency: string;
  timing: string;
  duration: string;
  instructions: string;
}

export interface PatientVitals {
  bp?: string;
  pulse?: string;
  temperature?: string;
  weight?: string;
  spo2?: string;
}

export interface PrescriptionRecord {
  id?: string;
  prescriptionNo?: string;
  appointmentId?: string;
  patientName: string;
  phone: string;
  age: number;
  gender?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialization?: string;
  doctorQualification?: string;
  doctorRegNo?: string;
  date: string;
  tokenNo?: number;
  chiefComplaints: string;
  diagnosis: string;
  vitals?: PatientVitals;
  clinicalNotes?: string;
  medicines: PrescribedMedicine[];
  advice?: string;
  followUpDate?: string;
  parchiImageUrl?: string;
  parchiFileName?: string;
  createdAt: string;
}

interface PrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment?: {
    id: string;
    patientName: string;
    phone: string;
    age: number;
    gender?: string;
    symptoms?: string;
    clinicalNotes?: string;
    parchiImageUrl?: string;
    parchiFileName?: string;
    doctorId?: string;
    doctorName?: string;
    tokenNo?: number;
    date: string;
    slot: string;
  } | null;
  doctor?: DoctorRecord;
  existingPrescription?: PrescriptionRecord | null;
  initialMode?: 'form' | 'print';
  clinicSettings?: Partial<ClinicSettingsDoc>;
  onSaved?: (prescription: PrescriptionRecord) => void;
}

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({
  isOpen,
  onClose,
  appointment,
  doctor,
  existingPrescription,
  initialMode,
  clinicSettings,
  onSaved,
}) => {
  const [activeView, setActiveView] = useState<'form' | 'print'>('form');

  // Patient Info
  const [patientName, setPatientName] = useState(
    appointment?.patientName || existingPrescription?.patientName || ''
  );
  const [patientPhone, setPatientPhone] = useState(
    appointment?.phone || existingPrescription?.phone || ''
  );
  const [patientAge, setPatientAge] = useState(
    String(appointment?.age ?? existingPrescription?.age ?? 30)
  );
  const [patientGender, setPatientGender] = useState(
    appointment?.gender || existingPrescription?.gender || 'Male'
  );
  const [tokenNo, setTokenNo] = useState<number>(
    appointment?.tokenNo ?? existingPrescription?.tokenNo ?? 1
  );

  // Clinical Complaints & Vitals
  const [chiefComplaints, setChiefComplaints] = useState(
    existingPrescription?.chiefComplaints || appointment?.symptoms || ''
  );
  const [diagnosis, setDiagnosis] = useState(
    existingPrescription?.diagnosis || appointment?.clinicalNotes || ''
  );
  const [bp, setBp] = useState(existingPrescription?.vitals?.bp || '');
  const [pulse, setPulse] = useState(existingPrescription?.vitals?.pulse || '');
  const [temperature, setTemperature] = useState(
    existingPrescription?.vitals?.temperature || ''
  );
  const [weight, setWeight] = useState(
    existingPrescription?.vitals?.weight || ''
  );
  const [spo2, setSpo2] = useState(existingPrescription?.vitals?.spo2 || '');

  // Medicines List
  const defaultMeds: PrescribedMedicine[] = [
    {
      name: 'Tab. Paracetamol 650mg',
      dosage: '1 Tab',
      frequency: '1-0-1 (सुबह - रात)',
      timing: 'After Food (खाने के बाद)',
      duration: '3 Days',
      instructions: 'ताजे पानी के साथ',
    },
  ];

  const [medicines, setMedicines] = useState<PrescribedMedicine[]>(
    existingPrescription?.medicines && existingPrescription.medicines.length > 0
      ? existingPrescription.medicines
      : defaultMeds
  );

  // Clinic stock suggestions & past prescriptions for returning patient lookup
  const [inventoryMedNames, setInventoryMedNames] = useState<string[]>([]);
  const [allPastPrescriptions, setAllPastPrescriptions] = useState<PrescriptionRecord[]>([]);
  const [allBookedAppointments, setAllBookedAppointments] = useState<any[]>([]);
  const [autoFilledNotice, setAutoFilledNotice] = useState<string | null>(null);

  const [advice, setAdvice] = useState(
    existingPrescription?.advice ||
      'पर्याप्त पानी पिएं, हल्का व सुपाच्य भोजन लें, ठंडा पानी व तली चीजें न खाएं।'
  );
  const [followUpDays, setFollowUpDays] = useState('5');

  // Uploaded Parchi (Handwritten Prescription Slip / Photo / Report)
  const [parchiImageUrl, setParchiImageUrl] = useState<string>(
    existingPrescription?.parchiImageUrl || appointment?.parchiImageUrl || ''
  );
  const [parchiFileName, setParchiFileName] = useState<string>(
    existingPrescription?.parchiFileName || appointment?.parchiFileName || ''
  );
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [savedPrescription, setSavedPrescription] =
    useState<PrescriptionRecord | null>(existingPrescription?.id ? existingPrescription : null);
  const [printed, setPrinted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const syncedTargetKeyRef = useRef<string | null>(null);

  // Load clinic inventory medicine names & past records for returning patient auto-lookup
  useEffect(() => {
    if (!isOpen) return;
    const loadModalMetadata = async () => {
      try {
        const [medSnap, rxSnap, aptSnap] = await Promise.all([
          getDocs(collection(db, 'medicines')).catch(() => null),
          getDocs(collection(db, 'prescriptions')).catch(() => null),
          getDocs(collection(db, 'appointments')).catch(() => null),
        ]);
        if (medSnap) {
          const names = medSnap.docs
            .map((d) => d.data().name as string)
            .filter(Boolean);
          setInventoryMedNames(names.slice(0, 60));
        }
        if (rxSnap) {
          const rxList = rxSnap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as PrescriptionRecord),
          }));
          rxList.sort((a, b) =>
            (b.createdAt || b.date || '').localeCompare(a.createdAt || a.date || '')
          );
          setAllPastPastPrescriptionsSafe(rxList);
        }
        if (aptSnap) {
          setAllBookedAppointments(
            aptSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
          );
        }
      } catch {
        // ignore
      }
    };
    loadModalMetadata();
  }, [isOpen]);

  const setAllPastPastPrescriptionsSafe = (list: PrescriptionRecord[]) => {
    setAllPastPrescriptions(list);
  };

  // Synchronize form state ONLY when modal is newly opened or target patient/prescription actually changes
  useEffect(() => {
    if (!isOpen) {
      syncedTargetKeyRef.current = null;
      return;
    }

    const currentKey = `${existingPrescription?.id || ''}_${appointment?.id || 'manual'}_${initialMode || 'form'}`;
    if (syncedTargetKeyRef.current === currentKey) {
      // Already synchronized for this patient/prescription, never overwrite user's typing!
      return;
    }
    syncedTargetKeyRef.current = currentKey;

    setErrorMsg(null);
    setSaveSuccessMsg(null);
    setPrinted(false);
    setAutoFilledNotice(null);

    if (existingPrescription) {
      setPatientName(existingPrescription.patientName || appointment?.patientName || '');
      setPatientPhone(existingPrescription.phone || appointment?.phone || '');
      setPatientAge(
        String(existingPrescription.age ?? appointment?.age ?? 30)
      );
      setPatientGender(
        existingPrescription.gender || appointment?.gender || 'Male'
      );
      setTokenNo(
        existingPrescription.tokenNo ?? appointment?.tokenNo ?? 1
      );
      setChiefComplaints(
        existingPrescription.chiefComplaints || appointment?.symptoms || ''
      );
      setDiagnosis(
        existingPrescription.diagnosis || appointment?.clinicalNotes || ''
      );
      setBp(existingPrescription.vitals?.bp || '');
      setPulse(existingPrescription.vitals?.pulse || '');
      setTemperature(existingPrescription.vitals?.temperature || '');
      setWeight(existingPrescription.vitals?.weight || '');
      setSpo2(existingPrescription.vitals?.spo2 || '');
      if (existingPrescription.medicines && existingPrescription.medicines.length > 0) {
        setMedicines(existingPrescription.medicines);
      } else {
        setMedicines(defaultMeds);
      }
      setAdvice(
        existingPrescription.advice ||
          'पर्याप्त पानी पिएं, हल्का व सुपाच्य भोजन लें, ठंडा पानी व तली चीजें न खाएं।'
      );
      setParchiImageUrl(
        existingPrescription.parchiImageUrl || appointment?.parchiImageUrl || ''
      );
      setParchiFileName(
        existingPrescription.parchiFileName || appointment?.parchiFileName || ''
      );

      // If existingPrescription has a saved ID and we didn't explicitly ask for 'form' mode, open in print view; otherwise open in form view so doctor can add new visit data & upload parchi
      if (existingPrescription.id && initialMode !== 'form') {
        setSavedPrescription(existingPrescription);
        setActiveView('print');
      } else {
        setSavedPrescription(null);
        setActiveView('form');
      }
    } else if (appointment) {
      setSavedPrescription(null);
      setPatientName(appointment.patientName || '');
      setPatientPhone(appointment.phone || '');
      setPatientAge(String(appointment.age ?? 30));
      setPatientGender(appointment.gender || 'Male');
      setTokenNo(appointment.tokenNo ?? 1);
      setChiefComplaints(appointment.symptoms || '');
      setDiagnosis(appointment.clinicalNotes || '');
      setBp('');
      setPulse('');
      setTemperature('');
      setWeight('');
      setSpo2('');
      setMedicines(defaultMeds);
      setAdvice(
        'पर्याप्त पानी पिएं, हल्का व सुपाच्य भोजन लें, ठंडा पानी व तली चीजें न खाएं।'
      );
      setParchiImageUrl(appointment.parchiImageUrl || '');
      setParchiFileName(appointment.parchiFileName || '');
      setActiveView(initialMode || 'form');
    } else {
      setSavedPrescription(null);
      setPatientName('');
      setPatientPhone('');
      setPatientAge('30');
      setPatientGender('Male');
      setTokenNo(1);
      setChiefComplaints('');
      setDiagnosis('');
      setBp('');
      setPulse('');
      setTemperature('');
      setWeight('');
      setSpo2('');
      setMedicines(defaultMeds);
      setAdvice(
        'पर्याप्त पानी पिएं, हल्का व सुपाच्य भोजन लें, ठंडा पानी व तली चीजें न खाएं।'
      );
      setParchiImageUrl('');
      setParchiFileName('');
      setActiveView('form');
    }
  }, [isOpen, appointment?.id, existingPrescription?.id, initialMode]);

  // Returning patient past visits matching phone or name
  const patientPreviousVisits = React.useMemo(() => {
    const cleanP = patientPhone.replace(/\D/g, '').slice(-10);
    const cleanN = patientName.trim().toLowerCase();
    if (!cleanP && cleanN.length < 3) return [];

    return allPastPrescriptions.filter((rx) => {
      if (existingPrescription?.id && rx.id === existingPrescription.id) {
        return false;
      }
      const rxPhone = (rx.phone || '').replace(/\D/g, '').slice(-10);
      const rxName = (rx.patientName || '').trim().toLowerCase();
      if (cleanP.length === 10 && rxPhone === cleanP) return true;
      if (cleanN.length >= 3 && rxName === cleanN) return true;
      return false;
    });
  }, [allPastPrescriptions, patientPhone, patientName, existingPrescription?.id]);

  // Auto-fill returning patient details when 10-digit mobile number is entered
  const handlePhoneInputChange = (val: string) => {
    setPatientPhone(val);
    const clean = val.replace(/\D/g, '').slice(-10);
    if (clean.length === 10) {
      const matchedRx = allPastPrescriptions.find(
        (r) => (r.phone || '').replace(/\D/g, '').slice(-10) === clean
      );
      const matchedApt = allBookedAppointments.find(
        (a) => (a.phone || '').replace(/\D/g, '').slice(-10) === clean
      );
      const found = matchedRx || matchedApt;
      if (found) {
        // Do NOT overwrite fields if user has already entered their own value!
        setPatientName((prev) => (prev.trim() ? prev : (found.patientName || '')));
        setPatientAge((prev) => (prev.trim() && prev !== '30' ? prev : String(found.age || 30)));
        setPatientGender((prev) => (prev && prev !== 'Male' ? prev : (found.gender || 'Male')));
        setChiefComplaints((prev) => (prev.trim() ? prev : (found.symptoms || found.chiefComplaints || '')));
        setAutoFilledNotice(
          `पुराना मरीज रिकॉर्ड मिला: ${found.patientName} (${found.age || 30} Yrs, ${found.gender || 'Male'}) — विवरण भर दिया गया है!`
        );
      }
    }
  };

  if (!isOpen) return null;

  // Handle image upload and compress on canvas
  const handleParchiFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setParchiFileName(file.name);
    setErrorMsg(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1100; // Crisp resolution & fast Firestore save under 1MB limit
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
          setParchiImageUrl(compressedDataUrl);
        }
        setUploadingImage(false);
      };
      img.src = String(ev.target?.result || '');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleAddMedicineRow = () => {
    setMedicines((prev) => [
      ...prev,
      {
        name: '',
        dosage: '1 Tab',
        frequency: '1-0-1 (सुबह - रात)',
        timing: 'After Food (खाने के बाद)',
        duration: '5 Days',
        instructions: 'ताजे पानी के साथ',
      },
    ]);
  };

  const handleUpdateMedicine = (
    index: number,
    field: keyof PrescribedMedicine,
    value: string
  ) => {
    setMedicines((prev) =>
      prev.map((m, i) => (i === index ? { ...m, [field]: value } : m))
    );
  };

  const handleRemoveMedicine = (index: number) => {
    setMedicines((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSavePrescription = async (goToPrint = true) => {
    setErrorMsg(null);
    const resolvedPatientName = (
      patientName ||
      appointment?.patientName ||
      existingPrescription?.patientName ||
      ''
    ).trim();

    if (!resolvedPatientName) {
      setErrorMsg('कृपया मरीज का नाम (Patient Name) दर्ज करें।');
      return;
    }

    if (resolvedPatientName !== patientName) {
      setPatientName(resolvedPatientName);
    }

    setSaving(true);
    try {
      const todayIsoDate = new Date().toISOString().split('T')[0];
      const isEditingExistingDoc = Boolean(
        existingPrescription?.id && initialMode !== 'form'
      );
      const prescriptionId = isEditingExistingDoc
        ? existingPrescription!.id!
        : `rx_${todayIsoDate}_${Date.now().toString().slice(-6)}`;
      const prescriptionNo = isEditingExistingDoc
        ? existingPrescription!.prescriptionNo ||
          `RX-${todayIsoDate.replace(/-/g, '')}-${String(tokenNo || 101).padStart(3, '0')}`
        : `RX-${todayIsoDate.replace(/-/g, '')}-${String(
            tokenNo || Math.floor(100 + Math.random() * 900)
          ).padStart(3, '0')}`;

      const doctorName =
        doctor?.name ||
        appointment?.doctorName ||
        existingPrescription?.doctorName ||
        'Dr. Sandana (MBBS)';
      const doctorSpec =
        doctor?.specialization ||
        existingPrescription?.doctorSpecialization ||
        'General Physician';
      const doctorQual =
        doctor?.qualification ||
        existingPrescription?.doctorQualification ||
        'MBBS, MD (General Medicine)';
      const doctorReg =
        doctor?.regNo || existingPrescription?.doctorRegNo || 'TNMC Reg. #75410';

      const safeTokenNo =
        typeof tokenNo === 'number' && tokenNo > 0
          ? tokenNo
          : appointment?.tokenNo !== undefined && appointment?.tokenNo !== null
          ? Number(appointment.tokenNo)
          : 1;

      const cleanFollowUp = followUpDays
        ? new Date(Date.now() + Number(followUpDays) * 86400000)
            .toISOString()
            .split('T')[0]
        : '';

      const resolvedPhone = (
        patientPhone ||
        appointment?.phone ||
        existingPrescription?.phone ||
        ''
      ).trim();

      const resolvedComplaints =
        (
          chiefComplaints ||
          appointment?.symptoms ||
          existingPrescription?.chiefComplaints ||
          diagnosis ||
          'General OPD Consultation'
        ).trim();

      const resolvedDiagnosis =
        (
          diagnosis ||
          appointment?.clinicalNotes ||
          existingPrescription?.diagnosis ||
          'General Medical Consultation'
        ).trim();

      const payload: PrescriptionRecord = {
        id: prescriptionId,
        prescriptionNo,
        appointmentId: appointment?.id || existingPrescription?.appointmentId || '',
        patientName: resolvedPatientName.slice(0, 140),
        phone: resolvedPhone.slice(0, 30),
        age: Math.max(0, Number(patientAge) || appointment?.age || 30),
        gender: patientGender || appointment?.gender || 'Male',
        doctorId:
          doctor?.id ||
          appointment?.doctorId ||
          existingPrescription?.doctorId ||
          'doc_sandana_1',
        doctorName: doctorName.slice(0, 140),
        doctorSpecialization: doctorSpec,
        doctorQualification: doctorQual,
        doctorRegNo: doctorReg,
        date: appointment?.date || existingPrescription?.date || todayIsoDate,
        tokenNo: safeTokenNo,
        chiefComplaints: resolvedComplaints,
        diagnosis: resolvedDiagnosis.slice(0, 1900),
        vitals: {
          bp: (bp || '').trim(),
          pulse: (pulse || '').trim(),
          temperature: (temperature || '').trim(),
          weight: (weight || '').trim(),
          spo2: (spo2 || '').trim(),
        },
        clinicalNotes: resolvedDiagnosis,
        medicines: (medicines || []).filter(
          (m) => m && m.name && m.name.trim().length > 0
        ),
        advice: (advice || '').trim(),
        followUpDate: cleanFollowUp,
        parchiImageUrl: parchiImageUrl || '',
        parchiFileName: parchiFileName || '',
        createdAt:
          isEditingExistingDoc && existingPrescription?.createdAt
            ? existingPrescription.createdAt
            : new Date().toISOString(),
      };

      // Strip any undefined keys so Firestore setDoc never throws Unsupported field value: undefined
      const firestorePayload: any = {};
      for (const [k, v] of Object.entries(payload)) {
        if (v !== undefined) {
          firestorePayload[k] = v;
        }
      }

      // 1. Save to Firestore prescriptions collection (using setDoc merge for full reliability)
      try {
        await setDoc(
          doc(db, 'prescriptions', prescriptionId),
          firestorePayload,
          { merge: true }
        );
      } catch (fsErr) {
        console.warn('Firestore prescription write warning, saved to SQL bridge:', fsErr);
      }

      // 2. Dual-save to SQL relational database
      await saveRecordToSql('prescriptions', prescriptionId, payload);

      // 3. If tied to an appointment, save all updated patient & parchi fields to the appointment record too
      if (appointment?.id) {
        const aptUpdate = {
          patientName: payload.patientName,
          phone: payload.phone || '0000000000',
          age: payload.age,
          gender: payload.gender,
          symptoms: payload.chiefComplaints,
          clinicalNotes: payload.diagnosis,
          doctorId: payload.doctorId,
          doctorName: payload.doctorName,
          date: appointment.date || payload.date,
          slot: appointment.slot || '10:00',
          tokenNo: safeTokenNo,
          status: 'completed' as const,
          prescriptionId,
          parchiImageUrl: payload.parchiImageUrl || '',
          parchiFileName: payload.parchiFileName || '',
          completedAt: new Date().toISOString(),
        };
        try {
          await setDoc(doc(db, 'appointments', appointment.id), aptUpdate, {
            merge: true,
          });
        } catch {
          // Fallback if demo appointment ID
        }
        await saveRecordToSql('appointments', appointment.id, aptUpdate);
      }

      await logStaffActivity(
        'PRESCRIPTION_CREATED',
        `Doctor saved prescription ${prescriptionNo} for patient ${payload.patientName} (Rx: ${payload.medicines.length} medicines, Parchi: ${parchiImageUrl ? 'Attached' : 'Digital'})`,
        doctorName
      ).catch(() => {});

      setSavedPrescription(payload);
      if (onSaved) onSaved(payload);
      setSaveSuccessMsg(
        `✅ पर्ची संख्या ${prescriptionNo} व मरीज का डेटा सफलतापूर्वक सुरक्षित (Saved) हो गया है!`
      );
      setTimeout(() => setSaveSuccessMsg(null), 6000);

      if (goToPrint) {
        setActiveView('print');
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'पर्ची सेव करने में त्रुटि आई। कृपया पुनः प्रयास करें।'
      );
      handleFirestoreError(err, OperationType.WRITE, 'prescriptions');
    } finally {
      setSaving(false);
    }
  };

  const handleTriggerPrint = () => {
    setPrinted(true);
    printElementById('printable-prescription', {
      title: `Prescription_${savedPrescription?.patientName || patientName}_${savedPrescription?.prescriptionNo || ''}`,
    });
    setTimeout(() => setPrinted(false), 3000);
  };

  const handleOpenPrintWindow = () => {
    openPrintWindow(
      'printable-prescription',
      `Prescription - ${savedPrescription?.patientName || patientName}`
    );
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col border border-slate-200 overflow-hidden animate-scale-in">
        {/* Modal Top Header */}
        <div className="bg-gradient-to-r from-[#0F2942] via-emerald-950 to-[#0F2942] text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Stethoscope size={20} />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold flex items-center gap-2">
                <span>डॉक्टर ओपीडी पर्ची व प्रिस्क्रिप्शन (Doctor Prescription &amp; Parchi)</span>
                {tokenNo > 0 && (
                  <span className="bg-amber-400 text-slate-950 font-mono text-xs px-2 py-0.5 rounded-md font-black">
                    Token #{tokenNo}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-emerald-200">
                Sandana Clinic · Doctor Chamber · Digital Rx &amp; Parchi Upload
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex bg-white/10 p-0.5 rounded-lg text-xs font-bold">
              <button
                type="button"
                onClick={() => setActiveView('form')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  activeView === 'form'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                ✍️ Write / Edit (पर्ची बनाएं)
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!savedPrescription) {
                    handleSavePrescription(true);
                  } else {
                    setActiveView('print');
                  }
                }}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  activeView === 'print'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-emerald-200 hover:text-white'
                }`}
              >
                🖨️ Print Preview (प्रिंट पेज)
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-50">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-xl text-xs font-bold text-red-700 flex items-center justify-between">
              <span>{errorMsg}</span>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="text-red-500 hover:text-red-800 font-extrabold px-2"
              >
                ✕
              </button>
            </div>
          )}

          {autoFilledNotice && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                <span>{autoFilledNotice}</span>
              </span>
              <button
                type="button"
                onClick={() => setAutoFilledNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 font-bold px-2"
              >
                ✕
              </button>
            </div>
          )}

          {saveSuccessMsg && (
            <div className="mb-4 p-3.5 bg-emerald-600 text-white rounded-xl text-xs font-black shadow-md flex items-center justify-between animate-fade-in">
              <span className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-200 shrink-0" />
                <span>{saveSuccessMsg}</span>
              </span>
              <button
                type="button"
                onClick={() => setSaveSuccessMsg(null)}
                className="text-white hover:text-emerald-200 font-extrabold px-2"
              >
                ✕
              </button>
            </div>
          )}

          {/* Booked OPD Appointment Summary Card so Doctor sees all saved booking details */}
          {appointment && activeView === 'form' && (
            <div className="mb-4 bg-gradient-to-r from-emerald-900 to-[#0F2942] text-white p-3.5 rounded-xl shadow-xs border border-emerald-700 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-3">
                <span className="bg-amber-400 text-slate-950 font-mono font-black px-2.5 py-1 rounded-lg text-sm">
                  OPD Token #{appointment.tokenNo || tokenNo || 1}
                </span>
                <div>
                  <p className="font-extrabold text-sm text-white">
                    {appointment.patientName} ({appointment.age} Yrs ·{' '}
                    {appointment.gender || patientGender || 'Male'})
                  </p>
                  <p className="text-emerald-200 font-mono text-[11px]">
                    Mobile: +91 {appointment.phone} · Date: {appointment.date} · Slot:{' '}
                    {appointment.slot}
                  </p>
                </div>
              </div>
              {appointment.symptoms && (
                <div className="bg-white/10 border border-white/20 px-3 py-1.5 rounded-lg max-w-md">
                  <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold block">
                    मरीज की बुक की गई समस्या (Booked Symptoms):
                  </span>
                  <span className="font-semibold text-white">
                    {appointment.symptoms}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Returning Patient Previous Visits & Uploaded Parchi History */}
          {patientPreviousVisits.length > 0 && activeView === 'form' && (
            <div className="mb-4 bg-amber-50/90 border border-amber-300 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                  <Clock size={15} className="text-amber-700" />
                  <span>
                    मरीज का पिछला रिकॉर्ड व पुरानी पर्चियां (Returning Patient History:{' '}
                    {patientPreviousVisits.length} Past Visit
                    {patientPreviousVisits.length > 1 ? 's' : ''})
                  </span>
                </span>
                <span className="text-[11px] text-amber-800 font-medium">
                  मरीज जब भी दोबारा आए, नीचे नया डेटा डालें और नई पर्ची अपलोड करें
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1">
                {patientPreviousVisits.map((oldRx, i) => (
                  <div
                    key={oldRx.id || i}
                    className="bg-white border border-amber-200 rounded-lg p-2.5 text-[11px] flex items-start justify-between gap-2 shadow-2xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-extrabold text-slate-900">
                        📅 {oldRx.date} ·{' '}
                        <span className="text-emerald-800">
                          {oldRx.diagnosis || 'OPD Visit'}
                        </span>
                      </p>
                      {oldRx.chiefComplaints && (
                        <p className="text-slate-600 truncate">
                          समस्या: {oldRx.chiefComplaints}
                        </p>
                      )}
                      {oldRx.medicines && oldRx.medicines.length > 0 && (
                        <p className="text-slate-500 truncate">
                          Rx: {oldRx.medicines.map((m) => m.name).join(', ')}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (oldRx.medicines?.length) {
                            setMedicines(oldRx.medicines);
                          }
                          if (oldRx.diagnosis && !diagnosis) {
                            setDiagnosis(oldRx.diagnosis);
                          }
                        }}
                        className="text-[10px] font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        + पुरानी दवाइयां आज की पर्ची में कॉपी करें
                      </button>
                    </div>

                    {oldRx.parchiImageUrl && (
                      <a
                        href={oldRx.parchiImageUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 w-14 h-12 rounded border border-amber-400 overflow-hidden bg-slate-100 relative group"
                        title="पुरानी अपलोड की गई पर्ची देखें"
                      >
                        <img
                          src={oldRx.parchiImageUrl}
                          alt="Old Parchi"
                          className="w-full h-full object-cover"
                        />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeView === 'form' ? (
            /* ================= FORM VIEW ================= */
            <div className="space-y-6">
              {/* 1. Patient & Doctor Information */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-2">
                  <User size={15} />
                  <span>1. मरीज का विवरण (Patient Information — Auto-Saved Profile)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Patient Full Name *
                    </label>
                    <input
                      type="text"
                      value={patientName}
                      onChange={(e) => {
                        setPatientName(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="e.g. Ramesh Kumar"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Mobile Number (10-Digit)
                    </label>
                    <input
                      type="tel"
                      value={patientPhone}
                      onChange={(e) => handlePhoneInputChange(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Age (Years)
                    </label>
                    <input
                      type="number"
                      value={patientAge}
                      onChange={(e) => setPatientAge(e.target.value)}
                      placeholder="35"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">
                      Gender
                    </label>
                    <select
                      value={patientGender}
                      onChange={(e) => setPatientGender(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900"
                    >
                      <option value="Male">Male (पुरुष)</option>
                      <option value="Female">Female (महिला)</option>
                      <option value="Child">Child (बच्चा)</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 2. Complaints, Symptoms & Vitals (मरीज को क्या परेशानी है) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 mb-3 flex items-center gap-2">
                  <HeartPulse size={15} />
                  <span>2. मरीज की समस्या, लक्षण व वाइटल्स (Patient Problem &amp; Diagnosis)</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Chief Complaints / मुख्य समस्या व लक्षण *
                    </label>
                    <textarea
                      rows={3}
                      value={chiefComplaints}
                      onChange={(e) => {
                        setChiefComplaints(e.target.value);
                        if (errorMsg) setErrorMsg(null);
                      }}
                      placeholder="मरीज को क्या समस्या है (उदा. 3 दिन से तेज बुखार, खांसी, गले में दर्द, बदन दर्द, सिरदर्द)..."
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-900"
                    />
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className="text-[10px] text-slate-400 font-bold">Quick suggestions:</span>
                      {[
                        'Fever & Chills',
                        'Dry Cough & Cold',
                        'Severe Headache',
                        'Body Ache & Weakness',
                        'Acidity & Nausea',
                        'Chest Tightness',
                        'Joint Pain',
                      ].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setChiefComplaints((prev) =>
                              prev ? `${prev}, ${tag}` : tag
                            )
                          }
                          className="text-[10px] bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 px-2 py-0.5 rounded-md border border-slate-200 cursor-pointer"
                        >
                          +{tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Doctor&apos;s Diagnosis / बीमारी की जांच (Diagnosis)
                    </label>
                    <input
                      type="text"
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="उदा. Acute Viral Pharyngitis / Hypertension / Typhoid"
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900"
                    />

                    {/* Vitals */}
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2 text-[11px]">
                      <div>
                        <span className="font-bold text-slate-600 block">BP (रक्तचाप)</span>
                        <input
                          type="text"
                          value={bp}
                          onChange={(e) => setBp(e.target.value)}
                          placeholder="120/80"
                          className="w-full px-2 py-1 border border-slate-200 rounded font-mono"
                        />
                      </div>
                      <div>
                        <span className="font-bold text-slate-600 block">Pulse (पल्स)</span>
                        <input
                          type="text"
                          value={pulse}
                          onChange={(e) => setPulse(e.target.value)}
                          placeholder="78 bpm"
                          className="w-full px-2 py-1 border border-slate-200 rounded font-mono"
                        />
                      </div>
                      <div>
                        <span className="font-bold text-slate-600 block">Temp (°F)</span>
                        <input
                          type="text"
                          value={temperature}
                          onChange={(e) => setTemperature(e.target.value)}
                          placeholder="99.2"
                          className="w-full px-2 py-1 border border-slate-200 rounded font-mono"
                        />
                      </div>
                      <div>
                        <span className="font-bold text-slate-600 block">Weight (kg)</span>
                        <input
                          type="text"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          placeholder="64"
                          className="w-full px-2 py-1 border border-slate-200 rounded font-mono"
                        />
                      </div>
                      <div>
                        <span className="font-bold text-slate-600 block">SpO2 (%)</span>
                        <input
                          type="text"
                          value={spo2}
                          onChange={(e) => setSpo2(e.target.value)}
                          placeholder="98%"
                          className="w-full px-2 py-1 border border-slate-200 rounded font-mono"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Handwritten Parchi / Report Photo Upload (पर्ची अपलोड) */}
              <div className="bg-white border-2 border-dashed border-emerald-300 rounded-xl p-4 shadow-xs bg-emerald-50/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-2">
                      <Camera size={16} />
                      <span>3. डॉक्टर की हाथ से लिखी पर्ची / फोटो अपलोड (Handwritten Parchi Upload)</span>
                    </h3>
                    <p className="text-[11px] text-slate-600">
                      डॉक्टर की हाथ से लिखी पर्ची या लैब रिपोर्ट की फोटो खींचकर या फाइल से अपलोड करें — यह पर्ची प्रिंटआउट और रिकॉर्ड में हमेशा सुरक्षित रहेगी।
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleParchiFileUpload}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingImage}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-xs cursor-pointer transition-all"
                    >
                      <Upload size={14} />
                      <span>{uploadingImage ? 'Compressing...' : '📷 पर्ची / फोटो अपलोड करें'}</span>
                    </button>
                    {parchiImageUrl && (
                      <button
                        type="button"
                        onClick={() => {
                          setParchiImageUrl('');
                          setParchiFileName('');
                        }}
                        className="px-2.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-lg border border-red-200 cursor-pointer"
                      >
                        हटाएं
                      </button>
                    )}
                  </div>
                </div>

                {parchiImageUrl ? (
                  <div className="bg-white p-3 rounded-xl border border-emerald-200 flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-48 h-36 border border-slate-200 rounded-lg overflow-hidden bg-slate-100 shrink-0 shadow-inner">
                      <img
                        src={parchiImageUrl}
                        alt="Uploaded Parchi"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-extrabold">
                        <CheckCircle2 size={16} />
                        <span>डॉक्टर पर्ची सफलतापूर्वक अपलोड हो गई है!</span>
                      </div>
                      <p className="font-mono text-slate-600 text-[11px]">
                        {parchiFileName || 'doctor_parchi_scan.jpg'}
                      </p>
                      <p className="text-slate-500 text-[11px]">
                        यह पर्ची प्रिंट पेज पर मरीज की डिजिटल प्रिस्क्रिप्शन के साथ दिखेगी और सीधे प्रिंट होगी।
                      </p>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-emerald-700 font-bold underline hover:text-emerald-800 text-[11px] cursor-pointer"
                      >
                        दूसरी फोटो बदलें (Change Photo)
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border border-slate-200 bg-white/70 hover:bg-emerald-50/50 rounded-xl p-4 text-center cursor-pointer transition-colors"
                  >
                    <ImageIcon className="mx-auto text-emerald-600 mb-1" size={28} />
                    <p className="text-xs font-extrabold text-slate-800">
                      यहां क्लिक करके हाथ से लिखी पर्ची का फोटो अपलोड करें
                    </p>
                    <p className="text-[11px] text-slate-500">
                      मोबाइल से कैमरा खोलकर तुरंत फोटो ले सकते हैं या गैलरी से सेलेक्ट कर सकते हैं (JPG, PNG, WebP)
                    </p>
                  </div>
                )}
              </div>

              {/* 4. Prescribed Medicines (Rx) */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 flex items-center gap-2">
                    <Pill size={15} />
                    <span>4. दवाइयां लिखें (Prescribed Medicines - Rx)</span>
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddMedicineRow}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-extrabold text-xs rounded-lg border border-emerald-300 transition-colors cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>+ दवा जोड़ें (Add Medicine)</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {medicines.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-12 gap-2 text-xs items-center"
                    >
                      <div className="sm:col-span-4">
                        <label className="text-[10px] font-bold text-slate-500 block">
                          Medicine Name #{idx + 1}
                        </label>
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            handleUpdateMedicine(idx, 'name', e.target.value)
                          }
                          placeholder="उदा. Tab. Azithromycin 500mg"
                          list="clinic-inventory-meds"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-bold text-slate-900 bg-white"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 block">
                          Frequency
                        </label>
                        <select
                          value={item.frequency}
                          onChange={(e) =>
                            handleUpdateMedicine(idx, 'frequency', e.target.value)
                          }
                          className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-[11px] font-semibold"
                        >
                          <option value="1-0-1 (सुबह - रात)">1-0-1 (सुबह - रात)</option>
                          <option value="1-1-1 (सुबह - दोपहर - रात)">
                            1-1-1 (सुबह - दोपहर - रात)
                          </option>
                          <option value="1-0-0 (सुबह खाली पेट)">
                            1-0-0 (सुबह खाली पेट)
                          </option>
                          <option value="0-0-1 (रात को)">0-0-1 (रात को)</option>
                          <option value="SOS (जरूरत पड़ने पर)">
                            SOS (जरूरत पड़ने पर)
                          </option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 block">
                          Timing
                        </label>
                        <select
                          value={item.timing}
                          onChange={(e) =>
                            handleUpdateMedicine(idx, 'timing', e.target.value)
                          }
                          className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-[11px] font-semibold"
                        >
                          <option value="After Food (खाने के बाद)">
                            After Food (खाने के बाद)
                          </option>
                          <option value="Before Food (खाने से पहले)">
                            Before Food (खाने से पहले)
                          </option>
                          <option value="With Milk (दूध के साथ)">
                            With Milk (दूध के साथ)
                          </option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 block">
                          Duration
                        </label>
                        <input
                          type="text"
                          value={item.duration}
                          onChange={(e) =>
                            handleUpdateMedicine(idx, 'duration', e.target.value)
                          }
                          placeholder="5 Days"
                          className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-[11px] font-semibold"
                        />
                      </div>

                      <div className="sm:col-span-2 flex items-center gap-1">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-slate-500 block">
                            Instructions
                          </label>
                          <input
                            type="text"
                            value={item.instructions}
                            onChange={(e) =>
                              handleUpdateMedicine(
                                idx,
                                'instructions',
                                e.target.value
                              )
                            }
                            placeholder="गुनगुने पानी से"
                            className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white text-[11px]"
                          />
                        </div>
                        {medicines.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMedicine(idx)}
                            className="mt-3.5 p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <datalist id="clinic-inventory-meds">
                  {inventoryMedNames.map((name, i) => (
                    <option key={i} value={name} />
                  ))}
                </datalist>
              </div>

              {/* 5. Doctor's Advice & Next Follow-Up */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="font-bold text-slate-700 block mb-1">
                    Doctor Advice / सावधानियां व परहेज
                  </label>
                  <input
                    type="text"
                    value={advice}
                    onChange={(e) => setAdvice(e.target.value)}
                    placeholder="उदा. गुनगुना पानी पिएं, धूल से बचें, पूरा आराम करें..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">
                    Next Follow-up (पुनः दिखाएं)
                  </label>
                  <select
                    value={followUpDays}
                    onChange={(e) => setFollowUpDays(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                  >
                    <option value="3">After 3 Days (3 दिन बाद)</option>
                    <option value="5">After 5 Days (5 दिन बाद)</option>
                    <option value="7">After 7 Days (1 हफ्ते बाद)</option>
                    <option value="15">After 15 Days</option>
                    <option value="30">After 1 Month</option>
                    <option value="0">SOS (जरूरत पड़ने पर)</option>
                  </select>
                </div>
              </div>
            </div>
          ) : (
            /* ================= PRINT PREVIEW VIEW ================= */
            <div className="space-y-4">
              <div className="no-print bg-emerald-50 border border-emerald-300 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-950">
                  <Printer className="text-emerald-700" size={18} />
                  <span>
                    प्रिंट प्रीव्यू तैयार है! नीचे &quot;प्रिंट पर्ची (Print Prescription)&quot; पर क्लिक करके सीधे प्रिंट निकालें या PDF सेव करें।
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleTriggerPrint}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-sm cursor-pointer transition-all"
                  >
                    <Printer size={15} />
                    <span>{printed ? 'प्रिंटिंग चालू है...' : 'प्रिंट पर्ची (Print Now)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenPrintWindow}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold rounded-lg border border-slate-300 cursor-pointer transition-all"
                  >
                    <ExternalLink size={14} />
                    <span>Open in New Window</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveView('form')}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg cursor-pointer"
                  >
                    ✏️ बदलाव करें (Edit)
                  </button>
                </div>
              </div>

              {/* Printable Prescription Card */}
              <div
                id="printable-prescription"
                className="bg-white border-2 border-slate-800 p-6 sm:p-8 rounded-xl shadow-lg max-w-3xl mx-auto text-slate-900 space-y-4 font-sans"
              >
                {/* Clinic Header / Letterhead */}
                <div className="border-b-2 border-slate-800 pb-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[#0F2942]">
                      {clinicSettings?.clinicName || 'SANDANA CLINIC'}
                    </h1>
                    <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">
                      Multispeciality Outpatient Healthcare &amp; Diagnostic Centre
                    </p>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {clinicSettings?.clinicAddress ||
                        '42, MG Healthcare Road, Anna Nagar, Chennai'}
                    </p>
                    <p className="text-[11px] text-slate-600 font-mono">
                      Phone: {clinicSettings?.clinicPhone || '+91 98400 11224'} · GSTIN:{' '}
                      {(clinicSettings as any)?.gstNo || '33AABCS1429B1Z5'}
                    </p>
                  </div>

                  <div className="text-center sm:text-right border-t sm:border-t-0 sm:border-l border-slate-300 pt-2 sm:pt-0 sm:pl-4">
                    <p className="text-sm font-extrabold text-slate-900">
                      {doctor?.name || savedPrescription?.doctorName || 'Dr. Sandana'}
                    </p>
                    <p className="text-xs font-bold text-emerald-700">
                      {doctor?.qualification || 'MBBS, MD (General Medicine)'}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {doctor?.specialization || 'Consultant Physician'}
                    </p>
                    <p className="text-[10px] font-mono text-slate-500">
                      {doctor?.regNo || 'TNMC Reg. #75410'}
                    </p>
                  </div>
                </div>

                {/* Patient Details & Token Bar */}
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <span className="text-slate-500 text-[10px] block font-bold">
                      PATIENT NAME
                    </span>
                    <span className="font-extrabold text-slate-900 text-sm">
                      {patientName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block font-bold">
                      AGE / GENDER
                    </span>
                    <span className="font-bold text-slate-900">
                      {patientAge} Yrs / {patientGender}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block font-bold">
                      CONTACT NO.
                    </span>
                    <span className="font-mono font-bold text-slate-900">
                      {patientPhone || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block font-bold">
                      DATE &amp; TOKEN
                    </span>
                    <span className="font-bold text-emerald-800">
                      {savedPrescription?.date || new Date().toISOString().split('T')[0]} ·{' '}
                      <span className="bg-emerald-100 text-emerald-900 px-1.5 py-0.5 rounded font-mono font-bold">
                        #{tokenNo || '01'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Complaints & Vitals */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 border border-slate-200 rounded-lg p-3 text-xs bg-white">
                  <div className="sm:col-span-2">
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                      Chief Complaints (मरीज की समस्या व लक्षण)
                    </p>
                    <p className="font-semibold text-slate-900 mt-0.5">
                      {chiefComplaints || 'General checkup & weakness'}
                    </p>
                    <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider mt-2">
                      Provisional Diagnosis (जांच / बीमारी)
                    </p>
                    <p className="font-bold text-emerald-800 mt-0.5">
                      {diagnosis || 'Acute Viral Pharyngitis'}
                    </p>
                  </div>

                  <div className="bg-slate-50 p-2.5 rounded border border-slate-200 space-y-1 text-[11px] font-mono">
                    <p className="text-[10px] font-bold text-slate-600 uppercase font-sans">
                      Patient Vitals
                    </p>
                    {bp && <p>BP: <span className="font-bold">{bp}</span></p>}
                    {pulse && <p>Pulse: <span className="font-bold">{pulse}</span></p>}
                    {temperature && <p>Temp: <span className="font-bold">{temperature}°F</span></p>}
                    {weight && <p>Weight: <span className="font-bold">{weight} kg</span></p>}
                    {spo2 && <p>SpO2: <span className="font-bold">{spo2}</span></p>}
                    {!bp && !pulse && !temperature && <p className="text-slate-400">Normal</p>}
                  </div>
                </div>

                {/* Uploaded Handwritten Parchi (यदि अपलोड की गई है तो यहाँ पर्ची प्रिंट होगी) */}
                {parchiImageUrl && (
                  <div className="border-2 border-emerald-500/80 rounded-xl p-3 bg-emerald-50/20">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wide flex items-center gap-1.5">
                        <FileText size={14} />
                        <span>डॉक्टर की मूल पर्ची / अटैचमेंट (Original Handwritten Doctor Slip)</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {parchiFileName || 'Prescription Scan'}
                      </span>
                    </div>
                    <div className="max-h-[380px] overflow-hidden rounded-lg bg-white border border-slate-300 flex items-center justify-center p-1">
                      <img
                        src={parchiImageUrl}
                        alt="Handwritten Parchi"
                        className="max-h-[370px] w-auto max-w-full object-contain"
                      />
                    </div>
                  </div>
                )}

                {/* Rx Medicines Table */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xl font-serif font-black text-emerald-800">
                      ℞
                    </span>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                      Prescribed Medications (दवाइयां)
                    </span>
                  </div>

                  <table className="w-full text-xs border border-slate-300 text-left">
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                        <th className="py-2 px-3 font-bold">#</th>
                        <th className="py-2 px-3 font-bold">Medicine / Brand</th>
                        <th className="py-2 px-3 font-bold">Dosage &amp; Frequency</th>
                        <th className="py-2 px-3 font-bold">Timing</th>
                        <th className="py-2 px-3 font-bold">Duration</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {medicines
                        .filter((m) => m.name.trim().length > 0)
                        .map((med, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 px-3 font-mono font-bold text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3 font-extrabold text-slate-900">
                              {med.name}
                              {med.instructions && (
                                <span className="block text-[10px] font-normal text-slate-500">
                                  {med.instructions}
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-800">
                              {med.dosage} · {med.frequency}
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {med.timing}
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-slate-900">
                              {med.duration}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Advice & Instructions */}
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs">
                  <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    General Advice / निर्देश व परहेज
                  </p>
                  <p className="text-slate-800 font-medium mt-0.5">
                    {advice ||
                      'पर्याप्त पानी पिएं, हल्का सुपाच्य भोजन लें, ठंडा पानी व तली चीजें न खाएं।'}
                  </p>
                  <p className="text-[11px] font-bold text-emerald-800 mt-2">
                    Next Follow-up:{' '}
                    {savedPrescription?.followUpDate ||
                      `After ${followUpDays} Days (or SOS)`}
                  </p>
                </div>

                {/* Signature & Stamp Footer */}
                <div className="pt-6 flex items-end justify-between border-t border-slate-300 text-xs">
                  <div>
                    <p className="text-[10px] text-slate-500">
                      Generated at Sandana Clinic · Valid for 30 Days
                    </p>
                    <p className="text-[10px] font-mono text-slate-400">
                      Prescription ID: {savedPrescription?.prescriptionNo || 'RX-LIVE'}
                    </p>
                  </div>

                  <div className="text-center w-52">
                    <div className="h-12 flex items-center justify-center">
                      <span className="font-serif italic text-slate-400 text-sm">
                        [Doctor Signature]
                      </span>
                    </div>
                    <div className="border-t-2 border-slate-800 pt-1">
                      <p className="font-extrabold text-slate-900">
                        {doctor?.name || savedPrescription?.doctorName || 'Dr. Sandana'}
                      </p>
                      <p className="text-[10px] font-mono text-slate-600">
                        Authorized Signature &amp; Stamp
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Bottom Action Bar */}
        <div className="bg-white px-5 py-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="text-xs text-slate-500 font-medium">
            {savedPrescription ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 size={14} />
                <span>पर्ची डेटाबेस में सुरक्षित है (Saved to Firestore &amp; SQL)</span>
              </span>
            ) : (
              <span>भरने के बाद &quot;सेव व प्रिंट करें&quot; पर क्लिक करें</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeView === 'form' ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                >
                  रद्द करें (Cancel)
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePrescription(false)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-extrabold rounded-lg shadow-sm cursor-pointer transition-all disabled:opacity-50"
                  title="फॉर्म में रहते हुए डेटाबेस में सेव करें"
                >
                  <CheckCircle2 size={15} className="text-emerald-400" />
                  <span>{saving ? 'सेव हो रहा है...' : '💾 सिर्फ सेव करें (Save Data)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSavePrescription(true)}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-sm cursor-pointer transition-all disabled:opacity-50"
                >
                  <Printer size={15} />
                  <span>{saving ? 'सेव हो रहा है...' : '🖨️ सेव व प्रिंट करें (Save &amp; Print)'}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveView('form')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-lg cursor-pointer"
                >
                  ← Edit Form
                </button>
                <button
                  type="button"
                  onClick={handleTriggerPrint}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-lg shadow-sm cursor-pointer transition-all"
                >
                  <Printer size={15} />
                  <span>{printed ? 'Print Sent...' : '🖨️ पर्ची प्रिंट करें (Print Slip)'}</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-800 cursor-pointer"
                >
                  पूर्ण (Done)
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
