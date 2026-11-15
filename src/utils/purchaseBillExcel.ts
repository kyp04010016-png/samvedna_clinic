import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import { calculateMarginPercent, calculateSuggestedSellPrice } from './invoiceNo';
import { logStaffActivity } from './activityLogger';
import { saveRecordToSql } from './sqlSyncBridge';
import { saveAutoSelfBackupAndSyncHost } from './backupRestore';

export interface ParsedPurchaseBillItem {
  rowId: string;
  medicineName: string;
  brand: string;
  genericName: string;
  pack: string;
  packUnit: 'strip' | 'bottle' | 'tablet';
  hsnCode: string;
  schedule: 'OTC' | 'H' | 'H1' | 'X';
  batchNo: string;
  barcode: string;
  expiryDate: string; // Normalized YYYY-MM-DD for FIFO sorting
  qty: number;
  freeQty: number;
  totalStockToAdd: number;
  costPrice: number; // PTR / Purchase Rate per unit
  mrp: number;
  sellPrice: number; // Retail Sale Rate per unit
  gstPercent: 5 | 12 | 18;
  discountPercent: number;
  lineTaxableAmount: number;
  lineGstAmount: number;
  lineNetAmount: number;
}

export interface ParsedPurchaseBill {
  supplierName: string;
  supplierBillNo: string;
  billDate: string;
  fileName: string;
  items: ParsedPurchaseBillItem[];
  totalTaxable: number;
  totalGst: number;
  grandTotal: number;
}

export interface CommitPurchaseBillResult {
  newMedicinesCreated: number;
  newBatchesCreated: number;
  existingBatchesUpdated: number;
  totalUnitsAdded: number;
  grandTotalValue: number;
  supplierName: string;
  supplierBillNo: string;
}

// Helper: case-insensitive & punctuation-insensitive column lookup
function getField(row: Record<string, any>, candidateKeys: string[]): any {
  const rowKeys = Object.keys(row);
  const normalize = (k: string) =>
    k
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .trim();

  for (const candidate of candidateKeys) {
    const normCand = normalize(candidate);
    for (const rk of rowKeys) {
      if (normalize(rk) === normCand) {
        const val = row[rk];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
    }
  }

  // Partial contains fallback for common headers
  for (const candidate of candidateKeys) {
    const normCand = normalize(candidate);
    if (normCand.length < 4) continue;
    for (const rk of rowKeys) {
      if (normalize(rk).includes(normCand)) {
        const val = row[rk];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          return val;
        }
      }
    }
  }

  return undefined;
}

function parseNumber(val: any, fallback = 0): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (val === undefined || val === null) return fallback;
  const cleaned = String(val)
    .replace(/[₹$,%\s]/g, '')
    .trim();
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? fallback : num;
}

/**
 * Normalizes any distributor/Marg expiry date into YYYY-MM-DD so FIFO sorting works reliably.
 */
export function normalizeExpiryDate(raw: any): string {
  const fallback = '2027-12-31';
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return fallback;
  }

  // Excel serial date number
  if (typeof raw === 'number' && raw > 25000 && raw < 80000) {
    const utcDays = Math.floor(raw - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  const s = String(raw).trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  // YYYY-MM
  if (/^\d{4}-\d{2}$/.test(s)) {
    return `${s}-28`;
  }

  // MM/YYYY or MM-YYYY
  const mmyyyy = s.match(/^(\d{1,2})[\/\-](\d{4})$/);
  if (mmyyyy) {
    const mm = String(Math.min(12, Math.max(1, parseInt(mmyyyy[1], 10)))).padStart(
      2,
      '0'
    );
    const yyyy = mmyyyy[2];
    return `${yyyy}-${mm}-28`;
  }

  // MM/YY or MM-YY
  const mmyy = s.match(/^(\d{1,2})[\/\-](\d{2})$/);
  if (mmyy) {
    const mm = String(Math.min(12, Math.max(1, parseInt(mmyy[1], 10)))).padStart(
      2,
      '0'
    );
    const yy = parseInt(mmyy[2], 10);
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mm}-28`;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const dd = String(Math.min(28, Math.max(1, parseInt(ddmmyyyy[1], 10)))).padStart(
      2,
      '0'
    );
    const mm = String(Math.min(12, Math.max(1, parseInt(ddmmyyyy[2], 10)))).padStart(
      2,
      '0'
    );
    const yyyy = ddmmyyyy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // MMM-YY or MMM-YYYY (e.g. Dec-27, Jan 2028)
  const monthNames: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  const mmmyy = s.match(/^([a-zA-Z]{3})[a-zA-Z]*[\s\/\-](\d{2,4})$/);
  if (mmmyy) {
    const mKey = mmmyy[1].toLowerCase();
    const mm = monthNames[mKey] || '12';
    let yyyy = parseInt(mmmyy[2], 10);
    if (yyyy < 100) yyyy += 2000;
    return `${yyyy}-${mm}-28`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return fallback;
}

function normalizeGst(raw: any): 5 | 12 | 18 {
  const n = parseNumber(raw, 12);
  if (n <= 6) return 5;
  if (n >= 16) return 18;
  return 12;
}

function normalizeUnit(raw: any): 'strip' | 'bottle' | 'tablet' {
  const s = String(raw || '').toLowerCase();
  if (
    s.includes('syr') ||
    s.includes('bot') ||
    s.includes('ml') ||
    s.includes('susp') ||
    s.includes('drop')
  ) {
    return 'bottle';
  }
  if (s === 'tab' || s === 'tablet' || s === '1s') {
    return 'tablet';
  }
  return 'strip';
}

function normalizeSchedule(raw: any): 'OTC' | 'H' | 'H1' | 'X' {
  const s = String(raw || '')
    .toUpperCase()
    .replace(/SCHEDULE|SCH|\s/g, '');
  if (s === 'H1') return 'H1';
  if (s === 'H') return 'H';
  if (s === 'X') return 'X';
  return 'OTC';
}

/**
 * Parses a Distributor / Marg ERP Purchase Bill Excel (.xlsx/.xls) or .csv file
 */
export async function parseSupplierPurchaseSpreadsheet(
  file: File,
  defaultSupplierName = 'Wholesale Pharma Distributor',
  defaultBillNo = `PUR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
  defaultMarginPercent = 20
): Promise<ParsedPurchaseBill> {
  let rows: Record<string, any>[] = [];

  if (file.name.toLowerCase().endsWith('.csv')) {
    const text = await file.text();
    const parsed = Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    rows = parsed.data || [];
  } else {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const firstSheet = wb.Sheets[wb.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json<Record<string, any>>(firstSheet, {
      defval: '',
    });
  }

  let detectedSupplier = defaultSupplierName;
  let detectedBillNo = defaultBillNo;
  let detectedBillDate = new Date().toISOString().slice(0, 10);

  const items: ParsedPurchaseBillItem[] = [];

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];

    const medNameRaw = getField(row, [
      'MedicineName',
      'Medicine Name',
      'Medicine',
      'Item Name',
      'ItemName',
      'Item',
      'Product Name',
      'ProductName',
      'Product',
      'Particulars',
      'Description',
      'Drug Name',
      'Name',
    ]);

    const medicineName = String(medNameRaw || '').trim();
    if (
      !medicineName ||
      medicineName.toLowerCase() === 'total' ||
      medicineName.toLowerCase() === 'grand total' ||
      medicineName.toLowerCase() === 'sub total'
    ) {
      continue;
    }

    // Check if supplier/billNo is present in row
    const rowSupplier = getField(row, [
      'Supplier',
      'SupplierName',
      'Supplier Name',
      'Party Name',
      'Party',
      'Distributor',
      'Vendor',
    ]);
    if (rowSupplier) {
      detectedSupplier = String(rowSupplier).trim();
    }

    const rowBillNo = getField(row, [
      'BillNo',
      'Bill No',
      'InvoiceNo',
      'Invoice No',
      'ChallanNo',
      'Challan No',
      'VoucherNo',
    ]);
    if (rowBillNo) {
      detectedBillNo = String(rowBillNo).trim();
    }

    const brand = String(
      getField(row, [
        'Brand',
        'Company',
        'Mfg',
        'Manufacturer',
        'Make',
        'Division',
        'MktBy',
      ]) || 'Standard Pharma'
    ).trim();

    const genericName = String(
      getField(row, [
        'GenericName',
        'Generic Name',
        'Generic',
        'Salt',
        'Composition',
        'Formula',
      ]) || medicineName
    ).trim();

    const packRaw = getField(row, ['Unit', 'Pack', 'Packing', 'UOM']);
    const packUnit = normalizeUnit(packRaw);
    const packStr =
      packRaw && String(packRaw).trim() && !['strip', 'tablet', 'bottle'].includes(String(packRaw).trim().toLowerCase())
        ? String(packRaw).trim().toUpperCase()
        : packUnit === 'bottle'
        ? '1 BTL'
        : '1*10';

    const hsnCode = String(
      getField(row, ['HSN', 'HSNCode', 'HSN Code', 'HSN/SAC']) || '30049099'
    ).trim();

    const schedule = normalizeSchedule(
      getField(row, ['Schedule', 'Sch', 'DrugSchedule', 'ScheduleType'])
    );

    const batchNo = String(
      getField(row, [
        'BatchNo',
        'Batch No',
        'Batch',
        'Batch No.',
        'Lot',
        'LotNo',
      ]) || `B-${Date.now().toString().slice(-4)}-${idx + 1}`
    ).trim();

    const barcode = String(
      getField(row, ['Barcode', 'EAN', 'ItemCode', 'Code']) ||
        `890${Math.floor(100000000 + Math.random() * 900000000)}`
    ).trim();

    const expiryDate = normalizeExpiryDate(
      getField(row, [
        'ExpiryDate',
        'Expiry Date',
        'Expiry',
        'Exp',
        'Exp Date',
        'Exp.',
        'ExpDate',
      ])
    );

    // Handle Qty and "10+2" style scheme if written in Qty
    const qtyRaw = getField(row, [
      'Qty',
      'Quantity',
      'Stock',
      'BillQty',
      'Bill Qty',
      'PurQty',
      'Purchase Qty',
      'Units',
    ]);
    let qty = 10;
    let freeQty = parseNumber(
      getField(row, ['Free', 'FreeQty', 'Free Qty', 'Scheme', 'Bonus']),
      0
    );

    if (typeof qtyRaw === 'string' && qtyRaw.includes('+')) {
      const parts = qtyRaw.split('+');
      qty = Math.max(1, parseNumber(parts[0], 10));
      freeQty += Math.max(0, parseNumber(parts[1], 0));
    } else if (qtyRaw !== undefined) {
      qty = Math.max(1, parseNumber(qtyRaw, 10));
    }

    const totalStockToAdd = qty + freeQty;

    // Cost / PTR / Purchase Rate
    const costRaw = getField(row, [
      'CostPrice',
      'Cost Price',
      'PTR',
      'P.Rate',
      'PRate',
      'PurRate',
      'Purchase Rate',
      'PurchasePrice',
      'Rate',
      'Cost',
      'NetRate',
      'PTS',
    ]);
    const mrpRaw = getField(row, ['MRP', 'M.R.P.', 'MaxRetailPrice', 'Max Price']);
    const sellRaw = getField(row, [
      'SellPrice',
      'Sell Price',
      'S.Rate',
      'SRate',
      'Sale Rate',
      'SalePrice',
      'Selling Price',
      'RetailRate',
    ]);

    const costPrice = Number(
      Math.max(1, parseNumber(costRaw, mrpRaw ? parseNumber(mrpRaw) * 0.72 : 50)).toFixed(2)
    );
    const mrp = Number(
      Math.max(costPrice, parseNumber(mrpRaw, costPrice * 1.35)).toFixed(2)
    );

    // If distributor bill doesn't specify retail SellPrice, calculate from cost + margin, capped at MRP (just like Marg ERP!)
    let sellPrice = sellRaw !== undefined ? parseNumber(sellRaw, 0) : 0;
    if (sellPrice <= 0) {
      const suggested = calculateSuggestedSellPrice(costPrice, defaultMarginPercent);
      sellPrice = Number(Math.min(mrp, Math.max(costPrice, suggested)).toFixed(2));
    }

    const gstPercent = normalizeGst(
      getField(row, ['GST', 'GST%', 'GSTPercent', 'Tax', 'Tax%', 'IGST'])
    );
    const discountPercent = parseNumber(
      getField(row, ['Disc', 'Disc%', 'Discount', 'Discount%']),
      0
    );

    const grossLine = qty * costPrice;
    const discAmt = (grossLine * discountPercent) / 100;
    const lineTaxableAmount = Number(Math.max(0, grossLine - discAmt).toFixed(2));
    const lineGstAmount = Number(((lineTaxableAmount * gstPercent) / 100).toFixed(2));
    const lineNetAmount = Number((lineTaxableAmount + lineGstAmount).toFixed(2));

    items.push({
      rowId: `${idx}-${batchNo}`,
      medicineName: medicineName.slice(0, 150),
      brand: brand.slice(0, 120),
      genericName: genericName.slice(0, 150),
      pack: packStr,
      packUnit,
      hsnCode: hsnCode.slice(0, 20),
      schedule,
      batchNo: batchNo.slice(0, 60),
      barcode: barcode.slice(0, 80),
      expiryDate,
      qty,
      freeQty,
      totalStockToAdd,
      costPrice,
      mrp,
      sellPrice,
      gstPercent,
      discountPercent,
      lineTaxableAmount,
      lineGstAmount,
      lineNetAmount,
    });
  }

  const totalTaxable = Number(
    items.reduce((acc, i) => acc + i.lineTaxableAmount, 0).toFixed(2)
  );
  const totalGst = Number(
    items.reduce((acc, i) => acc + i.lineGstAmount, 0).toFixed(2)
  );
  const grandTotal = Number((totalTaxable + totalGst).toFixed(2));

  return {
    supplierName: detectedSupplier,
    supplierBillNo: detectedBillNo,
    billDate: detectedBillDate,
    fileName: file.name,
    items,
    totalTaxable,
    totalGst,
    grandTotal,
  };
}

/**
 * Saves an imported/reviewed Supplier Purchase Bill directly into `medicines` & `batches`
 * so the pharmacist can immediately bill/sell all items in `SaleBilling.tsx`.
 */
export async function commitPurchaseBillToFirestore(
  bill: ParsedPurchaseBill,
  staffName = 'Pharmacy Staff'
): Promise<CommitPurchaseBillResult> {
  const [medSnap, batchSnap] = await Promise.all([
    getDocs(collection(db, 'medicines')),
    getDocs(collection(db, 'batches')),
  ]);

  const existingMedicines: Array<Record<string, any>> = medSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, any>),
  }));

  const existingBatches: Array<Record<string, any>> = batchSnap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Record<string, any>),
  }));

  let newMedicinesCreated = 0;
  let newBatchesCreated = 0;
  let existingBatchesUpdated = 0;
  let totalUnitsAdded = 0;

  for (const item of bill.items) {
    if (!item.medicineName.trim()) continue;

    // 1. Find or create Medicine Master
    let matchedMed = existingMedicines.find(
      (m) =>
        String(m.name || '').toLowerCase() === item.medicineName.toLowerCase()
    );

    let medicineId = matchedMed?.id || '';

    if (!medicineId) {
      const medPayload = {
        name: item.medicineName,
        brand: item.brand,
        barcode: item.barcode,
        genericName: item.genericName,
        manufacturer: item.brand,
        hsnCode: item.hsnCode || '30049099',
        unit: item.packUnit,
        pack: item.pack || '1*10',
        gstPercent: item.gstPercent,
        schedule: item.schedule,
        scheduleType: item.schedule,
        reorderLevel: 15,
        createdAt: new Date().toISOString(),
      };
      const createdMedRef = await addDoc(collection(db, 'medicines'), medPayload);
      medicineId = createdMedRef.id;
      existingMedicines.push({ id: medicineId, ...medPayload });
      await saveRecordToSql('medicines', medicineId, medPayload);
      newMedicinesCreated += 1;
    }

    // 2. Find or create Batch in `batches` (match by medicineId + batchNo)
    const matchedBatch = existingBatches.find(
      (b) =>
        b.medicineId === medicineId &&
        String(b.batchNo || '').toLowerCase() === item.batchNo.toLowerCase()
    );

    const stockToAdd = Math.max(1, Number(item.totalStockToAdd || item.qty || 1));
    totalUnitsAdded += stockToAdd;

    const supplierLabel = bill.supplierBillNo
      ? `${bill.supplierName} (Bill: ${bill.supplierBillNo})`
      : bill.supplierName;

    if (matchedBatch) {
      const updatedStock = Number(matchedBatch.stock ?? matchedBatch.stockQuantity ?? 0) + stockToAdd;
      const updatedPurchased = Number(matchedBatch.purchasedQty ?? matchedBatch.stock ?? 0) + stockToAdd;
      const batchPatch = {
        stock: updatedStock,
        stockQuantity: updatedStock,
        purchasedQty: updatedPurchased,
        pack: item.pack || matchedBatch.pack || '1*10',
        costPrice: Number(item.costPrice),
        mrp: Number(item.mrp),
        sellPrice: Number(item.sellPrice),
        marginPercent: calculateMarginPercent(item.costPrice, item.sellPrice),
        expiryDate: item.expiryDate,
        supplierName: supplierLabel.slice(0, 120),
        supplierBillNo: bill.supplierBillNo,
        purchaseDate: bill.billDate,
        updatedAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, 'batches', matchedBatch.id), batchPatch);
      matchedBatch.stock = updatedStock;
      await saveRecordToSql('batches', matchedBatch.id, {
        ...matchedBatch,
        ...batchPatch,
      });
      existingBatchesUpdated += 1;
    } else {
      const newBatchPayload = {
        medicineId,
        medicineName: item.medicineName,
        pack: item.pack || '1*10',
        batchNo: item.batchNo,
        batchNumber: item.batchNo,
        barcode: item.barcode,
        expiryDate: item.expiryDate,
        costPrice: Number(item.costPrice),
        mrp: Number(item.mrp),
        sellPrice: Number(item.sellPrice),
        marginPercent: calculateMarginPercent(item.costPrice, item.sellPrice),
        stock: stockToAdd,
        stockQuantity: stockToAdd,
        purchasedQty: stockToAdd,
        soldQty: 0,
        supplierName: supplierLabel.slice(0, 120),
        supplierBillNo: bill.supplierBillNo,
        purchaseDate: bill.billDate,
        createdAt: new Date().toISOString(),
      };
      const createdBatchRef = await addDoc(
        collection(db, 'batches'),
        newBatchPayload
      );
      existingBatches.push({ id: createdBatchRef.id, ...newBatchPayload });
      await saveRecordToSql('batches', createdBatchRef.id, newBatchPayload);
      newBatchesCreated += 1;
    }
  }

  await logStaffActivity(
    'PURCHASE_BILL_EXCEL_IMPORT',
    `${staffName} imported Purchase Bill #${bill.supplierBillNo} from ${bill.supplierName} (${bill.items.length} items, +${totalUnitsAdded} units, ₹${bill.grandTotal.toFixed(
      2
    )})`,
    staffName
  );

  saveAutoSelfBackupAndSyncHost(
    staffName,
    `PURCHASE_EXCEL_IMPORT_${bill.supplierBillNo}`
  ).catch(() => {});

  return {
    newMedicinesCreated,
    newBatchesCreated,
    existingBatchesUpdated,
    totalUnitsAdded,
    grandTotalValue: bill.grandTotal,
    supplierName: bill.supplierName,
    supplierBillNo: bill.supplierBillNo,
  };
}

/**
 * Downloads a sample Marg ERP / Distributor Purchase Invoice Excel (.xlsx) file
 * so the shopkeeper can see the exact columns or test importing immediately.
 */
export function downloadSamplePurchaseBillExcel(): void {
  const sampleRows = [
    {
      Supplier: 'Chennai Pharma Distributors',
      BillNo: 'CPD-GST-4092',
      ItemName: 'Dolo 650 Tablet (15s)',
      Company: 'Micro Labs',
      GenericName: 'Paracetamol 650mg',
      Pack: 'strip',
      HSN: '30049099',
      Schedule: 'OTC',
      BatchNo: 'DL650-A91',
      Barcode: '890111222001',
      ExpiryDate: '2028-03-31',
      Qty: 50,
      Free: 5,
      PTR: 22.5,
      MRP: 33.75,
      SaleRate: 30.0,
      GST: 12,
    },
    {
      Supplier: 'Chennai Pharma Distributors',
      BillNo: 'CPD-GST-4092',
      ItemName: 'Augmentin 625 Duo Tablet',
      Company: 'GSK Pharma',
      GenericName: 'Amoxycillin 500mg + Clavulanic Acid 125mg',
      Pack: 'strip',
      HSN: '30041000',
      Schedule: 'H',
      BatchNo: 'AUG-882',
      Barcode: '890111222002',
      ExpiryDate: '2027-11-30',
      Qty: 20,
      Free: 2,
      PTR: 148.0,
      MRP: 204.5,
      SaleRate: 190.0,
      GST: 12,
    },
    {
      Supplier: 'Chennai Pharma Distributors',
      BillNo: 'CPD-GST-4092',
      ItemName: 'Pan-D Capsule PR (15s)',
      Company: 'Alkem Laboratories',
      GenericName: 'Pantoprazole 40mg + Domperidone 30mg',
      Pack: 'strip',
      HSN: '30049034',
      Schedule: 'H',
      BatchNo: 'PAND-510',
      Barcode: '890111222003',
      ExpiryDate: '2028-01-31',
      Qty: 40,
      Free: 4,
      PTR: 135.0,
      MRP: 199.0,
      SaleRate: 180.0,
      GST: 12,
    },
    {
      Supplier: 'Chennai Pharma Distributors',
      BillNo: 'CPD-GST-4092',
      ItemName: 'Azithral 500 Tablet (5s)',
      Company: 'Alembic Pharma',
      GenericName: 'Azithromycin 500mg',
      Pack: 'strip',
      HSN: '30042061',
      Schedule: 'H',
      BatchNo: 'AZI-774',
      Barcode: '890111222004',
      ExpiryDate: '2028-05-31',
      Qty: 30,
      Free: 3,
      PTR: 86.0,
      MRP: 125.0,
      SaleRate: 115.0,
      GST: 12,
    },
    {
      Supplier: 'Chennai Pharma Distributors',
      BillNo: 'CPD-GST-4092',
      ItemName: 'Telma 40 Tablet (15s)',
      Company: 'Glenmark Pharma',
      GenericName: 'Telmisartan 40mg',
      Pack: 'strip',
      HSN: '30049085',
      Schedule: 'H',
      BatchNo: 'TLM-309',
      Barcode: '890111222005',
      ExpiryDate: '2028-06-30',
      Qty: 25,
      Free: 0,
      PTR: 158.0,
      MRP: 225.0,
      SaleRate: 205.0,
      GST: 12,
    },
    {
      Supplier: 'Chennai Pharma Distributors',
      BillNo: 'CPD-GST-4092',
      ItemName: 'Shelcal 500 Tablet (15s)',
      Company: 'Torrent Pharma',
      GenericName: 'Calcium 500mg + Vitamin D3 250 IU',
      Pack: 'strip',
      HSN: '30049099',
      Schedule: 'OTC',
      BatchNo: 'SHC-921',
      Barcode: '890111222006',
      ExpiryDate: '2028-04-30',
      Qty: 35,
      Free: 3,
      PTR: 98.0,
      MRP: 144.0,
      SaleRate: 132.0,
      GST: 12,
    },
    {
      Supplier: 'Chennai Pharma Distributors',
      BillNo: 'CPD-GST-4092',
      ItemName: 'Montair LC Tablet (10s)',
      Company: 'Cipla Ltd',
      GenericName: 'Montelukast 10mg + Levocetirizine 5mg',
      Pack: 'strip',
      HSN: '30049039',
      Schedule: 'H',
      BatchNo: 'MTLC-118',
      Barcode: '890111222007',
      ExpiryDate: '2028-02-28',
      Qty: 30,
      Free: 2,
      PTR: 142.0,
      MRP: 210.0,
      SaleRate: 190.0,
      GST: 12,
    },
    {
      Supplier: 'Chennai Pharma Distributors',
      BillNo: 'CPD-GST-4092',
      ItemName: 'Ascoril LS Syrup 100ml',
      Company: 'Glenmark Pharma',
      GenericName: 'Ambroxol + Levosalbutamol + Guaiphenesin',
      Pack: 'bottle',
      HSN: '30049099',
      Schedule: 'H',
      BatchNo: 'ASLS-604',
      Barcode: '890111222008',
      ExpiryDate: '2027-10-31',
      Qty: 24,
      Free: 2,
      PTR: 82.0,
      MRP: 118.0,
      SaleRate: 108.0,
      GST: 12,
    },
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  XLSX.utils.book_append_sheet(wb, ws, 'Purchase_Bill_Marg');
  XLSX.writeFile(wb, 'Distributor_Purchase_Bill_Marg_Sample.xlsx');
}
