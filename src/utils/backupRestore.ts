import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { logStaffActivity } from './activityLogger';

export const BACKUP_COLLECTIONS = [
  'settings',
  'counters',
  'doctors',
  'appointments',
  'tokens',
  'prescriptions',
  'medicines',
  'batches',
  'invoices',
  'feedback',
  'users',
  'staff_activity',
] as const;

export type BackupCollectionName = (typeof BACKUP_COLLECTIONS)[number];

export interface FullSystemBackupPayload {
  system: 'Sandana Clinic + Dudrucs Marg ERP 9+';
  version: string;
  exportedAt: string;
  exportedBy: string;
  checksum: string;
  counts: Record<BackupCollectionName, number>;
  collections: Record<
    BackupCollectionName,
    Array<{ id: string; data: Record<string, any> }>
  >;
}

export interface CloudBackupSnapshot {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  counts: Record<string, number>;
  payloadJson: string;
  checksum: string;
}

export const AUTO_SELF_BACKUP_STORAGE_KEY = 'sandana_auto_self_backup_v1';
export const AUTO_SELF_BACKUP_META_KEY = 'sandana_auto_self_backup_meta_v1';
export const AUTO_LOCAL_PC_DOWNLOAD_KEY = 'sandana_auto_local_pc_backup_enabled';

export function computeBackupChecksum(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    'SCD-' +
    (h2 >>> 0).toString(16).padStart(8, '0').toUpperCase() +
    '-' +
    (h1 >>> 0).toString(16).padStart(8, '0').toUpperCase()
  );
}

export async function collectFullSystemBackup(
  exportedBy = 'Admin'
): Promise<FullSystemBackupPayload> {
  const collectionsData = {} as Record<
    BackupCollectionName,
    Array<{ id: string; data: Record<string, any> }>
  >;
  const counts = {} as Record<BackupCollectionName, number>;

  await Promise.all(
    BACKUP_COLLECTIONS.map(async (colName) => {
      try {
        const snap = await getDocs(collection(db, colName));
        const rows = snap.docs.map((d) => ({
          id: d.id,
          data: d.data() as Record<string, any>,
        }));
        collectionsData[colName] = rows;
        counts[colName] = rows.length;
      } catch {
        collectionsData[colName] = [];
        counts[colName] = 0;
      }
    })
  );

  const rawForHash = JSON.stringify({ counts, collections: collectionsData });
  const checksum = computeBackupChecksum(rawForHash);

  return {
    system: 'Sandana Clinic + Dudrucs Marg ERP 9+',
    version: '2.6.0-ERP',
    exportedAt: new Date().toISOString(),
    exportedBy,
    checksum,
    counts,
    collections: collectionsData,
  };
}

export async function downloadSystemBackupJson(
  exportedBy = 'Admin'
): Promise<FullSystemBackupPayload> {
  const payload = await collectFullSystemBackup(exportedBy);
  const jsonString = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const datePart = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Sandana_Dudrucs_Full_Backup_${datePart}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  await logStaffActivity(
    'SYSTEM_BACKUP_DOWNLOAD',
    `Full clinic & pharmacy JSON backup downloaded (${payload.checksum}) by ${exportedBy}`
  );
  return payload;
}

export async function exportPharmacyInventoryAndBillsExcel(
  exportedBy = 'Pharmacy Admin'
): Promise<void> {
  const payload = await collectFullSystemBackup(exportedBy);
  const wb = XLSX.utils.book_new();

  // Sheet 1: Live Batch Stock & Purchase vs Sale Register
  const batchRows = (payload.collections.batches || []).map((b, idx) => {
    const d = b.data || {};
    const purchased = Number(d.purchasedQty ?? d.initialStock ?? d.stock ?? 0);
    const sold = Number(d.soldQty ?? 0);
    const currentStock = Number(d.stock ?? d.stockQuantity ?? 0);
    return {
      'S.No': idx + 1,
      'Medicine Name': d.medicineName || '',
      'Pack Size': d.pack || '1*10',
      'Batch No': d.batchNo || d.batchNumber || '',
      'Expiry Date': d.expiryDate || '',
      'Supplier Name': d.supplierName || '',
      'Supplier Bill No': d.supplierBillNo || d.challanNo || '',
      'Purchase Date': d.purchaseDate || '',
      'Total Purchased (Strips)': purchased,
      'Total Sold (Strips)': sold,
      'Current Available Stock (Strips)': currentStock,
      'Purchase Rate (P.Rate ₹)': Number(d.costPrice || 0),
      'Sale Rate (₹)': Number(d.sellPrice || d.mrp || 0),
      'M.R.P. (₹)': Number(d.mrp || 0),
      'GST %': Number(d.gstPercent || 12),
      'Stock Value (Cost ₹)': Number((currentStock * Number(d.costPrice || 0)).toFixed(2)),
      'Stock Value (MRP ₹)': Number((currentStock * Number(d.mrp || 0)).toFixed(2)),
    };
  });
  const wsBatches = XLSX.utils.json_to_sheet(
    batchRows.length > 0 ? batchRows : [{ Note: 'No batches yet' }]
  );
  XLSX.utils.book_append_sheet(wb, wsBatches, 'Live_Stock_&_Batches');

  // Sheet 2: All Sale & Purchase Invoices
  const invRows = (payload.collections.invoices || []).map((inv, idx) => {
    const d = inv.data || {};
    return {
      'S.No': idx + 1,
      'Bill / Entry No': d.invoiceNo || '',
      'Type': d.invoiceType || 'SALE',
      'Party / Patient Name': d.customerName || '',
      'Phone': d.customerPhone || '',
      'Supplier Bill No': d.supplierBillNo || '',
      'Total Items': Array.isArray(d.items) ? d.items.length : 0,
      'Items Summary': Array.isArray(d.items)
        ? d.items.map((i: any) => `${i.medicineName} (${i.qty} Str)`).join(', ')
        : '',
      'Subtotal (₹)': Number(d.subtotal || 0),
      'Discount (₹)': Number(d.totalDiscount || 0),
      'GST (₹)': Number(d.totalGst || 0),
      'Grand Total (₹)': Number(d.grandTotal || 0),
      'Profit (₹)': Number(d.grossProfit || d.totalProfit || 0),
      'Payment Mode': d.paymentMode || 'cash',
      'Payment Status': d.paymentStatus || 'paid',
      'Date': d.createdAt || '',
    };
  });
  const wsInvoices = XLSX.utils.json_to_sheet(
    invRows.length > 0 ? invRows : [{ Note: 'No invoices yet' }]
  );
  XLSX.utils.book_append_sheet(wb, wsInvoices, 'Sale_&_Purchase_Bills');

  // Sheet 3: Medicine Master
  const medRows = (payload.collections.medicines || []).map((m, idx) => {
    const d = m.data || {};
    return {
      'S.No': idx + 1,
      'Medicine ID': m.id,
      'Medicine Name': d.name || '',
      'Generic / Salt': d.genericName || '',
      'Brand / Company': d.brand || d.manufacturer || '',
      'Pack / Unit': d.packSize || d.unit || '1*10',
      'HSN Code': d.hsnCode || '30049099',
      'GST %': Number(d.gstPercent || 12),
      'Schedule': d.scheduleType || 'OTC',
      'Reorder Level': Number(d.reorderLevel || 10),
    };
  });
  const wsMeds = XLSX.utils.json_to_sheet(
    medRows.length > 0 ? medRows : [{ Note: 'No medicines yet' }]
  );
  XLSX.utils.book_append_sheet(wb, wsMeds, 'Medicine_Master');

  const dateStr = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Sandana_Pharmacy_Stock_Purchase_Sale_Backup_${dateStr}.xlsx`);
}

export function getLocalSelfBackupMeta(): {
  savedAt: string;
  checksum: string;
  totalRecords: number;
  trigger: string;
} | null {
  try {
    const raw = localStorage.getItem(AUTO_SELF_BACKUP_META_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isAutoLocalPcDownloadEnabled(): boolean {
  try {
    return localStorage.getItem(AUTO_LOCAL_PC_DOWNLOAD_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setAutoLocalPcDownloadEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(AUTO_LOCAL_PC_DOWNLOAD_KEY, enabled ? 'true' : 'false');
  } catch {
    // ignore storage quota errors
  }
}

/**
 * 3-Tier Automatic Backup Engine:
 * 1. Saves full snapshot into Browser Self-Backup (localStorage)
 * 2. Syncs all 12 tables to Domain/Host SQL Engine (/api/sql/sync) & triggers Host Daily Backup (/api/backup/daily/run)
 * 3. Updates Daily Cloud Backup document in Firestore (`backups/daily_auto_YYYY_MM_DD`)
 * 4. Optionally downloads JSON backup to Local PC if auto-local-PC download is enabled
 */
export async function saveAutoSelfBackupAndSyncHost(
  operatorName = 'AutoBackup Engine',
  triggerReason = 'auto_save',
  forceLocalPcDownload = false
): Promise<{
  success: boolean;
  checksum: string;
  totalRecords: number;
  savedAt: string;
}> {
  const payload = await collectFullSystemBackup(operatorName);
  const payloadJson = JSON.stringify(payload);
  const totalRecords = Object.values(payload.counts).reduce((a, b) => a + b, 0);
  const savedAt = new Date().toISOString();
  const todayStr = savedAt.slice(0, 10);

  // 1. Save Self-Backup in Browser LocalStorage
  try {
    localStorage.setItem(AUTO_SELF_BACKUP_STORAGE_KEY, payloadJson);
    localStorage.setItem(
      AUTO_SELF_BACKUP_META_KEY,
      JSON.stringify({
        savedAt,
        checksum: payload.checksum,
        totalRecords,
        trigger: triggerReason,
      })
    );
  } catch {
    // ignore quota warning if payload is large
  }

  // 2. Sync all 12 collections to Domain/Host Server SQLite/MySQL & write Daily Host Backup (.sql + .json)
  try {
    await fetch('/api/sql/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collections: payload.collections, replace: false }),
    });
    await fetch('/api/backup/daily/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trigger: triggerReason }),
    });
  } catch {
    // continue gracefully
  }

  // 3. Save/Update Daily Cloud Backup Snapshot in Firestore `backups` collection
  try {
    if (payloadJson.length < 950000) {
      const dailyDocId = `daily_auto_${todayStr.replace(/-/g, '_')}`;
      await setDoc(doc(db, 'backups', dailyDocId), {
        name: `Daily Auto-Backup (${todayStr}) — ${triggerReason}`,
        createdBy: operatorName.slice(0, 110),
        createdAt: savedAt,
        counts: payload.counts,
        payloadJson,
        checksum: payload.checksum,
      });
    }
  } catch {
    // ignore
  }

  // 4. Download to Local PC if requested or if Auto-Local-PC mode is ON
  if (forceLocalPcDownload || isAutoLocalPcDownloadEnabled()) {
    try {
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sandana_Dudrucs_LocalPC_Backup_${todayStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }

  window.dispatchEvent(
    new CustomEvent('sandana-backup-updated', {
      detail: { savedAt, checksum: payload.checksum, totalRecords, trigger: triggerReason },
    })
  );

  return {
    success: true,
    checksum: payload.checksum,
    totalRecords,
    savedAt,
  };
}

export async function restoreFromLocalSelfBackup(
  restoredBy = 'Admin'
): Promise<{ totalRestored: number; collectionsRestored: number }> {
  const raw = localStorage.getItem(AUTO_SELF_BACKUP_STORAGE_KEY);
  if (!raw) {
    throw new Error('No local browser self-backup found yet.');
  }
  const payload = JSON.parse(raw) as FullSystemBackupPayload;
  return await restoreSystemFromPayload(payload, 'merge', restoredBy);
}

export async function createCloudBackupSnapshot(
  label: string,
  createdBy = 'Admin'
): Promise<CloudBackupSnapshot> {
  const payload = await collectFullSystemBackup(createdBy);
  const payloadJson = JSON.stringify(payload);
  const id = `bkp_${Date.now()}`;
  const snapshot: CloudBackupSnapshot = {
    id,
    name: (
      label.trim() ||
      `Auto Snapshot ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
    ).slice(0, 140),
    createdBy: createdBy.slice(0, 110),
    createdAt: new Date().toISOString(),
    counts: payload.counts,
    payloadJson,
    checksum: payload.checksum,
  };

  await setDoc(doc(db, 'backups', id), {
    name: snapshot.name,
    createdBy: snapshot.createdBy,
    createdAt: snapshot.createdAt,
    counts: snapshot.counts,
    payloadJson: snapshot.payloadJson,
    checksum: snapshot.checksum,
  });

  await logStaffActivity(
    'CLOUD_BACKUP_CREATED',
    `Cloud backup snapshot "${snapshot.name}" saved (${snapshot.checksum})`
  );

  return snapshot;
}

export async function listCloudBackupSnapshots(): Promise<
  CloudBackupSnapshot[]
> {
  const snap = await getDocs(collection(db, 'backups'));
  return snap.docs
    .map((d) => ({
      id: d.id,
      ...(d.data() as Omit<CloudBackupSnapshot, 'id'>),
    }))
    .sort((a, b) =>
      String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
    );
}

export async function deleteCloudBackupSnapshot(id: string): Promise<void> {
  await deleteDoc(doc(db, 'backups', id));
  await logStaffActivity(
    'CLOUD_BACKUP_DELETED',
    `Deleted cloud backup snapshot ${id}`
  );
}

export async function restoreSystemFromPayload(
  payload: FullSystemBackupPayload,
  mode: 'merge' | 'replace' = 'merge',
  restoredBy = 'Admin'
): Promise<{ totalRestored: number; collectionsRestored: number }> {
  if (!payload || typeof payload !== 'object' || !payload.collections) {
    throw new Error(
      'Invalid backup file format: missing collections structure.'
    );
  }

  let totalRestored = 0;
  let collectionsRestored = 0;

  for (const colName of BACKUP_COLLECTIONS) {
    const incomingRows = payload.collections[colName];
    if (!Array.isArray(incomingRows)) continue;

    collectionsRestored += 1;

    if (
      mode === 'replace' &&
      colName !== 'settings' &&
      colName !== 'counters'
    ) {
      const existingSnap = await getDocs(collection(db, colName));
      const incomingIds = new Set(incomingRows.map((r) => String(r.id)));
      for (const existingDoc of existingSnap.docs) {
        if (!incomingIds.has(existingDoc.id)) {
          try {
            await deleteDoc(doc(db, colName, existingDoc.id));
          } catch {
            // ignore delete restrictions on protected docs
          }
        }
      }
    }

    for (const row of incomingRows) {
      if (!row || !row.id || !row.data || typeof row.data !== 'object')
        continue;
      const safeId = String(row.id).replace(/[^a-zA-Z0-9_-]/g, '_');
      await setDoc(doc(db, colName, safeId), row.data, {
        merge: mode === 'merge',
      });
      totalRestored += 1;
    }
  }

  await logStaffActivity(
    'SYSTEM_RESTORE_COMPLETED',
    `Restored ${totalRestored} records across ${collectionsRestored} collections (mode: ${mode.toUpperCase()}) by ${restoredBy}`
  );

  return { totalRestored, collectionsRestored };
}

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(',')),
  ];
  const blob = new Blob([csvLines.join('\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
