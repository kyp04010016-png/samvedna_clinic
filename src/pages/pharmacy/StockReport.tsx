import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  AlertTriangle,
  Clock,
  FileSpreadsheet,
  Layers,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { db } from '../../firebase';
import {
  calculateMarginPercent,
  getExpiryStatus,
  getMarginColorClass,
} from '../../utils/invoiceNo';
import { BatchDoc } from './Stock';
import { logStaffActivity } from '../../utils/activityLogger';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';

type ReportFilter = 'all' | 'expiry' | 'low';

export const StockReport: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = (searchParams.get('filter') as ReportFilter) || 'all';

  const [filter, setFilter] = useState<ReportFilter>(initialFilter);
  const [batches, setBatches] = useState<(BatchDoc & { barcode?: string })[]>(
    []
  );
  const [clinicSettings, setClinicSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const printReportRef = useRef<HTMLDivElement>(null);
  const handlePrintA4Stock = useReactToPrint({
    contentRef: printReportRef,
    documentTitle: `Dudrucs_A4_Stock_Report_${new Date().toISOString().slice(0, 10)}`,
  });

  useEffect(() => {
    const f = searchParams.get('filter') as ReportFilter;
    if (f && ['all', 'expiry', 'low'].includes(f)) {
      setFilter(f);
    }
  }, [searchParams]);

  const handleFilterChange = (next: ReportFilter) => {
    setFilter(next);
    setSearchParams({ filter: next });
  };

  const loadBatches = async () => {
    setLoading(true);
    try {
      const [snap, setSnap] = await Promise.all([
        getDocs(collection(db, 'batches')),
        getDoc(doc(db, 'settings', 'clinic')),
      ]);
      if (setSnap.exists()) {
        setClinicSettings(setSnap.data());
      }
      const list = snap.docs.map((b) => ({
        id: b.id,
        ...(b.data() as Omit<BatchDoc, 'id'> & { barcode?: string }),
      }));
      list.sort((a, b) =>
        (a.expiryDate || '').localeCompare(b.expiryDate || '')
      );
      setBatches(list);
    } catch (err) {
      console.error('Error loading StockReport:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBatches();
  }, []);

  const handleDeleteBatch = async (batch: BatchDoc) => {
    setToastMsg(null);
    try {
      await deleteDoc(doc(db, 'batches', batch.id));
      await logStaffActivity(
        'DELETE_BATCH_STOCK_REPORT',
        `Deleted batch ${batch.batchNo} (${batch.medicineName}) from Stock Report`
      );
      setToastMsg(
        `Deleted Batch ${batch.batchNo} (${batch.medicineName}) from inventory.`
      );
      await loadBatches();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `batches/${batch.id}`);
    }
  };

  const filteredBatches = batches.filter((b) => {
    const exp = getExpiryStatus(b.expiryDate);
    if (filter === 'expiry') {
      return exp.status === 'expired' || exp.status === 'expiring_soon';
    }
    if (filter === 'low') {
      return Number(b.stock) < 10;
    }
    return true;
  });

  const handleExportExcel = () => {
    const rows = filteredBatches.map((b) => ({
      MedicineName: b.medicineName,
      BatchNo: b.batchNo,
      Barcode: b.barcode || b.batchNo,
      ExpiryDate: b.expiryDate,
      CostPrice: Number(b.costPrice || 0),
      MRP: Number(b.mrp || 0),
      SellPrice: Number(b.sellPrice || 0),
      MarginPercent: Number(
        calculateMarginPercent(Number(b.costPrice), Number(b.sellPrice)).toFixed(
          2
        )
      ),
      Stock: Number(b.stock || 0),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock_Batches');
    XLSX.writeFile(
      wb,
      `Dudrucs_Stock_Report_${filter}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleExportCsv = () => {
    const rows = filteredBatches.map((b) => ({
      MedicineName: b.medicineName,
      BatchNo: b.batchNo,
      Barcode: b.barcode || b.batchNo,
      ExpiryDate: b.expiryDate,
      CostPrice: Number(b.costPrice || 0),
      MRP: Number(b.mrp || 0),
      SellPrice: Number(b.sellPrice || 0),
      MarginPercent: calculateMarginPercent(
        Number(b.costPrice),
        Number(b.sellPrice)
      ).toFixed(2),
      Stock: Number(b.stock || 0),
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dudrucs_Stock_Report_${filter}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      <div className="bg-gradient-to-r from-[#000080] via-blue-900 to-indigo-950 text-white px-4 py-3 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-extrabold tracking-wider uppercase">
          MARG STOCK STATUS, BARCODE &amp; BATCH EXPIRY REPORT (A4 PRINTABLE &amp; DELETE READY)
        </span>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => handleFilterChange('all')}
            className={`px-3 py-1 rounded-lg font-bold inline-flex items-center gap-1 transition-all ${
              filter === 'all'
                ? 'bg-amber-400 text-slate-950 shadow-2xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Layers size={13} />
            All Batches ({batches.length})
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('expiry')}
            className={`px-3 py-1 rounded-lg font-bold inline-flex items-center gap-1 transition-all ${
              filter === 'expiry'
                ? 'bg-amber-400 text-slate-950 shadow-2xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Clock size={13} />
            Expiring ≤90d / Expired
          </button>
          <button
            type="button"
            onClick={() => handleFilterChange('low')}
            className={`px-3 py-1 rounded-lg font-bold inline-flex items-center gap-1 transition-all ${
              filter === 'low'
                ? 'bg-amber-400 text-slate-950 shadow-2xs'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            <AlertTriangle size={13} />
            Low Stock (&lt;10)
          </button>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 bg-green-50 border border-green-300 rounded-xl text-xs font-bold text-green-800 shadow-xs">
          {toastMsg}
        </div>
      )}

      <div className="bg-white border border-slate-300 rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-300 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-4 font-semibold">
            <span className="text-red-700">
              ■ Red Row: Stock &lt; 10 or Expired Batch
            </span>
            <span className="text-amber-800">
              ■ Yellow Row: Expiring within 90 Days
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handlePrintA4Stock()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded-lg shadow-2xs"
            >
              <Printer size={13} />
              Print A4 Stock Report
            </button>
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-700 hover:bg-green-800 text-white font-bold rounded-lg shadow-2xs"
            >
              <FileSpreadsheet size={13} />
              Export .XLSX
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg shadow-2xs"
            >
              <FileSpreadsheet size={13} />
              Export .CSV
            </button>
            <Link
              to="/pharmacy/masters?tab=batch"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg shadow-2xs"
            >
              <Plus size={13} />
              Add Batch / Import Excel
            </Link>
          </div>
        </div>

        <div ref={printReportRef} className="print:p-6">
          {/* Print-only A4 Header with GST Number */}
          <div className="hidden print:flex items-start justify-between border-b-2 border-slate-900 pb-3 mb-4">
            <div>
              <h1 className="text-lg font-extrabold uppercase">
                {clinicSettings.medicalName ||
                  'SANDANA CLINIC + DUDRUCS PHARMACY'}{' '}
                — A4 STOCK &amp; EXPIRY REPORT
              </h1>
              <p className="text-xs text-slate-600">
                {clinicSettings.clinicAddress ||
                  'Main Road, Sandana Clinic Campus'}{' '}
                · Phone: {clinicSettings.clinicPhone || '+91 98400 11223'}
              </p>
            </div>
            <div className="text-right font-mono text-xs">
              <div className="font-bold">
                GSTIN: {clinicSettings.gstNo || '33AABCS1429B1Z5'}
              </div>
              <div>Date: {new Date().toLocaleDateString()}</div>
            </div>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Loading batch stock status...
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No batches match the selected filter.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-[#000080] text-white print:bg-slate-200 print:text-slate-950">
                    <th className="py-2 px-3">Medicine Name</th>
                    <th className="py-2 px-3">Batch No</th>
                    <th className="py-2 px-3">Barcode</th>
                    <th className="py-2 px-3">Expiry Date</th>
                    <th className="py-2 px-3">Expiry Status</th>
                    <th className="py-2 px-3 text-right">Cost</th>
                    <th className="py-2 px-3 text-right">MRP</th>
                    <th className="py-2 px-3 text-right">Sell Price</th>
                    <th className="py-2 px-3 text-right">Margin %</th>
                    <th className="py-2 px-3 text-right">Current Stock</th>
                    <th className="py-2 px-3 text-right no-print">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredBatches.map((b) => {
                    const exp = getExpiryStatus(b.expiryDate);
                    const isLowStock = Number(b.stock) < 10;
                    const marginPct = calculateMarginPercent(
                      Number(b.costPrice),
                      Number(b.sellPrice)
                    );

                    const rowClass =
                      exp.status === 'expired' || isLowStock
                        ? 'bg-red-100/90 text-red-950 font-medium'
                        : exp.status === 'expiring_soon'
                        ? 'bg-amber-100/90 text-amber-950 font-medium'
                        : 'hover:bg-blue-50/40';

                    return (
                      <tr key={b.id} className={rowClass}>
                        <td className="py-2.5 px-3 font-bold">
                          {b.medicineName}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-semibold">
                          {b.batchNo}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px]">
                          {b.barcode || b.batchNo}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {b.expiryDate}
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          {exp.status === 'expired' ? (
                            <span className="text-red-700 font-bold">
                              EXPIRED ({Math.abs(exp.daysLeft)}d ago)
                            </span>
                          ) : exp.status === 'expiring_soon' ? (
                            <span className="text-amber-900 font-bold">
                              Expiring in {exp.daysLeft}d
                            </span>
                          ) : (
                            <span className="text-green-700">
                              Valid ({exp.daysLeft}d)
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          ₹{Number(b.costPrice).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                          ₹{Number(b.mrp).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                          ₹{Number(b.sellPrice).toFixed(2)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono tabular-nums ${getMarginColorClass(
                            marginPct
                          )}`}
                        >
                          {marginPct.toFixed(2)}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold">
                          {b.stock} {isLowStock ? '(LOW)' : ''}
                        </td>
                        <td className="py-2.5 px-3 text-right no-print">
                          <button
                            type="button"
                            onClick={() => handleDeleteBatch(b)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold"
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
          )}
        </div>
      </div>
    </div>
  );
};
