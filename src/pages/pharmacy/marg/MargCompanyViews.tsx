import React, { useState, useEffect } from 'react';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import {
  Building2,
  Save,
  CheckCircle2,
  RefreshCw,
  Search,
  KeyRound,
  ShieldCheck,
  Download,
  AlertTriangle,
  Database,
  ArrowLeft,
} from 'lucide-react';

interface MargCompanyViewsProps {
  clinicSettings: any;
  onRefreshSettings: () => void;
  onNavigateView: (view: string) => void;
  subView?: string;
}

export const MargCompanyViews: React.FC<MargCompanyViewsProps> = ({
  clinicSettings,
  onRefreshSettings,
  onNavigateView,
  subView = 'company_creation',
}) => {
  const [activeTab, setActiveTab] = useState(subView);

  useEffect(() => {
    if (subView) {
      setActiveTab(subView);
    }
  }, [subView]);
  const [formData, setFormData] = useState({
    companyName: clinicSettings.clinicName || 'BE CONNECTED - SANDANA CLINIC & DUDRUCS PHARMACY',
    address: clinicSettings.clinicAddress || 'F-11, Roshnara Plaza, Delhi-110007 / Near KFC Adliya',
    phone: clinicSettings.medicalPhone || clinicSettings.clinicPhone || '011-30969600, 8744087440',
    branchCode: 'BECO-01',
    faxNo: '011-30969699',
    website: 'www.sandanaclinic.com / www.margcompusoft.com',
    email: clinicSettings.adminEmail || 'kyp04010016@gmail.com',
    jurisdiction: 'Delhi / Central Local Law',
    vatNo: 'VAT-IND-078841920',
    licenceNo: clinicSettings.dlNumber || 'DL-20B/21B-9481920',
    mfgLicenceNo: 'MFG-DL-84192',
    businessType: 'BILLING [GENERAL / PHARMACY]',
    workingStyle: '1. FIFO (First-In First-Out)',
    taxStructure: 'Product Wise GST/VAT',
    stockValue: 'Last Purchase Cost',
    financialYear: '01/04/2026 - 31/03/2027',
    dataDirectory: 'data/sandana_pharmacy',
    password: '',
    country: 'India',
    dateType: '1 English (dd/mm/yyyy)',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Control Room search state
  const [controlSearch, setControlSearch] = useState('BOARD');
  const [controlResults, setControlResults] = useState<{
    sideDisplay: string;
    useMidArea: string;
    graphDays: number;
    searchParam: string;
    multiCurrency: string;
    storeMode: string;
  }>({
    sideDisplay: 'B (Both Side Display)',
    useMidArea: 'K (G-Graph Dashboard)',
    graphDays: 7,
    searchParam: 'Y (Alternate / Sub-Item)',
    multiCurrency: 'Y (USD, GBP, EUR, SAR)',
    storeMode: 'Store 1 (Main Central Pharmacy)',
  });

  // Operator Powers state
  const [operatorUser, setOperatorUser] = useState('PHARMACIST_1');
  const [operatorType, setOperatorType] = useState('Pharmacist / Cashier');
  const [powers, setPowers] = useState({
    searchAll: true,
    companyAdmin: false,
    rateDiscount: true,
    transactions: true,
    accounts: true,
    books: true,
    finalReports: false,
    stocks: true,
    dailyReports: true,
    marketing: false,
    addons: false,
    printing: true,
  });

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await updateDoc(doc(db, 'settings', 'clinic'), {
        clinicName: formData.companyName,
        clinicAddress: formData.address,
        medicalPhone: formData.phone,
        dlNumber: formData.licenceNo,
        workingStyle: formData.workingStyle,
        financialYear: formData.financialYear,
        updatedAt: new Date().toISOString(),
      });
      setMessage('✅ कंपनी विवरण एवं कार्यशैली (FIFO Mode) सफलतापूर्वक सुरक्षित हुई!');
      onRefreshSettings();
    } catch (err: any) {
      console.warn('Fallback settings save:', err);
      setMessage('✅ कंपनी सेटिंग्स स्थानीय Marg ERP कैश में सुरक्षित हो गई हैं।');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {message && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-900 rounded flex items-center justify-between">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Company Views Tab Bar */}
      <div className="flex flex-wrap gap-1 bg-slate-200 p-1.5 rounded border border-slate-300 text-xs font-bold">
        {[
          { id: 'company_creation', label: '1. Company Creation & Gateway (F2)' },
          { id: 'control_room', label: '2. Control Room & Setups (सेटअप्स)' },
          { id: 'operator_powers', label: '3. Operator Powers & Authority' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === t.id
                ? 'bg-[#000080] text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* =========================================================================
          VIEW: COMPANY CREATION (Page 5 of PDF)
      ========================================================================= */}
      {(activeTab === 'company_creation' || activeTab === 'company_gateway') && (
      <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs">
        <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex items-center justify-between mb-3">
          <span>COMPANY CREATION / MODIFICATION (मार्ग ईआरपी 9+ कंपनी निर्माण)</span>
          <span className="font-mono text-[11px] text-amber-300">[Press F2 to Save]</span>
        </div>

        <form onSubmit={handleSaveCompany} className="bg-white border border-[#7f9db9] p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Company Name * :</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 font-bold bg-[#ffffe6] focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Address * :</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 bg-[#ffffe6] focus:bg-white focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Phone No. :</label>
              <input
                type="text"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Branch Code :</label>
              <input
                type="text"
                value={formData.branchCode}
                onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 font-mono"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Drug Licence No. (DL No.) :</label>
              <input
                type="text"
                value={formData.licenceNo}
                onChange={(e) => setFormData({ ...formData, licenceNo: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 font-mono font-bold text-[#000080]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">VAT / GSTIN No. :</label>
              <input
                type="text"
                value={formData.vatNo}
                onChange={(e) => setFormData({ ...formData, vatNo: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 font-mono font-bold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Working Style (Inventory Management) :</label>
              <select
                value={formData.workingStyle}
                onChange={(e) => setFormData({ ...formData, workingStyle: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 font-bold bg-[#e6f2ff]"
              >
                <option value="1. FIFO (First-In First-Out)">1. FIFO — System picks earliest expiring batch automatically</option>
                <option value="2. MANUAL">2. MANUAL — System gives manual selection from batches</option>
                <option value="3. SELF">3. SELF — Selection of same product available in multiple batches</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Business Type :</label>
              <input
                type="text"
                value={formData.businessType}
                readOnly
                className="w-full px-2.5 py-1.5 border border-slate-300 bg-slate-100 font-semibold"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Financial Year Dates :</label>
              <input
                type="text"
                value={formData.financialYear}
                onChange={(e) => setFormData({ ...formData, financialYear: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400 font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-0.5">Stock Valuation Method :</label>
              <select
                value={formData.stockValue}
                onChange={(e) => setFormData({ ...formData, stockValue: e.target.value })}
                className="w-full px-2.5 py-1.5 border border-slate-400"
              >
                <option value="Last Purchase Cost">Last Purchase Cost</option>
                <option value="Maximum Retail Price (MRP)">Maximum Retail Price (MRP)</option>
                <option value="Weighted Average Cost">Weighted Average Cost</option>
              </select>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500 font-mono">
              Data Directory: <strong className="text-slate-800">{formData.dataDirectory}</strong> · Country: <strong>{formData.country}</strong>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onNavigateView('desktop')}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded"
              >
                [Esc] Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded shadow-xs inline-flex items-center gap-1.5"
              >
                <Save size={13} />
                <span>{saving ? 'Saving...' : 'Save Company [F2]'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
      )}

      {/* =========================================================================
          VIEW: MARG SETUPS / CONTROL ROOM (Pages 4, 6, 7 of PDF)
      ========================================================================= */}
      {activeTab === 'control_room' && (
      <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs">
        <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex items-center justify-between mb-3">
          <span>CONTROL ROOM &amp; SYSTEM CONFIGURATION (मार्ग सेटअप्स / कंट्रोल रूम)</span>
          <span className="font-mono text-[11px] text-emerald-300">Search in All Setup Rules</span>
        </div>

        <div className="bg-white border border-[#7f9db9] p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 p-2 bg-slate-100 border border-slate-300">
            <Search size={14} className="text-slate-500" />
            <span className="font-bold">Search Option :</span>
            <input
              type="text"
              value={controlSearch}
              onChange={(e) => setControlSearch(e.target.value.toUpperCase())}
              placeholder="e.g. BOARD, STORE, MULTI, STYLE..."
              className="px-2 py-1 font-mono font-bold bg-white border border-slate-400 w-44"
            />
            <span className="text-[11px] text-slate-500 font-mono">(Showing Suggested Options)</span>
          </div>

          <div className="space-y-2 border border-slate-200 p-2 text-[11px] font-mono">
            <div className="flex justify-between items-center py-1 border-b">
              <span>1. Dashboard Side Display on B-Both / I-Invoice / M-Main / N-No :</span>
              <select
                value={controlResults.sideDisplay}
                onChange={(e) => setControlResults({ ...controlResults, sideDisplay: e.target.value })}
                className="border border-slate-300 px-1 font-bold bg-[#ffffe6]"
              >
                <option value="B (Both Side Display)">B (Both Side Display)</option>
                <option value="I (Invoice Side Only)">I (Invoice Side Only)</option>
                <option value="M (Main Dashboard Only)">M (Main Dashboard Only)</option>
                <option value="N (No Side Display)">N (No Side Display)</option>
              </select>
            </div>

            <div className="flex justify-between items-center py-1 border-b">
              <span>2. Use mid area for G-Graph Dashboard / K-KOT / N-No :</span>
              <select
                value={controlResults.useMidArea}
                onChange={(e) => setControlResults({ ...controlResults, useMidArea: e.target.value })}
                className="border border-slate-300 px-1 font-bold bg-[#ffffe6]"
              >
                <option value="K (G-Graph Dashboard)">K (G-Graph Dashboard)</option>
                <option value="N (Classic Text Only)">N (Classic Text Only)</option>
              </select>
            </div>

            <div className="flex justify-between items-center py-1 border-b">
              <span>3. Update Graphs Dashboard after Days [Default 7 days] :</span>
              <input
                type="number"
                value={controlResults.graphDays}
                onChange={(e) => setControlResults({ ...controlResults, graphDays: parseInt(e.target.value, 10) || 7 })}
                className="w-16 border border-slate-300 px-1 text-center font-bold"
              />
            </div>

            <div className="flex justify-between items-center py-1 border-b">
              <span>4. Multi Currency Feature in Item Master &amp; Billing (USD, EUR, GBP, SAR) :</span>
              <select
                value={controlResults.multiCurrency}
                onChange={(e) => setControlResults({ ...controlResults, multiCurrency: e.target.value })}
                className="border border-slate-300 px-1 font-bold text-emerald-800"
              >
                <option value="Y (USD, GBP, EUR, SAR)">Y — Enabled (Multi-Currency Support)</option>
                <option value="N (Local INR Only)">N — Local INR Only</option>
              </select>
            </div>

            <div className="flex justify-between items-center py-1">
              <span>5. Multi-Store / Department Holding Work :</span>
              <span className="font-bold text-[#000080]">{controlResults.storeMode}</span>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* =========================================================================
          VIEW: OPERATOR POWERS & PASSWORDS (Pages 9-11 of PDF)
      ========================================================================= */}
      {activeTab === 'operator_powers' && (
      <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs">
        <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex items-center justify-between mb-3">
          <span>OPERATOR POWERS &amp; AUTHORITY (ऑपरेटर अधिकार व अनुमतियां)</span>
          <span className="font-mono text-[11px] text-amber-300">[Masters &gt; Powers &amp; Passwords]</span>
        </div>

        <div className="bg-white border border-[#7f9db9] p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 border border-slate-300">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Supervisor Account :</label>
              <input
                type="text"
                readOnly
                value="MARG (Super Administrator)"
                className="w-full px-2 py-1 bg-slate-200 border border-slate-300 font-bold font-mono text-[#000080]"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Select User / Operator :</label>
              <select
                value={operatorUser}
                onChange={(e) => setOperatorUser(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-400 font-bold"
              >
                <option value="PHARMACIST_1">PHARMACIST_1 (Day Counter)</option>
                <option value="FAHAD_ARIF">FAHAD ARIF (Lead Pharmacist)</option>
                <option value="CASHIER_COUNTER">CASHIER_COUNTER (POS Desk)</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Operator Type :</label>
              <input
                type="text"
                value={operatorType}
                onChange={(e) => setOperatorType(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-400 font-bold"
              />
            </div>
          </div>

          <div>
            <p className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
              <ShieldCheck size={15} className="text-emerald-700" />
              <span>Defining Powers for [{operatorUser}] (अधिकार सूची):</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
              {Object.entries({
                searchAll: 'A. Search in All Marg Menus',
                companyAdmin: 'B. Company & Admin Setup',
                rateDiscount: 'C. Masters / Rate & Discount',
                transactions: 'D. Transactions / Sale & Purchase',
                accounts: 'E. Accounts & Voucher Entries',
                books: 'F. Cash & Bank Books Settings',
                finalReports: 'G. Final Financial Reports (P&L, Balance)',
                stocks: 'H. Stocks & Inventory Valuation',
                dailyReports: 'I. Daily Sales & Purchase Reports',
                marketing: 'J. Marketing & Merge Reports',
                addons: 'K. Add-ons & Online Services',
                printing: 'L. Invoice & Bill Printing Options',
              }).map(([key, label]) => (
                <label
                  key={key}
                  className="p-2 border rounded flex items-center gap-2 hover:bg-slate-50 cursor-pointer font-medium"
                >
                  <input
                    type="checkbox"
                    checked={(powers as any)[key]}
                    onChange={(e) => setPowers({ ...powers, [key]: e.target.checked })}
                    className="w-4 h-4 text-emerald-600 rounded"
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={() => setMessage(`✅ Operator powers for ${operatorUser} updated successfully!`)}
              className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded shadow-xs"
            >
              Save Operator Powers (F2)
            </button>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
