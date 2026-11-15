import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
} from 'firebase/firestore';
import { Printer, Trash2 } from 'lucide-react';
import { db } from '../../firebase';
import { InvoiceRecord, Receipt } from '../../components/Receipt';
import { ClinicSettingsDoc } from '../public/Home';
import { logStaffActivity } from '../../utils/activityLogger';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';

export const Invoices: React.FC = () => {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [settings, setSettings] = useState<Partial<ClinicSettingsDoc>>({});
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const [invSnap, setSnap] = await Promise.all([
        getDocs(collection(db, 'invoices')),
        getDoc(doc(db, 'settings', 'clinic')),
      ]);
      const list: InvoiceRecord[] = invSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as InvoiceRecord),
      }));
      list.sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
      setInvoices(list);
      if (setSnap.exists()) {
        setSettings(setSnap.data() as Partial<ClinicSettingsDoc>);
      }
    } catch (err) {
      console.error('Error loading past invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleDeleteInvoice = async (
    e: React.MouseEvent,
    inv: InvoiceRecord
  ) => {
    e.stopPropagation();
    if (!inv.id) return;
    setToastMsg(null);
    try {
      await deleteDoc(doc(db, 'invoices', inv.id));
      await logStaffActivity(
        'DELETE_INVOICE',
        `Deleted Invoice ${inv.invoiceNo} (₹${inv.grandTotal})`
      );
      setToastMsg(`Deleted Invoice ${inv.invoiceNo} permanently.`);
      await loadInvoices();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `invoices/${inv.id}`);
    }
  };

  if (selectedInvoice) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-6 animate-fade-in-up">
        <Receipt
          invoice={selectedInvoice}
          clinicName={settings.clinicName}
          medicalName={settings.medicalName}
          clinicAddress={settings.clinicAddress}
          medicalPhone={settings.medicalPhone}
          onClose={() => setSelectedInvoice(null)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 space-y-4 animate-fade-in-up">
      <div className="bg-gradient-to-r from-[#000080] via-blue-900 to-indigo-950 text-white px-5 py-3.5 rounded-xl shadow-md flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-sm sm:text-base font-extrabold uppercase tracking-wide">
            DUDRUCS PHARMACY — PAST INVOICES, RECEIPTS &amp; REALIZED PROFIT
          </h1>
          <p className="text-[11px] text-blue-200">
            Click any invoice to view/print its GST receipt or delete cancelled bills
          </p>
        </div>
        <span className="text-xs font-mono font-bold bg-white/15 px-3 py-1 rounded-lg">
          Total Invoices: {invoices.length}
        </span>
      </div>

      {toastMsg && (
        <div className="p-3 bg-green-50 border border-green-300 rounded-xl text-xs font-bold text-green-800 shadow-xs">
          {toastMsg}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Loading invoice history...
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No pharmacy invoices generated yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-[#000080] text-white">
                  <th className="py-3 px-4 font-bold">Invoice No</th>
                  <th className="py-3 px-4 font-bold">Date &amp; Time</th>
                  <th className="py-3 px-4 font-bold">Customer</th>
                  <th className="py-3 px-4 font-bold">Staff</th>
                  <th className="py-3 px-4 font-bold">Payment</th>
                  <th className="py-3 px-4 font-bold text-right">
                    Grand Total
                  </th>
                  <th className="py-3 px-4 font-bold text-right">
                    Net Profit
                  </th>
                  <th className="py-3 px-4 font-bold text-right">
                    Print / Delete
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map((inv) => (
                  <tr
                    key={inv.id || inv.invoiceNo}
                    onClick={() => setSelectedInvoice(inv)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-[#000080]">
                      {inv.invoiceNo}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {inv.createdAt
                        ? new Date(inv.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : ''}
                    </td>
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {inv.customerName || 'Walk-in Customer'}
                      {inv.customerPhone ? ` · ${inv.customerPhone}` : ''}
                    </td>
                    <td className="py-3 px-4 text-slate-700">
                      {(inv as any).staffName || 'Pharmacy Staff'}
                    </td>
                    <td className="py-3 px-4 font-mono uppercase text-slate-700 font-semibold">
                      {inv.paymentMode} ({inv.paymentStatus})
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      ₹{Number(inv.grandTotal ?? 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-green-700">
                      ₹{Number(inv.grossProfit ?? (inv as any).totalProfit ?? 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInvoice(inv);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#000080] hover:bg-blue-900 text-white rounded-lg font-bold"
                      >
                        <Printer size={12} />
                        Print
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDeleteInvoice(e, inv)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold"
                        title="Delete Invoice"
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
        )}
      </div>
    </div>
  );
};
