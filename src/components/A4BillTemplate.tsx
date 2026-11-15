import React, { forwardRef } from 'react';

export interface A4BillTemplateProps {
  invoice: {
    id?: string;
    invoiceNo: string;
    createdAt: string;
    customerName?: string;
    customerPhone?: string;
    staffId?: string;
    staffName?: string;
    paymentMode?: string;
    paymentStatus?: string;
    razorpayPaymentId?: string;
    razorpayMethod?: string;
    subtotal?: number;
    totalDiscount?: number;
    totalGst?: number;
    grandTotal: number;
    items: Array<{
      medicineName: string;
      batchNo: string;
      barcode?: string;
      expiryDate?: string;
      qty: number;
      mrp?: number;
      sellPrice: number;
      gstPercent?: number;
      gstAmount?: number;
      lineTotal: number;
    }>;
  };
  clinicSettings?: {
    name?: string;
    clinicName?: string;
    medicalName?: string;
    address?: string;
    clinicAddress?: string;
    phone?: string;
    clinicPhone?: string;
    medicalPhone?: string;
    gstNo?: string;
    upiId?: string;
    logoUrl?: string;
  };
  qrDataUrl?: string | null;
}

export const A4BillTemplate = forwardRef<HTMLDivElement, A4BillTemplateProps>(
  ({ invoice, clinicSettings, qrDataUrl }, ref) => {
    const storeName =
      clinicSettings?.medicalName ||
      clinicSettings?.name ||
      'SANDANA CLINIC + DUDRUCS PHARMACY';
    const clinicSub = clinicSettings?.clinicName || 'Sandana Multi-Specialty Clinic';
    const address =
      clinicSettings?.address ||
      clinicSettings?.clinicAddress ||
      'Main Road, Medical Square, Sandana Clinic Campus';
    const phone =
      clinicSettings?.phone ||
      clinicSettings?.clinicPhone ||
      clinicSettings?.medicalPhone ||
      '+91 98400 11223';
    const gstNo = clinicSettings?.gstNo || '33AABCS1429B1Z5';
    const upiId = clinicSettings?.upiId || 'sandanaclinic@upi';

    const subtotal = Number(
      invoice.subtotal ??
        invoice.items.reduce((s, it) => s + Number(it.lineTotal || 0), 0)
    );
    const totalGst = Number(invoice.totalGst ?? 0);
    const totalDiscount = Number(invoice.totalDiscount ?? 0);
    const grandTotal = Number(invoice.grandTotal ?? 0);

    return (
      <div
        ref={ref}
        id="sandana-a4-bill-print"
        className="bg-white text-slate-950 p-8 max-w-[210mm] mx-auto border border-slate-400 print:border-0 print:p-4 font-sans text-xs"
      >
        {/* Top Header with GST Number at Top Right */}
        <div className="border-b-2 border-slate-900 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            {clinicSettings?.logoUrl && (
              <img
                src={clinicSettings.logoUrl}
                alt={storeName}
                referrerPolicy="no-referrer"
                className="w-14 h-14 object-contain rounded border border-slate-300 p-1 shrink-0"
              />
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-green-800">
                TAX INVOICE · ORIGINAL FOR RECIPIENT
              </p>
              <h1 className="text-xl font-extrabold uppercase tracking-tight text-slate-950 mt-0.5">
                {storeName}
              </h1>
              <p className="text-xs font-semibold text-slate-700">{clinicSub}</p>
              <p className="text-xs text-slate-600 mt-0.5">{address}</p>
              <p className="text-xs font-mono text-slate-700 mt-0.5">
                Phone: {phone} · UPI ID: {upiId}
              </p>
            </div>
          </div>

          <div className="text-right border-2 border-slate-900 px-3.5 py-2 rounded bg-slate-50 shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
              GSTIN / TAX REG NO.
            </p>
            <p className="text-sm font-mono font-extrabold text-[#000080] tracking-wider">
              {gstNo}
            </p>
            <p className="text-[10px] font-mono text-slate-600 mt-1">
              DL No: TN-14-20B/21B-88921
            </p>
          </div>
        </div>

        {/* Invoice & Patient Metadata Strip */}
        <div className="grid grid-cols-2 gap-4 py-3 border-b border-slate-300 text-xs">
          <div className="space-y-1">
            <div>
              <span className="font-bold text-slate-600">Patient / Customer: </span>
              <span className="font-bold text-slate-950 uppercase">
                {invoice.customerName || 'Walk-In Customer'}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-600">Mobile Number: </span>
              <span className="font-mono">
                {invoice.customerPhone || 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-600">Billed By (Staff): </span>
              <span className="font-semibold text-[#000080]">
                {invoice.staffName || 'Pharmacy Staff'}{' '}
                {invoice.staffId ? `(${invoice.staffId})` : ''}
              </span>
            </div>
          </div>

          <div className="text-right space-y-1">
            <div>
              <span className="font-bold text-slate-600">Invoice No: </span>
              <span className="font-mono font-extrabold text-sm text-slate-950">
                {invoice.invoiceNo}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-600">Invoice Date: </span>
              <span className="font-mono">
                {new Date(invoice.createdAt).toLocaleString()}
              </span>
            </div>
            <div>
              <span className="font-bold text-slate-600">Payment Status: </span>
              <span className="font-mono font-bold uppercase">
                {invoice.paymentMode || 'CASH'} —{' '}
                {invoice.paymentStatus || 'PAID'}
              </span>
            </div>
            {invoice.razorpayPaymentId && (
              <div>
                <span className="font-bold text-slate-600">Razorpay Txn ID: </span>
                <span className="font-mono font-bold text-[#000080]">
                  {invoice.razorpayPaymentId}{' '}
                  {invoice.razorpayMethod ? `(${invoice.razorpayMethod})` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* A4 Itemized GST Table */}
        <div className="mt-3">
          <table className="w-full border-collapse border border-slate-800 text-[11px]">
            <thead>
              <tr className="bg-slate-200 text-slate-950 border-b border-slate-800">
                <th className="border border-slate-400 py-1.5 px-2 text-left w-8">
                  #
                </th>
                <th className="border border-slate-400 py-1.5 px-2 text-left">
                  Medicine / Particulars
                </th>
                <th className="border border-slate-400 py-1.5 px-2 text-left">
                  Batch No
                </th>
                <th className="border border-slate-400 py-1.5 px-2 text-left">
                  Exp.
                </th>
                <th className="border border-slate-400 py-1.5 px-2 text-right">
                  Qty
                </th>
                <th className="border border-slate-400 py-1.5 px-2 text-right">
                  MRP
                </th>
                <th className="border border-slate-400 py-1.5 px-2 text-right">
                  Rate
                </th>
                <th className="border border-slate-400 py-1.5 px-2 text-right">
                  GST %
                </th>
                <th className="border border-slate-400 py-1.5 px-2 text-right">
                  GST Amt
                </th>
                <th className="border border-slate-400 py-1.5 px-2 text-right">
                  Total (₹)
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-300">
                  <td className="border border-slate-300 py-1.5 px-2 font-mono">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-2 font-semibold">
                    {item.medicineName}
                    {item.barcode ? (
                      <span className="block text-[9px] font-mono text-slate-500">
                        Barcode: {item.barcode}
                      </span>
                    ) : null}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-2 font-mono">
                    {item.batchNo}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-2 font-mono">
                    {item.expiryDate || '-'}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-2 text-right font-mono font-bold">
                    {item.qty}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-2 text-right font-mono">
                    ₹{Number(item.mrp ?? item.sellPrice ?? 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-2 text-right font-mono">
                    ₹{Number(item.sellPrice || 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-2 text-right font-mono">
                    {Number(item.gstPercent ?? 12)}%
                  </td>
                  <td className="border border-slate-300 py-1.5 px-2 text-right font-mono">
                    ₹{Number(item.gstAmount ?? 0).toFixed(2)}
                  </td>
                  <td className="border border-slate-300 py-1.5 px-2 text-right font-mono font-bold">
                    ₹{Number(item.lineTotal || 0).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals + QR + Signatory */}
        <div className="mt-4 grid grid-cols-12 gap-4 items-start border-t-2 border-slate-900 pt-3">
          <div className="col-span-7 flex items-start gap-4">
            {qrDataUrl && (
              <div className="border border-slate-300 p-1.5 rounded text-center shrink-0">
                <img
                  src={qrDataUrl}
                  alt="UPI QR"
                  className="w-20 h-20 object-contain mx-auto"
                />
                <p className="text-[9px] font-mono font-bold mt-0.5">
                  Scan to Pay UPI
                </p>
              </div>
            )}
            <div className="text-[10px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-900 uppercase">
                Terms &amp; Declarations:
              </p>
              <p>
                1. Goods once sold will not be taken back without original A4
                invoice &amp; intact strip.
              </p>
              <p>
                2. Please verify batch number and expiry date before consuming
                medicines.
              </p>
              <p className="font-mono text-slate-800 pt-1">
                GSTIN: {gstNo} · Computer Generated Marg ERP 9+ Tax Invoice
              </p>
            </div>
          </div>

          <div className="col-span-5 space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Taxable Subtotal:</span>
              <span className="font-mono">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">
                CGST + SGST Total:
              </span>
              <span className="font-mono">₹{totalGst.toFixed(2)}</span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-green-700">
                <span>Discount:</span>
                <span className="font-mono">-₹{totalDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-slate-900 pt-1.5 text-sm font-extrabold text-slate-950">
              <span>NET GRAND TOTAL:</span>
              <span className="font-mono">₹{grandTotal.toFixed(2)}</span>
            </div>

            <div className="pt-8 text-right">
              <p className="text-[10px] font-bold uppercase text-slate-800">
                For {storeName}
              </p>
              <p className="text-[10px] text-slate-500 mt-4">
                Authorized Pharmacist / Signatory
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

A4BillTemplate.displayName = 'A4BillTemplate';
export default A4BillTemplate;
