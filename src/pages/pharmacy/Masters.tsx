import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import {
  Plus,
  Pencil,
  Trash2,
  Pill,
  Boxes,
  BookOpen,
  FolderTree,
  FileSpreadsheet,
  Upload,
  Download,
  ShoppingCart,
  CheckCircle2,
  X,
  Printer,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import {
  calculateMarginPercent,
  calculateSuggestedSellPrice,
  commitBatchCounter,
  getMarginColorClass,
  previewNextBatchNo,
} from '../../utils/invoiceNo';
import { logStaffActivity } from '../../utils/activityLogger';
import {
  commitPurchaseBillToFirestore,
  downloadSamplePurchaseBillExcel,
  ParsedPurchaseBill,
  ParsedPurchaseBillItem,
  parseSupplierPurchaseSpreadsheet,
} from '../../utils/purchaseBillExcel';
import { BatchDoc, MedicineMasterDoc } from './Stock';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';
import { printElementById } from '../../utils/printEngine';

type MasterTab = 'medicine' | 'batch' | 'ledger' | 'groups';

export const Masters: React.FC = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as MasterTab) || 'medicine';

  const [activeTab, setActiveTab] = useState<MasterTab>(initialTab);
  const [medicines, setMedicines] = useState<MedicineMasterDoc[]>([]);
  const [batches, setBatches] = useState<BatchDoc[]>([]);
  const [defaultMarginPercent, setDefaultMarginPercent] = useState(20);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Tab 1: Medicine Form
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medName, setMedName] = useState('');
  const [medBrand, setMedBrand] = useState('');
  const [medBarcode, setMedBarcode] = useState('');
  const [medGeneric, setMedGeneric] = useState('');
  const [medSchedule, setMedSchedule] = useState<'OTC' | 'H' | 'H1' | 'X'>('OTC');
  const [medGst, setMedGst] = useState<5 | 12 | 18>(12);
  const [medReorder, setMedReorder] = useState('10');
  const [savingMed, setSavingMed] = useState(false);

  // Tab 2: Batch Form
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchMedicineId, setBatchMedicineId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [batchBarcode, setBatchBarcode] = useState('');
  const [nextBatchCounter, setNextBatchCounter] = useState<number | null>(null);
  const [expiryDate, setExpiryDate] = useState('2027-12-31');
  const [costPrice, setCostPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stock, setStock] = useState('100');
  const [supplierName, setSupplierName] = useState('Chennai Pharma Distributors');
  const [savingBatch, setSavingBatch] = useState(false);
  const [importingFile, setImportingFile] = useState(false);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  // Marg Supplier Purchase Bill Excel Preview & Entry State
  const [purSupplierName, setPurSupplierName] = useState('Chennai Pharma Distributors');
  const [purBillNo, setPurBillNo] = useState(
    `PUR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`
  );
  const [purBillDate, setPurBillDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [parsedPurchaseBill, setParsedPurchaseBill] =
    useState<ParsedPurchaseBill | null>(null);
  const [directSaveOnUpload, setDirectSaveOnUpload] = useState(false);

  useEffect(() => {
    const paramTab = searchParams.get('tab') as MasterTab;
    if (paramTab && ['medicine', 'batch', 'ledger', 'groups'].includes(paramTab)) {
      setActiveTab(paramTab);
    }
  }, [searchParams]);

  const switchTab = (t: MasterTab) => {
    setActiveTab(t);
    setSearchParams({ tab: t });
  };

  const loadMasters = async () => {
    setLoading(true);
    try {
      const [medSnap, batchSnap, settingsSnap, nextBatch] = await Promise.all([
        getDocs(collection(db, 'medicines')),
        getDocs(collection(db, 'batches')),
        getDoc(doc(db, 'settings', 'clinic')),
        previewNextBatchNo(),
      ]);

      const medList: MedicineMasterDoc[] = medSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MedicineMasterDoc, 'id'>),
      }));
      medList.sort((a, b) => a.name.localeCompare(b.name));

      const batchList: BatchDoc[] = batchSnap.docs.map((b) => ({
        id: b.id,
        ...(b.data() as Omit<BatchDoc, 'id'>),
      }));
      batchList.sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));

      setMedicines(medList);
      setBatches(batchList);

      if (medList.length > 0 && !batchMedicineId) {
        setBatchMedicineId(medList[0].id);
      }

      if (!editingBatchId) {
        setBatchNo(nextBatch.batchNo);
        setNextBatchCounter(nextBatch.nextNumber);
      }

      if (settingsSnap.exists()) {
        const sData = settingsSnap.data();
        if (typeof sData.defaultMarginPercent === 'number') {
          setDefaultMarginPercent(sData.defaultMarginPercent);
        }
      }
    } catch (err) {
      console.error('Error loading Masters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  const handleCostChange = (val: string) => {
    setCostPrice(val);
    const numCost = Number(val);
    if (numCost > 0) {
      const suggested = calculateSuggestedSellPrice(numCost, defaultMarginPercent);
      setSellPrice(String(suggested));
      if (!mrp || Number(mrp) < suggested) {
        setMrp(String(Math.round(suggested * 1.15)));
      }
    }
  };

  const liveMargin = calculateMarginPercent(
    Number(costPrice) || 0,
    Number(sellPrice) || 0
  );

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    setToastMsg(null);
    if (!medName.trim()) return;

    setSavingMed(true);
    try {
      const payload = {
        name: medName.trim().slice(0, 150),
        brand: medBrand.trim().slice(0, 120) || 'Generic',
        barcode: (medBarcode.trim() || `890${Date.now().toString().slice(-9)}`).slice(0, 80),
        genericName: medGeneric.trim().slice(0, 150) || medName.trim().slice(0, 150),
        manufacturer: medBrand.trim().slice(0, 150) || 'Standard Pharma',
        hsnCode: '30049099',
        unit: 'strip' as const,
        gstPercent: medGst,
        schedule: medSchedule,
        scheduleType: medSchedule,
        reorderLevel: Math.max(0, Math.floor(Number(medReorder) || 10)),
      };

      if (editingMedId) {
        await updateDoc(doc(db, 'medicines', editingMedId), payload);
        await saveRecordToSql('medicines', editingMedId, payload);
        await logStaffActivity(
          'Updated Medicine Master',
          `${userProfile?.name || 'Staff'} updated medicine ${payload.name}`,
          userProfile?.name
        );
        setToastMsg(`Updated medicine: ${payload.name}`);
      } else {
        const ref = await addDoc(collection(db, 'medicines'), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        setBatchMedicineId(ref.id);
        await saveRecordToSql('medicines', ref.id, {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        await logStaffActivity(
          'Added Medicine Master',
          `${userProfile?.name || 'Staff'} added medicine ${payload.name} (Barcode: ${payload.barcode})`,
          userProfile?.name
        );
        setToastMsg(`Saved ${payload.name} (Barcode: ${payload.barcode}) to Medicine Master.`);
      }

      setEditingMedId(null);
      setMedName('');
      setMedBrand('');
      setMedBarcode('');
      setMedGeneric('');
      setMedReorder('10');
      await loadMasters();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'medicines');
    } finally {
      setSavingMed(false);
    }
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setToastMsg(null);
    const med = medicines.find((m) => m.id === batchMedicineId);
    if (!med || !batchNo.trim()) return;

    const numCost = Math.max(0, Number(costPrice) || 0);
    const numMrp = Math.max(0, Number(mrp) || 0);
    const numSell = Math.max(0, Number(sellPrice) || 0);
    const numStock = Math.max(0, Math.floor(Number(stock) || 0));
    const marginPercent = calculateMarginPercent(numCost, numSell);

    setSavingBatch(true);
    try {
      const payload = {
        medicineId: med.id,
        medicineName: med.name,
        batchNo: batchNo.trim().slice(0, 60),
        barcode: (
          batchBarcode.trim() ||
          (med as any).barcode ||
          batchNo.trim()
        ).slice(0, 80),
        expiryDate: expiryDate.trim().slice(0, 20),
        costPrice: numCost,
        mrp: numMrp,
        sellPrice: numSell,
        marginPercent,
        stock: numStock,
        supplierName: supplierName.trim().slice(0, 120),
        purchaseDate: new Date().toISOString().split('T')[0],
      };

      if (editingBatchId) {
        await updateDoc(doc(db, 'batches', editingBatchId), payload);
        await saveRecordToSql('batches', editingBatchId, payload);
        await logStaffActivity(
          'Updated Batch Master',
          `${userProfile?.name || 'Staff'} updated Batch ${payload.batchNo} (${med.name})`,
          userProfile?.name
        );
        setToastMsg(`Updated Batch ${payload.batchNo}.`);
      } else {
        const batchRef = await addDoc(collection(db, 'batches'), {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        await saveRecordToSql('batches', batchRef.id, {
          ...payload,
          createdAt: new Date().toISOString(),
        });
        if (nextBatchCounter) {
          await commitBatchCounter(nextBatchCounter);
        }
        await logStaffActivity(
          'Purchase / Batch Entry',
          `${userProfile?.name || 'Staff'} added Batch ${payload.batchNo} for ${med.name} (Qty: ${numStock}, Cost: ₹${numCost}, Sell: ₹${numSell})`,
          userProfile?.name
        );
        setToastMsg(
          `Saved Batch ${payload.batchNo} (Barcode: ${payload.barcode}) for ${med.name} (Margin: ${marginPercent.toFixed(
            2
          )}%).`
        );
      }

      setEditingBatchId(null);
      setBatchBarcode('');
      setCostPrice('');
      setMrp('');
      setSellPrice('');
      setStock('100');
      await loadMasters();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'batches');
    } finally {
      setSavingBatch(false);
    }
  };

  const handleExportMastersExcel = () => {
    const medSheet = medicines.map((m: any) => ({
      MedicineName: m.name,
      Brand: m.brand,
      Barcode: m.barcode || '',
      GenericName: m.genericName || '',
      Schedule: m.scheduleType || m.schedule || 'OTC',
      GSTPercent: m.gstPercent || 12,
      ReorderLevel: m.reorderLevel || 10,
    }));
    const batchSheet = batches.map((b: any) => ({
      MedicineName: b.medicineName,
      BatchNo: b.batchNo,
      Barcode: b.barcode || b.batchNo,
      ExpiryDate: b.expiryDate,
      CostPrice: b.costPrice,
      MRP: b.mrp,
      SellPrice: b.sellPrice,
      Stock: b.stock,
      Supplier: b.supplierName || '',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(medSheet),
      'Medicines'
    );
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(batchSheet),
      'Batches'
    );
    XLSX.writeFile(
      wb,
      `Dudrucs_Medicines_And_Batches_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const recalculateBillTotals = (
    bill: ParsedPurchaseBill,
    nextItems: ParsedPurchaseBillItem[]
  ): ParsedPurchaseBill => {
    const recalculated = nextItems.map((it) => {
      const qty = Math.max(1, Number(it.qty) || 1);
      const freeQty = Math.max(0, Number(it.freeQty) || 0);
      const costPrice = Math.max(0, Number(it.costPrice) || 0);
      const mrp = Math.max(costPrice, Number(it.mrp) || costPrice);
      const sellPrice = Math.max(0, Number(it.sellPrice) || mrp);
      const grossLine = qty * costPrice;
      const discAmt = (grossLine * (Number(it.discountPercent) || 0)) / 100;
      const lineTaxableAmount = Number(Math.max(0, grossLine - discAmt).toFixed(2));
      const lineGstAmount = Number(
        ((lineTaxableAmount * (Number(it.gstPercent) || 12)) / 100).toFixed(2)
      );
      const lineNetAmount = Number((lineTaxableAmount + lineGstAmount).toFixed(2));
      return {
        ...it,
        qty,
        freeQty,
        totalStockToAdd: qty + freeQty,
        costPrice,
        mrp,
        sellPrice,
        lineTaxableAmount,
        lineGstAmount,
        lineNetAmount,
      };
    });

    const totalTaxable = Number(
      recalculated.reduce((s, r) => s + r.lineTaxableAmount, 0).toFixed(2)
    );
    const totalGst = Number(
      recalculated.reduce((s, r) => s + r.lineGstAmount, 0).toFixed(2)
    );
    return {
      ...bill,
      items: recalculated,
      totalTaxable,
      totalGst,
      grandTotal: Number((totalTaxable + totalGst).toFixed(2)),
    };
  };

  const handleUpdatePreviewRow = (
    rowId: string,
    field: keyof ParsedPurchaseBillItem,
    value: any
  ) => {
    if (!parsedPurchaseBill) return;
    const nextItems = parsedPurchaseBill.items.map((it) =>
      it.rowId === rowId ? { ...it, [field]: value } : it
    );
    setParsedPurchaseBill(recalculateBillTotals(parsedPurchaseBill, nextItems));
  };

  const handleRemovePreviewRow = (rowId: string) => {
    if (!parsedPurchaseBill) return;
    const nextItems = parsedPurchaseBill.items.filter((it) => it.rowId !== rowId);
    if (nextItems.length === 0) {
      setParsedPurchaseBill(null);
      return;
    }
    setParsedPurchaseBill(recalculateBillTotals(parsedPurchaseBill, nextItems));
  };

  const handleCommitReviewedPurchaseBill = async (
    billToCommit?: ParsedPurchaseBill,
    redirectToSale = false
  ) => {
    const targetBill = billToCommit || parsedPurchaseBill;
    if (!targetBill || targetBill.items.length === 0) return;

    setImportingFile(true);
    setToastMsg(null);
    try {
      const finalBill: ParsedPurchaseBill = {
        ...targetBill,
        supplierName:
          purSupplierName.trim() || targetBill.supplierName || 'Wholesale Pharma Distributor',
        supplierBillNo: purBillNo.trim() || targetBill.supplierBillNo || 'PUR-BILL',
        billDate: purBillDate || targetBill.billDate,
      };

      const result = await commitPurchaseBillToFirestore(
        finalBill,
        userProfile?.name || 'Pharmacy Staff'
      );

      setParsedPurchaseBill(null);
      await loadMasters();

      setToastMsg(
        `Purchase Bill #${result.supplierBillNo} (${result.supplierName}) Saved! Added ${result.totalUnitsAdded} units across ${
          result.newBatchesCreated + result.existingBatchesUpdated
        } batch(es) (${result.newMedicinesCreated} new medicine(s), Bill Total: ₹${result.grandTotalValue.toFixed(
          2
        )}). Ready for Direct Sale Billing!`
      );

      if (redirectToSale) {
        navigate('/pharmacy/sale');
      }
    } catch (err: any) {
      setToastMsg(err?.message || 'Failed to save Purchase Bill to inventory.');
    } finally {
      setImportingFile(false);
    }
  };

  const handleImportSpreadsheetFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingFile(true);
    setToastMsg(null);
    try {
      const parsedBill = await parseSupplierPurchaseSpreadsheet(
        file,
        purSupplierName || 'Chennai Pharma Distributors',
        purBillNo || `PUR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
        defaultMarginPercent
      );

      if (parsedBill.items.length === 0) {
        setToastMsg(
          `No valid medicine rows found in "${file.name}". Download the Sample Distributor Purchase Bill (.XLSX) to check column headers.`
        );
        return;
      }

      setPurSupplierName(parsedBill.supplierName);
      setPurBillNo(parsedBill.supplierBillNo);
      setPurBillDate(parsedBill.billDate);

      if (directSaveOnUpload) {
        await handleCommitReviewedPurchaseBill(parsedBill, false);
      } else {
        setParsedPurchaseBill(parsedBill);
        setToastMsg(
          `Loaded ${parsedBill.items.length} medicine(s) from Distributor Purchase Bill "${file.name}" (Bill Total: ₹${parsedBill.grandTotal.toFixed(
            2
          )}). Review below & click "Save Purchase Bill to Stock" to start selling!`
        );
      }
    } catch (err: any) {
      setToastMsg(err?.message || 'Failed to parse Excel/CSV Purchase Bill.');
    } finally {
      setImportingFile(false);
      e.target.value = '';
    }
  };

  // Extract unique supplier ledgers from batches for Ledger Master tab
  const supplierLedgers = Array.from(
    new Set(
      batches
        .map((b) => b.supplierName)
        .filter(Boolean)
        .concat([
          'Chennai Pharma Distributors',
          'Apex Medico Agencies',
          'Sri Murugan Pharma',
        ])
    )
  );

  return (
    <div id="printable-pharmacy-masters" className="space-y-4">
      {/* Marg ERP Window Header */}
      <div className="bg-[#000080] text-white px-4 py-2 rounded-t flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-bold tracking-wider uppercase">
          MARG ERP MASTERS — SUPPLIER PURCHASE BILL IMPORT, INVENTORY &amp; BATCHES
        </span>
        <div className="no-print flex flex-wrap items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => switchTab('medicine')}
            className={`px-3 py-1 rounded font-bold inline-flex items-center gap-1 ${
              activeTab === 'medicine'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Pill size={13} />
            1. Medicine Master
          </button>
          <button
            type="button"
            onClick={() => switchTab('batch')}
            className={`px-3 py-1 rounded font-bold inline-flex items-center gap-1 ${
              activeTab === 'batch'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Boxes size={13} />
            2. Purchase Bill / Batch Entry
          </button>
          <button
            type="button"
            onClick={() => switchTab('ledger')}
            className={`px-3 py-1 rounded font-bold inline-flex items-center gap-1 ${
              activeTab === 'ledger'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <BookOpen size={13} />
            3. Ledger Master
          </button>
          <button
            type="button"
            onClick={() => switchTab('groups')}
            className={`px-3 py-1 rounded font-bold inline-flex items-center gap-1 ${
              activeTab === 'groups'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <FolderTree size={13} />
            4. Account Groups
          </button>
          <button
            type="button"
            onClick={() =>
              printElementById('printable-pharmacy-masters', {
                title: 'Dudrucs_Pharmacy_Masters_And_Batches',
              })
            }
            className="px-3 py-1 rounded font-bold inline-flex items-center gap-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950"
          >
            <Printer size={13} />
            Print Masters
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="no-print p-3 bg-green-50 border border-green-300 rounded text-xs font-semibold text-green-800 flex flex-wrap items-center justify-between gap-2">
          <span>{toastMsg}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                printElementById('printable-pharmacy-masters', {
                  title: 'Dudrucs_Pharmacy_Masters_And_Batches',
                })
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded shadow-2xs"
            >
              <Printer size={13} />
              Print Saved Data
            </button>
            <button
              type="button"
              onClick={() => navigate('/pharmacy/sale')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded shadow-2xs"
            >
              <ShoppingCart size={13} />
              Go to Sale Billing (Sell Imported Items) →
            </button>
          </div>
        </div>
      )}

      {/* Marg ERP Supplier Purchase Bill Excel (.xlsx / .csv) Import Bar */}
      <div className="bg-white border-2 border-[#000080] rounded-lg p-3.5 space-y-3 text-xs shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[#000080] font-bold">
            <FileSpreadsheet size={18} className="text-green-700 shrink-0" />
            <div>
              <span className="text-sm font-extrabold uppercase tracking-wide block">
                Marg ERP Supplier Purchase Bill Excel Import (.XLSX / .CSV)
              </span>
              <span className="text-[11px] text-slate-600 font-normal">
                Import wholesale distributor / medical shopkeeper purchase bills directly from Excel — auto-creates Medicines, FIFO Batches, PTR, MRP, GST &amp; Sale Rates for instant billing!
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleImportSpreadsheetFile}
              className="hidden"
            />
            <button
              type="button"
              disabled={importingFile}
              onClick={() => excelInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded shadow-xs"
            >
              <Upload size={14} />
              {importingFile
                ? 'Reading Purchase Bill...'
                : 'Import Purchase Bill Excel (.XLSX / .CSV)'}
            </button>

            <button
              type="button"
              onClick={downloadSamplePurchaseBillExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded shadow-xs"
              title="Download a realistic Marg ERP / Distributor Purchase Invoice Excel file to test importing"
            >
              <Download size={14} />
              Sample Distributor Purchase Bill (.XLSX)
            </button>

            <button
              type="button"
              onClick={handleExportMastersExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-green-700 hover:bg-green-800 text-white font-bold rounded"
            >
              <FileSpreadsheet size={14} />
              Export All Stock (.XLSX)
            </button>
          </div>
        </div>

        {/* Supplier Bill Header Metadata + Mode Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-200 items-end">
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Distributor / Supplier Name
            </label>
            <input
              type="text"
              value={purSupplierName}
              onChange={(e) => setPurSupplierName(e.target.value)}
              placeholder="e.g. Chennai Pharma Distributors"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-semibold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Supplier Purchase Bill / Challan No
            </label>
            <input
              type="text"
              value={purBillNo}
              onChange={(e) => setPurBillNo(e.target.value)}
              placeholder="e.g. CPD-GST-4092"
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
            />
          </div>
          <div>
            <label className="block font-bold text-slate-700 mb-1">
              Purchase Bill Date
            </label>
            <input
              type="date"
              value={purBillDate}
              onChange={(e) => setPurBillDate(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono"
            />
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-2 pb-1">
            <label className="inline-flex items-center gap-1.5 cursor-pointer select-none font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={directSaveOnUpload}
                onChange={(e) => setDirectSaveOnUpload(e.target.checked)}
                className="rounded border-slate-300 text-[#000080]"
              />
              <span>1-Click Direct Stock Save (Skip Preview)</span>
            </label>
          </div>
        </div>

        {/* Interactive Marg ERP Purchase Bill Preview Grid (when an Excel/CSV bill is loaded) */}
        {parsedPurchaseBill && (
          <div className="mt-3 border-2 border-emerald-600 rounded-lg overflow-hidden bg-emerald-50/30">
            <div className="bg-emerald-800 text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="font-extrabold uppercase tracking-wider text-xs block">
                  PURCHASE BILL PREVIEW: {parsedPurchaseBill.fileName} ({parsedPurchaseBill.items.length} ITEMS)
                </span>
                <span className="text-[11px] text-emerald-100">
                  Supplier: <strong>{purSupplierName}</strong> · Bill No:{' '}
                  <strong>{purBillNo}</strong> · Taxable: ₹
                  {parsedPurchaseBill.totalTaxable.toFixed(2)} · GST: ₹
                  {parsedPurchaseBill.totalGst.toFixed(2)} ·{' '}
                  <strong className="text-amber-300">
                    Net Bill Total: ₹{parsedPurchaseBill.grandTotal.toFixed(2)}
                  </strong>
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={importingFile}
                  onClick={() => handleCommitReviewedPurchaseBill(parsedPurchaseBill, false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded shadow"
                >
                  <CheckCircle2 size={14} />
                  {importingFile
                    ? 'Saving to Inventory...'
                    : 'Save Purchase Bill to Stock'}
                </button>
                <button
                  type="button"
                  disabled={importingFile}
                  onClick={() => handleCommitReviewedPurchaseBill(parsedPurchaseBill, true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-green-600 hover:bg-green-500 text-white font-extrabold rounded shadow"
                >
                  <ShoppingCart size={14} />
                  Save &amp; Open Sale Billing →
                </button>
                <button
                  type="button"
                  onClick={() => setParsedPurchaseBill(null)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded"
                >
                  <X size={13} />
                  Cancel
                </button>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-[11px] text-left border-collapse bg-white">
                <thead>
                  <tr className="bg-slate-900 text-white font-bold">
                    <th className="py-2 px-2">#</th>
                    <th className="py-2 px-2">Medicine / Item Name</th>
                    <th className="py-2 px-2">Company</th>
                    <th className="py-2 px-2">Batch No</th>
                    <th className="py-2 px-2">Expiry</th>
                    <th className="py-2 px-2 text-center">Pur. Qty</th>
                    <th className="py-2 px-2 text-center">Free</th>
                    <th className="py-2 px-2 text-right">P.Rate (PTR ₹)</th>
                    <th className="py-2 px-2 text-right">MRP (₹)</th>
                    <th className="py-2 px-2 text-right">Sale Rate (₹)</th>
                    <th className="py-2 px-2 text-center">GST%</th>
                    <th className="py-2 px-2 text-right">Net Amt (₹)</th>
                    <th className="py-2 px-2 text-center">Del</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {parsedPurchaseBill.items.map((item, idx) => (
                    <tr key={item.rowId} className="hover:bg-emerald-50/50">
                      <td className="py-1.5 px-2 font-mono text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={item.medicineName}
                          onChange={(e) =>
                            handleUpdatePreviewRow(
                              item.rowId,
                              'medicineName',
                              e.target.value
                            )
                          }
                          className="w-44 px-1.5 py-1 border border-slate-300 rounded font-bold text-slate-900"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={item.brand}
                          onChange={(e) =>
                            handleUpdatePreviewRow(item.rowId, 'brand', e.target.value)
                          }
                          className="w-28 px-1.5 py-1 border border-slate-300 rounded text-slate-700"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={item.batchNo}
                          onChange={(e) =>
                            handleUpdatePreviewRow(item.rowId, 'batchNo', e.target.value)
                          }
                          className="w-24 px-1.5 py-1 border border-slate-300 rounded font-mono font-bold"
                        />
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="date"
                          value={item.expiryDate}
                          onChange={(e) =>
                            handleUpdatePreviewRow(
                              item.rowId,
                              'expiryDate',
                              e.target.value
                            )
                          }
                          className="w-28 px-1 py-1 border border-slate-300 rounded font-mono"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) =>
                            handleUpdatePreviewRow(
                              item.rowId,
                              'qty',
                              Number(e.target.value)
                            )
                          }
                          className="w-16 px-1.5 py-1 border border-slate-300 rounded font-mono font-bold text-center"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          value={item.freeQty}
                          onChange={(e) =>
                            handleUpdatePreviewRow(
                              item.rowId,
                              'freeQty',
                              Number(e.target.value)
                            )
                          }
                          className="w-14 px-1.5 py-1 border border-slate-300 rounded font-mono text-center text-emerald-700 font-bold"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.costPrice}
                          onChange={(e) =>
                            handleUpdatePreviewRow(
                              item.rowId,
                              'costPrice',
                              Number(e.target.value)
                            )
                          }
                          className="w-20 px-1.5 py-1 border border-slate-300 rounded font-mono text-right"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.mrp}
                          onChange={(e) =>
                            handleUpdatePreviewRow(
                              item.rowId,
                              'mrp',
                              Number(e.target.value)
                            )
                          }
                          className="w-20 px-1.5 py-1 border border-slate-300 rounded font-mono text-right"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.sellPrice}
                          onChange={(e) =>
                            handleUpdatePreviewRow(
                              item.rowId,
                              'sellPrice',
                              Number(e.target.value)
                            )
                          }
                          className="w-20 px-1.5 py-1 border border-emerald-400 bg-emerald-50/40 rounded font-mono font-bold text-emerald-800 text-right"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center font-mono">
                        {item.gstPercent}%
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                        ₹{item.lineNetAmount.toFixed(2)}
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePreviewRow(item.rowId)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                          title="Remove row"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* TAB 1: MEDICINE MASTER */}
      {activeTab === 'medicine' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <form
            onSubmit={handleSaveMedicine}
            className="lg:col-span-4 bg-white border border-slate-300 rounded p-4 space-y-3 text-xs"
          >
            <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
              <h2 className="font-bold text-sm text-[#000080]">
                {editingMedId ? 'Modify Medicine Item' : 'Add New Medicine Master'}
              </h2>
              {editingMedId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingMedId(null);
                    setMedName('');
                    setMedBrand('');
                    setMedGeneric('');
                  }}
                  className="text-slate-500 underline"
                >
                  Cancel
                </button>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Item / Medicine Name *
              </label>
              <input
                type="text"
                required
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                placeholder="e.g. Dolo 650 Tablet"
                className="w-full px-2.5 py-2 border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Company / Brand *
              </label>
              <input
                type="text"
                required
                value={medBrand}
                onChange={(e) => setMedBrand(e.target.value)}
                placeholder="e.g. Micro Labs"
                className="w-full px-2.5 py-2 border border-slate-300 rounded"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Barcode (Scan or Auto-Generate)
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={medBarcode}
                  onChange={(e) => setMedBarcode(e.target.value)}
                  placeholder="e.g. 890123456789"
                  className="flex-1 px-2.5 py-2 border border-slate-300 rounded font-mono"
                />
                <button
                  type="button"
                  onClick={() =>
                    setMedBarcode(`890${Math.floor(100000000 + Math.random() * 900000000)}`)
                  }
                  className="px-2.5 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded font-bold text-[11px]"
                >
                  Auto
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Salt / Generic Composition
              </label>
              <input
                type="text"
                value={medGeneric}
                onChange={(e) => setMedGeneric(e.target.value)}
                placeholder="e.g. Paracetamol 650mg"
                className="w-full px-2.5 py-2 border border-slate-300 rounded"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Drug Schedule *
                </label>
                <select
                  value={medSchedule}
                  onChange={(e) =>
                    setMedSchedule(e.target.value as 'OTC' | 'H' | 'H1' | 'X')
                  }
                  className="w-full px-2 py-2 border border-slate-300 rounded bg-white font-mono"
                >
                  <option value="OTC">OTC</option>
                  <option value="H">Sch H</option>
                  <option value="H1">Sch H1</option>
                  <option value="X">Sch X</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  GST % *
                </label>
                <select
                  value={medGst}
                  onChange={(e) => setMedGst(Number(e.target.value) as 5 | 12 | 18)}
                  className="w-full px-2 py-2 border border-slate-300 rounded bg-white font-mono"
                >
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Reorder Lvl *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={medReorder}
                  onChange={(e) => setMedReorder(e.target.value)}
                  className="w-full px-2 py-2 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingMed}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded inline-flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              {savingMed ? 'Saving...' : 'Save Medicine Master'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-300 rounded overflow-hidden">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 flex items-center justify-between text-xs font-bold">
              <span>MEDICINE MASTER LIST ({medicines.length})</span>
              <button
                type="button"
                onClick={() => switchTab('batch')}
                className="text-[#000080] underline"
              >
                + Add Batch for Selected Medicine →
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#000080] text-white">
                    <th className="py-2 px-3">Medicine Name</th>
                    <th className="py-2 px-3">Brand</th>
                    <th className="py-2 px-3">Schedule</th>
                    <th className="py-2 px-3 text-right">Reorder Level</th>
                    <th className="py-2 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {medicines.map((m) => (
                    <tr key={m.id} className="hover:bg-blue-50/40 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {m.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{m.brand}</td>
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                        {m.scheduleType || (m as any).schedule || 'OTC'}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {m.reorderLevel}
                      </td>
                      <td className="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMedId(m.id);
                            setMedName(m.name);
                            setMedBrand(m.brand);
                            setMedBarcode((m as any).barcode || '');
                            setMedGeneric(m.genericName || '');
                            setMedSchedule(m.scheduleType || 'OTC');
                            setMedReorder(String(m.reorderLevel));
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold inline-flex items-center gap-1"
                        >
                          <Pencil size={12} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await deleteDoc(doc(db, 'medicines', m.id));
                              // Also delete any batches belonging to this medicine
                              const medBatches = batches.filter(
                                (b) => b.medicineId === m.id
                              );
                              for (const b of medBatches) {
                                await deleteDoc(doc(db, 'batches', b.id));
                              }
                              await logStaffActivity(
                                'DELETE_MEDICINE',
                                `${userProfile?.name || 'Staff'} deleted medicine ${m.name} and ${medBatches.length} linked batch(es)`
                              );
                              setToastMsg(
                                `Deleted medicine "${m.name}" and ${medBatches.length} linked batch(es).`
                              );
                              await loadMasters();
                            } catch (err) {
                              handleFirestoreError(
                                err,
                                OperationType.DELETE,
                                `medicines/${m.id}`
                              );
                            }
                          }}
                          className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold inline-flex items-center gap-1 shadow-2xs"
                          title="Delete Medicine & Linked Batches"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ADD BATCH / PURCHASE ENTRY */}
      {activeTab === 'batch' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <form
            onSubmit={handleSaveBatch}
            className="lg:col-span-4 bg-white border border-slate-300 rounded-xl p-4 space-y-3 text-xs shadow-xs"
          >
            <div className="border-b border-slate-200 pb-2 flex items-center justify-between">
              <h2 className="font-bold text-sm text-[#000080]">
                {editingBatchId
                  ? 'Modify Batch Entry'
                  : 'Add Batch / Purchase Entry'}
              </h2>
              {editingBatchId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingBatchId(null);
                    setBatchBarcode('');
                    setCostPrice('');
                    setMrp('');
                    setSellPrice('');
                  }}
                  className="text-slate-500 underline"
                >
                  Cancel
                </button>
              )}
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Select Medicine *
              </label>
              <select
                required
                value={batchMedicineId}
                onChange={(e) => setBatchMedicineId(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded bg-white font-semibold"
              >
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.brand})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Batch No *
                </label>
                <input
                  type="text"
                  required
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Barcode
                </label>
                <input
                  type="text"
                  value={batchBarcode}
                  onChange={(e) => setBatchBarcode(e.target.value)}
                  placeholder="Scan/Enter"
                  className="w-full px-2.5 py-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Expiry Date *
                </label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Cost (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={costPrice}
                  onChange={(e) => handleCostChange(e.target.value)}
                  placeholder="80"
                  className="w-full px-2 py-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  MRP (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={mrp}
                  onChange={(e) => setMrp(e.target.value)}
                  placeholder="120"
                  className="w-full px-2 py-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Sell Rate (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="110"
                  className="w-full px-2 py-2 border border-slate-300 rounded font-mono"
                />
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded flex items-center justify-between">
              <span className="text-slate-600 font-medium">
                Auto-Calculated Margin %:
              </span>
              <span className={`font-mono text-sm ${getMarginColorClass(liveMargin)}`}>
                {liveMargin.toFixed(2)}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Opening / Purchase Stock *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Supplier Ledger
                </label>
                <input
                  type="text"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  className="w-full px-2.5 py-2 border border-slate-300 rounded"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingBatch}
              className="w-full py-2.5 px-4 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded-lg inline-flex items-center justify-center gap-1.5"
            >
              <Plus size={14} />
              {savingBatch ? 'Saving Batch...' : 'Save Batch to Inventory'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
            <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
              <span>BATCH MASTER REGISTER ({batches.length} BATCHES)</span>
              <button
                type="button"
                onClick={async () => {
                  const todayStr = new Date().toISOString().split('T')[0];
                  const toDelete = batches.filter(
                    (b) => Number(b.stock) <= 0 || (b.expiryDate && b.expiryDate < todayStr)
                  );
                  if (toDelete.length === 0) {
                    setToastMsg('No expired or zero-stock batches found to clean up.');
                    return;
                  }
                  for (const b of toDelete) {
                    await deleteDoc(doc(db, 'batches', b.id));
                  }
                  await logStaffActivity(
                    'CLEANUP_BATCHES',
                    `Deleted ${toDelete.length} expired/zero-stock batches`
                  );
                  setToastMsg(
                    `Cleaned up ${toDelete.length} expired or zero-stock batch(es)!`
                  );
                  await loadMasters();
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-[11px] font-bold"
              >
                <Trash2 size={12} />
                Delete Expired / 0-Stock Batches
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#000080] text-white">
                    <th className="py-2 px-3">Medicine</th>
                    <th className="py-2 px-3">Batch No</th>
                    <th className="py-2 px-3">Expiry</th>
                    <th className="py-2 px-3 text-right">Cost</th>
                    <th className="py-2 px-3 text-right">MRP</th>
                    <th className="py-2 px-3 text-right">Sell Rate</th>
                    <th className="py-2 px-3 text-right">Margin %</th>
                    <th className="py-2 px-3 text-right">Stock</th>
                    <th className="py-2 px-3 text-right">Edit / Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {batches.map((b) => {
                    const mPct = calculateMarginPercent(b.costPrice, b.sellPrice);
                    return (
                      <tr key={b.id} className="hover:bg-blue-50/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {b.medicineName}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold">
                          {b.batchNo}
                        </td>
                        <td className="py-2.5 px-3 font-mono">{b.expiryDate}</td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          ₹{Number(b.costPrice).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono">
                          ₹{Number(b.mrp).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          ₹{Number(b.sellPrice).toFixed(2)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono ${getMarginColorClass(
                            mPct
                          )}`}
                        >
                          {mPct.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          {b.stock}
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingBatchId(b.id);
                              setBatchMedicineId(b.medicineId);
                              setBatchNo(b.batchNo);
                              setBatchBarcode((b as any).barcode || '');
                              setExpiryDate(b.expiryDate);
                              setCostPrice(String(b.costPrice));
                              setMrp(String(b.mrp));
                              setSellPrice(String(b.sellPrice));
                              setStock(String(b.stock));
                              setSupplierName(b.supplierName || '');
                            }}
                            className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg font-bold inline-flex items-center gap-1"
                            title="Edit Batch"
                          >
                            <Pencil size={12} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await deleteDoc(doc(db, 'batches', b.id));
                                await logStaffActivity(
                                  'DELETE_BATCH',
                                  `${userProfile?.name || 'Staff'} deleted Batch ${b.batchNo} (${b.medicineName})`
                                );
                                setToastMsg(
                                  `Deleted Batch ${b.batchNo} (${b.medicineName}) from inventory.`
                                );
                                await loadMasters();
                              } catch (err) {
                                handleFirestoreError(
                                  err,
                                  OperationType.DELETE,
                                  `batches/${b.id}`
                                );
                              }
                            }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold inline-flex items-center gap-1"
                            title="Delete Batch"
                          >
                            <Trash2 size={12} />
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LEDGER MASTER */}
      {activeTab === 'ledger' && (
        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
          <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 text-xs font-bold text-[#000080]">
            MARG ACCOUNTING LEDGER MASTER (SUPPLIERS, CASH &amp; UPI ACCOUNTS)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#000080] text-white">
                  <th className="py-2 px-4">Ledger Account Name</th>
                  <th className="py-2 px-4">Account Group</th>
                  <th className="py-2 px-4">Type</th>
                  <th className="py-2 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-blue-50/40">
                  <td className="py-2.5 px-4 font-bold text-slate-900">
                    CASH IN HAND (COUNTER)
                  </td>
                  <td className="py-2.5 px-4">Cash-in-Hand</td>
                  <td className="py-2.5 px-4 font-mono">Current Asset</td>
                  <td className="py-2.5 px-4 text-right text-green-700 font-semibold">
                    Active
                  </td>
                </tr>
                <tr className="hover:bg-blue-50/40">
                  <td className="py-2.5 px-4 font-bold text-slate-900">
                    DUDRUCS UPI SETTLEMENT BANK A/C
                  </td>
                  <td className="py-2.5 px-4">Bank Accounts</td>
                  <td className="py-2.5 px-4 font-mono">Current Asset</td>
                  <td className="py-2.5 px-4 text-right text-green-700 font-semibold">
                    Active
                  </td>
                </tr>
                <tr className="hover:bg-blue-50/40">
                  <td className="py-2.5 px-4 font-bold text-slate-900">
                    RETAIL GST SALES A/C
                  </td>
                  <td className="py-2.5 px-4">Sales Accounts</td>
                  <td className="py-2.5 px-4 font-mono">Revenue</td>
                  <td className="py-2.5 px-4 text-right text-green-700 font-semibold">
                    Active
                  </td>
                </tr>
                {supplierLedgers.map((sup) => (
                  <tr key={sup} className="hover:bg-blue-50/40">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                      {sup}
                    </td>
                    <td className="py-2.5 px-4">Sundry Creditors (Suppliers)</td>
                    <td className="py-2.5 px-4 font-mono">Current Liability</td>
                    <td className="py-2.5 px-4 text-right text-green-700 font-semibold">
                      Active
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ACCOUNT GROUPS */}
      {activeTab === 'groups' && (
        <div className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-xs">
          <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-300 text-xs font-bold text-[#000080]">
            MARG ERP STANDARD ACCOUNT GROUPS
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#000080] text-white">
                  <th className="py-2 px-4">Group Name</th>
                  <th className="py-2 px-4">Primary Classification</th>
                  <th className="py-2 px-4">Nature of Group</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {[
                  {
                    name: 'Sales Accounts',
                    primary: 'Trading Account',
                    nature: 'Revenue / Direct Income',
                  },
                  {
                    name: 'Purchase Accounts',
                    primary: 'Trading Account',
                    nature: 'Direct Expense (Batch Cost)',
                  },
                  {
                    name: 'Sundry Creditors (Suppliers)',
                    primary: 'Balance Sheet',
                    nature: 'Current Liabilities',
                  },
                  {
                    name: 'Sundry Debtors (Patients/Customers)',
                    primary: 'Balance Sheet',
                    nature: 'Current Assets',
                  },
                  {
                    name: 'Duties & Taxes (GST Output)',
                    primary: 'Balance Sheet',
                    nature: 'Current Liabilities',
                  },
                  {
                    name: 'Cash-in-Hand & UPI Bank Accounts',
                    primary: 'Balance Sheet',
                    nature: 'Liquid Current Assets',
                  },
                ].map((grp) => (
                  <tr key={grp.name} className="hover:bg-blue-50/40">
                    <td className="py-2.5 px-4 font-bold text-slate-900">
                      {grp.name}
                    </td>
                    <td className="py-2.5 px-4">{grp.primary}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">
                      {grp.nature}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
