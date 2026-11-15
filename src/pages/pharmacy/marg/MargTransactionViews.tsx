import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Plus,
  Save,
  Search,
  CheckCircle2,
  AlertTriangle,
  Truck,
  RotateCcw,
  ArrowRight,
  Layers,
  X,
  Printer,
  Trash2,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { printElementById } from '../../../utils/printEngine';
import {
  parseSupplierPurchaseSpreadsheet,
  downloadSamplePurchaseBillExcel,
} from '../../../utils/purchaseBillExcel';
import { saveRecordToSql } from '../../../utils/sqlSyncBridge';
import { saveAutoSelfBackupAndSyncHost } from '../../../utils/backupRestore';

interface MargTransactionViewsProps {
  medicines: any[];
  batches: any[];
  invoices: any[];
  subView?: string;
  onRefreshData: () => void;
}

interface PurchaseChallanRow {
  id: string;
  product: string;
  pack: string;
  batch: string;
  expiry: string;
  stri: number;
  tab: number;
  free: number;
  pRate: number;
  mrp: number;
  sRate: number;
  dis1: number;
  gstPct: number;
  hsnCode: string;
}

export const MargTransactionViews: React.FC<MargTransactionViewsProps> = ({
  medicines,
  batches,
  invoices,
  subView = 'purchase_challan',
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState(subView);
  const [toast, setToast] = useState<string | null>(null);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const excelInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (subView) {
      if (subView === 'purchase_register') {
        setActiveTab('purchase_challan');
      } else {
        setActiveTab(subView);
      }
    }
  }, [subView]);

  // 1. Purchase Order State (Multi-Medicine Editable Table)
  const [poSupplier, setPoSupplier] = useState('ALKEM PHARMA DISTRIBUTOR');
  const [poChallanNo, setPoChallanNo] = useState('OP-00001');
  const [poDate, setPoDate] = useState(new Date().toISOString().slice(0, 10));
  const [poType, setPoType] = useState('LP GST PURCHASE ORDER');
  const [poItems, setPoItems] = useState<
    { id: string; item: string; pack: string; batch: string; qty: number; pRate: number; disc: number; amount: number }[]
  >([
    { id: 'po-1', item: 'DOLO 650 MG TABLET', pack: '1*15', batch: 'DL2609', qty: 50, pRate: 22.5, disc: 5, amount: 1068.75 },
    { id: 'po-2', item: 'PAN D CAPSULE', pack: '1*15', batch: 'PD9912', qty: 30, pRate: 135.0, disc: 5, amount: 3847.5 },
    { id: 'po-3', item: 'AUGMENTIN 625 DUO TAB', pack: '1*10', batch: 'AG401', qty: 20, pRate: 162.0, disc: 0, amount: 3240.0 },
  ]);

  const handleUpdatePoRow = (idx: number, field: string, val: string | number) => {
    setPoItems((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, [field]: val };
        if (field === 'item') {
          const upper = String(val).toUpperCase();
          next.item = upper;
          const matched = batches.find((b) => (b.medicineName || '').toUpperCase() === upper.trim());
          if (matched) {
            next.pack = matched.pack || next.pack || '1*10';
            next.batch = matched.batchNo || next.batch;
            next.pRate = Number(matched.costPrice || next.pRate);
          }
        }
        next.amount = Number((Number(next.qty || 0) * Number(next.pRate || 0) * (1 - Number(next.disc || 0) / 100)).toFixed(2));
        return next;
      })
    );
  };

  const handleAddPoRow = () => {
    setPoItems((prev) => [
      ...prev,
      {
        id: `po-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        item: '',
        pack: '1*10',
        batch: `B${String(prev.length + 1).padStart(3, '0')}`,
        qty: 10,
        pRate: 25,
        disc: 0,
        amount: 250,
      },
    ]);
  };

  // 1B. Purchase Challan / Bill Entry State (Exact Match to PURCHASE_CHALLAN_ENTRY_85e82830.PNG)
  const [pcPartyName, setPcPartyName] = useState('ALKEM LABORATORIES LTD (DEPOT)');
  const [pcDate, setPcDate] = useState(new Date().toISOString().slice(0, 10));
  const [pcEntryNo, setPcEntryNo] = useState('PC-00108');
  const [pcPartyNo, setPcPartyNo] = useState('INV/ALK/8821');
  const [pcPartyDt, setPcPartyDt] = useState(new Date().toISOString().slice(0, 10));
  const [pcSelectedRowIdx, setPcSelectedRowIdx] = useState<number>(0);
  const [pcRows, setPcRows] = useState<PurchaseChallanRow[]>([
    {
      id: 'pc-1',
      product: 'DOLO 650MG TAB',
      pack: '1*15',
      batch: 'DL2609',
      expiry: '2028-06-30',
      stri: 20,
      tab: 0,
      free: 2,
      pRate: 22.5,
      mrp: 33.0,
      sRate: 29.5,
      dis1: 5,
      gstPct: 12,
      hsnCode: '30049099',
    },
    {
      id: 'pc-2',
      product: 'PAN D CAPSULE',
      pack: '1*15',
      batch: 'PD9912',
      expiry: '2028-03-31',
      stri: 10,
      tab: 0,
      free: 1,
      pRate: 135.0,
      mrp: 198.0,
      sRate: 175.0,
      dis1: 5,
      gstPct: 12,
      hsnCode: '30049039',
    },
  ]);

  // Quick Add Row state for Purchase Challan
  const [newPcProduct, setNewPcProduct] = useState('');
  const [newPcPack, setNewPcPack] = useState('1*10');
  const [newPcBatch, setNewPcBatch] = useState('');
  const [newPcExpiry, setNewPcExpiry] = useState('2028-12-31');
  const [newPcStri, setNewPcStri] = useState(10);
  const [newPcFree, setNewPcFree] = useState(0);
  const [newPcPRate, setNewPcPRate] = useState(45);
  const [newPcMrp, setNewPcMrp] = useState(65);
  const [newPcDis1, setNewPcDis1] = useState(0);

  const handleImportPurchaseExcelToGrid = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseSupplierPurchaseSpreadsheet(file);
      if (!parsed.items || parsed.items.length === 0) {
        setToast('⚠️ इस Excel फाइल में कोई मान्य दवा पंक्ति नहीं मिली।');
        e.target.value = '';
        return;
      }
      if (parsed.supplierName) {
        setPcPartyName(parsed.supplierName.toUpperCase());
      }
      if (parsed.supplierBillNo) {
        setPcPartyNo(parsed.supplierBillNo.toUpperCase());
      }
      const importedRows: PurchaseChallanRow[] = parsed.items.map((row, idx) => ({
        id: `pc-xl-${Date.now()}-${idx}`,
        product: row.medicineName.toUpperCase(),
        pack: row.pack || (row.packUnit === 'bottle' ? '1 BTL' : '1*10'),
        batch: row.batchNo.toUpperCase(),
        expiry: row.expiryDate || '2028-12-31',
        stri: Number(row.qty) || 1,
        tab: 0,
        free: Number(row.freeQty) || 0,
        pRate: Number(row.costPrice) || 10,
        mrp: Number(row.mrp) || Number(row.costPrice) * 1.35,
        sRate: Number(row.sellPrice || row.mrp) || Number(row.costPrice) * 1.25,
        dis1: Number(row.discountPercent) || 0,
        gstPct: Number(row.gstPercent) || 12,
        hsnCode: row.hsnCode || '30049099',
      }));
      setPcRows((prev) => [...prev, ...importedRows]);
      setPcSelectedRowIdx(pcRows.length);
      setToast(
        `✅ Excel से ${importedRows.length} दवाइयां सीधे Purchase ग्रिड में लोड हो गईं! आप किसी भी पंक्ति को एडिट कर सकते हैं या [Save & Add Stock F10] दबाएं।`
      );
    } catch (err: any) {
      setToast(`❌ Excel पढ़ने में त्रुटि: ${err?.message || 'Invalid file'}`);
    } finally {
      e.target.value = '';
    }
  };

  const handleUpdatePcRow = (idx: number, field: keyof PurchaseChallanRow, value: string | number) => {
    setPcRows((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const updated = { ...r, [field]: value };
        if (field === 'product') {
          const upperName = String(value).toUpperCase();
          updated.product = upperName;
          const matchedBatch = batches.find(
            (b) => (b.medicineName || '').toUpperCase() === upperName.trim()
          );
          if (matchedBatch) {
            updated.pack = matchedBatch.pack || updated.pack || '1*10';
            updated.batch = matchedBatch.batchNo || updated.batch;
            updated.expiry = matchedBatch.expiryDate || updated.expiry;
            updated.pRate = Number(matchedBatch.costPrice || updated.pRate);
            updated.mrp = Number(matchedBatch.mrp || matchedBatch.sellPrice || updated.mrp);
            updated.sRate = Number(matchedBatch.sellPrice || matchedBatch.mrp || updated.sRate);
          }
        }
        return updated;
      })
    );
  };

  const handleAddBlankPcRow = () => {
    const newRow: PurchaseChallanRow = {
      id: `pc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product: '',
      pack: '1*10',
      batch: `B${String(pcRows.length + 1).padStart(3, '0')}`,
      expiry: '2028-12-31',
      stri: 10,
      tab: 0,
      free: 0,
      pRate: 25,
      mrp: 35,
      sRate: 32,
      dis1: 0,
      gstPct: 12,
      hsnCode: '30049099',
    };
    setPcRows((prev) => [...prev, newRow]);
    setPcSelectedRowIdx(pcRows.length);
  };

  const handleAddPcRow = () => {
    if (!newPcProduct.trim()) {
      handleAddBlankPcRow();
      return;
    }
    const row: PurchaseChallanRow = {
      id: `pc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      product: newPcProduct.trim().toUpperCase(),
      pack: newPcPack.trim() || '1*10',
      batch: (newPcBatch.trim() || `B-${Math.floor(1000 + Math.random() * 9000)}`).toUpperCase(),
      expiry: newPcExpiry || '2028-12-31',
      stri: Number(newPcStri) || 1,
      tab: 0,
      free: Number(newPcFree) || 0,
      pRate: Number(newPcPRate) || 10,
      mrp: Number(newPcMrp) || Number(newPcPRate) * 1.35,
      sRate: Number(newPcMrp) || Number(newPcPRate) * 1.25,
      dis1: Number(newPcDis1) || 0,
      gstPct: 12,
      hsnCode: '30049099',
    };
    setPcRows((prev) => [...prev, row]);
    setPcSelectedRowIdx(pcRows.length);
    setNewPcProduct('');
    setNewPcBatch('');
    setToast(`✅ "${row.product}" चालान सूची में नीचे अगली लाइन में जोड़ा गया!`);
  };

  const handleSavePurchaseChallanToFirestore = async () => {
    const validRows = pcRows.filter((r) => r.product.trim().length > 0);
    if (validRows.length === 0) {
      setToast('⚠️ सेव करने से पहले कम से कम 1 दवा चालान में जोड़ें।');
      return;
    }
    setIsSavingPurchase(true);
    try {
      const nowIso = new Date().toISOString();
      const savedInvoiceItems: any[] = [];

      for (const row of validRows) {
        const cleanProduct = row.product.trim().toUpperCase();
        // Find or create medicine in Firestore
        const existingMed = medicines.find(
          (m) => (m.name || '').toLowerCase() === cleanProduct.toLowerCase()
        );
        let medId = existingMed?.id;
        const medPayload = {
          id: medId || `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: cleanProduct,
          genericName: existingMed?.genericName || cleanProduct,
          brand: pcPartyName || 'Standard Pharma',
          category: 'Tablet',
          manufacturer: pcPartyName || 'Standard Pharma',
          hsnCode: row.hsnCode || '30049099',
          gstPercent: row.gstPct || 12,
          gstPercentage: row.gstPct || 12,
          barcode: existingMed?.barcode || `890${Math.floor(1000000 + Math.random() * 9000000)}`,
          reorderLevel: 10,
          unit: 'strip',
          pack: row.pack || '1*10',
          packSize: row.pack || '1*10',
          scheduleType: 'OTC',
          createdAt: existingMed?.createdAt || nowIso,
          updatedAt: nowIso,
        };
        medId = medPayload.id;
        await setDoc(doc(db, 'medicines', medId), medPayload, { merge: true });
        await saveRecordToSql('medicines', medId, medPayload);

        // Find or create batch in Firestore
        const totalQtyToAdd = Number(row.stri || 0) + Number(row.free || 0);
        const existingBatch = batches.find(
          (b) =>
            (b.medicineId === medId ||
              (b.medicineName || '').toLowerCase() === cleanProduct.toLowerCase()) &&
            ((b.batchNo || b.batchNumber || '').toLowerCase() === row.batch.toLowerCase())
        );

        const costVal = Math.max(0.01, Number(row.pRate || 10));
        const mrpVal = Math.max(costVal, Number(row.mrp || costVal * 1.35));
        const sellVal = Math.max(costVal, Number(row.sRate || mrpVal));
        let finalBatchId = existingBatch?.id || `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

        if (existingBatch) {
          const prevStock = Number(existingBatch.stock ?? existingBatch.stockQuantity ?? 0);
          const prevPurchased = Number(existingBatch.purchasedQty ?? prevStock);
          const nextStock = Number((prevStock + totalQtyToAdd).toFixed(2));
          const updatedBatchPayload = {
            ...existingBatch,
            medicineId: medId,
            medicineName: cleanProduct,
            pack: row.pack || '1*10',
            batchNo: row.batch,
            batchNumber: row.batch,
            expiryDate: row.expiry || '2028-12-31',
            costPrice: costVal,
            mrp: mrpVal,
            sellPrice: sellVal,
            gstPercent: Number(row.gstPct || 12),
            stock: nextStock,
            stockQuantity: nextStock,
            purchasedQty: Number((prevPurchased + totalQtyToAdd).toFixed(2)),
            soldQty: Number(existingBatch.soldQty || 0),
            supplierName: `${pcPartyName} (Bill: ${pcPartyNo || pcEntryNo})`,
            supplierBillNo: pcPartyNo || pcEntryNo,
            challanNo: pcEntryNo,
            purchaseDate: pcDate,
            updatedAt: nowIso,
          };
          await setDoc(doc(db, 'batches', existingBatch.id), updatedBatchPayload);
          await saveRecordToSql('batches', existingBatch.id, updatedBatchPayload);
        } else {
          const newBatchPayload = {
            id: finalBatchId,
            medicineId: medId,
            medicineName: cleanProduct,
            pack: row.pack || '1*10',
            batchNo: row.batch,
            batchNumber: row.batch,
            expiryDate: row.expiry || '2028-12-31',
            costPrice: costVal,
            mrp: mrpVal,
            sellPrice: sellVal,
            gstPercent: Number(row.gstPct || 12),
            marginPercent: Number((((sellVal - costVal) / sellVal) * 100).toFixed(1)),
            stock: totalQtyToAdd,
            stockQuantity: totalQtyToAdd,
            purchasedQty: totalQtyToAdd,
            soldQty: 0,
            supplierName: `${pcPartyName} (Bill: ${pcPartyNo || pcEntryNo})`,
            supplierBillNo: pcPartyNo || pcEntryNo,
            challanNo: pcEntryNo,
            purchaseDate: pcDate,
            createdAt: nowIso,
            updatedAt: nowIso,
          };
          await setDoc(doc(db, 'batches', finalBatchId), newBatchPayload);
          await saveRecordToSql('batches', finalBatchId, newBatchPayload);
        }

        savedInvoiceItems.push({
          medicineId: medId,
          medicineName: cleanProduct,
          pack: row.pack || '1*10',
          batchId: finalBatchId,
          batchNo: row.batch,
          qty: totalQtyToAdd,
          costPrice: costVal,
          sellPrice: sellVal,
          mrp: mrpVal,
          gstPercent: Number(row.gstPct || 12),
          lineTotal: Number((row.stri * costVal * (1 - row.dis1 / 100)).toFixed(2)),
        });
      }

      // Also save Bill-Wise Purchase Invoice record in `invoices` so all medicines in this bill stay grouped together!
      const purInvId = `pur_${Date.now()}`;
      const purInvPayload = {
        id: purInvId,
        invoiceNo: `${activeTab === 'purchase_bill' ? 'PURC' : 'PC'}-${pcEntryNo}`,
        invoiceType: activeTab === 'purchase_bill' ? 'PURC' : 'PC',
        supplierBillNo: pcPartyNo || pcEntryNo,
        customerName: pcPartyName,
        customerPhone: '',
        items: savedInvoiceItems,
        subtotal: Number(pcValueOfGoods.toFixed(2)),
        totalDiscount: Number(pcTotalDiscount.toFixed(2)),
        totalGst: Number(pcTotalGst.toFixed(2)),
        grandTotal: Number(pcNetAmount.toFixed(2)),
        totalCost: Number(pcValueOfGoods.toFixed(2)),
        grossProfit: 0,
        totalProfit: 0,
        paymentStatus: 'paid',
        paymentMode: 'cash',
        staffId: 'pharmacy_staff',
        staffName: 'Pharmacy Staff',
        createdAt: nowIso,
      };
      await setDoc(doc(db, 'invoices', purInvId), purInvPayload).catch(() => {});
      await saveRecordToSql('invoices', purInvId, purInvPayload).catch(() => {});

      // Trigger automatic 3-tier backup
      await saveAutoSelfBackupAndSyncHost('Pharmacy Staff', 'purchase_challan_saved').catch(() => {});

      onRefreshData();
      setToast(
        `✅ Purchase Bill/Challan [${pcEntryNo}] (${pcPartyName}) में कुल ${validRows.length} दवाइयां बिल-वाइज डेटाबेस में सेव हो गईं, स्टॉक बढ़ गया और Auto-Backup अपडेट हो गया!`
      );
    } catch (err: any) {
      setToast(`❌ सेव करने में त्रुटि: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsSavingPurchase(false);
    }
  };

  // Calculations for Purchase Challan
  const pcValueOfGoods = pcRows.reduce((sum, r) => sum + r.stri * r.pRate, 0);
  const pcTotalDiscount = pcRows.reduce((sum, r) => sum + r.stri * r.pRate * (r.dis1 / 100), 0);
  const pcTaxable = pcValueOfGoods - pcTotalDiscount;
  const pcTotalGst = pcRows.reduce(
    (sum, r) => sum + r.stri * r.pRate * (1 - r.dis1 / 100) * (r.gstPct / 100),
    0
  );
  const pcNetAmount = pcTaxable + pcTotalGst;
  const activePcRow = pcRows[pcSelectedRowIdx] || pcRows[0] || null;

  // 2. Sales Order & Multi-Medicine Table (Used across Sales Order, Quotation, Delivery Challan, Sale Return, Purchase Return, Stock Transfer)
  const [showBillDetailModal, setShowBillDetailModal] = useState(false);
  const [soCustomer, setSoCustomer] = useState('PATNA MEDICAL AGENCY / PATIENT');
  const [soType, setSoType] = useState('CREDIT / RETAIL');
  const [soItems, setSoItems] = useState<
    { id: string; item: string; pack: string; batch: string; expiry: string; qty: number; mrp: number; disc: number; amount: number }[]
  >([
    { id: 'so-1', item: 'DOLO 650MG TAB', pack: '1*15', batch: 'DL2609', expiry: '2028-06-30', qty: 2, mrp: 33.0, disc: 0, amount: 66.0 },
    { id: 'so-2', item: 'PAN D CAPSULE', pack: '1*15', batch: 'PD9912', expiry: '2028-03-31', qty: 1, mrp: 198.0, disc: 0, amount: 198.0 },
  ]);

  const handleUpdateSoRow = (idx: number, field: string, val: string | number) => {
    setSoItems((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        const next = { ...r, [field]: val };
        if (field === 'item') {
          const upper = String(val).toUpperCase();
          next.item = upper;
          const matched = batches.find((b) => (b.medicineName || '').toUpperCase() === upper.trim());
          if (matched) {
            next.pack = matched.pack || next.pack || '1*10';
            next.batch = matched.batchNo || next.batch;
            next.expiry = matched.expiryDate || next.expiry;
            next.mrp = Number(matched.sellPrice || matched.mrp || next.mrp);
          }
        }
        next.amount = Number((Number(next.qty || 0) * Number(next.mrp || 0) * (1 - Number(next.disc || 0) / 100)).toFixed(2));
        return next;
      })
    );
  };

  const handleAddSoRow = () => {
    setSoItems((prev) => [
      ...prev,
      {
        id: `so-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        item: '',
        pack: '1*10',
        batch: `B${String(prev.length + 1).padStart(3, '0')}`,
        expiry: '2028-12-31',
        qty: 1,
        mrp: 30,
        disc: 0,
        amount: 30,
      },
    ]);
  };

  const handleSaveMultiMedicineVoucher = async (
    voucherType: string,
    voucherNo: string,
    partyName: string,
    rows: { item: string; pack?: string; batch?: string; expiry?: string; qty: number; mrp?: number; pRate?: number; amount: number }[],
    stockEffect: 'NONE' | 'ADD' | 'DEDUCT'
  ) => {
    const validRows = rows.filter((r) => r.item && r.item.trim().length > 0);
    if (validRows.length === 0) {
      setToast('⚠️ कृपया कम से कम 1 दवा का नाम दर्ज करें।');
      return;
    }
    try {
      const nowIso = new Date().toISOString();
      const invId = `vou_${Date.now()}`;
      const totalVal = validRows.reduce((s, r) => s + Number(r.amount || 0), 0);

      if (stockEffect !== 'NONE') {
        for (const r of validRows) {
          const cleanName = r.item.trim().toUpperCase();
          const matchedBatch = batches.find(
            (b) => (b.medicineName || '').toUpperCase() === cleanName
          );
          if (matchedBatch) {
            const prevStock = Number(matchedBatch.stock ?? matchedBatch.stockQuantity ?? 0);
            const delta = stockEffect === 'ADD' ? Number(r.qty || 0) : -Number(r.qty || 0);
            const nextStock = Math.max(0, Number((prevStock + delta).toFixed(2)));
            const updatedBatch = {
              ...matchedBatch,
              stock: nextStock,
              stockQuantity: nextStock,
              updatedAt: nowIso,
            };
            await setDoc(doc(db, 'batches', matchedBatch.id), updatedBatch).catch(() => {});
            await saveRecordToSql('batches', matchedBatch.id, updatedBatch).catch(() => {});
          }
        }
      }

      const payload = {
        id: invId,
        invoiceNo: `${voucherType}-${voucherNo}`,
        invoiceType: voucherType,
        customerName: partyName,
        customerPhone: '',
        items: validRows.map((r, i) => ({
          medicineId: `med_${i}`,
          medicineName: r.item.toUpperCase(),
          pack: r.pack || '1*10',
          batchId: `batch_${i}`,
          batchNo: r.batch || 'B001',
          qty: Number(r.qty || 1),
          costPrice: Number(r.pRate || r.mrp || 15),
          sellPrice: Number(r.mrp || r.pRate || 20),
          mrp: Number(r.mrp || r.pRate || 20),
          gstPercent: 12,
          lineTotal: Number(r.amount || 0),
        })),
        subtotal: Number(totalVal.toFixed(2)),
        totalDiscount: 0,
        totalGst: 0,
        grandTotal: Number(totalVal.toFixed(2)),
        totalCost: Number(totalVal.toFixed(2)),
        grossProfit: 0,
        totalProfit: 0,
        paymentStatus: 'paid',
        paymentMode: 'cash',
        staffId: 'pharmacy_staff',
        staffName: 'Pharmacy Staff',
        createdAt: nowIso,
      };
      await setDoc(doc(db, 'invoices', invId), payload).catch(() => {});
      await saveRecordToSql('invoices', invId, payload).catch(() => {});
      await saveAutoSelfBackupAndSyncHost('Pharmacy Staff', `${voucherType}_${voucherNo}`).catch(() => {});
      onRefreshData();
      setToast(
        `✅ ${voucherType} #${voucherNo} (${partyName}) में कुल ${validRows.length} दवाइयां बिल-वाइज सेव हो गईं और बैकअप अपडेट हो गया!`
      );
    } catch (err: any) {
      setToast(`❌ सेव करने में त्रुटि: ${err?.message || 'Error'}`);
    }
  };

  const [billDetail, setBillDetail] = useState({
    againstForm: 'FORM-C / RETAIL',
    dueDays: '30',
    form38No: 'NA',
    crDrNote: '0.00',
    orderNo: 'SO-2026-88',
    orderDate: '2026-11-02',
    transport: 'FAST TRACK LOGISTICS',
    goodsTo: 'Mr. Dawn / Branch Manager',
    delivery: 'Riffa / Adliya Medical Hub',
    grnNo: 'GRN-4491',
    cases: '4 CARTONS',
    mark: 'FRAGILE - PHARMACY DISPENSARY',
    terms: '30 DAYS NET CREDIT · 100% REPLACEMENT ON EXPIRY',
  });

  // 3. Sales Return / S/R Expiry (Page 30 of PDF)
  const [soOrderNo, setSoOrderNo] = useState('SO-2026-0109');
  const [srBillNo, setSrBillNo] = useState('DU-2026-0842');
  const [srBillDate, setSrBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [srReturnType, setSrReturnType] = useState<'cash_refund' | 'credit_note'>('credit_note');
  const [prDebitNoteNo, setPrDebitNoteNo] = useState('DN-2026-0041');

  // 4. Quotation & Delivery Challan (Pages 26-27 of PDF)
  const [quotationNo, setQuotationNo] = useState('QT-2026-0092');
  const [quotationType, setQuotationType] = useState('DISCOUNT');
  const [dcChallanNo, setDcChallanNo] = useState('DC-2026-0119');

  // 5. Store Stock Transfer (Page 38 of PDF)
  const [transferMemoNo, setTransferMemoNo] = useState('TR-2026-0054');
  const [transferFrom, setTransferFrom] = useState('Store 1 (Central Warehouse)');
  const [transferTo, setTransferTo] = useState('Store 2 (Hospital OPD Dispensary)');

  const calculatePoTotal = () => poItems.reduce((s, i) => s + i.amount, 0);
  const calculateSoTotal = () => soItems.reduce((s, i) => s + i.amount, 0);

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

      {/* Marg Transactions Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-200 p-1.5 rounded border border-slate-300 text-xs font-bold">
        {[
          { id: 'purchase_challan', label: '1. Purchase Challan Entry (माल प्राप्ति चालान)' },
          { id: 'purchase_bill', label: '2. Purchase Bill / Invoice' },
          { id: 'purchase_order', label: '3. Purchase Order (New)' },
          { id: 'purchase_return', label: '4. Purchase Return (Debit Note)' },
          { id: 'quotation', label: '5. Sales Quotation' },
          { id: 'sales_order', label: '6. Sales Order & Detail' },
          { id: 'delivery_challan', label: '7. Delivery Challan' },
          { id: 'sales_return', label: '8. Sale Return (S/R Expiry)' },
          { id: 'stock_transfer', label: '9. Store Stock Transfer' },
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
          VIEW 1: PURCHASE ORDER (Pages 22-23 of PDF)
      ========================================================================= */}
      {activeTab === 'purchase_order' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>PURCHASE ORDER [RETAIL / MULTI-MEDICINE INVENTORY ENTRY] (खरीद आदेश)</span>
            <span className="font-mono text-[11px] text-amber-300">Marg Order Management · {poItems.length} Medicines</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-3 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-[#f0f4f8] p-2 border">
              <div>
                <label className="block font-bold text-slate-700">Supplier Name :</label>
                <input
                  type="text"
                  value={poSupplier}
                  onChange={(e) => setPoSupplier(e.target.value)}
                  className="w-full px-2 py-1 border bg-[#ffffe6] font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Challan / Order No :</label>
                <input
                  type="text"
                  value={poChallanNo}
                  onChange={(e) => setPoChallanNo(e.target.value)}
                  className="w-full px-2 py-1 border font-bold text-[#000080]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Order Date :</label>
                <input
                  type="date"
                  value={poDate}
                  onChange={(e) => setPoDate(e.target.value)}
                  className="w-full px-2 py-1 border font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Tax Type :</label>
                <input
                  type="text"
                  value={poType}
                  onChange={(e) => setPoType(e.target.value)}
                  className="w-full px-2 py-1 border font-bold"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border text-left">
                <thead>
                  <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                    <th className="p-2 border-r w-8 text-center">#</th>
                    <th className="p-2 border-r">PRODUCT / MEDICINE NAME (दवा का नाम)</th>
                    <th className="p-2 border-r w-24">PACK</th>
                    <th className="p-2 border-r w-28">BATCH</th>
                    <th className="p-2 border-r text-center w-20">QTY</th>
                    <th className="p-2 border-r text-right w-24">P. RATE</th>
                    <th className="p-2 border-r text-right w-20">DISC %</th>
                    <th className="p-2 border-r text-right w-28">AMOUNT</th>
                    <th className="p-2 text-center w-12">DEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono text-[11px]">
                  {poItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-amber-50">
                      <td className="p-1.5 border-r text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-1 border-r font-bold">
                        <input
                          type="text"
                          list="marg-all-meds-list"
                          value={item.item}
                          onChange={(e) => handleUpdatePoRow(idx, 'item', e.target.value.toUpperCase())}
                          placeholder="Type medicine (e.g. DOLO 650 TABLET)..."
                          className="w-full px-1.5 py-0.5 border border-slate-300 bg-[#ffffe6] font-bold text-[#000080] focus:outline-none"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.pack}
                          onChange={(e) => handleUpdatePoRow(idx, 'pack', e.target.value)}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.batch}
                          onChange={(e) => handleUpdatePoRow(idx, 'batch', e.target.value.toUpperCase())}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold uppercase"
                        />
                      </td>
                      <td className="p-1 border-r text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => handleUpdatePoRow(idx, 'qty', Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-center font-bold"
                        />
                      </td>
                      <td className="p-1 border-r text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.pRate}
                          onChange={(e) => handleUpdatePoRow(idx, 'pRate', Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-right font-bold"
                        />
                      </td>
                      <td className="p-1 border-r text-right">
                        <input
                          type="number"
                          step="0.5"
                          value={item.disc}
                          onChange={(e) => handleUpdatePoRow(idx, 'disc', Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r text-right font-bold text-green-700">₹{item.amount.toFixed(2)}</td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => setPoItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="px-1.5 py-0.5 text-red-600 hover:bg-red-100 rounded font-bold cursor-pointer"
                          title="Remove medicine row"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f0f4f8] p-2 border">
              <button
                type="button"
                onClick={handleAddPoRow}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={13} />
                <span>+ नीचे अगली दवा जोड़ें (Add Next Medicine Row)</span>
              </button>
              <div className="font-bold text-slate-900">
                <span>Total Order Value ({poItems.length} Medicines) : </span>
                <span className="text-base text-[#000080]">₹{calculatePoTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() =>
                  handleSaveMultiMedicineVoucher('PURCHASE_ORDER', poChallanNo, poSupplier, poItems, 'NONE')
                }
                className="px-4 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={13} />
                <span>Save Multi-Medicine Purchase Order [F10]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared Datalist for Medicine Auto-Suggest across all transaction tables */}
      <datalist id="marg-all-meds-list">
        {medicines.map((m) => (
          <option key={m.id} value={m.name} />
        ))}
      </datalist>

      {/* =========================================================================
          VIEW 2: PURCHASE CHALLAN / BILL ENTRY (Exact Match to PURCHASE_CHALLAN_ENTRY_85e82830.PNG)
      ========================================================================= */}
      {(activeTab === 'purchase_challan' || activeTab === 'purchase_bill') && (
        <div className="border-2 border-[#4b6b66] bg-[#dce8cc] shadow-lg select-none font-mono text-xs overflow-hidden">
          {/* 1. Classic Marg Dark Slate-Teal Title Bar */}
          <div className="bg-[#4b6b66] text-white px-2.5 py-1 flex flex-wrap items-center justify-between gap-2 border-b border-[#2e4541]">
            <div className="flex items-center gap-2 font-bold tracking-wider text-xs sm:text-sm">
              <span className="text-amber-300">❖</span>
              <span>
                {activeTab === 'purchase_bill' ? 'PURCHASE BILL ENTRY' : 'PURCHASE CHALLAN ENTRY'}
              </span>
              <span className="text-[11px] font-normal text-emerald-200 hidden sm:inline">
                [MULTI-MEDICINE BILL-WISE INWARD · {pcRows.length} MEDICINES]
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleImportPurchaseExcelToGrid}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleAddBlankPcRow}
                className="px-2.5 py-0.5 bg-cyan-300 hover:bg-cyan-200 text-slate-950 font-black rounded shadow-2xs cursor-pointer inline-flex items-center gap-1"
                title="Add another medicine row below in this bill"
              >
                <Plus size={12} />
                <span>+ New Medicine Row</span>
              </button>
              <button
                type="button"
                onClick={() => excelInputRef.current?.click()}
                className="px-2.5 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded shadow-2xs cursor-pointer inline-flex items-center gap-1"
                title="Import Supplier Purchase Excel (.xlsx/.csv) directly into the Marg Grid"
              >
                <FileSpreadsheet size={12} />
                <span>Import Excel (.XLSX)</span>
              </button>
              <button
                type="button"
                onClick={downloadSamplePurchaseBillExcel}
                className="px-2 py-0.5 bg-[#33524d] hover:bg-[#233b37] text-emerald-100 border border-emerald-400/40 font-bold rounded cursor-pointer inline-flex items-center gap-1"
                title="Download Sample Purchase Excel Template"
              >
                <Download size={11} />
                <span>Sample Excel</span>
              </button>
              <button
                type="button"
                onClick={handleSavePurchaseChallanToFirestore}
                disabled={isSavingPurchase}
                className="px-2.5 py-0.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isSavingPurchase ? 'Saving...' : 'Save Bill & Add Stock [F10]'}
              </button>
            </div>
          </div>

          {/* 2. Authentic Marg Sage-Green Header Fields (#dce8cc) */}
          <div className="bg-[#dce8cc] px-3 py-2 border-b-2 border-[#6a8759] space-y-1.5 text-[12px] text-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-[260px]">
                <span className="font-bold whitespace-nowrap">Name :</span>
                <input
                  type="text"
                  value={pcPartyName}
                  onChange={(e) => setPcPartyName(e.target.value.toUpperCase())}
                  placeholder="SUPPLIER / DISTRIBUTOR NAME"
                  className="flex-1 bg-[#edf5e1] border border-[#6a8759] px-2 py-0.5 font-bold text-[#000080] focus:bg-[#ffffcc] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Date :</span>
                <input
                  type="date"
                  value={pcDate}
                  onChange={(e) => setPcDate(e.target.value)}
                  className="bg-[#edf5e1] border border-[#6a8759] px-2 py-0.5 font-bold text-[#000080] focus:bg-[#ffffcc] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold">Entry No.:</span>
                <input
                  type="text"
                  value={pcEntryNo}
                  onChange={(e) => setPcEntryNo(e.target.value)}
                  className="w-28 bg-[#edf5e1] border border-[#6a8759] px-2 py-0.5 font-bold text-[#000080] focus:bg-[#ffffcc] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">Party Bill No:</span>
                <input
                  type="text"
                  value={pcPartyNo}
                  onChange={(e) => setPcPartyNo(e.target.value)}
                  className="w-36 bg-black text-white border border-slate-700 px-2 py-0.5 font-bold focus:outline-none"
                />
                <span className="font-bold ml-2">Dt:</span>
                <input
                  type="date"
                  value={pcPartyDt}
                  onChange={(e) => setPcPartyDt(e.target.value)}
                  className="bg-[#edf5e1] border border-[#6a8759] px-2 py-0.5 font-bold text-[#000080] focus:bg-[#ffffcc] focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Quick Item Entry Bar for Adding New Medicines/Batches into the Challan */}
          <div className="bg-[#cfdfb8] px-3 py-1.5 border-b border-[#6a8759] flex flex-wrap items-end gap-1.5 text-[11px]">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[10px] font-bold text-slate-700">PRODUCT (दवा नाम - Enter दबाएं)</label>
              <input
                type="text"
                list="marg-all-meds-list"
                value={newPcProduct}
                onChange={(e) => setNewPcProduct(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPcRow();
                  }
                }}
                placeholder="Type DOLO 650, PAN-D, etc..."
                className="w-full bg-white border border-[#6a8759] px-1.5 py-0.5 font-bold text-slate-900"
              />
            </div>
            <div className="w-20">
              <label className="block text-[10px] font-bold text-slate-700">PACK</label>
              <input
                type="text"
                value={newPcPack}
                onChange={(e) => setNewPcPack(e.target.value)}
                className="w-full bg-white border border-[#6a8759] px-1.5 py-0.5 font-bold"
              />
            </div>
            <div className="w-24">
              <label className="block text-[10px] font-bold text-slate-700">BATCH</label>
              <input
                type="text"
                value={newPcBatch}
                onChange={(e) => setNewPcBatch(e.target.value)}
                placeholder="BATCH01"
                className="w-full bg-white border border-[#6a8759] px-1.5 py-0.5 font-bold uppercase"
              />
            </div>
            <div className="w-28">
              <label className="block text-[10px] font-bold text-slate-700">EXPIRY</label>
              <input
                type="date"
                value={newPcExpiry}
                onChange={(e) => setNewPcExpiry(e.target.value)}
                className="w-full bg-white border border-[#6a8759] px-1 py-0.5 font-bold"
              />
            </div>
            <div className="w-14">
              <label className="block text-[10px] font-bold text-slate-700">STRI (Qty)</label>
              <input
                type="number"
                min={1}
                value={newPcStri}
                onChange={(e) => setNewPcStri(Number(e.target.value))}
                className="w-full bg-white border border-[#6a8759] px-1 py-0.5 font-bold text-center"
              />
            </div>
            <div className="w-14">
              <label className="block text-[10px] font-bold text-slate-700">FREE</label>
              <input
                type="number"
                min={0}
                value={newPcFree}
                onChange={(e) => setNewPcFree(Number(e.target.value))}
                className="w-full bg-white border border-[#6a8759] px-1 py-0.5 font-bold text-center"
              />
            </div>
            <div className="w-18">
              <label className="block text-[10px] font-bold text-slate-700">P.RATE/S</label>
              <input
                type="number"
                step="0.01"
                value={newPcPRate}
                onChange={(e) => setNewPcPRate(Number(e.target.value))}
                className="w-full bg-white border border-[#6a8759] px-1 py-0.5 font-bold text-right"
              />
            </div>
            <div className="w-18">
              <label className="block text-[10px] font-bold text-slate-700">M.R.P.</label>
              <input
                type="number"
                step="0.01"
                value={newPcMrp}
                onChange={(e) => setNewPcMrp(Number(e.target.value))}
                className="w-full bg-white border border-[#6a8759] px-1 py-0.5 font-bold text-right"
              />
            </div>
            <div className="w-14">
              <label className="block text-[10px] font-bold text-slate-700">DIS1%</label>
              <input
                type="number"
                step="0.5"
                value={newPcDis1}
                onChange={(e) => setNewPcDis1(Number(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddPcRow();
                  }
                }}
                className="w-full bg-white border border-[#6a8759] px-1 py-0.5 font-bold text-right"
              />
            </div>
            <button
              type="button"
              onClick={handleAddPcRow}
              className="px-3 py-1 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1"
            >
              <Plus size={12} />
              <span>Add Medicine</span>
            </button>
          </div>

          {/* 3. Authentic Marg Multi-Medicine Grid: PRODUCT | PACK | BATCH | STRI | TAB. | FREE | P.RATE/S | DIS1% | AMOUNT */}
          <div className="bg-[#c6ddb0] overflow-x-auto">
            <table className="w-full border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-[#dce8cc] text-[#004d40] font-bold border-b-2 border-[#557347]">
                  <th className="py-1 px-2 border-r border-[#557347] text-left w-[30%]">PRODUCT (दवा का नाम)</th>
                  <th className="py-1 px-2 border-r border-[#557347] text-left w-[10%]">PACK</th>
                  <th className="py-1 px-2 border-r border-[#557347] text-left w-[12%]">BATCH</th>
                  <th className="py-1 px-2 border-r border-[#557347] text-right w-[7%]">STRI</th>
                  <th className="py-1 px-2 border-r border-[#557347] text-right w-[7%]">TAB.</th>
                  <th className="py-1 px-2 border-r border-[#557347] text-right w-[7%]">FREE</th>
                  <th className="py-1 px-2 border-r border-[#557347] text-right w-[10%]">P.RATE/S</th>
                  <th className="py-1 px-2 border-r border-[#557347] text-right w-[7%]">DIS1%</th>
                  <th className="py-1 px-2 text-right w-[10%]">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: Math.max(10, pcRows.length) }).map((_, idx) => {
                  const row = pcRows[idx];
                  const isSelected = idx === pcSelectedRowIdx && !!row;
                  const rowAmt = row ? row.stri * row.pRate * (1 - row.dis1 / 100) : 0;
                  return (
                    <tr
                      key={row ? row.id : `empty-pc-${idx}`}
                      onClick={() => {
                        if (row) {
                          setPcSelectedRowIdx(idx);
                        } else {
                          handleAddBlankPcRow();
                        }
                      }}
                      className={`h-6 border-b border-[#8aa878] cursor-pointer ${
                        isSelected
                          ? 'bg-[#254132] text-white font-bold'
                          : row
                          ? 'bg-[#d3e6be] hover:bg-[#bed8a4] text-slate-900 font-bold'
                          : 'bg-[#c6ddb0] hover:bg-[#b8d49e]'
                      }`}
                    >
                      <td className="px-1.5 border-r border-[#557347] truncate">
                        {row ? (
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[10px] opacity-70 mr-1">{idx + 1}.</span>
                            <input
                              type="text"
                              list="marg-all-meds-list"
                              value={row.product}
                              onChange={(e) =>
                                handleUpdatePcRow(idx, 'product', e.target.value.toUpperCase())
                              }
                              placeholder="TYPE MEDICINE NAME..."
                              className="w-full bg-transparent font-bold focus:bg-[#ffffcc] focus:text-slate-950 px-1 outline-none"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPcRows((prev) => prev.filter((_, i) => i !== idx));
                              }}
                              className={`text-[10px] px-1 rounded ${
                                isSelected ? 'text-red-300 hover:text-white' : 'text-red-600 hover:bg-red-100'
                              }`}
                              title="Remove medicine row"
                            >
                              ✕
                            </button>
                          </div>
                        ) : idx === pcRows.length ? (
                          <span className="text-[10px] text-emerald-950/60 italic">
                            + Click here to add Medicine #{idx + 1} below...
                          </span>
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="px-1 border-r border-[#557347]">
                        {row ? (
                          <input
                            type="text"
                            value={row.pack}
                            onChange={(e) => handleUpdatePcRow(idx, 'pack', e.target.value)}
                            className="w-full bg-transparent font-bold focus:bg-[#ffffcc] focus:text-slate-950 px-1 outline-none"
                          />
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="px-1 border-r border-[#557347]">
                        {row ? (
                          <input
                            type="text"
                            value={row.batch}
                            onChange={(e) =>
                              handleUpdatePcRow(idx, 'batch', e.target.value.toUpperCase())
                            }
                            className="w-full bg-transparent font-bold focus:bg-[#ffffcc] focus:text-slate-950 px-1 outline-none uppercase"
                          />
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="px-1 border-r border-[#557347] text-right">
                        {row ? (
                          <input
                            type="number"
                            min={1}
                            value={row.stri}
                            onChange={(e) =>
                              handleUpdatePcRow(idx, 'stri', Math.max(1, Number(e.target.value) || 1))
                            }
                            className="w-full bg-transparent text-right font-bold focus:bg-[#ffffcc] focus:text-slate-950 px-1 outline-none"
                          />
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="px-1 border-r border-[#557347] text-right">
                        {row ? (
                          <input
                            type="number"
                            min={0}
                            value={row.tab}
                            onChange={(e) =>
                              handleUpdatePcRow(idx, 'tab', Math.max(0, Number(e.target.value) || 0))
                            }
                            className="w-full bg-transparent text-right font-bold focus:bg-[#ffffcc] focus:text-slate-950 px-1 outline-none"
                          />
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="px-1 border-r border-[#557347] text-right">
                        {row ? (
                          <input
                            type="number"
                            min={0}
                            value={row.free}
                            onChange={(e) =>
                              handleUpdatePcRow(idx, 'free', Math.max(0, Number(e.target.value) || 0))
                            }
                            className="w-full bg-transparent text-right font-bold focus:bg-[#ffffcc] focus:text-slate-950 px-1 outline-none"
                          />
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="px-1 border-r border-[#557347] text-right">
                        {row ? (
                          <input
                            type="number"
                            step="0.01"
                            value={row.pRate}
                            onChange={(e) =>
                              handleUpdatePcRow(idx, 'pRate', Math.max(0, Number(e.target.value) || 0))
                            }
                            className="w-full bg-transparent text-right font-bold focus:bg-[#ffffcc] focus:text-slate-950 px-1 outline-none"
                          />
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="px-1 border-r border-[#557347] text-right">
                        {row ? (
                          <input
                            type="number"
                            step="0.5"
                            value={row.dis1}
                            onChange={(e) =>
                              handleUpdatePcRow(idx, 'dis1', Math.max(0, Number(e.target.value) || 0))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddBlankPcRow();
                              }
                            }}
                            className="w-full bg-transparent text-right font-bold focus:bg-[#ffffcc] focus:text-slate-950 px-1 outline-none"
                          />
                        ) : (
                          ''
                        )}
                      </td>
                      <td className="px-2 text-right">{row ? rowAmt.toFixed(2) : ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Multi-Medicine Add Row Strip right below Purchase Challan Grid */}
          <div className="bg-[#b7d39c] px-3 py-1 border-t border-[#557347] flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="font-bold text-slate-900">
              इस खरीद बिल में कुल दवाइयां (Medicines in Bill): <strong className="text-[#000080]">{pcRows.length}</strong>
            </span>
            <button
              type="button"
              onClick={handleAddBlankPcRow}
              className="px-3 py-0.5 bg-[#254132] hover:bg-emerald-950 text-amber-300 font-bold rounded cursor-pointer inline-flex items-center gap-1"
            >
              <Plus size={12} />
              <span>+ नीचे अगली दवा की लाइन जोड़ें (Add Next Medicine Row Below)</span>
            </button>
          </div>

          {/* 4. Bottom 3-Column Marg Info + Value of Goods Box (#dce8cc) */}
          <div className="bg-[#dce8cc] border-t-2 border-[#4b6b66] p-2.5 grid grid-cols-1 md:grid-cols-12 gap-3 text-[12px] text-slate-900">
            {/* Left Info Column */}
            <div className="md:col-span-5 space-y-1 font-bold">
              <div className="flex justify-between">
                <span>
                  Item : <span className="text-[#000080]">{activePcRow?.product || '---'}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  Batch : <span className="text-[#000080]">{activePcRow?.batch || '---'}</span>
                </span>
                <span>
                  Expiry : <span className="text-red-700">{activePcRow?.expiry || '---'}</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  Stock :{' '}
                  <span className="text-emerald-800">
                    {activePcRow ? activePcRow.stri + activePcRow.free : 0} Strips
                  </span>
                </span>
                <span>
                  Deal :{' '}
                  <span className="text-[#000080]">
                    {activePcRow ? `${activePcRow.stri}+${activePcRow.free}` : '0+0'}
                  </span>
                </span>
              </div>
              <div className="flex justify-between">
                <span>
                  M.R.P. : <span className="text-[#000080]">₹{activePcRow ? activePcRow.mrp.toFixed(2) : '0.00'}</span>
                </span>
                <span>
                  SRate : <span className="text-[#000080]">₹{activePcRow ? activePcRow.sRate.toFixed(2) : '0.00'}</span>
                </span>
              </div>
            </div>

            {/* Center Challan & Tax Info */}
            <div className="md:col-span-3 space-y-1 font-bold border-x border-[#8aa878] px-3">
              <div className="flex justify-between">
                <span>Chall. :</span>
                <span className="text-[#000080]">{pcEntryNo}</span>
              </div>
              <div className="flex justify-between">
                <span>Date :</span>
                <span className="text-[#000080]">{pcDate}</span>
              </div>
              <div className="flex justify-between">
                <span>HSN :</span>
                <span>{activePcRow?.hsnCode || '30049099'}</span>
              </div>
              <div className="flex justify-between">
                <span>GST % :</span>
                <span className="text-emerald-800">{activePcRow?.gstPct || 12}% (6+6)</span>
              </div>
            </div>

            {/* Right Value of Goods / Discount / GST Box */}
            <div className="md:col-span-4 border-2 border-[#4b6b66] bg-[#edf5e1] p-2 space-y-1 font-bold">
              <div className="flex justify-between">
                <span>VALUE OF GOODS</span>
                <span>{pcValueOfGoods.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>DISCOUNT</span>
                <span>-{pcTotalDiscount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#000080]">
                <span>GST</span>
                <span>+{pcTotalGst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t border-[#4b6b66] pt-1 text-sm font-black text-emerald-950">
                <span>NET CHALLAN AMT</span>
                <span>₹{pcNetAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* 5. Dark Slate-Teal Status Strip with Red Oval HELP Badge */}
          <div className="bg-[#4b6b66] text-white px-3 py-1 flex flex-wrap items-center justify-between text-[11px]">
            <div className="flex items-center gap-3 font-mono">
              <span>[F2-Add Item]</span>
              <span>[F3-Search Batch]</span>
              <span>[F10-Save Challan &amp; Update Stock]</span>
              <span>[Esc-Exit]</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePurchaseChallanToFirestore}
                disabled={isSavingPurchase}
                className="px-3 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded cursor-pointer"
              >
                {isSavingPurchase ? 'Saving...' : 'SAVE CHALLAN [F10]'}
              </button>
              <span className="px-3 py-0.5 bg-red-600 text-white font-black rounded-full border border-white text-[10px] tracking-wider shadow">
                HELP
              </span>
            </div>
          </div>

          {/* 6. Classic Marg Bottom Banner: Bold Italic "PURCHASE CHALLAN" */}
          <div className="bg-[#dce8cc] px-4 py-1.5 border-t border-[#6a8759] flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700">
              LOCAL PURCHASE · {pcRows.length} MEDICINES IN BILL · AUTO FIFO BATCH CREATION ENABLED
            </span>
            <span className="text-xl sm:text-2xl font-black italic tracking-wider text-slate-900 font-serif">
              {activeTab === 'purchase_bill' ? 'PURCHASE BILL' : 'PURCHASE CHALLAN'}
            </span>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: SALES ORDER & BILL DETAIL POPUP (Pages 27-28 of PDF)
      ========================================================================= */}
      {activeTab === 'sales_order' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>SALES ORDER [MULTI-MEDICINE RETAIL / CREDIT ENTRY] (बिक्री आदेश एवं बिल विवरण)</span>
            <button
              type="button"
              onClick={() => setShowBillDetailModal(true)}
              className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-bold rounded hover:bg-amber-300 cursor-pointer"
            >
              [View / Edit Bill Detail Screen]
            </button>
          </div>

          <div className="bg-white border border-[#7f9db9] p-3 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#f0f4f8] p-2 border">
              <div>
                <label className="block font-bold text-slate-700">Customer / Patient Name :</label>
                <input
                  type="text"
                  value={soCustomer}
                  onChange={(e) => setSoCustomer(e.target.value)}
                  className="w-full px-2 py-1 border bg-[#ffffe6] font-bold text-[#000080]"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Order No :</label>
                <input
                  type="text"
                  value={soOrderNo}
                  onChange={(e) => setSoOrderNo(e.target.value)}
                  className="w-full px-2 py-1 border font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700">Order Type :</label>
                <input
                  type="text"
                  value={soType}
                  onChange={(e) => setSoType(e.target.value)}
                  className="w-full px-2 py-1 border font-bold text-purple-800"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border text-left">
                <thead>
                  <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                    <th className="p-2 border-r w-8 text-center">#</th>
                    <th className="p-2 border-r">MEDICINE / ITEM NAME (दवा का नाम)</th>
                    <th className="p-2 border-r w-24">PACK</th>
                    <th className="p-2 border-r w-28">BATCH</th>
                    <th className="p-2 border-r text-center w-20">QTY</th>
                    <th className="p-2 border-r text-right w-24">M.R.P.</th>
                    <th className="p-2 border-r text-right w-20">DISC %</th>
                    <th className="p-2 border-r text-right w-28">AMOUNT</th>
                    <th className="p-2 text-center w-12">DEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono text-[11px]">
                  {soItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-amber-50">
                      <td className="p-1.5 border-r text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-1 border-r font-bold">
                        <input
                          type="text"
                          list="marg-all-meds-list"
                          value={item.item}
                          onChange={(e) => handleUpdateSoRow(idx, 'item', e.target.value.toUpperCase())}
                          placeholder="Type medicine (e.g. DOLO 650 TABLET)..."
                          className="w-full px-1.5 py-0.5 border border-slate-300 bg-[#ffffe6] font-bold text-[#000080]"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.pack}
                          onChange={(e) => handleUpdateSoRow(idx, 'pack', e.target.value)}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.batch}
                          onChange={(e) => handleUpdateSoRow(idx, 'batch', e.target.value.toUpperCase())}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold uppercase"
                        />
                      </td>
                      <td className="p-1 border-r text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => handleUpdateSoRow(idx, 'qty', Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-center font-bold"
                        />
                      </td>
                      <td className="p-1 border-r text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.mrp}
                          onChange={(e) => handleUpdateSoRow(idx, 'mrp', Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-right font-bold"
                        />
                      </td>
                      <td className="p-1 border-r text-right">
                        <input
                          type="number"
                          step="0.5"
                          value={item.disc}
                          onChange={(e) => handleUpdateSoRow(idx, 'disc', Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r text-right font-bold text-green-700">₹{item.amount.toFixed(2)}</td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => setSoItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="px-1.5 py-0.5 text-red-600 hover:bg-red-100 rounded font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-[#e6f2ff] p-2.5 border flex flex-wrap justify-between items-center gap-2 font-bold">
              <button
                type="button"
                onClick={handleAddSoRow}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={13} />
                <span>+ नीचे अगली दवा जोड़ें (Add Next Medicine Row)</span>
              </button>
              <div>
                <span>Challan / Order Value ({soItems.length} Medicines) : </span>
                <span className="text-base text-[#000080]">₹{calculateSoTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowBillDetailModal(true)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 font-bold rounded cursor-pointer"
              >
                Open Bill Details Popup
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSaveMultiMedicineVoucher('SALES_ORDER', soOrderNo, soCustomer, soItems, 'NONE')
                }
                className="px-4 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Save size={13} />
                <span>Save Multi-Medicine Sales Order [F10]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: SALE RETURN / S/R EXPIRY (Page 30 of PDF)
      ========================================================================= */}
      {activeTab === 'sales_return' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>SALE RETURN [MULTI-MEDICINE CR NOTE RETAIL / EXPIRY RETURN] (दवा वापसी एवं क्रेडिट नोट)</span>
            <span className="font-mono text-[11px] text-amber-300">Shortcut: S/R Expiry · {soItems.length} Medicines</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-4 space-y-3 font-mono text-xs">
            <div className="p-3 bg-red-50 border border-red-300 space-y-2">
              <p className="font-bold text-red-950">RETURN OF BILL DETAILS (वापसी बिल विवरण - एक बिल में कई दवाइयों की वापसी):</p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div>
                  <label className="block text-[11px] text-slate-600">Patient / Customer Name :</label>
                  <input
                    type="text"
                    value={soCustomer}
                    onChange={(e) => setSoCustomer(e.target.value)}
                    className="w-full px-2 py-1 border bg-white font-bold text-[#000080]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600">Return / Original Bill No :</label>
                  <input
                    type="text"
                    value={srBillNo}
                    onChange={(e) => setSrBillNo(e.target.value)}
                    className="w-full px-2 py-1 border bg-white font-bold text-[#000080]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600">Return Date :</label>
                  <input
                    type="date"
                    value={srBillDate}
                    onChange={(e) => setSrBillDate(e.target.value)}
                    className="w-full px-2 py-1 border bg-white font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600">Type of Return :</label>
                  <select
                    value={srReturnType}
                    onChange={(e) => setSrReturnType(e.target.value as any)}
                    className="w-full px-2 py-1 border font-bold bg-white"
                  >
                    <option value="credit_note">Credit Note (Adjust in Next Bill)</option>
                    <option value="cash_refund">Cash Refund (Instant Cash)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Multi-Medicine Return Table */}
            <div className="overflow-x-auto">
              <table className="w-full border text-left">
                <thead>
                  <tr className="bg-red-100 text-red-950 font-bold border-b">
                    <th className="p-2 border-r w-8 text-center">#</th>
                    <th className="p-2 border-r">RETURNED MEDICINE NAME (वापस की गई दवा)</th>
                    <th className="p-2 border-r w-24">PACK</th>
                    <th className="p-2 border-r w-28">BATCH</th>
                    <th className="p-2 border-r text-center w-20">RET. QTY</th>
                    <th className="p-2 border-r text-right w-24">M.R.P.</th>
                    <th className="p-2 border-r text-right w-28">REFUND AMT</th>
                    <th className="p-2 text-center w-12">DEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono text-[11px]">
                  {soItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-red-50/60">
                      <td className="p-1.5 border-r text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-1 border-r font-bold">
                        <input
                          type="text"
                          list="marg-all-meds-list"
                          value={item.item}
                          onChange={(e) => handleUpdateSoRow(idx, 'item', e.target.value.toUpperCase())}
                          placeholder="Type medicine name..."
                          className="w-full px-1.5 py-0.5 border border-slate-300 bg-[#ffffe6] font-bold text-[#000080]"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.pack}
                          onChange={(e) => handleUpdateSoRow(idx, 'pack', e.target.value)}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.batch}
                          onChange={(e) => handleUpdateSoRow(idx, 'batch', e.target.value.toUpperCase())}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold uppercase"
                        />
                      </td>
                      <td className="p-1 border-r text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => handleUpdateSoRow(idx, 'qty', Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-center font-bold text-red-700"
                        />
                      </td>
                      <td className="p-1 border-r text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.mrp}
                          onChange={(e) => handleUpdateSoRow(idx, 'mrp', Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r text-right font-bold text-red-700">₹{item.amount.toFixed(2)}</td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => setSoItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="px-1.5 py-0.5 text-red-600 hover:bg-red-100 rounded font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 bg-red-50 p-2.5 border border-red-200">
              <button
                type="button"
                onClick={handleAddSoRow}
                className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={13} />
                <span>+ अगली वापसी दवा जोड़ें (Add Next Returned Medicine)</span>
              </button>
              <div className="font-bold text-red-950">
                <span>Total Return / Refund Amount ({soItems.length} Medicines) : </span>
                <span className="text-base">₹{calculateSoTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() =>
                  handleSaveMultiMedicineVoucher('SALE_RETURN', `SR-${srBillNo}`, soCustomer, soItems, 'ADD')
                }
                className="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Save Multi-Medicine Return &amp; Add Back to Stock [F10]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 5: STORE STOCK TRANSFER (Page 38 of PDF)
      ========================================================================= */}
      {activeTab === 'stock_transfer' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>STORE STOCK TRANSFER / ISSUE (स्टोर स्टॉक ट्रांसफर - अस्पताल वार्ड वितरण)</span>
            <span className="font-mono text-[11px] text-emerald-300">Multi-Medicine Ward Transfer · {soItems.length} Items</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-4 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-3 border">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Transfer Memo No :</label>
                <input
                  type="text"
                  value={transferMemoNo}
                  onChange={(e) => setTransferMemoNo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-400 font-bold text-[#000080] bg-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Transfer From (Store Out) :</label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-400 font-bold bg-[#ffffe6]"
                >
                  <option value="Store 1 (Central Warehouse)">Store 1 (Central Warehouse)</option>
                  <option value="Store 2 (Hospital OPD Dispensary)">Store 2 (Hospital OPD Dispensary)</option>
                  <option value="Store 3 (Emergency Ward)">Store 3 (Emergency Ward)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Transfer To (Store In) :</label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-400 font-bold bg-[#e6f2ff]"
                >
                  <option value="Store 2 (Hospital OPD Dispensary)">Store 2 (Hospital OPD Dispensary)</option>
                  <option value="Store 3 (Emergency Ward)">Store 3 (Emergency Ward)</option>
                  <option value="Store 1 (Central Warehouse)">Store 1 (Central Warehouse)</option>
                </select>
              </div>
            </div>

            {/* Multi-Medicine Store Transfer Table */}
            <div className="overflow-x-auto">
              <table className="w-full border text-left">
                <thead>
                  <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                    <th className="p-2 border-r w-8 text-center">#</th>
                    <th className="p-2 border-r">MEDICINE NAME TO TRANSFER (दवा का नाम)</th>
                    <th className="p-2 border-r w-24">PACK</th>
                    <th className="p-2 border-r w-28">BATCH</th>
                    <th className="p-2 border-r text-center w-24">TRANSFER QTY</th>
                    <th className="p-2 border-r text-right w-24">M.R.P.</th>
                    <th className="p-2 border-r text-right w-28">VALUE</th>
                    <th className="p-2 text-center w-12">DEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono text-[11px]">
                  {soItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-amber-50">
                      <td className="p-1.5 border-r text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-1 border-r font-bold">
                        <input
                          type="text"
                          list="marg-all-meds-list"
                          value={item.item}
                          onChange={(e) => handleUpdateSoRow(idx, 'item', e.target.value.toUpperCase())}
                          placeholder="Type medicine name..."
                          className="w-full px-1.5 py-0.5 border border-slate-300 bg-[#ffffe6] font-bold text-[#000080]"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.pack}
                          onChange={(e) => handleUpdateSoRow(idx, 'pack', e.target.value)}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.batch}
                          onChange={(e) => handleUpdateSoRow(idx, 'batch', e.target.value.toUpperCase())}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold uppercase"
                        />
                      </td>
                      <td className="p-1 border-r text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => handleUpdateSoRow(idx, 'qty', Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-center font-bold text-[#000080]"
                        />
                      </td>
                      <td className="p-1 border-r text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.mrp}
                          onChange={(e) => handleUpdateSoRow(idx, 'mrp', Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r text-right font-bold text-green-700">₹{item.amount.toFixed(2)}</td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => setSoItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="px-1.5 py-0.5 text-red-600 hover:bg-red-100 rounded font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f0f4f8] p-2.5 border">
              <button
                type="button"
                onClick={handleAddSoRow}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={13} />
                <span>+ अगली दवा जोड़ें (Add Next Medicine to Transfer)</span>
              </button>
              <div className="font-bold">
                <span>Total Transfer Value ({soItems.length} Medicines) : </span>
                <span className="text-base text-[#000080]">₹{calculateSoTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() =>
                  handleSaveMultiMedicineVoucher(
                    'STOCK_TRANSFER',
                    transferMemoNo,
                    `${transferFrom} -> ${transferTo}`,
                    soItems,
                    'DEDUCT'
                  )
                }
                className="px-4 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Truck size={13} />
                <span>Execute Multi-Medicine Store Transfer Invoice [F10]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 6: PURCHASE RETURN / DEBIT NOTE (P/R EXPIRY)
      ========================================================================= */}
      {activeTab === 'purchase_return' && (
        <div className="border-2 border-[#4b6b66] bg-[#f7e6e6] shadow-lg font-mono text-xs overflow-hidden">
          <div className="bg-[#4b6b66] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>PURCHASE RETURN / DEBIT NOTE ENTRY [MULTI-MEDICINE P/R EXPIRY &amp; BREAKAGE]</span>
            <span className="text-amber-300 text-[11px]">Supplier Debit Note · {poItems.length} Medicines</span>
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 border border-[#7f9db9]">
              <div>
                <label className="block text-[11px] font-bold text-slate-700">Supplier Ledger :</label>
                <input
                  type="text"
                  value={pcPartyName}
                  onChange={(e) => setPcPartyName(e.target.value)}
                  className="w-full px-2 py-1 border bg-[#ffffe6] font-bold text-[#000080]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700">Debit Note No. :</label>
                <input
                  type="text"
                  value={prDebitNoteNo}
                  onChange={(e) => setPrDebitNoteNo(e.target.value)}
                  className="w-full px-2 py-1 border font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700">Return Reason :</label>
                <select className="w-full px-2 py-1 border font-bold bg-white">
                  <option>Near Expiry / Expired Stock (90-Day Return)</option>
                  <option>Breakage / Damaged Strip</option>
                  <option>Rate Difference / Batch Recall</option>
                </select>
              </div>
            </div>

            {/* Multi-Medicine Purchase Return Table */}
            <div className="bg-white border border-[#7f9db9] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-red-100 text-red-950 font-bold border-b">
                    <th className="p-2 border-r w-8 text-center">#</th>
                    <th className="p-2 border-r">MEDICINE NAME (सप्लायर को वापस दवा)</th>
                    <th className="p-2 border-r w-24">PACK</th>
                    <th className="p-2 border-r w-28">BATCH</th>
                    <th className="p-2 border-r text-center w-20">RET. QTY</th>
                    <th className="p-2 border-r text-right w-24">P. RATE</th>
                    <th className="p-2 border-r text-right w-28">DEBIT AMT</th>
                    <th className="p-2 text-center w-12">DEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono text-[11px]">
                  {poItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-red-50">
                      <td className="p-1.5 border-r text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-1 border-r font-bold">
                        <input
                          type="text"
                          list="marg-all-meds-list"
                          value={item.item}
                          onChange={(e) => handleUpdatePoRow(idx, 'item', e.target.value.toUpperCase())}
                          placeholder="Type medicine name..."
                          className="w-full px-1.5 py-0.5 border border-slate-300 bg-[#ffffe6] font-bold text-[#000080]"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.pack}
                          onChange={(e) => handleUpdatePoRow(idx, 'pack', e.target.value)}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.batch}
                          onChange={(e) => handleUpdatePoRow(idx, 'batch', e.target.value.toUpperCase())}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold uppercase"
                        />
                      </td>
                      <td className="p-1 border-r text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => handleUpdatePoRow(idx, 'qty', Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-center font-bold text-red-700"
                        />
                      </td>
                      <td className="p-1 border-r text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.pRate}
                          onChange={(e) => handleUpdatePoRow(idx, 'pRate', Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r text-right font-bold text-red-700">₹{item.amount.toFixed(2)}</td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => setPoItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="px-1.5 py-0.5 text-red-600 hover:bg-red-100 rounded font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-2.5 border border-[#7f9db9]">
              <button
                type="button"
                onClick={handleAddPoRow}
                className="px-3 py-1 bg-red-700 hover:bg-red-800 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={13} />
                <span>+ अगली वापसी दवा जोड़ें (Add Next Medicine Row)</span>
              </button>
              <div className="font-bold text-red-950">
                <span>Total Debit Note Value ({poItems.length} Medicines) : </span>
                <span className="text-base">₹{calculatePoTotal().toFixed(2)}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() =>
                  handleSaveMultiMedicineVoucher('PURCHASE_RETURN', prDebitNoteNo, pcPartyName, poItems, 'DEDUCT')
                }
                className="px-4 py-1.5 bg-red-700 hover:bg-red-800 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw size={13} />
                <span>Save Multi-Medicine Debit Note &amp; Deduct Stock [F10]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 7: SALES QUOTATION / ESTIMATE
      ========================================================================= */}
      {activeTab === 'quotation' && (
        <div className="border-2 border-[#4b6b66] bg-[#dff0fa] shadow-lg font-mono text-xs overflow-hidden">
          <div className="bg-[#4b6b66] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>SALES QUOTATION / PATIENT ESTIMATE ENTRY (मल्टी-मेडिसिन दवा कोटेशन पर्ची)</span>
            <span className="text-emerald-200 text-[11px]">Estimate Only · {soItems.length} Medicines</span>
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-white p-2.5 border border-[#7f9db9]">
              <div>
                <label className="block text-[11px] font-bold text-slate-700">Quotation No. :</label>
                <input
                  type="text"
                  value={quotationNo}
                  onChange={(e) => setQuotationNo(e.target.value)}
                  className="w-full px-2 py-1 border font-bold text-[#000080]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700">Patient / Hospital Name :</label>
                <input
                  type="text"
                  value={soCustomer}
                  onChange={(e) => setSoCustomer(e.target.value)}
                  className="w-full px-2 py-1 border bg-[#ffffe6] font-bold text-[#000080]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700">Quotation Mode :</label>
                <select
                  value={quotationType}
                  onChange={(e) => setQuotationType(e.target.value)}
                  className="w-full px-2 py-1 border font-bold bg-white"
                >
                  <option value="DISCOUNT">RETAIL WITH DISCOUNT %</option>
                  <option value="NET_RATE">INSTITUTIONAL NET RATE</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700">Estimated Total :</label>
                <input
                  type="text"
                  readOnly
                  value={`₹${calculateSoTotal().toFixed(2)}`}
                  className="w-full px-2 py-1 border bg-slate-100 font-bold text-emerald-800"
                />
              </div>
            </div>

            {/* Multi-Medicine Quotation Table */}
            <div className="bg-white border border-[#7f9db9] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                    <th className="p-2 border-r w-8 text-center">#</th>
                    <th className="p-2 border-r">MEDICINE NAME (दवा का नाम)</th>
                    <th className="p-2 border-r w-24">PACK</th>
                    <th className="p-2 border-r w-28">BATCH</th>
                    <th className="p-2 border-r text-center w-20">QTY</th>
                    <th className="p-2 border-r text-right w-24">M.R.P.</th>
                    <th className="p-2 border-r text-right w-20">DISC %</th>
                    <th className="p-2 border-r text-right w-28">EST. AMT</th>
                    <th className="p-2 text-center w-12">DEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono text-[11px]">
                  {soItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-amber-50">
                      <td className="p-1.5 border-r text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-1 border-r font-bold">
                        <input
                          type="text"
                          list="marg-all-meds-list"
                          value={item.item}
                          onChange={(e) => handleUpdateSoRow(idx, 'item', e.target.value.toUpperCase())}
                          placeholder="Type medicine name..."
                          className="w-full px-1.5 py-0.5 border border-slate-300 bg-[#ffffe6] font-bold text-[#000080]"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.pack}
                          onChange={(e) => handleUpdateSoRow(idx, 'pack', e.target.value)}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.batch}
                          onChange={(e) => handleUpdateSoRow(idx, 'batch', e.target.value.toUpperCase())}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold uppercase"
                        />
                      </td>
                      <td className="p-1 border-r text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => handleUpdateSoRow(idx, 'qty', Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-center font-bold"
                        />
                      </td>
                      <td className="p-1 border-r text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.mrp}
                          onChange={(e) => handleUpdateSoRow(idx, 'mrp', Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-right font-bold"
                        />
                      </td>
                      <td className="p-1 border-r text-right">
                        <input
                          type="number"
                          step="0.5"
                          value={item.disc}
                          onChange={(e) => handleUpdateSoRow(idx, 'disc', Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r text-right font-bold text-green-700">₹{item.amount.toFixed(2)}</td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => setSoItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="px-1.5 py-0.5 text-red-600 hover:bg-red-100 rounded font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-2.5 border border-[#7f9db9]">
              <button
                type="button"
                onClick={handleAddSoRow}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={13} />
                <span>+ अगली दवा जोड़ें (Add Next Medicine Row)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSaveMultiMedicineVoucher('QUOTATION', quotationNo, soCustomer, soItems, 'NONE')
                }
                className="px-4 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1.5"
              >
                <Save size={13} />
                <span>Save Multi-Medicine Quotation [F10]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 8: DELIVERY CHALLAN (COUNTER CHALLAN)
      ========================================================================= */}
      {activeTab === 'delivery_challan' && (
        <div className="border-2 border-[#4b6b66] bg-[#dff0fa] shadow-lg font-mono text-xs overflow-hidden">
          <div className="bg-[#4b6b66] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>DELIVERY CHALLAN / COUNTER CHALLAN ENTRY [MULTI-MEDICINE ALT+INS]</span>
            <span className="text-amber-300 text-[11px]">{soItems.length} Medicines · Pending for Final Invoice</span>
          </div>
          <div className="p-3 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white p-2.5 border border-[#7f9db9]">
              <div>
                <label className="block text-[11px] font-bold text-slate-700">Challan No. :</label>
                <input
                  type="text"
                  value={dcChallanNo}
                  onChange={(e) => setDcChallanNo(e.target.value)}
                  className="w-full px-2 py-1 border font-bold text-[#000080]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700">Ward / Customer Name :</label>
                <input
                  type="text"
                  value={soCustomer}
                  onChange={(e) => setSoCustomer(e.target.value)}
                  className="w-full px-2 py-1 border bg-[#ffffe6] font-bold"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700">Dispatch Status :</label>
                <input
                  type="text"
                  defaultValue="DISPATCHED TO IPD / OPD"
                  className="w-full px-2 py-1 border font-bold text-emerald-800"
                />
              </div>
            </div>

            {/* Multi-Medicine Delivery Challan Table */}
            <div className="bg-white border border-[#7f9db9] overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                    <th className="p-2 border-r w-8 text-center">#</th>
                    <th className="p-2 border-r">MEDICINE NAME (डिलीवरी चालान दवा)</th>
                    <th className="p-2 border-r w-24">PACK</th>
                    <th className="p-2 border-r w-28">BATCH</th>
                    <th className="p-2 border-r text-center w-20">QTY</th>
                    <th className="p-2 border-r text-right w-24">M.R.P.</th>
                    <th className="p-2 border-r text-right w-28">AMOUNT</th>
                    <th className="p-2 text-center w-12">DEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono text-[11px]">
                  {soItems.map((item, idx) => (
                    <tr key={item.id} className="hover:bg-amber-50">
                      <td className="p-1.5 border-r text-center font-bold text-slate-500">{idx + 1}</td>
                      <td className="p-1 border-r font-bold">
                        <input
                          type="text"
                          list="marg-all-meds-list"
                          value={item.item}
                          onChange={(e) => handleUpdateSoRow(idx, 'item', e.target.value.toUpperCase())}
                          placeholder="Type medicine name..."
                          className="w-full px-1.5 py-0.5 border border-slate-300 bg-[#ffffe6] font-bold text-[#000080]"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.pack}
                          onChange={(e) => handleUpdateSoRow(idx, 'pack', e.target.value)}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold"
                        />
                      </td>
                      <td className="p-1 border-r">
                        <input
                          type="text"
                          value={item.batch}
                          onChange={(e) => handleUpdateSoRow(idx, 'batch', e.target.value.toUpperCase())}
                          className="w-full px-1.5 py-0.5 border border-slate-300 font-bold uppercase"
                        />
                      </td>
                      <td className="p-1 border-r text-center">
                        <input
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(e) => handleUpdateSoRow(idx, 'qty', Math.max(1, Number(e.target.value) || 1))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-center font-bold"
                        />
                      </td>
                      <td className="p-1 border-r text-right">
                        <input
                          type="number"
                          step="0.01"
                          value={item.mrp}
                          onChange={(e) => handleUpdateSoRow(idx, 'mrp', Math.max(0, Number(e.target.value) || 0))}
                          className="w-full px-1 py-0.5 border border-slate-300 text-right font-bold"
                        />
                      </td>
                      <td className="p-1.5 border-r text-right font-bold text-green-700">₹{item.amount.toFixed(2)}</td>
                      <td className="p-1 text-center">
                        <button
                          type="button"
                          onClick={() => setSoItems((prev) => prev.filter((_, i) => i !== idx))}
                          className="px-1.5 py-0.5 text-red-600 hover:bg-red-100 rounded font-bold cursor-pointer"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap justify-between items-center gap-2 bg-white p-2.5 border border-[#7f9db9]">
              <button
                type="button"
                onClick={handleAddSoRow}
                className="px-3 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1"
              >
                <Plus size={13} />
                <span>+ अगली दवा जोड़ें (Add Next Medicine Row)</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  handleSaveMultiMedicineVoucher('DELIVERY_CHALLAN', dcChallanNo, soCustomer, soItems, 'DEDUCT')
                }
                className="px-4 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded cursor-pointer inline-flex items-center gap-1.5"
              >
                <Truck size={13} />
                <span>Save Multi-Medicine Delivery Challan [F10]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: BILL DETAIL POPUP (Page 28 of PDF)
      ========================================================================= */}
      {showBillDetailModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-[#edeae0] border-2 border-[#7f9db9] rounded-lg shadow-2xl max-w-2xl w-full p-4 space-y-3 font-mono text-xs">
            <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
              <span>BILL DETAIL (TRANSACTION LOGISTICS &amp; TRANSPORTATION)</span>
              <button
                type="button"
                onClick={() => setShowBillDetailModal(false)}
                className="text-white hover:text-red-300 font-bold"
              >
                <X size={16} />
              </button>
            </div>

            <div className="bg-white border border-slate-300 p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 border-b pb-2">
                <div>
                  <span className="text-slate-500">Against Form : </span>
                  <input
                    type="text"
                    value={billDetail.againstForm}
                    onChange={(e) => setBillDetail({ ...billDetail, againstForm: e.target.value })}
                    className="border px-1 font-bold"
                  />
                </div>
                <div>
                  <span className="text-slate-500">Due Days : </span>
                  <input
                    type="number"
                    value={billDetail.dueDays}
                    onChange={(e) => setBillDetail({ ...billDetail, dueDays: e.target.value })}
                    className="border px-1 font-bold text-center w-16"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b pb-2">
                <div>
                  <span className="text-slate-500">Transportation : </span>
                  <input
                    type="text"
                    value={billDetail.transport}
                    onChange={(e) => setBillDetail({ ...billDetail, transport: e.target.value })}
                    className="border px-1 w-full"
                  />
                </div>
                <div>
                  <span className="text-slate-500">Contact / Goods To : </span>
                  <input
                    type="text"
                    value={billDetail.goodsTo}
                    onChange={(e) => setBillDetail({ ...billDetail, goodsTo: e.target.value })}
                    className="border px-1 w-full"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b pb-2">
                <div>
                  <span className="text-slate-500">Delivery Address : </span>
                  <input
                    type="text"
                    value={billDetail.delivery}
                    onChange={(e) => setBillDetail({ ...billDetail, delivery: e.target.value })}
                    className="border px-1 w-full"
                  />
                </div>
                <div>
                  <span className="text-slate-500">G.R.N. No. / Cases : </span>
                  <input
                    type="text"
                    value={`${billDetail.grnNo} / ${billDetail.cases}`}
                    onChange={(e) => setBillDetail({ ...billDetail, cases: e.target.value })}
                    className="border px-1 w-full font-bold"
                  />
                </div>
              </div>

              <div>
                <span className="text-slate-500">Terms &amp; Conditions : </span>
                <input
                  type="text"
                  value={billDetail.terms}
                  onChange={(e) => setBillDetail({ ...billDetail, terms: e.target.value })}
                  className="border px-1 w-full text-[11px]"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowBillDetailModal(false);
                    setToast('✅ Bill Detail specifications saved!');
                  }}
                  className="px-4 py-1.5 bg-[#000080] text-white font-bold rounded"
                >
                  Save Bill Details [Enter]
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
