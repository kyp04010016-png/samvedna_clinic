import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PrescriptionExplorer } from '../../components/PrescriptionExplorer';
import { PrescriptionRecord } from '../../components/PrescriptionModal';

export const PrescriptionsPharmacy: React.FC = () => {
  const navigate = useNavigate();

  const handleLoadIntoBill = (rx: PrescriptionRecord) => {
    // Navigate to Sale Billing and open bill with prescription context
    navigate('/pharmacy/sale');
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-6 space-y-6 animate-fade-in-up">
      <div className="border-b border-slate-200 pb-3">
        <p className="text-xs font-extrabold text-[#000080] uppercase tracking-wider">
          Dudrucs Medical Store · Pharmacy Counter EMR
        </p>
        <h1 className="text-2xl font-black text-slate-900">
          Doctor Prescriptions &amp; Uploaded Parchis (डॉक्टर की पर्चियां)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          View all doctor prescriptions, see uploaded handwritten slips, and dispense medicines directly by patient name.
        </p>
      </div>

      <PrescriptionExplorer
        role="pharmacy"
        onLoadIntoBill={handleLoadIntoBill}
        showWriteButton={false}
      />
    </div>
  );
};
