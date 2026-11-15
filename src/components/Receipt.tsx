import React, { useState } from 'react';
import { Printer, X, ExternalLink, Check } from 'lucide-react';
import { printElementById, openPrintWindow } from '../utils/printEngine';

export interface InvoiceLineItem {
  medicineId: string;
  medicineName: string;
  batchId: string;
  batchNo: string;
  qty: number;
  costPrice: number;
  sellPrice: number;
  mrp: number;
  gstPercent: number;
  lineTotal: number;
}

export interface InvoiceRecord {
  id?: string;
  invoiceNo: string;
  items: InvoiceLineItem[];
  subtotal: number;
  totalDiscount: number;
  totalGst: number;
  grandTotal: number;
  totalCost: number;
  grossProfit: number;
  paymentStatus: 'pending' | 'paid';
  paymentMode: 'cash' | 'upi' | 'razorpay';
  razorpayPaymentId?: string;
  razorpayMethod?: string;
  staffId: string;
  staffName: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
}

interface ReceiptProps {
  invoice: InvoiceRecord;
  clinicName?: string;
  medicalName?: string;
  clinicAddress?: string;
  medicalPhone?: string;
  onClose?: () => void;
}

export const Receipt: React.FC<ReceiptProps> = ({
  invoice,
  clinicName = 'Sandana Clinic',
  medicalName = 'Dudrucs Medical Store',
  clinicAddress = '42, MG Healthcare Road, Anna Nagar, Chennai',
  medicalPhone = '+91 98400 11224',
  onClose,
}) => {
  const [printed, setPrinted] = useState(false);

  const handlePrint = () => {
    setPrinted(true);
    printElementById('printable-receipt', {
      title: `Invoice_${invoice.invoiceNo}`,
    });
    setTimeout(() => setPrinted(false), 3000);
  };

  const handleOpenPrintPage = () => {
    openPrintWindow('printable-receipt', `Invoice_${invoice.invoiceNo}`);
  };

  const formattedDate = new Date(invoice.createdAt).toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl mx-auto shadow-md">
      <div className="no-print flex flex-wrap items-center justify-between pb-4 mb-4 border-b border-slate-200 gap-3">
        <div>
          <span className="text-sm font-bold text-green-700">
            Marg-Style GST Pharmacy Invoice
          </span>
          <span className="ml-3 text-xs font-mono text-slate-500">
            Net Profit (Excl. GST): ₹{Number(invoice.grossProfit || 0).toFixed(2)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-extrabold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            {printed ? <Check size={15} /> : <Printer size={15} />}
            <span>{printed ? 'Printing Sent...' : 'Print Receipt'}</span>
          </button>
          <button
            type="button"
            onClick={handleOpenPrintPage}
            title="Open printable page in new clean window"
            className="inline-flex items-center gap-1 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-lg border border-blue-200 transition-colors cursor-pointer"
          >
            <ExternalLink size={14} />
            <span>Open Print Page</span>
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <X size={15} />
              Close
            </button>
          )}
        </div>
      </div>

      <div id="printable-receipt" className="space-y-4 text-slate-900">
        <div className="text-center border-b border-slate-200 pb-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            {medicalName}
          </h2>
          <p className="text-xs font-medium text-slate-600">
            Pharmacy Unit of {clinicName}
          </p>
          <p className="text-xs text-slate-500 mt-1">{clinicAddress}</p>
          <p className="text-xs text-slate-500 font-mono">Phone: {medicalPhone}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs border-b border-slate-200 pb-3">
          <div>
            <p className="text-slate-500">Invoice No</p>
            <p className="font-mono font-bold text-slate-900">{invoice.invoiceNo}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-500">Date &amp; Time</p>
            <p className="font-mono text-slate-900">{formattedDate}</p>
          </div>
          <div>
            <p className="text-slate-500">Patient / Customer</p>
            <p className="font-medium text-slate-900">
              {invoice.customerName || 'Walk-in Customer'}
            </p>
            {invoice.customerPhone && (
              <p className="font-mono text-slate-600">{invoice.customerPhone}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-slate-500">Payment Mode</p>
            <p className="font-semibold uppercase text-slate-900">
              {invoice.paymentMode} · {invoice.paymentStatus}
            </p>
            {invoice.razorpayPaymentId && (
              <p className="font-mono text-[11px] font-bold text-sky-700">
                RZP ID: {invoice.razorpayPaymentId}
                {invoice.razorpayMethod ? ` (${invoice.razorpayMethod})` : ''}
              </p>
            )}
            <p className="text-slate-500">Billed by: {invoice.staffName}</p>
          </div>
        </div>

        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 text-left font-semibold">Medicine</th>
              <th className="py-2 text-left font-semibold">Batch</th>
              <th className="py-2 text-right font-semibold">MRP</th>
              <th className="py-2 text-right font-semibold">Rate</th>
              <th className="py-2 text-right font-semibold">Qty</th>
              <th className="py-2 text-right font-semibold">GST%</th>
              <th className="py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item, idx) => (
              <tr key={`${item.medicineId}-${item.batchNo}-${idx}`}>
                <td className="py-2 pr-2 font-medium text-slate-900">
                  {item.medicineName}
                </td>
                <td className="py-2 pr-2 font-mono text-slate-600">
                  {item.batchNo}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-slate-500">
                  ₹{Number(item.mrp || item.sellPrice).toFixed(2)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-slate-800">
                  ₹{Number(item.sellPrice).toFixed(2)}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-slate-800">
                  {item.qty}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-slate-600">
                  {item.gstPercent}%
                </td>
                <td className="py-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                  ₹{Number(item.lineTotal).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal (Before Tax)</span>
            <span className="font-mono tabular-nums">
              ₹{Number(invoice.subtotal).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Discount</span>
            <span className="font-mono tabular-nums">
              - ₹{Number(invoice.totalDiscount || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Total GST</span>
            <span className="font-mono tabular-nums">
              + ₹{Number(invoice.totalGst || 0).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-base font-bold text-slate-900 pt-1.5 border-t border-slate-200">
            <span>Grand Total</span>
            <span className="font-mono tabular-nums text-green-700">
              ₹{Number(invoice.grandTotal).toFixed(2)}
            </span>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
          <p>Get well soon! Thank you for visiting {clinicName} &amp; {medicalName}.</p>
        </div>
      </div>
    </div>
  );
};
