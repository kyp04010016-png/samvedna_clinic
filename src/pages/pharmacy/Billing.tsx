import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import {
  Search,
  Plus,
  Trash2,
  QrCode,
  Banknote,
  CheckCircle2,
  TrendingUp,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { generateUPIQR, UPIQRResult } from '../../utils/upiQR';
import {
  commitInvoiceCounter,
  getMarginColorClass,
  previewNextInvoiceNo,
} from '../../utils/invoiceNo';
import { QRDisplay } from '../../components/QRDisplay';
import { InvoiceLineItem, InvoiceRecord, Receipt } from '../../components/Receipt';
import { ClinicSettingsDoc } from '../public/Home';
import { BatchDoc, MedicineMasterDoc } from './Stock';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';

interface CartLineItem extends InvoiceLineItem {
  maxStock: number;
  marginPercent: number;
}

export const Billing: React.FC = () => {
  const { firebaseUser, userProfile } = useAuth();

  const [medicines, setMedicines] = useState<MedicineMasterDoc[]>([]);
  const [batches, setBatches] = useState<BatchDoc[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Selected medicine & FIFO batch state
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>('');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [addQty, setAddQty] = useState<string>('1');

  const [cart, setCart] = useState<CartLineItem[]>([]);
  const [discountInput, setDiscountInput] = useState('0');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');

  const [clinicSettings, setClinicSettings] = useState<Partial<ClinicSettingsDoc>>({});
  const [qrResult, setQrResult] = useState<UPIQRResult | null>(null);
  const [pendingInvoicePreview, setPendingInvoicePreview] = useState<{
    invoiceNo: string;
    nextNumber: number;
  } | null>(null);

  const [completedInvoice, setCompletedInvoice] = useState<InvoiceRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadBillingInventory = async () => {
    try {
      const [medSnap, batchSnap, settingsSnap] = await Promise.all([
        getDocs(collection(db, 'medicines')),
        getDocs(collection(db, 'batches')),
        getDoc(doc(db, 'settings', 'clinic')),
      ]);

      const medList: MedicineMasterDoc[] = medSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MedicineMasterDoc, 'id'>),
      }));
      medList.sort((a, b) => a.name.localeCompare(b.name));

      const batchList: BatchDoc[] = batchSnap.docs
        .map((b) => ({
          id: b.id,
          ...(b.data() as Omit<BatchDoc, 'id'>),
        }))
        .filter((b) => Number(b.stock) > 0);
      // FIFO: sort by earliest expiryDate first
      batchList.sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));

      setMedicines(medList);
      setBatches(batchList);

      if (settingsSnap.exists()) {
        setClinicSettings(settingsSnap.data() as Partial<ClinicSettingsDoc>);
      }
    } catch (err) {
      console.error('Error loading pharmacy billing catalog:', err);
    }
  };

  useEffect(() => {
    loadBillingInventory();
  }, []);

  // Filter medicines that match search term
  const filteredMedicines = medicines.filter((m) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      (m.brand || '').toLowerCase().includes(q) ||
      (m.genericName || '').toLowerCase().includes(q)
    );
  });

  // Available FIFO batches for currently selected medicine
  const availableBatchesForSelected = batches
    .filter((b) => b.medicineId === selectedMedicineId && b.stock > 0)
    .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));

  const handleSelectMedicine = (med: MedicineMasterDoc) => {
    setErrorMsg(null);
    setSelectedMedicineId(med.id);
    const medBatches = batches
      .filter((b) => b.medicineId === med.id && b.stock > 0)
      .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));
    if (medBatches.length > 0) {
      // Automatically pick earliest expiry batch (FIFO)
      setSelectedBatchId(medBatches[0].id);
      setAddQty('1');
    } else {
      setSelectedBatchId('');
    }
  };

  const activeMedicine = medicines.find((m) => m.id === selectedMedicineId);
  const activeBatch = availableBatchesForSelected.find(
    (b) => b.id === selectedBatchId
  );

  const handleAddBatchToBill = () => {
    setErrorMsg(null);
    if (!activeMedicine || !activeBatch) {
      setErrorMsg('Please select a medicine with an available batch.');
      return;
    }

    const qtyNum = Math.max(1, parseInt(addQty, 10) || 1);
    if (qtyNum > activeBatch.stock) {
      setErrorMsg(
        `Insufficient stock in batch ${activeBatch.batchNo}. Available: ${activeBatch.stock}`
      );
      return;
    }

    setCart((prev) => {
      const existing = prev.find((i) => i.batchId === activeBatch.id);
      if (existing) {
        const nextQty = Math.min(existing.qty + qtyNum, activeBatch.stock);
        return prev.map((i) =>
          i.batchId === activeBatch.id
            ? {
                ...i,
                qty: nextQty,
                lineTotal: Number((nextQty * i.sellPrice).toFixed(2)),
              }
            : i
        );
      }
      return [
        ...prev,
        {
          medicineId: activeMedicine.id,
          medicineName: activeMedicine.name,
          batchId: activeBatch.id,
          batchNo: activeBatch.batchNo,
          qty: qtyNum,
          costPrice: Number(activeBatch.costPrice),
          sellPrice: Number(activeBatch.sellPrice),
          mrp: Number(activeBatch.mrp),
          gstPercent: Number(activeMedicine.gstPercent || 12),
          lineTotal: Number((qtyNum * Number(activeBatch.sellPrice)).toFixed(2)),
          maxStock: Number(activeBatch.stock),
          marginPercent: Number(activeBatch.marginPercent),
        },
      ];
    });
  };

  const handleCartQtyChange = (batchId: string, rawQty: string) => {
    const qty = Math.max(1, parseInt(rawQty, 10) || 1);
    setCart((prev) =>
      prev.map((item) => {
        if (item.batchId !== batchId) return item;
        const clampedQty = Math.min(qty, item.maxStock);
        return {
          ...item,
          qty: clampedQty,
          lineTotal: Number((clampedQty * item.sellPrice).toFixed(2)),
        };
      })
    );
  };

  const handleRemoveCartItem = (batchId: string) => {
    setCart((prev) => prev.filter((i) => i.batchId !== batchId));
  };

  // Marg-style Totals & Profit Calculations
  const subtotal = Number(
    cart.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
  );
  const totalDiscount = Math.max(
    0,
    Math.min(subtotal, Number(discountInput) || 0)
  );
  const totalGst = Number(
    cart
      .reduce((sum, item) => sum + (item.lineTotal * item.gstPercent) / 100, 0)
      .toFixed(2)
  );
  const grandTotal = Number(
    Math.max(0, subtotal - totalDiscount + totalGst).toFixed(2)
  );
  const totalCost = Number(
    cart.reduce((sum, item) => sum + item.costPrice * item.qty, 0).toFixed(2)
  );
  // IMPORTANT: GST is excluded from profit calculation because GST collected is paid to government.
  // grossProfit = (grandTotal - totalGst - totalCost) = sum((sellPrice - costPrice)*qty) - totalDiscount
  const estimatedProfit = Number(
    (grandTotal - totalGst - totalCost).toFixed(2)
  );

  const handleGenerateUpiQr = async () => {
    setErrorMsg(null);
    if (cart.length === 0) {
      setErrorMsg('Please add at least one medicine batch to the bill first.');
      return;
    }
    if (grandTotal <= 0) {
      setErrorMsg('Grand Total must be greater than ₹0.');
      return;
    }

    try {
      const nextPreview =
        pendingInvoicePreview || (await previewNextInvoiceNo());
      setPendingInvoicePreview(nextPreview);

      const qr = await generateUPIQR(grandTotal, nextPreview.invoiceNo);
      if (qr) {
        setQrResult(qr);
      }
    } catch (err: any) {
      setErrorMsg(
        err?.message || 'UPI ID not set by admin. Go to Admin > Settings.'
      );
    }
  };

  const handleRecordPayment = async (mode: 'upi' | 'cash') => {
    setErrorMsg(null);
    if (cart.length === 0) {
      setErrorMsg('Add medicines to the bill before confirming payment.');
      return;
    }

    // Validate stock for each batch
    for (const item of cart) {
      const liveBatch = batches.find((b) => b.id === item.batchId);
      if (!liveBatch || liveBatch.stock < item.qty) {
        setErrorMsg(
          `Insufficient stock for ${item.medicineName} (Batch ${item.batchNo}). Available: ${
            liveBatch?.stock ?? 0
          }`
        );
        return;
      }
    }

    setSaving(true);
    try {
      const nextPreview =
        pendingInvoicePreview || (await previewNextInvoiceNo());

      const invoicePayload: InvoiceRecord = {
        invoiceNo: nextPreview.invoiceNo,
        items: cart.map((c) => ({
          medicineId: c.medicineId,
          medicineName: c.medicineName,
          batchId: c.batchId,
          batchNo: c.batchNo,
          qty: c.qty,
          costPrice: c.costPrice,
          sellPrice: c.sellPrice,
          mrp: c.mrp,
          gstPercent: c.gstPercent,
          lineTotal: c.lineTotal,
        })),
        subtotal,
        totalDiscount,
        totalGst,
        grandTotal,
        totalCost,
        grossProfit: estimatedProfit,
        paymentStatus: 'paid',
        paymentMode: mode,
        staffId: firebaseUser?.uid || 'pharmacy_staff',
        staffName: userProfile?.name || firebaseUser?.email || 'Pharmacist',
        customerName: customerName.trim().slice(0, 120),
        customerPhone: customerPhone.trim().slice(0, 25),
        createdAt: new Date().toISOString(),
      };

      // 1. Save invoice to 'invoices'
      try {
        const invRef = await addDoc(collection(db, 'invoices'), invoicePayload);
        await saveRecordToSql('invoices', invRef.id, invoicePayload);
      } catch (invErr) {
        handleFirestoreError(invErr, OperationType.CREATE, 'invoices');
      }

      // 2. Decrement each batch stock
      for (const item of cart) {
        const liveBatch = batches.find((b) => b.id === item.batchId);
        if (liveBatch) {
          const newStock = Math.max(0, Number(liveBatch.stock) - item.qty);
          try {
            await updateDoc(doc(db, 'batches', item.batchId), {
              stock: newStock,
            });
            await saveRecordToSql('batches', item.batchId, {
              ...liveBatch,
              stock: newStock,
            });
          } catch (stockErr) {
            handleFirestoreError(
              stockErr,
              OperationType.UPDATE,
              `batches/${item.batchId}`
            );
          }
        }
      }

      // 3. Increment counters/invoice
      await commitInvoiceCounter(nextPreview.nextNumber);

      // 4. Show printable receipt & reset form
      setCompletedInvoice(invoicePayload);
      setCart([]);
      setDiscountInput('0');
      setCustomerName('');
      setCustomerPhone('');
      setQrResult(null);
      setPendingInvoicePreview(null);
      await loadBillingInventory();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save invoice.');
    } finally {
      setSaving(false);
    }
  };

  if (completedInvoice) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <div className="no-print p-4 bg-green-50 border border-green-200 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold text-green-800">
            <CheckCircle2 size={18} className="text-green-600" />
            <span>
              Invoice {completedInvoice.invoiceNo} saved! Net Profit Earned: ₹
              {completedInvoice.grossProfit.toFixed(2)}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCompletedInvoice(null)}
            className="px-3.5 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg"
          >
            New Pharmacy Bill
          </button>
        </div>

        <Receipt
          invoice={completedInvoice}
          clinicName={clinicSettings.clinicName}
          medicalName={clinicSettings.medicalName}
          clinicAddress={clinicSettings.clinicAddress}
          medicalPhone={clinicSettings.medicalPhone}
          onClose={() => setCompletedInvoice(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-green-700">
            Dudrucs Medical Store · Marg-Style FIFO Point of Sale
          </p>
          <h1 className="text-2xl font-bold text-slate-900">
            Pharmacy Billing, Batch Selector &amp; UPI QR
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/pharmacy/stock"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            Medicine Master &amp; Batches
          </Link>
          <Link
            to="/pharmacy/invoices"
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg whitespace-nowrap"
          >
            Past Invoices &amp; Profit
          </Link>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-xs font-medium text-red-700">
          {errorMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Medicine Search & FIFO Batch Selector */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search medicine by name, brand, or generic..."
              className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-100 rounded-lg">
            {filteredMedicines.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No matching medicines in Medicine Master.
              </div>
            ) : (
              filteredMedicines.map((med) => {
                const medBatches = batches.filter(
                  (b) => b.medicineId === med.id && b.stock > 0
                );
                const totalAvailable = medBatches.reduce(
                  (s, b) => s + Number(b.stock),
                  0
                );
                const isSelected = selectedMedicineId === med.id;
                return (
                  <div
                    key={med.id}
                    onClick={() => handleSelectMedicine(med)}
                    className={`p-3 cursor-pointer flex items-center justify-between gap-3 transition-colors ${
                      isSelected ? 'bg-green-50/80' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900">
                        {med.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {med.brand} · {med.genericName} · Sch {med.scheduleType} ·{' '}
                        {med.gstPercent}% GST
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`text-xs font-mono font-bold ${
                          totalAvailable > 0 ? 'text-green-700' : 'text-red-600'
                        }`}
                      >
                        {totalAvailable > 0
                          ? `${totalAvailable} in stock`
                          : 'Out of Stock'}
                      </span>
                      <p className="text-[10px] font-mono text-slate-400">
                        {medBatches.length} batch{medBatches.length === 1 ? '' : 'es'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* FIFO Batch Selection Box */}
          {activeMedicine && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-900">
                  Select Batch (FIFO: Earliest Expiry First)
                </p>
                <span className="text-[11px] font-mono text-slate-500">
                  GST: {activeMedicine.gstPercent}%
                </span>
              </div>

              {availableBatchesForSelected.length === 0 ? (
                <p className="text-xs text-red-600 font-medium">
                  No stock available for {activeMedicine.name}. Add a batch in Stock Management.
                </p>
              ) : (
                <>
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                  >
                    {availableBatchesForSelected.map((b, index) => (
                      <option key={b.id} value={b.id}>
                        {index === 0 ? '[FIFO] ' : ''}Batch {b.batchNo} · Exp:{' '}
                        {b.expiryDate} · Sell: ₹{b.sellPrice} · Stock: {b.stock}
                      </option>
                    ))}
                  </select>

                  {activeBatch && (
                    <div className="grid grid-cols-4 gap-2 text-center bg-white border border-slate-200 rounded-lg p-2.5 text-xs">
                      <div>
                        <p className="text-[10px] text-slate-400">MRP</p>
                        <p className="font-mono font-semibold text-slate-700">
                          ₹{Number(activeBatch.mrp).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Sell Price</p>
                        <p className="font-mono font-bold text-slate-900">
                          ₹{Number(activeBatch.sellPrice).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Margin %</p>
                        <p
                          className={`font-mono ${getMarginColorClass(
                            Number(activeBatch.marginPercent)
                          )}`}
                        >
                          {Number(activeBatch.marginPercent).toFixed(1)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-400">Batch Stock</p>
                        <p className="font-mono font-semibold text-slate-800">
                          {activeBatch.stock}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="number"
                      min={1}
                      max={activeBatch?.stock || 1}
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      className="w-20 px-3 py-2 text-xs font-mono text-center bg-white border border-slate-300 rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleAddBatchToBill}
                      className="flex-1 py-2 px-4 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5"
                    >
                      <Plus size={14} />
                      Add Batch to Bill
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Active Bill, Estimated Profit Box, & UPI QR */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">
                Current Pharmacy Bill
              </h2>

              {/* Marg-style Estimated Profit Box */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs">
                <TrendingUp size={14} className="text-green-700" />
                <span className="text-slate-600 font-medium">
                  Estimated Profit (Excl. GST):
                </span>
                <span
                  className={`font-mono tabular-nums font-bold ${
                    estimatedProfit >= 0 ? 'text-green-700' : 'text-red-600'
                  }`}
                >
                  ₹{estimatedProfit.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Customer Optional Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer / Patient Name (Optional)
                </label>
                <input
                  type="text"
                  maxLength={120}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Walk-in Customer"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Customer Phone (Optional)
                </label>
                <input
                  type="tel"
                  maxLength={20}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="98400 12345"
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-600"
                />
              </div>
            </div>

            {/* Bill Items Table */}
            {cart.length === 0 ? (
              <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg text-xs text-slate-500">
                Select a medicine on the left and click &ldquo;Add Batch to Bill&rdquo;.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <th className="py-2.5 px-3 font-semibold">Medicine</th>
                      <th className="py-2.5 px-3 font-semibold">Batch</th>
                      <th className="py-2.5 px-3 font-semibold text-center">Qty</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Sell Price</th>
                      <th className="py-2.5 px-3 font-semibold text-right">GST%</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item) => (
                      <tr key={item.batchId}>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {item.medicineName}
                          <p
                            className={`text-[10px] font-mono ${getMarginColorClass(
                              item.marginPercent
                            )}`}
                          >
                            Margin: {item.marginPercent.toFixed(1)}% · Profit: ₹
                            {((item.sellPrice - item.costPrice) * item.qty).toFixed(2)}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-700">
                          {item.batchNo}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <input
                            type="number"
                            min={1}
                            max={item.maxStock}
                            value={item.qty}
                            onChange={(e) =>
                              handleCartQtyChange(item.batchId, e.target.value)
                            }
                            className="w-16 px-2 py-1 text-center font-mono border border-slate-300 rounded-md"
                          />
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700">
                          ₹{item.sellPrice.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                          {item.gstPercent}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          ₹{item.lineTotal.toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleRemoveCartItem(item.batchId)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals Calculation */}
            <div className="border-t border-slate-200 pt-4 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-600">
                <span>Subtotal (Line Totals)</span>
                <span className="font-mono tabular-nums font-semibold">
                  ₹{subtotal.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Discount (₹)</span>
                <input
                  type="number"
                  min={0}
                  max={subtotal}
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  className="w-24 px-2.5 py-1 text-right font-mono border border-slate-300 rounded-md"
                />
              </div>

              <div className="flex items-center justify-between text-slate-600">
                <span>Total GST (Collected for Govt)</span>
                <span className="font-mono tabular-nums">
                  + ₹{totalGst.toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                <span>Grand Total Payable</span>
                <span className="font-mono tabular-nums text-green-700 text-xl">
                  ₹{grandTotal.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <button
                type="button"
                disabled={cart.length === 0 || saving}
                onClick={handleGenerateUpiQr}
                className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <QrCode size={15} />
                Generate UPI QR
              </button>

              <button
                type="button"
                disabled={cart.length === 0 || saving}
                onClick={() => handleRecordPayment('upi')}
                className="py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <CheckCircle2 size={15} />
                Payment Received (UPI)
              </button>

              <button
                type="button"
                disabled={cart.length === 0 || saving}
                onClick={() => handleRecordPayment('cash')}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 text-xs font-semibold rounded-lg inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
              >
                <Banknote size={15} />
                Payment Received (Cash)
              </button>
            </div>
          </div>

          {qrResult && pendingInvoicePreview && (
            <QRDisplay
              qrDataUrl={qrResult.qrDataUrl}
              upiId={qrResult.upiId}
              upiName={qrResult.upiName}
              amount={grandTotal}
              invoiceNo={pendingInvoicePreview.invoiceNo}
              saving={saving}
              onConfirmUpiPayment={() => handleRecordPayment('upi')}
              onClose={() => setQrResult(null)}
            />
          )}
        </div>
      </div>
    </div>
  );
};
