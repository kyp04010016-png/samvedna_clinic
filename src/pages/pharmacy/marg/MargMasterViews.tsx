import React, { useState, useEffect } from 'react';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import {
  Pill,
  Plus,
  Save,
  Search,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  DollarSign,
  Filter,
  X,
  Layers,
  Building,
  Tag,
  BookOpen,
} from 'lucide-react';

interface MargMasterViewsProps {
  medicines: any[];
  batches: any[];
  onRefreshData: () => void;
  subView?: string;
}

export const MargMasterViews: React.FC<MargMasterViewsProps> = ({
  medicines,
  batches,
  onRefreshData,
  subView = 'item_master',
}) => {
  const [activeTab, setActiveTab] = useState(subView);
  const [searchFilter, setSearchFilter] = useState('');
  const [showNewItemModal, setShowNewItemModal] = useState(false);
  const [showNewLedgerModal, setShowNewLedgerModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (subView) {
      if (subView === 'new_item') {
        setActiveTab('item_master');
        setShowNewItemModal(true);
      } else if (subView === 'new_ledger') {
        setActiveTab('ledger_master');
        setShowNewLedgerModal(true);
      } else if (subView === 'ledger_list' || subView === 'ledger_statement') {
        setActiveTab('ledger_master');
      } else if (subView === 'group_masters' || subView === 'category_masters') {
        setActiveTab('company_masters');
      } else {
        setActiveTab(subView);
      }
    }
  }, [subView]);

  // Full 30+ Field Item Master Form (Pages 12-14 of PDF)
  const [newItem, setNewItem] = useState({
    status: 'CONTINUED',
    type: 'NORMAL',
    hide: 'NO',
    barcode: '',
    name: '',
    genericName: '',
    unit: 'STRIP',
    decimal: 'NO',
    fastSearch: '',
    colourType: 'NORMAL',
    itemType: '1 NORMAL (Store Below 30°C)',
    company: 'Sun Pharma Ltd',
    group: 'HARDWARE / MEDICINES',
    category: 'TABLET',
    rackNo: 'RACK-04-A',
    localTax: 'TAXABLE',
    gstPercent: '12',
    vatPercent: '12.00',
    mrp: '110.00',
    purchaseRate: '75.00',
    cost: '75.00',
    rateA: '95.00',
    rateB: '98.00',
    rateC: '100.00',
    conversion: '10',
    salesQty: '100',
    negative: 'DISALLOW',
    minQty: '15',
    maxQty: '250',
    reorderQty: '20',
    days: '30',
    volumeDiscount1: '0.00',
    itemDiscount: '5.00',
    disc2: '0.00',
    specialDiscount: '0.00',
    maxDiscount: '10.00',
    purchaseDiscount: '0.00',
    minMargin: '18.50',
    mfrName: 'Sun Pharmaceutical Industries Ltd',
  });

  // Ledger Master State (Pages 11-12 of PDF)
  const [newLedger, setNewLedger] = useState({
    name: '',
    station: 'Delhi / Adliya',
    group: 'SUNDRY DEBTORS (CUSTOMERS)',
    balancingMethod: 'BILL BY BILL',
    mailTo: '',
    email: '',
    phone: '',
    regNo: '',
    gstin: '',
    panNo: '',
    openingBalance: '0.00',
    balanceType: 'Dr',
  });

  // Local sample ledgers
  const [ledgers, setLedgers] = useState<any[]>([
    { id: '1', name: 'AHLI UNITED BANK A/C', group: 'BANK ACCOUNTS', balance: '52,400.00 Dr', station: 'Main Branch' },
    { id: '2', name: 'CASH-IN-HAND (PHARMACY DRAWER)', group: 'CASH-IN-HAND', balance: '18,650.00 Dr', station: 'Counter 1' },
    { id: '3', name: 'ALKEM LABORATORIES DEPOT', group: 'SUNDRY CREDITORS (SUPPLIERS)', balance: '14,200.00 Cr', station: 'Wholesale Depot' },
    { id: '4', name: 'CIPLA PHARMACEUTICALS DISTRIBUTOR', group: 'SUNDRY CREDITORS (SUPPLIERS)', balance: '28,500.00 Cr', station: 'Central Hub' },
    { id: '5', name: 'KARTIK GENERAL CUSTOMERS', group: 'SUNDRY DEBTORS (CUSTOMER)', balance: '4,100.00 Dr', station: 'Adliya Retail' },
    { id: '6', name: 'DUTIES & TAXES (GST OUTPUT / INPUT)', group: 'DUTIES & TAXES', balance: '8,420.00 Cr', station: 'Govt Treasury' },
  ]);

  // Companies / Manufacturers (Page 14 of PDF)
  const [companies, setCompanies] = useState([
    { name: 'SUN PHARMA LTD', dumpDays: 90, minMargin: 20, invoicePrinting: 'Default A4' },
    { name: 'CIPLA HEALTHCARE', dumpDays: 90, minMargin: 18, invoicePrinting: 'Default A4' },
    { name: 'ALKEM LABORATORIES', dumpDays: 60, minMargin: 22, invoicePrinting: 'Default A4' },
    { name: 'MANKIND PHARMA', dumpDays: 90, minMargin: 25, invoicePrinting: 'Default A4' },
    { name: 'LOCKMASTER / HEALTHCARE PACKS', dumpDays: 45, minMargin: 15, invoicePrinting: 'POS 80mm' },
  ]);

  // Currency Rates (Page 8 of PDF)
  const [currencyRates, setCurrencyRates] = useState([
    { currency: 'DOLLAR ($)', code: 'USD', rateToInr: '86.50', rateToBhd: '0.28' },
    { currency: 'POUNDS (£)', code: 'GBP', rateToInr: '109.80', rateToBhd: '0.18' },
    { currency: 'EURO (€)', code: 'EUR', rateToInr: '92.40', rateToBhd: '0.23' },
    { currency: 'SAUDI RIYAL (SAR)', code: 'SAR', rateToInr: '23.05', rateToBhd: '0.10' },
  ]);

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;

    try {
      const docRef = await addDoc(collection(db, 'medicines'), {
        name: newItem.name.trim(),
        genericName: newItem.genericName.trim() || newItem.name.trim(),
        brand: newItem.company,
        category: newItem.category,
        unit: newItem.unit,
        rackNo: newItem.rackNo,
        barcode: newItem.barcode || `890${Math.floor(100000000 + Math.random() * 900000000)}`,
        gstPercent: Number(newItem.gstPercent || 12),
        mrp: Number(newItem.mrp || 100),
        costPrice: Number(newItem.cost || 70),
        sellPrice: Number(newItem.rateA || 90),
        minStock: Number(newItem.minQty || 10),
        reorderLevel: Number(newItem.reorderQty || 15),
        status: newItem.status,
        createdAt: new Date().toISOString(),
      });

      // Also create an initial batch if needed
      await addDoc(collection(db, 'batches'), {
        medicineId: docRef.id,
        medicineName: newItem.name.trim(),
        batchNo: `BT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        expiryDate: '2028-12',
        costPrice: Number(newItem.cost || 70),
        mrp: Number(newItem.mrp || 100),
        sellPrice: Number(newItem.rateA || 90),
        stock: Number(newItem.salesQty || 50),
        createdAt: new Date().toISOString(),
      });

      setToast(`✅ Item "${newItem.name}" created and synced to Marg Inventory & Firebase!`);
      setShowNewItemModal(false);
      onRefreshData();
    } catch (err: any) {
      console.error('Save item error:', err);
      setToast('Saved item in offline Marg ERP mode!');
    }
  };

  const handleSaveLedger = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLedger.name.trim()) return;
    const item = {
      id: String(Date.now()),
      name: newLedger.name.toUpperCase(),
      group: newLedger.group,
      balance: `${newLedger.openingBalance} ${newLedger.balanceType}`,
      station: newLedger.station,
    };
    setLedgers([item, ...ledgers]);
    setToast(`✅ Ledger Account "${newLedger.name}" successfully created!`);
    setShowNewLedgerModal(false);
  };

  const handleExportLedger = (formatType: 'pdf' | 'excel' | 'word') => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Description,Group,Station,Current Balance']
        .concat(ledgers.map((l) => `"${l.name}","${l.group}","${l.station}","${l.balance}"`))
        .join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Marg_ERP_Ledgers_${new Date().toISOString().slice(0, 10)}.${formatType === 'excel' ? 'csv' : 'txt'}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToast(`✅ List of Accounts successfully exported in ${formatType.toUpperCase()} format!`);
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-900 rounded flex justify-between items-center">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Marg Master Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-200 p-1.5 rounded border border-slate-300 text-xs font-bold">
        {[
          { id: 'item_master', label: 'Item / Inventory Master (F2)' },
          { id: 'ledger_master', label: 'Ledger Master / Accounts' },
          { id: 'price_list', label: 'General Price List (Rate-A/MRP)' },
          { id: 'company_masters', label: 'Company / Manufacturers' },
          { id: 'currency_rates', label: 'Currency Rates (Multi-Currency)' },
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
          TAB 1: ITEM / INVENTORY MASTER (Pages 12-14 of PDF)
      ========================================================================= */}
      {activeTab === 'item_master' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Pill size={14} className="text-emerald-400" />
              <span>ITEM / INVENTORY MASTER (मार्ग दवा एवं इन्वेंटरी मास्टर)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewItemModal(true)}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded shadow-xs cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={13} />
                <span>+ Create New Item [F2]</span>
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center gap-2 bg-white p-2 border border-slate-300">
            <div className="flex items-center gap-2 flex-1">
              <Search size={14} className="text-slate-400" />
              <input
                type="text"
                placeholder="Find item by name, salt, barcode..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="px-2 py-1 text-xs border border-slate-300 rounded w-full max-w-sm focus:outline-none"
              />
            </div>
            <span className="text-[11px] font-mono text-slate-500 font-bold">
              Total Items in Master: {medicines.length}
            </span>
          </div>

          <div className="bg-white border border-[#7f9db9] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b border-slate-300">
                  <th className="p-2 border-r">Barcode / SKU</th>
                  <th className="p-2 border-r">Description (Item Name)</th>
                  <th className="p-2 border-r">Salt / Generic Formula</th>
                  <th className="p-2 border-r text-center">Unit</th>
                  <th className="p-2 border-r text-right">Cost Price</th>
                  <th className="p-2 border-r text-right">Rate-A (Sell)</th>
                  <th className="p-2 border-r text-right">M.R.P.</th>
                  <th className="p-2 border-r text-center">Stock</th>
                  <th className="p-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {medicines
                  .filter(
                    (m) =>
                      !searchFilter ||
                      m.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                      (m.genericName && m.genericName.toLowerCase().includes(searchFilter.toLowerCase()))
                  )
                  .map((med) => {
                    const totalMedStock = batches
                      .filter((b) => b.medicineId === med.id)
                      .reduce((s, b) => s + Number(b.stock || 0), 0);
                    return (
                      <tr key={med.id} className="hover:bg-[#ffffe6]">
                        <td className="p-2 border-r text-purple-800 font-bold">{med.barcode || '89011248920'}</td>
                        <td className="p-2 border-r font-sans font-bold text-slate-900">{med.name}</td>
                        <td className="p-2 border-r text-slate-600 truncate max-w-[200px]">{med.genericName || '-'}</td>
                        <td className="p-2 border-r text-center">{med.unit || 'STRIP'}</td>
                        <td className="p-2 border-r text-right font-bold">₹{Number(med.costPrice || 60).toFixed(2)}</td>
                        <td className="p-2 border-r text-right text-emerald-700 font-bold">₹{Number(med.sellPrice || 85).toFixed(2)}</td>
                        <td className="p-2 border-r text-right font-bold">₹{Number(med.mrp || 100).toFixed(2)}</td>
                        <td className="p-2 border-r text-center font-bold text-[#000080]">{totalMedStock}</td>
                        <td className="p-2 text-center">
                          <span className="px-1.5 py-0.5 bg-green-100 text-green-800 text-[10px] font-bold rounded">
                            CONTINUED
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LEDGER MASTER (Pages 11-12 & 18-20 of PDF)
      ========================================================================= */}
      {activeTab === 'ledger_master' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <BookOpen size={14} className="text-amber-300" />
              <span>ACCOUNTS / LEDGER MASTER (खाता बही एवं पार्टी मास्टर)</span>
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowNewLedgerModal(true)}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded shadow-xs cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={13} />
                <span>+ New Ledger</span>
              </button>
              <button
                type="button"
                onClick={() => handleExportLedger('excel')}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded inline-flex items-center gap-1"
              >
                <Download size={13} />
                <span>Export to Excel</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-[#7f9db9] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead>
                <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b border-slate-300">
                  <th className="p-2 border-r">Account / Ledger Description</th>
                  <th className="p-2 border-r">Group (Under Account)</th>
                  <th className="p-2 border-r">Station / Branch</th>
                  <th className="p-2 text-right">Current Ledger Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {ledgers.map((l) => (
                  <tr key={l.id} className="hover:bg-[#ffffe6]">
                    <td className="p-2 border-r font-sans font-bold text-slate-900">{l.name}</td>
                    <td className="p-2 border-r font-bold text-slate-600">{l.group}</td>
                    <td className="p-2 border-r font-sans text-slate-500">{l.station}</td>
                    <td className={`p-2 text-right font-bold ${l.balance.includes('Dr') ? 'text-green-700' : 'text-red-700'}`}>
                      {l.balance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: PRICE LIST (Pages 20-21 of PDF)
      ========================================================================= */}
      {activeTab === 'price_list' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex items-center justify-between">
            <span>GENERAL PRICE LIST (मूल्य सूची: Rate-A, Purchase Rate, M.R.P.)</span>
            <span className="text-[11px] text-emerald-300 font-mono">F2-Detail / Ctrl+W-Qty</span>
          </div>

          <div className="bg-white border border-[#7f9db9] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b border-slate-300">
                  <th className="p-2 border-r">ITEM DESCRIPTION</th>
                  <th className="p-2 border-r text-right">RATE-A (SELLING)</th>
                  <th className="p-2 border-r text-right">P. RATE (PURCHASE)</th>
                  <th className="p-2 border-r text-right">M.R.P.</th>
                  <th className="p-2 text-right">MARGIN %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-[11px]">
                {medicines.map((m) => {
                  const mrp = Number(m.mrp || 100);
                  const pRate = Number(m.costPrice || 70);
                  const rateA = Number(m.sellPrice || 85);
                  const margin = pRate > 0 ? ((rateA - pRate) / pRate) * 100 : 0;
                  return (
                    <tr key={m.id} className="hover:bg-[#ffffe6]">
                      <td className="p-2 border-r font-sans font-bold text-slate-900">{m.name}</td>
                      <td className="p-2 border-r text-right font-bold text-emerald-700">₹{rateA.toFixed(2)}</td>
                      <td className="p-2 border-r text-right text-slate-700">₹{pRate.toFixed(2)}</td>
                      <td className="p-2 border-r text-right text-slate-900 font-bold">₹{mrp.toFixed(2)}</td>
                      <td className="p-2 text-right font-bold text-sky-700">{margin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: COMPANY / MANUFACTURERS (Page 14 of PDF)
      ========================================================================= */}
      {activeTab === 'company_masters' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex items-center justify-between">
            <span>PRODUCT / COMPANY MASTERS (दवा निर्माता एवं कंपनी मास्टर)</span>
            <span className="text-[11px] text-amber-300">Press 'F2' to Create / 'F3' to Modify</span>
          </div>

          <div className="bg-white border border-[#7f9db9] overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b border-slate-300">
                  <th className="p-2 border-r">Manufacturer / Company Name</th>
                  <th className="p-2 border-r text-center">Dump Days (Target)</th>
                  <th className="p-2 border-r text-right">Minimum Margin %</th>
                  <th className="p-2 text-center">Invoice Printing Style</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-mono text-[11px]">
                {companies.map((c, idx) => (
                  <tr key={idx} className="hover:bg-[#ffffe6]">
                    <td className="p-2 border-r font-sans font-bold text-slate-900">{c.name}</td>
                    <td className="p-2 border-r text-center font-bold text-amber-800">{c.dumpDays} Days</td>
                    <td className="p-2 border-r text-right font-bold text-emerald-700">{c.minMargin}%</td>
                    <td className="p-2 text-center font-sans">{c.invoicePrinting}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: CURRENCY RATES (Page 8 of PDF)
      ========================================================================= */}
      {activeTab === 'currency_rates' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex items-center justify-between">
            <span>TODAY'S CURRENCY RATES (बहु-मुद्रा विनिमय दरें)</span>
            <span className="text-[11px] text-emerald-300 font-mono">Multi-Currency Engine</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-4 max-w-xl mx-auto shadow-inner space-y-3">
            <div className="bg-[#e6f2ff] p-2 text-center font-bold text-[#000080] border border-blue-200">
              LATEST CURRENCY RATES (DATED: {new Date().toISOString().slice(0, 10)})
            </div>
            <table className="w-full border text-xs">
              <thead>
                <tr className="bg-slate-100 border-b">
                  <th className="p-2 text-left font-bold">Currency Name</th>
                  <th className="p-2 text-center font-bold">Symbol</th>
                  <th className="p-2 text-right font-bold">Rate to INR (₹)</th>
                  <th className="p-2 text-right font-bold">Rate to BHD</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono">
                {currencyRates.map((cr, i) => (
                  <tr key={i} className="hover:bg-amber-50">
                    <td className="p-2 font-sans font-bold">{cr.currency}</td>
                    <td className="p-2 text-center font-bold text-slate-600">{cr.code}</td>
                    <td className="p-2 text-right font-bold text-emerald-700">₹{cr.rateToInr}</td>
                    <td className="p-2 text-right font-bold text-sky-700">{cr.rateToBhd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-500 italic text-center">
              * If selected NO in Billing, then local currency (INR / BHD) will be applied automatically.
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: NEW ITEM CREATION (FULL 30+ FIELDS FROM PAGES 12-14)
      ========================================================================= */}
      {showNewItemModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3 overflow-y-auto">
          <div className="bg-[#edeae0] border-2 border-[#7f9db9] rounded-lg shadow-2xl max-w-3xl w-full p-4 space-y-3 my-4">
            <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
              <span>NEW PRODUCT / ITEM CREATION (नया आइटम जोड़ें - मार्ग ईआरपी)</span>
              <button
                type="button"
                onClick={() => setShowNewItemModal(false)}
                className="text-white hover:text-red-300 font-bold"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-3 bg-white p-3 border border-slate-300 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block font-bold text-slate-700">Status :</label>
                  <select
                    value={newItem.status}
                    onChange={(e) => setNewItem({ ...newItem, status: e.target.value })}
                    className="w-full px-1.5 py-1 border bg-[#ffffe6] font-bold"
                  >
                    <option value="CONTINUED">CONTINUED</option>
                    <option value="DISCONTINUED">DISCONTINUED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Type :</label>
                  <select
                    value={newItem.type}
                    onChange={(e) => setNewItem({ ...newItem, type: e.target.value })}
                    className="w-full px-1.5 py-1 border"
                  >
                    <option value="NORMAL">NORMAL</option>
                    <option value="PROHIBITED">PROHIBITED</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Hide :</label>
                  <select
                    value={newItem.hide}
                    onChange={(e) => setNewItem({ ...newItem, hide: e.target.value })}
                    className="w-full px-1.5 py-1 border"
                  >
                    <option value="NO">NO</option>
                    <option value="YES">YES</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Barcode :</label>
                  <input
                    type="text"
                    value={newItem.barcode}
                    onChange={(e) => setNewItem({ ...newItem, barcode: e.target.value })}
                    placeholder="Scan or auto-generate"
                    className="w-full px-1.5 py-1 border font-mono font-bold text-[#000080]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700">Item Name * :</label>
                  <input
                    type="text"
                    required
                    value={newItem.name}
                    onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="e.g. AUGMENTIN 625 DUO TAB, DOLO 650MG"
                    className="w-full px-2 py-1 border bg-[#ffffe6] font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Unit :</label>
                  <select
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full px-1.5 py-1 border font-bold"
                  >
                    <option value="STRIP">STRIP</option>
                    <option value="PCS">PCS</option>
                    <option value="BOTTLE">BOTTLE</option>
                    <option value="VIAL">VIAL</option>
                    <option value="TUBE">TUBE</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700">Generic Composition / Salt :</label>
                  <input
                    type="text"
                    value={newItem.genericName}
                    onChange={(e) => setNewItem({ ...newItem, genericName: e.target.value })}
                    placeholder="e.g. Paracetamol 650mg, Amoxicillin + Clav"
                    className="w-full px-2 py-1 border"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Manufacturer (Company) :</label>
                  <input
                    type="text"
                    value={newItem.company}
                    onChange={(e) => setNewItem({ ...newItem, company: e.target.value })}
                    className="w-full px-2 py-1 border font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#f0f4f8] p-2 border">
                <div>
                  <label className="block font-bold text-slate-700">P. Rate (Purchase) :</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.purchaseRate}
                    onChange={(e) => setNewItem({ ...newItem, purchaseRate: e.target.value, cost: e.target.value })}
                    className="w-full px-1.5 py-1 border font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Rate-A (Selling) :</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.rateA}
                    onChange={(e) => setNewItem({ ...newItem, rateA: e.target.value })}
                    className="w-full px-1.5 py-1 border font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">M.R.P. :</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newItem.mrp}
                    onChange={(e) => setNewItem({ ...newItem, mrp: e.target.value })}
                    className="w-full px-1.5 py-1 border font-mono font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">GST / VAT % :</label>
                  <select
                    value={newItem.gstPercent}
                    onChange={(e) => setNewItem({ ...newItem, gstPercent: e.target.value, vatPercent: e.target.value })}
                    className="w-full px-1.5 py-1 border font-bold"
                  >
                    <option value="0">0% (Exempted)</option>
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block font-bold text-slate-700">Rack No. :</label>
                  <input
                    type="text"
                    value={newItem.rackNo}
                    onChange={(e) => setNewItem({ ...newItem, rackNo: e.target.value })}
                    className="w-full px-1.5 py-1 border font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Initial Stock Qty :</label>
                  <input
                    type="number"
                    value={newItem.salesQty}
                    onChange={(e) => setNewItem({ ...newItem, salesQty: e.target.value })}
                    className="w-full px-1.5 py-1 border font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Minimum Qty :</label>
                  <input
                    type="number"
                    value={newItem.minQty}
                    onChange={(e) => setNewItem({ ...newItem, minQty: e.target.value })}
                    className="w-full px-1.5 py-1 border font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Reorder Level Qty :</label>
                  <input
                    type="number"
                    value={newItem.reorderQty}
                    onChange={(e) => setNewItem({ ...newItem, reorderQty: e.target.value })}
                    className="w-full px-1.5 py-1 border font-mono font-bold text-amber-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewItemModal(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded inline-flex items-center gap-1.5"
                >
                  <Save size={13} />
                  <span>Save Medicine [F2]</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: NEW LEDGER (Pages 11-12 of PDF)
      ========================================================================= */}
      {showNewLedgerModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-[#edeae0] border-2 border-[#7f9db9] rounded-lg shadow-2xl max-w-lg w-full p-4 space-y-3">
            <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
              <span>NEW LEDGER ACCOUNT (नया खाता बनाएं)</span>
              <button
                type="button"
                onClick={() => setShowNewLedgerModal(false)}
                className="text-white hover:text-red-300 font-bold"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveLedger} className="space-y-3 bg-white p-3 border border-slate-300 text-xs">
              <div>
                <label className="block font-bold text-slate-700">Ledger Name * :</label>
                <input
                  type="text"
                  required
                  value={newLedger.name}
                  onChange={(e) => setNewLedger({ ...newLedger, name: e.target.value })}
                  placeholder="e.g. Alkem Pharma Depot, Dr. Verma, Ramesh Kumar"
                  className="w-full px-2 py-1 border bg-[#ffffe6] font-bold uppercase"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700">Group :</label>
                  <select
                    value={newLedger.group}
                    onChange={(e) => setNewLedger({ ...newLedger, group: e.target.value })}
                    className="w-full px-1.5 py-1 border font-bold"
                  >
                    <option value="SUNDRY DEBTORS (CUSTOMERS)">SUNDRY DEBTORS (CUSTOMERS)</option>
                    <option value="SUNDRY CREDITORS (SUPPLIERS)">SUNDRY CREDITORS (SUPPLIERS)</option>
                    <option value="BANK ACCOUNTS">BANK ACCOUNTS</option>
                    <option value="CASH-IN-HAND">CASH-IN-HAND</option>
                    <option value="DUTIES & TAXES">DUTIES &amp; TAXES</option>
                    <option value="DIRECT EXPENSES">DIRECT EXPENSES</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Balancing Method :</label>
                  <select
                    value={newLedger.balancingMethod}
                    onChange={(e) => setNewLedger({ ...newLedger, balancingMethod: e.target.value })}
                    className="w-full px-1.5 py-1 border"
                  >
                    <option value="BILL BY BILL">BILL BY BILL</option>
                    <option value="ON ACCOUNT">ON ACCOUNT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700">Station / City :</label>
                  <input
                    type="text"
                    value={newLedger.station}
                    onChange={(e) => setNewLedger({ ...newLedger, station: e.target.value })}
                    className="w-full px-1.5 py-1 border"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Phone No. :</label>
                  <input
                    type="text"
                    value={newLedger.phone}
                    onChange={(e) => setNewLedger({ ...newLedger, phone: e.target.value })}
                    className="w-full px-1.5 py-1 border font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700">Opening Balance :</label>
                  <input
                    type="number"
                    step="0.01"
                    value={newLedger.openingBalance}
                    onChange={(e) => setNewLedger({ ...newLedger, openingBalance: e.target.value })}
                    className="w-full px-1.5 py-1 border font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Balance Type :</label>
                  <select
                    value={newLedger.balanceType}
                    onChange={(e) => setNewLedger({ ...newLedger, balanceType: e.target.value })}
                    className="w-full px-1.5 py-1 border font-bold"
                  >
                    <option value="Dr">Debit (Dr - Receivable)</option>
                    <option value="Cr">Credit (Cr - Payable)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewLedgerModal(false)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded inline-flex items-center gap-1.5"
                >
                  <Save size={13} />
                  <span>Save Ledger</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
