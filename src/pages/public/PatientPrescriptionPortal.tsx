import React, { useState } from 'react';
import {
  FileText,
  Search,
  Phone,
  Calendar,
  Camera,
  Printer,
  User,
  HeartPulse,
  Pill,
  Download,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Sparkles,
} from 'lucide-react';
import { PrescriptionExplorer } from '../../components/PrescriptionExplorer';

export const PatientPrescriptionPortal: React.FC = () => {
  const [mobileQuery, setMobileQuery] = useState('');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6 animate-fade-in-up">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-950 via-[#0F2942] to-teal-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-emerald-600/40 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide">
            <HeartPulse size={14} />
            <span>SANDANA CLINIC · PATIENT MEDICAL RECORDS (EMR)</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
            मरीज की पर्चियां व रिपोर्ट (My Prescriptions &amp; Parchi)
          </h1>

          <p className="text-sm sm:text-base text-slate-200 font-medium">
            जितने भी दिन आपने क्लिनिक में डॉक्टर को दिखाया है, उन सभी तारीखों की दवाइयां, डॉक्टर के निर्देश और हाथ से लिखी मूल पर्ची (Handwritten Parchi) यहां देखें व प्रिंट करें।
          </p>
        </div>

        {/* Decorative background glow */}
        <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Explorer Component in Patient Mode */}
      <PrescriptionExplorer
        role="patient"
        initialSearchQuery={mobileQuery}
        showWriteButton={false}
      />
    </div>
  );
};
