import React, { useEffect, useRef, useState } from 'react';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useReactToPrint } from 'react-to-print';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import {
  FileSpreadsheet,
  IndianRupee,
  Printer,
  RefreshCw,
  Users,
  Eye,
} from 'lucide-react';
import { db } from '../../firebase';
import { A4BillTemplate } from '../../components/A4BillTemplate';

interface StaffSummaryRow {
  staffKey: string;
  staffId: string;
  staffName: string;
  billCount: number;
  paidSalesTotal: number;
  pendingSalesTotal: number;
  totalProfit: number;
  totalGst: number;
  invoices: any[];
}

export const StaffReports: React.FC = () => {
  const [staffSummaries, setStaffSummaries] = useState<StaffSummaryRow[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<StaffSummaryRow | null>(
    null
  );
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<
    any | null
  >(null);
  const [clinicSettings, setClinicSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const a4PrintRef = useRef<HTMLDivElement>(null);
  const handlePrintA4 = useReactToPrint({
    contentRef: a4PrintRef,
    documentTitle: selectedInvoiceForPrint
      ? `Tax_Invoice_${selectedInvoiceForPrint.invoiceNo}`
      : 'Dudrucs_A4_Tax_Invoice',
  });

  const loadStaffSales = async () => {
    setLoading(true);
    try {
      const [invSnap, setSnap] = await Promise.all([
        getDocs(collection(db, 'invoices')),
        getDoc(doc(db, 'settings', 'clinic')),
      ]);

      if (setSnap.exists()) {
        setClinicSettings(setSnap.data());
      }

      const map = new Map<string, StaffSummaryRow>();

      invSnap.docs.forEach((d) => {
        const inv: Record<string, any> = { id: d.id, ...(d.data() as Record<string, any>) };
        const sName = String(inv.staffName || 'Pharmacy Staff');
        const sId = String(inv.staffId || 'staff');
        const key = `${sName.toLowerCase()}__${sId}`;

        const entry: StaffSummaryRow = map.get(key) || {
          staffKey: key,
          staffId: sId,
          staffName: sName,
          billCount: 0,
          paidSalesTotal: 0,
          pendingSalesTotal: 0,
          totalProfit: 0,
          totalGst: 0,
          invoices: [],
        };

        const grand = Number(inv.grandTotal ?? inv.total ?? 0);
        const profit = Number(inv.totalProfit ?? inv.grossProfit ?? 0);
        const gst = Number(inv.totalGst ?? 0);

        entry.billCount += 1;
        if (inv.paymentStatus === 'paid') {
          entry.paidSalesTotal += grand;
          entry.totalProfit += profit;
          entry.totalGst += gst;
        } else {
          entry.pendingSalesTotal += grand;
        }
        entry.invoices.push(inv);
        map.set(key, entry);
      });

      const list = Array.from(map.values()).sort(
        (a, b) => b.paidSalesTotal - a.paidSalesTotal
      );
      list.forEach((row) => {
        row.invoices.sort((a, b) =>
          String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
        );
      });

      setStaffSummaries(list);
      if (list.length > 0 && !selectedStaff) {
        setSelectedStaff(list[0]);
        if (list[0].invoices.length > 0) {
          setSelectedInvoiceForPrint(list[0].invoices[0]);
        }
      }
    } catch (err) {
      console.error('Error loading staff sales report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaffSales();
  }, []);

  const handleExportExcel = () => {
    const summarySheet = staffSummaries.map((s) => ({
      StaffName: s.staffName,
      StaffID: s.staffId,
      TotalBillsGenerated: s.billCount,
      PaidSalesTotal: Number(s.paidSalesTotal.toFixed(2)),
      PendingSalesTotal: Number(s.pendingSalesTotal.toFixed(2)),
      TotalGSTCollected: Number(s.totalGst.toFixed(2)),
      TotalNetProfit: Number(s.totalProfit.toFixed(2)),
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(summarySheet),
      'Staff_Sales_Summary'
    );
    if (selectedStaff) {
      const invSheet = selectedStaff.invoices.map((i) => ({
        InvoiceNo: i.invoiceNo,
        Date: i.createdAt,
        Customer: i.customerName || 'Walk-In',
        Phone: i.customerPhone || '',
        Mode: i.paymentMode || 'cash',
        Status: i.paymentStatus,
        GST: Number(i.totalGst || 0).toFixed(2),
        Profit: Number(i.totalProfit ?? i.grossProfit ?? 0).toFixed(2),
        GrandTotal: Number(i.grandTotal || 0).toFixed(2),
      }));
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(invSheet),
        'Selected_Staff_Bills'
      );
    }
    XLSX.writeFile(
      wb,
      `Dudrucs_Staff_Wise_Sales_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleExportCsv = () => {
    const rows = staffSummaries.map((s) => ({
      StaffName: s.staffName,
      StaffID: s.staffId,
      TotalBills: s.billCount,
      PaidSales: s.paidSalesTotal.toFixed(2),
      PendingSales: s.pendingSalesTotal.toFixed(2),
      TotalGST: s.totalGst.toFixed(2),
      TotalProfit: s.totalProfit.toFixed(2),
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Dudrucs_Staff_Wise_Sales_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#000080] text-white px-4 py-3 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-mono text-amber-300 uppercase">
            ADMINISTRATION — STAFF-WISE PHARMACY SALES &amp; BILLING AUDIT
          </p>
          <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide flex items-center gap-2">
            <Users size={18} />
            Staff-Wise Sales Report, Profit &amp; Individual Invoice Drilldown
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded"
          >
            <FileSpreadsheet size={13} />
            Export .XLSX
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded"
          >
            <FileSpreadsheet size={13} />
            Export .CSV
          </button>
          <button
            type="button"
            onClick={loadStaffSales}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-800 hover:bg-blue-700 text-white text-xs font-bold rounded border border-blue-500"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Staff Summary Table */}
      <div className="bg-white border border-slate-300 rounded overflow-hidden">
        <div className="px-4 py-3 bg-slate-100 border-b border-slate-300 flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080]">
            Click Any Staff Member Below to View Their Specific Invoices
          </h2>
          <span className="text-xs font-mono text-slate-600">
            {staffSummaries.length} Active Operators with Bills
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                <th className="py-2.5 px-3 font-bold">Pharmacy Staff Name</th>
                <th className="py-2.5 px-3 font-bold">Staff ID</th>
                <th className="py-2.5 px-3 font-bold text-right">
                  Total Bills Generated
                </th>
                <th className="py-2.5 px-3 font-bold text-right">
                  Paid Sales (₹)
                </th>
                <th className="py-2.5 px-3 font-bold text-right">
                  Pending Bills (₹)
                </th>
                <th className="py-2.5 px-3 font-bold text-right">
                  GST Collected (₹)
                </th>
                <th className="py-2.5 px-3 font-bold text-right">
                  Net Profit (₹)
                </th>
                <th className="py-2.5 px-3 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {staffSummaries.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-8 text-center text-slate-500 text-xs"
                  >
                    No pharmacy bills generated yet.
                  </td>
                </tr>
              ) : (
                staffSummaries.map((s) => {
                  const isSelected = selectedStaff?.staffKey === s.staffKey;
                  return (
                    <tr
                      key={s.staffKey}
                      onClick={() => {
                        setSelectedStaff(s);
                        if (s.invoices.length > 0) {
                          setSelectedInvoiceForPrint(s.invoices[0]);
                        }
                      }}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-100/80 font-semibold'
                          : 'hover:bg-blue-50/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-bold text-[#000080] underline">
                        {s.staffName}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                        {s.staffId}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold">
                        {s.billCount}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                        ₹{s.paidSalesTotal.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-700">
                        ₹{s.pendingSalesTotal.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        ₹{s.totalGst.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-green-700">
                        ₹{s.totalProfit.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#000080] text-white rounded text-[11px] font-bold"
                        >
                          <Eye size={12} />
                          View {s.billCount} Bills
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Staff Member's Invoices Drilldown */}
      {selectedStaff && (
        <div className="bg-white border border-slate-300 rounded overflow-hidden">
          <div className="px-4 py-3 bg-[#000080] text-white flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <IndianRupee size={16} className="text-amber-300" />
              <h3 className="text-xs font-bold uppercase tracking-wider">
                Invoices Generated by {selectedStaff.staffName} (
                {selectedStaff.invoices.length} Bills · Total Paid: ₹
                {selectedStaff.paidSalesTotal.toFixed(2)})
              </h3>
            </div>
            {selectedInvoiceForPrint && (
              <button
                type="button"
                onClick={() => handlePrintA4()}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded"
              >
                <Printer size={13} />
                Print Selected Bill #{selectedInvoiceForPrint.invoiceNo} (A4
                GST)
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-300 text-slate-700">
                  <th className="py-2 px-3 font-bold">Invoice No</th>
                  <th className="py-2 px-3 font-bold">Date &amp; Time</th>
                  <th className="py-2 px-3 font-bold">Customer</th>
                  <th className="py-2 px-3 font-bold">Items</th>
                  <th className="py-2 px-3 font-bold">Mode / Status</th>
                  <th className="py-2 px-3 font-bold text-right">GST</th>
                  <th className="py-2 px-3 font-bold text-right">Profit</th>
                  <th className="py-2 px-3 font-bold text-right">
                    Grand Total
                  </th>
                  <th className="py-2 px-3 font-bold text-right">
                    A4 GST Print
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {selectedStaff.invoices.map((inv) => (
                  <tr
                    key={inv.id}
                    className={
                      selectedInvoiceForPrint?.id === inv.id
                        ? 'bg-amber-50/70'
                        : 'hover:bg-slate-50'
                    }
                  >
                    <td className="py-2 px-3 font-mono font-bold text-[#000080]">
                      {inv.invoiceNo}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px]">
                      {new Date(inv.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-semibold">
                      {inv.customerName || 'Walk-in'}{' '}
                      {inv.customerPhone ? `(${inv.customerPhone})` : ''}
                    </td>
                    <td className="py-2 px-3 font-mono">
                      {Array.isArray(inv.items) ? inv.items.length : 0} items
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                          inv.paymentStatus === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {inv.paymentMode || 'cash'} · {inv.paymentStatus}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono">
                      ₹{Number(inv.totalGst || 0).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-green-700 font-semibold">
                      ₹
                      {Number(inv.totalProfit ?? inv.grossProfit ?? 0).toFixed(
                        2
                      )}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      ₹{Number(inv.grandTotal || 0).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInvoiceForPrint(inv);
                          setTimeout(() => handlePrintA4(), 80);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-[11px] font-bold"
                      >
                        <Printer size={12} />
                        A4 Print
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Hidden/Preview A4 Printable Bill */}
      {selectedInvoiceForPrint && (
        <div className="bg-slate-100 border border-slate-300 rounded p-4">
          <div className="flex items-center justify-between mb-3 print:hidden">
            <span className="text-xs font-bold uppercase text-[#000080]">
              A4 GST Tax Invoice Preview — #{selectedInvoiceForPrint.invoiceNo}
            </span>
            <button
              type="button"
              onClick={() => handlePrintA4()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#000080] text-white text-xs font-bold rounded"
            >
              <Printer size={13} />
              Print A4 Bill Now
            </button>
          </div>
          <A4BillTemplate
            ref={a4PrintRef}
            invoice={selectedInvoiceForPrint}
            clinicSettings={clinicSettings}
          />
        </div>
      )}
    </div>
  );
};

export default StaffReports;
