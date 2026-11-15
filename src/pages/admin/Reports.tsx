import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import {
  AlertTriangle,
  Clock,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  IndianRupee,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react';
import { db } from '../../firebase';
import { getExpiryStatus, getMarginColorClass } from '../../utils/invoiceNo';
import {
  downloadSystemBackupJson,
  exportRowsToCsv,
} from '../../utils/backupRestore';

interface DoctorAppointmentSummary {
  doctorName: string;
  total: number;
  booked: number;
  completed: number;
  cancelled: number;
}

interface ExpiringBatchRow {
  id: string;
  medicineName: string;
  batchNo: string;
  expiryDate: string;
  daysLeft: number;
  status: 'expired' | 'expiring_soon' | 'ok';
  stock: number;
  costPrice: number;
  sellPrice: number;
  marginPercent: number;
}

interface LowStockMedicineRow {
  id: string;
  name: string;
  brand: string;
  genericName: string;
  scheduleType: string;
  reorderLevel: number;
  totalStock: number;
}

export const Reports: React.FC = () => {
  const [todaySales, setTodaySales] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [monthProfit, setMonthProfit] = useState(0);
  const [totalGstCollected, setTotalGstCollected] = useState(0);
  const [cashTotal, setCashTotal] = useState(0);
  const [upiTotal, setUpiTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [stockValuationCost, setStockValuationCost] = useState(0);
  const [stockValuationSell, setStockValuationSell] = useState(0);

  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [expiringBatches, setExpiringBatches] = useState<ExpiringBatchRow[]>(
    []
  );
  const [lowStockMedicines, setLowStockMedicines] = useState<
    LowStockMedicineRow[]
  >([]);
  const [doctorStats, setDoctorStats] = useState<DoctorAppointmentSummary[]>(
    []
  );
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'sales' | 'expiry' | 'lowstock' | 'doctors' | 'audit'
  >('overview');
  const [backingUp, setBackingUp] = useState(false);

  const loadReports = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const currentMonthPrefix = todayStr.slice(0, 7);

      const [invSnap, aptSnap, medSnap, batchSnap, actSnap] = await Promise.all(
        [
          getDocs(collection(db, 'invoices')),
          getDocs(collection(db, 'appointments')),
          getDocs(collection(db, 'medicines')),
          getDocs(collection(db, 'batches')),
          getDocs(collection(db, 'staff_activity')),
        ]
      );

      let tSales = 0;
      let tProfit = 0;
      let mSales = 0;
      let mProfit = 0;
      let gstSum = 0;
      let cashSum = 0;
      let upiSum = 0;
      let pendSum = 0;

      const invRows = invSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
        .sort((a: any, b: any) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        );

      invRows.forEach((data: any) => {
        const grand = Number(data.grandTotal ?? data.total ?? 0);
        const profit = Number(data.totalProfit ?? data.grossProfit ?? 0);
        const gst = Number(data.totalGst ?? 0);
        const created = String(data.createdAt || '');

        if (data.paymentStatus === 'paid') {
          gstSum += gst;
          if (data.paymentMode === 'upi') upiSum += grand;
          else cashSum += grand;

          if (created.startsWith(todayStr)) {
            tSales += grand;
            tProfit += profit;
          }
          if (created.startsWith(currentMonthPrefix)) {
            mSales += grand;
            mProfit += profit;
          }
        } else {
          pendSum += grand;
        }
      });

      const stockByMedicine = new Map<string, number>();
      const expRows: ExpiringBatchRow[] = [];
      let valCost = 0;
      let valSell = 0;

      batchSnap.docs.forEach((b) => {
        const data = b.data();
        const medId = String(data.medicineId || '');
        const stockVal = Number(data.stock || 0);
        const costVal = Number(data.costPrice || 0);
        const sellVal = Number(data.sellPrice || 0);

        valCost += stockVal * costVal;
        valSell += stockVal * sellVal;

        stockByMedicine.set(
          medId,
          (stockByMedicine.get(medId) || 0) + stockVal
        );

        const expInfo = getExpiryStatus(String(data.expiryDate || ''));
        if (
          expInfo.status === 'expired' ||
          expInfo.status === 'expiring_soon'
        ) {
          expRows.push({
            id: b.id,
            medicineName: String(data.medicineName || ''),
            batchNo: String(data.batchNo || ''),
            expiryDate: String(data.expiryDate || ''),
            daysLeft: expInfo.daysLeft,
            status: expInfo.status,
            stock: stockVal,
            costPrice: costVal,
            sellPrice: sellVal,
            marginPercent: Number(data.marginPercent || 0),
          });
        }
      });

      expRows.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

      const lowRows: LowStockMedicineRow[] = [];
      medSnap.docs.forEach((m) => {
        const data = m.data();
        const reorder = Number(data.reorderLevel ?? 10);
        const totalStock = stockByMedicine.get(m.id) || 0;
        if (totalStock < reorder) {
          lowRows.push({
            id: m.id,
            name: String(data.name || ''),
            brand: String(data.brand || ''),
            genericName: String(data.genericName || ''),
            scheduleType: String(
              data.scheduleType || data.schedule || 'OTC'
            ),
            reorderLevel: reorder,
            totalStock,
          });
        }
      });

      const docMap = new Map<string, DoctorAppointmentSummary>();
      aptSnap.docs.forEach((d) => {
        const data = d.data();
        const dName = String(data.doctorName || 'Unassigned Doctor');
        const entry = docMap.get(dName) || {
          doctorName: dName,
          total: 0,
          booked: 0,
          completed: 0,
          cancelled: 0,
        };
        entry.total += 1;
        if (data.status === 'booked') entry.booked += 1;
        if (data.status === 'completed') entry.completed += 1;
        if (data.status === 'cancelled') entry.cancelled += 1;
        docMap.set(dName, entry);
      });

      const actRows = actSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }))
        .sort((a: any, b: any) =>
          String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
        );

      setTodaySales(tSales);
      setTodayProfit(tProfit);
      setMonthSales(mSales);
      setMonthProfit(mProfit);
      setTotalGstCollected(gstSum);
      setCashTotal(cashSum);
      setUpiTotal(upiSum);
      setPendingTotal(pendSum);
      setStockValuationCost(valCost);
      setStockValuationSell(valSell);
      setAllInvoices(invRows);
      setExpiringBatches(expRows);
      setLowStockMedicines(lowRows);
      setDoctorStats(Array.from(docMap.values()));
      setAuditLogs(actRows);
    } catch (err) {
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, []);

  const handleQuickBackupDownload = async () => {
    setBackingUp(true);
    try {
      await downloadSystemBackupJson('Super Admin');
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#000080] text-white px-4 py-3 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono text-amber-300 uppercase">
            SANDANA CLINIC + DUDRUCS — MASTER MIS &amp; FINANCIAL ANALYTICS
          </p>
          <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide">
            Complete Clinic &amp; Pharmacy Reports, GST, Stock Valuation &amp;
            Audit Control
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={loadReports}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold rounded border border-blue-500"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            type="button"
            disabled={backingUp}
            onClick={handleQuickBackupDownload}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded"
          >
            <Download size={13} />
            {backingUp ? 'Exporting...' : '1-Click JSON Backup'}
          </button>
          <Link
            to="/admin/backup"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded"
          >
            <DatabaseBackup size={13} />
            Backup &amp; Restore Center
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        <div className="bg-white border border-slate-300 rounded p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">
            Today Sales
          </p>
          <p className="text-base font-bold font-mono text-slate-900">
            {loading ? '...' : `₹${todaySales.toFixed(2)}`}
          </p>
        </div>
        <div className="bg-white border border-slate-300 rounded p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">
            Today Profit
          </p>
          <p className="text-base font-bold font-mono text-green-700">
            {loading ? '...' : `₹${todayProfit.toFixed(2)}`}
          </p>
        </div>
        <div className="bg-white border border-slate-300 rounded p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">
            Month Sales
          </p>
          <p className="text-base font-bold font-mono text-[#000080]">
            {loading ? '...' : `₹${monthSales.toFixed(2)}`}
          </p>
        </div>
        <div className="bg-white border border-slate-300 rounded p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">
            Month Profit
          </p>
          <p className="text-base font-bold font-mono text-green-700">
            {loading ? '...' : `₹${monthProfit.toFixed(2)}`}
          </p>
        </div>
        <div className="bg-white border border-slate-300 rounded p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">
            Total GST
          </p>
          <p className="text-base font-bold font-mono text-slate-900">
            {loading ? '...' : `₹${totalGstCollected.toFixed(2)}`}
          </p>
        </div>
        <div className="bg-white border border-slate-300 rounded p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">
            Cash / UPI Paid
          </p>
          <p className="text-xs font-bold font-mono text-slate-800 mt-0.5">
            C: ₹{cashTotal.toFixed(0)} | U: ₹{upiTotal.toFixed(0)}
          </p>
        </div>
        <div className="bg-white border border-slate-300 rounded p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">
            Stock Cost Val
          </p>
          <p className="text-base font-bold font-mono text-slate-900">
            {loading ? '...' : `₹${stockValuationCost.toFixed(0)}`}
          </p>
        </div>
        <div className="bg-white border border-slate-300 rounded p-3">
          <p className="text-[10px] font-bold uppercase text-slate-500">
            Stock Sell Val
          </p>
          <p className="text-base font-bold font-mono text-green-700">
            {loading ? '...' : `₹${stockValuationSell.toFixed(0)}`}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-300 rounded p-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'overview', label: 'All Reports Overview' },
            { id: 'sales', label: `Sales & GST Bills (${allInvoices.length})` },
            {
              id: 'expiry',
              label: `Expiring / Expired (${expiringBatches.length})`,
            },
            {
              id: 'lowstock',
              label: `Low Stock (${lowStockMedicines.length})`,
            },
            {
              id: 'doctors',
              label: `Doctor OPD Report (${doctorStats.length})`,
            },
            {
              id: 'audit',
              label: `Security Audit Log (${auditLogs.length})`,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 rounded text-xs font-bold transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#000080] text-white'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              exportRowsToCsv(
                `Dudrucs_Sales_Bills_${new Date().toISOString().slice(0, 10)}.csv`,
                [
                  'Invoice No',
                  'Date',
                  'Customer',
                  'Phone',
                  'Operator',
                  'Mode',
                  'Status',
                  'GST',
                  'Profit',
                  'Grand Total',
                ],
                allInvoices.map((inv) => [
                  inv.invoiceNo,
                  inv.createdAt,
                  inv.customerName,
                  inv.customerPhone || '',
                  inv.staffName,
                  inv.paymentMode,
                  inv.paymentStatus,
                  Number(inv.totalGst || 0).toFixed(2),
                  Number(inv.totalProfit ?? inv.grossProfit ?? 0).toFixed(2),
                  Number(inv.grandTotal || 0).toFixed(2),
                ])
              )
            }
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-50 hover:bg-green-100 border border-green-300 text-green-800 text-[11px] font-bold rounded"
          >
            <FileSpreadsheet size={13} />
            Export Sales CSV
          </button>
          <button
            type="button"
            onClick={() =>
              exportRowsToCsv(
                `Dudrucs_Expiry_Batches_${new Date().toISOString().slice(0, 10)}.csv`,
                [
                  'Medicine',
                  'Batch No',
                  'Expiry Date',
                  'Days Left',
                  'Status',
                  'Cost Price',
                  'Sell Price',
                  'Stock',
                ],
                expiringBatches.map((b) => [
                  b.medicineName,
                  b.batchNo,
                  b.expiryDate,
                  b.daysLeft,
                  b.status,
                  b.costPrice,
                  b.sellPrice,
                  b.stock,
                ])
              )
            }
            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-bold rounded"
          >
            <FileSpreadsheet size={13} />
            Export Expiry CSV
          </button>
        </div>
      </div>

      {(activeTab === 'overview' || activeTab === 'sales') && (
        <div className="bg-white border border-slate-300 rounded overflow-hidden">
          <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IndianRupee size={16} className="text-[#000080]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080]">
                Pharmacy Sales, GST &amp; Margin Register ({allInvoices.length}{' '}
                Invoices · Pending Receivables: ₹{pendingTotal.toFixed(2)})
              </h2>
            </div>
            <Link
              to="/pharmacy/invoices"
              className="text-xs font-bold text-green-700 hover:underline"
            >
              Open Full Receipt Register →
            </Link>
          </div>
          {allInvoices.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">
              No pharmacy invoices generated yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 font-bold">Invoice No</th>
                    <th className="py-2.5 px-3 font-bold">Date</th>
                    <th className="py-2.5 px-3 font-bold">Customer</th>
                    <th className="py-2.5 px-3 font-bold">Operator</th>
                    <th className="py-2.5 px-3 font-bold">Mode / Status</th>
                    <th className="py-2.5 px-3 font-bold text-right">GST</th>
                    <th className="py-2.5 px-3 font-bold text-right">Profit</th>
                    <th className="py-2.5 px-3 font-bold text-right">
                      Grand Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allInvoices.slice(0, 25).map((inv) => (
                    <tr key={inv.id} className="hover:bg-blue-50/30">
                      <td className="py-2 px-3 font-mono font-bold text-[#000080]">
                        {inv.invoiceNo}
                      </td>
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {new Date(inv.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-semibold">
                        {inv.customerName || 'Walk-in'}
                      </td>
                      <td className="py-2 px-3">{inv.staffName}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                            inv.paymentStatus === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inv.paymentMode} · {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        ₹{Number(inv.totalGst || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-green-700 font-semibold">
                        ₹
                        {Number(
                          inv.totalProfit ?? inv.grossProfit ?? 0
                        ).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        ₹{Number(inv.grandTotal || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'overview' || activeTab === 'expiry') && (
        <div className="bg-white border border-slate-300 rounded overflow-hidden">
          <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080]">
                Expiring Soon (Next 90 Days) &amp; Expired Batches
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-600">
              {expiringBatches.length} batches
            </span>
          </div>

          {expiringBatches.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">
              No batches are expiring within the next 90 days.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 font-bold">Medicine</th>
                    <th className="py-2.5 px-3 font-bold">Batch No</th>
                    <th className="py-2.5 px-3 font-bold">Expiry Date</th>
                    <th className="py-2.5 px-3 font-bold">Status</th>
                    <th className="py-2.5 px-3 font-bold text-right">Cost</th>
                    <th className="py-2.5 px-3 font-bold text-right">
                      Sell Price
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right">
                      Margin %
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right">Stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expiringBatches.map((b) => (
                    <tr
                      key={b.id}
                      className={
                        b.status === 'expired'
                          ? 'bg-red-50/90 text-red-950'
                          : 'bg-amber-50/90 text-amber-950'
                      }
                    >
                      <td className="py-2.5 px-3 font-semibold">
                        {b.medicineName}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-semibold">
                        {b.batchNo}
                      </td>
                      <td className="py-2.5 px-3 font-mono">{b.expiryDate}</td>
                      <td className="py-2.5 px-3 font-mono font-bold">
                        {b.status === 'expired'
                          ? `EXPIRED (${Math.abs(b.daysLeft)}d ago)`
                          : `${b.daysLeft} days left`}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        ₹{b.costPrice.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        ₹{b.sellPrice.toFixed(2)}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono ${getMarginColorClass(
                          b.marginPercent
                        )}`}
                      >
                        {b.marginPercent.toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {b.stock}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'overview' || activeTab === 'lowstock') && (
        <div className="bg-white border border-slate-300 rounded overflow-hidden">
          <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080]">
                Low Stock Re-Order Report (Total Batch Stock &lt; Reorder Level)
              </h2>
            </div>
            <span className="text-xs font-mono text-slate-600">
              {lowStockMedicines.length} medicines
            </span>
          </div>

          {lowStockMedicines.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">
              All medicines have total batch stock at or above their reorder
              level.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 font-bold">Medicine Name</th>
                    <th className="py-2.5 px-3 font-bold">Brand &amp; Generic</th>
                    <th className="py-2.5 px-3 font-bold">Schedule</th>
                    <th className="py-2.5 px-3 font-bold text-right">
                      Reorder Level
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right">
                      Total Stock
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {lowStockMedicines.map((m) => (
                    <tr key={m.id} className="bg-red-50/60 hover:bg-red-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {m.name}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {m.brand} · {m.genericName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        Schedule {m.scheduleType}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {m.reorderLevel}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-red-700">
                        {m.totalStock}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'overview' || activeTab === 'doctors') && (
        <div className="bg-white border border-slate-300 rounded overflow-hidden">
          <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Stethoscope size={16} className="text-green-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080]">
                Doctor-Wise OPD Appointment Summary
              </h2>
            </div>
          </div>
          {doctorStats.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">
              No appointments recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 font-bold">Doctor Name</th>
                    <th className="py-2.5 px-3 font-bold text-right">Booked</th>
                    <th className="py-2.5 px-3 font-bold text-right">
                      Completed
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right">
                      Cancelled
                    </th>
                    <th className="py-2.5 px-3 font-bold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctorStats.map((row) => (
                    <tr key={row.doctorName} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {row.doctorName}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {row.booked}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-green-700 font-semibold">
                        {row.completed}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">
                        {row.cancelled}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        {row.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {(activeTab === 'overview' || activeTab === 'audit') && (
        <div className="bg-white border border-slate-300 rounded overflow-hidden">
          <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-[#000080]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080]">
                Operator Security &amp; Activity Audit Trail (`staff_activity`)
              </h2>
            </div>
            <Link
              to="/admin/activity"
              className="text-xs font-bold text-green-700 hover:underline"
            >
              Open Full Audit Log →
            </Link>
          </div>
          {auditLogs.length === 0 ? (
            <div className="p-6 text-xs text-slate-500">
              No operator actions recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2.5 px-3 font-bold">Timestamp</th>
                    <th className="py-2.5 px-3 font-bold">Operator</th>
                    <th className="py-2.5 px-3 font-bold">Action</th>
                    <th className="py-2.5 px-3 font-bold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.slice(0, 20).map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {new Date(act.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-bold">{act.staffName}</td>
                      <td className="py-2 px-3 font-mono font-bold text-[#000080]">
                        {act.action}
                      </td>
                      <td className="py-2 px-3">{act.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
