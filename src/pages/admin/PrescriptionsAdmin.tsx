import React from 'react';
import { PrescriptionExplorer } from '../../components/PrescriptionExplorer';

export const PrescriptionsAdmin: React.FC = () => {
  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 animate-fade-in-up">
      <div className="border-b border-slate-200 pb-3">
        <p className="text-xs font-extrabold text-emerald-800 uppercase tracking-wider">
          Admin Control Panel · Electronic Medical Records (EMR)
        </p>
        <h1 className="text-2xl font-black text-slate-900">
          All Doctor Prescriptions &amp; Uploaded Parchis
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Monitor all outpatient prescriptions, clinical complaints, prescribed medicines, and handwritten slip photos uploaded by doctors.
        </p>
      </div>

      <PrescriptionExplorer role="admin" showWriteButton={true} />
    </div>
  );
};
