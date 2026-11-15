import React, { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { Plus, Pencil, Trash2, AlertTriangle, Package, Layers, Printer } from 'lucide-react';
import { db } from '../../firebase';
import {
  calculateMarginPercent,
  calculateSuggestedSellPrice,
  commitBatchCounter,
  getExpiryStatus,
  getMarginColorClass,
  previewNextBatchNo,
} from '../../utils/invoiceNo';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';
import { saveAutoSelfBackupAndSyncHost } from '../../utils/backupRestore';
import { printElementById } from '../../utils/printEngine';

export interface MedicineMasterDoc {
  id: string;
  name: string;
  brand: string;
  genericName: string;
  manufacturer: string;
  hsnCode: string;
  unit: 'tablet' | 'bottle' | 'strip';
  pack?: string;
  gstPercent: 5 | 12 | 18;
  scheduleType: 'OTC' | 'H' | 'H1' | 'X';
  reorderLevel: number;
  createdAt: string;
}

export interface BatchDoc {
  id: string;
  medicineId: string;
  medicineName: string;
  pack?: string;
  batchNo: string;
  expiryDate: string;
  costPrice: number;
  mrp: number;
  sellPrice: number;
  marginPercent: number;
  stock: number;
  purchasedQty?: number;
  soldQty?: number;
  supplierName: string;
  supplierBillNo?: string;
  purchaseDate: string;
  createdAt: string;
}

export const Stock: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'batches' | 'master'>('batches');
  const [medicines, setMedicines] = useState<MedicineMasterDoc[]>([]);
  const [batches, setBatches] = useState<BatchDoc[]>([]);
  const [defaultMarginPercent, setDefaultMarginPercent] = useState<number>(20);
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Medicine Master Form State
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medName, setMedName] = useState('');
  const [medBrand, setMedBrand] = useState('');
  const [medGeneric, setMedGeneric] = useState('');
  const [medManufacturer, setMedManufacturer] = useState('');
  const [medHsn, setMedHsn] = useState('30049099');
  const [medUnit, setMedUnit] = useState<'tablet' | 'bottle' | 'strip'>('strip');
  const [medGst, setMedGst] = useState<5 | 12 | 18>(12);
  const [medSchedule, setMedSchedule] = useState<'OTC' | 'H' | 'H1' | 'X'>('OTC');
  const [medReorder, setMedReorder] = useState('10');
  const [savingMed, setSavingMed] = useState(false);

  // Batch Form State
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [batchMedicineId, setBatchMedicineId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [nextBatchCounter, setNextBatchCounter] = useState<number | null>(null);
  const [expiryDate, setExpiryDate] = useState('2027-12-31');
  const [costPrice, setCostPrice] = useState('');
  const [mrp, setMrp] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [stock, setStock] = useState('100');
  const [supplierName, setSupplierName] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    () => new Date().toISOString().split('T')[0]
  );
  const [savingBatch, setSavingBatch] = useState(false);

  const loadAllInventory = async () => {
    setLoading(true);
    try {
      const [medSnap, batchSnap, settingsSnap, nextBatchInfo] = await Promise.all([
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
      // Sort batches by expiryDate ascending (FIFO order)
      batchList.sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));

      setMedicines(medList);
      setBatches(batchList);

      if (medList.length > 0 && !batchMedicineId) {
        setBatchMedicineId(medList[0].id);
      }

      if (!editingBatchId) {
        setBatchNo(nextBatchInfo.batchNo);
        setNextBatchCounter(nextBatchInfo.nextNumber);
      }

      if (settingsSnap.exists()) {
        const sData = settingsSnap.data();
        if (typeof sData.defaultMarginPercent === 'number') {
          setDefaultMarginPercent(sData.defaultMarginPercent);
        }
      }
    } catch (err) {
      console.error('Error loading Marg inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllInventory();
  }, []);

  // Auto-margin helper when costPrice changes
  const handleCostPriceChange = (val: string) => {
    setCostPrice(val);
    const numCost = Number(val);
    if (numCost > 0) {
      const suggested = calculateSuggestedSellPrice(numCost, defaultMarginPercent);
      setSellPrice(String(suggested));
      if (!mrp || Number(mrp) < suggested) {
        setMrp(String(Math.round(suggested * 1.1)));
      }
    }
  };

  const liveSuggestedSellPrice = calculateSuggestedSellPrice(
    Number(costPrice) || 0,
    defaultMarginPercent
  );
  const liveMarginPercent = calculateMarginPercent(
    Number(costPrice) || 0,
    Number(sellPrice) || 0
  );

  // Medicine Master Handlers
  const resetMedForm = () => {
    setEditingMedId(null);
    setMedName('');
    setMedBrand('');
    setMedGeneric('');
    setMedManufacturer('');
    setMedHsn('30049099');
    setMedUnit('strip');
    setMedGst(12);
    setMedSchedule('OTC');
    setMedReorder('10');
  };

  const handleEditMedicine = (m: MedicineMasterDoc) => {
    setActiveTab('master');
    setEditingMedId(m.id);
    setMedName(m.name);
    setMedBrand(m.brand || '');
    setMedGeneric(m.genericName || '');
    setMedManufacturer(m.manufacturer || '');
    setMedHsn(m.hsnCode || '30049099');
    setMedUnit(m.unit || 'strip');
    setMedGst((m.gstPercent as 5 | 12 | 18) || 12);
    setMedSchedule(m.scheduleType || 'OTC');
    setMedReorder(String(m.reorderLevel ?? 10));
  };

  const handleSaveMedicine = async (e: React.FormEvent) => {
    e.preventDefault();
    setToastMsg(null);
    if (!medName.trim()) return;

    setSavingMed(true);
    try {
      const basePayload = {
        name: medName.trim().slice(0, 150),
        brand: medBrand.trim().slice(0, 120),
        genericName: medGeneric.trim().slice(0, 150),
        manufacturer: medManufacturer.trim().slice(0, 150),
        hsnCode: medHsn.trim().slice(0, 30),
        unit: medUnit,
        gstPercent: Number(medGst) as 5 | 12 | 18,
        scheduleType: medSchedule,
        reorderLevel: Math.max(0, Math.floor(Number(medReorder) || 10)),
      };

      if (editingMedId) {
        await updateDoc(doc(db, 'medicines', editingMedId), basePayload);
        await saveRecordToSql('medicines', editingMedId, basePayload);
        setToastMsg(`Updated Medicine Master: ${basePayload.name}`);
      } else {
        const createdPayload = {
          ...basePayload,
          createdAt: new Date().toISOString(),
        };
        const ref = await addDoc(collection(db, 'medicines'), createdPayload);
        await saveRecordToSql('medicines', ref.id, createdPayload);
        setBatchMedicineId(ref.id);
        setToastMsg(`Added ${basePayload.name} to Medicine Master.`);
      }
      saveAutoSelfBackupAndSyncHost('Pharmacy Staff', 'MEDICINE_MASTER_SAVED').catch(() => {});
      resetMedForm();
      await loadAllInventory();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'medicines');
    } finally {
      setSavingMed(false);
    }
  };

  const handleDeleteMedicine = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'medicines', id));
      await loadAllInventory();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `medicines/${id}`);
    }
  };

  // Batch Handlers
  const resetBatchForm = async () => {
    setEditingBatchId(null);
    setCostPrice('');
    setMrp('');
    setSellPrice('');
    setStock('100');
    setSupplierName('');
    const nextB = await previewNextBatchNo();
    setBatchNo(nextB.batchNo);
    setNextBatchCounter(nextB.nextNumber);
  };

  const handleEditBatch = (b: BatchDoc) => {
    setActiveTab('batches');
    setEditingBatchId(b.id);
    setBatchMedicineId(b.medicineId);
    setBatchNo(b.batchNo);
    setExpiryDate(b.expiryDate);
    setCostPrice(String(b.costPrice));
    setMrp(String(b.mrp));
    setSellPrice(String(b.sellPrice));
    setStock(String(b.stock));
    setSupplierName(b.supplierName || '');
    setPurchaseDate(b.purchaseDate || new Date().toISOString().split('T')[0]);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setToastMsg(null);

    const selectedMed = medicines.find((m) => m.id === batchMedicineId);
    if (!selectedMed || !batchNo.trim() || !expiryDate) {
      setToastMsg('Please select a medicine from Medicine Master and enter Batch No & Expiry.');
      return;
    }

    const numCost = Math.max(0, Number(costPrice) || 0);
    const numMrp = Math.max(0, Number(mrp) || 0);
    const numSell = Math.max(0, Number(sellPrice) || 0);
    const numStock = Math.max(0, Math.floor(Number(stock) || 0));
    const computedMargin = calculateMarginPercent(numCost, numSell);

    setSavingBatch(true);
    try {
      const batchPayload = {
        medicineId: selectedMed.id,
        medicineName: selectedMed.name,
        pack: selectedMed.pack || '1*10',
        batchNo: batchNo.trim().slice(0, 60),
        batchNumber: batchNo.trim().slice(0, 60),
        expiryDate: expiryDate.trim().slice(0, 20),
        costPrice: numCost,
        mrp: numMrp,
        sellPrice: numSell,
        marginPercent: computedMargin,
        stock: numStock,
        stockQuantity: numStock,
        purchasedQty: numStock,
        supplierName: supplierName.trim().slice(0, 120),
        purchaseDate: purchaseDate.trim().slice(0, 20),
      };

      if (editingBatchId) {
        await updateDoc(doc(db, 'batches', editingBatchId), batchPayload);
        await saveRecordToSql('batches', editingBatchId, batchPayload);
        setToastMsg(`Updated Batch ${batchPayload.batchNo} for ${selectedMed.name}`);
      } else {
        const createdBatch = {
          ...batchPayload,
          soldQty: 0,
          createdAt: new Date().toISOString(),
        };
        const bRef = await addDoc(collection(db, 'batches'), createdBatch);
        await saveRecordToSql('batches', bRef.id, createdBatch);
        if (nextBatchCounter) {
          await commitBatchCounter(nextBatchCounter);
        }
        setToastMsg(
          `Added Batch ${batchPayload.batchNo} (${selectedMed.name}) with ${computedMargin.toFixed(
            2
          )}% margin.`
        );
      }

      saveAutoSelfBackupAndSyncHost('Pharmacy Staff', 'BATCH_INVENTORY_SAVED').catch(() => {});
      await resetBatchForm();
      await loadAllInventory();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'batches');
    } finally {
      setSavingBatch(false);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'batches', id));
      await loadAllInventory();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `batches/${id}`);
    }
  };

  // Compute total stock per medicine across all batches
  const totalStockByMedicine = new Map<string, number>();
  batches.forEach((b) => {
    totalStockByMedicine.set(
      b.medicineId,
      (totalStockByMedicine.get(b.medicineId) || 0) + Number(b.stock || 0)
    );
  });

  return (
    <div id="printable-pharmacy-stock" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-green-700">
            Dudrucs Medical Store · Marg-Style Inventory &amp; Batch Control
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Medicine Master &amp; FIFO Batch Tracking
          </h1>
        </div>

        {/* Segmented Control: Tab 1 (Medicine Master) | Tab 2 (Batches) + Print */}
        <div className="no-print flex flex-wrap items-center gap-2 self-start">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-200/80 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('master')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'master'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package size={14} />
              Tab 1: Medicine Master ({medicines.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('batches')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'batches'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers size={14} />
              Tab 2: Batches ({batches.length})
            </button>
          </div>
          <button
            type="button"
            onClick={() =>
              printElementById('printable-pharmacy-stock', {
                title: 'Dudrucs_Pharmacy_Stock_And_Batches',
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#000080] hover:bg-blue-900 text-white text-xs font-bold rounded-lg shadow-xs"
          >
            <Printer size={14} />
            Print Stock Report
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="no-print p-3.5 bg-green-50 border border-green-200 rounded-lg text-xs font-medium text-green-800 flex items-center justify-between gap-2">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() =>
              printElementById('printable-pharmacy-stock', {
                title: 'Dudrucs_Pharmacy_Stock_And_Batches',
              })
            }
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-700 hover:bg-green-800 text-white font-bold rounded"
          >
            <Printer size={12} />
            Print Saved Stock
          </button>
        </div>
      )}

      {/* TAB 1: MEDICINE MASTER */}
      {activeTab === 'master' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleSaveMedicine}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingMedId ? 'Edit Medicine Master' : 'Add Medicine to Master'}
              </h2>
              {editingMedId && (
                <button
                  type="button"
                  onClick={resetMedForm}
                  className="text-xs text-slate-500 underline"
                >
                  Cancel
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Medicine Trade Name *
              </label>
              <input
                type="text"
                required
                maxLength={150}
                value={medName}
                onChange={(e) => setMedName(e.target.value)}
                placeholder="e.g. Dolo 650 Tablet"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand *
                </label>
                <input
                  type="text"
                  required
                  maxLength={120}
                  value={medBrand}
                  onChange={(e) => setMedBrand(e.target.value)}
                  placeholder="Dolo"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Manufacturer *
                </label>
                <input
                  type="text"
                  required
                  maxLength={150}
                  value={medManufacturer}
                  onChange={(e) => setMedManufacturer(e.target.value)}
                  placeholder="Micro Labs"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Generic Composition *
              </label>
              <input
                type="text"
                required
                maxLength={150}
                value={medGeneric}
                onChange={(e) => setMedGeneric(e.target.value)}
                placeholder="Paracetamol 650mg"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  HSN Code *
                </label>
                <input
                  type="text"
                  required
                  maxLength={30}
                  value={medHsn}
                  onChange={(e) => setMedHsn(e.target.value)}
                  placeholder="30049099"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Unit Type *
                </label>
                <select
                  value={medUnit}
                  onChange={(e) =>
                    setMedUnit(e.target.value as 'tablet' | 'bottle' | 'strip')
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="strip">strip</option>
                  <option value="tablet">tablet</option>
                  <option value="bottle">bottle</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  GST % *
                </label>
                <select
                  value={medGst}
                  onChange={(e) => setMedGst(Number(e.target.value) as 5 | 12 | 18)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18%</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Schedule *
                </label>
                <select
                  value={medSchedule}
                  onChange={(e) =>
                    setMedSchedule(e.target.value as 'OTC' | 'H' | 'H1' | 'X')
                  }
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="OTC">OTC</option>
                  <option value="H">H</option>
                  <option value="H1">H1</option>
                  <option value="X">X</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reorder Lvl *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={medReorder}
                  onChange={(e) => setMedReorder(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingMed}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Plus size={15} />
              {savingMed
                ? 'Saving Master...'
                : editingMedId
                ? 'Update Medicine Master'
                : 'Add to Medicine Master'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                Medicine Master Catalog
              </h2>
              <span className="text-xs font-mono text-slate-500">
                {medicines.length} master items
              </span>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Loading Medicine Master...
              </div>
            ) : medicines.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No medicines in master catalog yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-3 px-4 font-semibold">Medicine &amp; Brand</th>
                      <th className="py-3 px-4 font-semibold">Generic &amp; Mfg</th>
                      <th className="py-3 px-4 font-semibold">Schedule · GST</th>
                      <th className="py-3 px-4 font-semibold text-right">Total Stock</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {medicines.map((m) => {
                      const totalStock = totalStockByMedicine.get(m.id) || 0;
                      const isBelowReorder = totalStock < (m.reorderLevel ?? 10);
                      return (
                        <tr key={m.id} className="hover:bg-slate-50">
                          <td className="py-3.5 px-4">
                            <p className="font-semibold text-slate-900">{m.name}</p>
                            <p className="text-slate-500">
                              {m.brand} · Unit: {m.unit} · HSN: {m.hsnCode}
                            </p>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="text-slate-800">{m.genericName}</p>
                            <p className="text-slate-500">{m.manufacturer}</p>
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            Sch {m.scheduleType} · {m.gstPercent}% GST
                          </td>
                          <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                            <span
                              className={
                                isBelowReorder
                                  ? 'text-red-600 font-bold'
                                  : 'text-slate-900 font-semibold'
                              }
                            >
                              {totalStock}
                            </span>
                            <span className="text-slate-400">
                              {' '}
                              / min {m.reorderLevel}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right space-x-2 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleEditMedicine(m)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium"
                            >
                              <Pencil size={13} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMedicine(m.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-md font-medium"
                            >
                              <Trash2 size={13} />
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: BATCHES (MARG-STYLE BATCH TRACKING) */}
      {activeTab === 'batches' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleSaveBatch}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                {editingBatchId ? 'Edit Batch' : 'Add New Batch'}
              </h2>
              {editingBatchId && (
                <button
                  type="button"
                  onClick={resetBatchForm}
                  className="text-xs text-slate-500 underline"
                >
                  Cancel
                </button>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Select Medicine (from Master) *
              </label>
              <select
                required
                value={batchMedicineId}
                onChange={(e) => setBatchMedicineId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.brand} · {m.gstPercent}% GST)
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Batch No *
                </label>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                  placeholder="B106"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Expiry Date *
                </label>
                <input
                  type="date"
                  required
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Cost Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={costPrice}
                  onChange={(e) => handleCostPriceChange(e.target.value)}
                  placeholder="80"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
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
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Sell Price (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  required
                  value={sellPrice}
                  onChange={(e) => setSellPrice(e.target.value)}
                  placeholder="110"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            {/* Auto-Margin Helper Box */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Live Margin % (on Sell Price):</span>
                <span
                  className={`font-mono tabular-nums ${getMarginColorClass(
                    liveMarginPercent
                  )}`}
                >
                  {liveMarginPercent.toFixed(2)}%
                </span>
              </div>
              {Number(costPrice) > 0 && (
                <div className="flex items-center justify-between text-slate-500">
                  <span>
                    Suggested Sell (+{defaultMarginPercent}% on cost):{' '}
                    <strong className="font-mono text-slate-800">
                      ₹{liveSuggestedSellPrice}
                    </strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setSellPrice(String(liveSuggestedSellPrice))}
                    className="text-green-700 font-semibold underline"
                  >
                    Apply ₹{liveSuggestedSellPrice}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Batch Stock Qty *
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="100"
                  className="w-full px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Supplier Name
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                  placeholder="Chennai Pharma"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={savingBatch || medicines.length === 0}
              className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <Plus size={15} />
              {savingBatch
                ? 'Saving Batch...'
                : editingBatchId
                ? 'Update Batch'
                : 'Add Batch to Inventory'}
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900">
                Active Batches (Sorted FIFO by Earliest Expiry)
              </h2>
              <div className="flex items-center gap-3 text-[11px] text-slate-500">
                <span>Yellow = Expiring ≤90d</span>
                <span>·</span>
                <span>Red = Expired / Stock &lt;10</span>
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Loading batches...
              </div>
            ) : batches.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No batches recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-3 px-3.5 font-semibold">Medicine</th>
                      <th className="py-3 px-3.5 font-semibold">Batch No</th>
                      <th className="py-3 px-3.5 font-semibold">Expiry</th>
                      <th className="py-3 px-3.5 font-semibold text-right">Cost</th>
                      <th className="py-3 px-3.5 font-semibold text-right">MRP</th>
                      <th className="py-3 px-3.5 font-semibold text-right">Sell Price</th>
                      <th className="py-3 px-3.5 font-semibold text-right">Margin %</th>
                      <th className="py-3 px-3.5 font-semibold text-right">Stock</th>
                      <th className="py-3 px-3.5 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batches.map((b) => {
                      const expInfo = getExpiryStatus(b.expiryDate);
                      const isLowStock = b.stock < 10;
                      const rowBg =
                        expInfo.status === 'expired'
                          ? 'bg-red-50/90 hover:bg-red-100/80'
                          : expInfo.status === 'expiring_soon'
                          ? 'bg-amber-50/90 hover:bg-amber-100/80'
                          : isLowStock
                          ? 'bg-red-50/50 hover:bg-red-50'
                          : 'hover:bg-slate-50';

                      return (
                        <tr key={b.id} className={rowBg}>
                          <td className="py-3 px-3.5 font-semibold text-slate-900">
                            {b.medicineName}
                            {b.supplierName && (
                              <p className="text-[11px] font-normal text-slate-500">
                                {b.supplierName}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3.5 font-mono font-semibold text-slate-800">
                            {b.batchNo}
                          </td>
                          <td className="py-3 px-3.5 font-mono">
                            <span
                              className={
                                expInfo.status === 'expired'
                                  ? 'text-red-700 font-bold'
                                  : expInfo.status === 'expiring_soon'
                                  ? 'text-amber-800 font-semibold'
                                  : 'text-slate-700'
                              }
                            >
                              {b.expiryDate}
                            </span>
                            {expInfo.status !== 'ok' && (
                              <p className="text-[10px] font-semibold">
                                {expInfo.status === 'expired'
                                  ? 'EXPIRED'
                                  : `${expInfo.daysLeft}d left`}
                              </p>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono tabular-nums text-slate-600">
                            ₹{Number(b.costPrice).toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono tabular-nums text-slate-600">
                            ₹{Number(b.mrp).toFixed(2)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                            ₹{Number(b.sellPrice).toFixed(2)}
                          </td>
                          <td
                            className={`py-3 px-3.5 text-right font-mono tabular-nums ${getMarginColorClass(
                              Number(b.marginPercent)
                            )}`}
                          >
                            {Number(b.marginPercent).toFixed(2)}%
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono tabular-nums font-bold">
                            <span
                              className={
                                isLowStock
                                  ? 'text-red-700 inline-flex items-center gap-1'
                                  : 'text-slate-900'
                              }
                            >
                              {isLowStock && <AlertTriangle size={12} />}
                              {b.stock}
                            </span>
                          </td>
                          <td className="py-3 px-3.5 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleEditBatch(b)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded font-medium"
                            >
                              <Pencil size={12} />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteBatch(b.id)}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded font-medium"
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
