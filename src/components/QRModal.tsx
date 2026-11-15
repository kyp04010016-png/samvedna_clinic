import React from 'react';
import { X, CheckCircle2, Banknote } from 'lucide-react';

interface QRModalProps {
  isOpen: boolean;
  qrDataUrl: string;
  upiId: string;
  upiName: string;
  amount: number;
  invoiceNo: string;
  saving?: boolean;
  onMarkPaidUpi: () => void;
  onMarkPaidCash: () => void;
  onClose: () => void;
}

export const QRModal: React.FC<QRModalProps> = ({
  isOpen,
  qrDataUrl,
  upiId,
  upiName,
  amount,
  invoiceNo,
  saving = false,
  onMarkPaidUpi,
  onMarkPaidCash,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="bg-white border-2 border-[#000080] rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        {/* Marg ERP Modal Title Bar */}
        <div className="bg-[#000080] text-white px-4 py-2.5 flex items-center justify-between">
          <span className="text-xs font-bold tracking-wide">
            DUDRUCS DYNAMIC UPI QR — BILL #{invoiceNo}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-0.5"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-600">
              Scan with GPay · PhonePe · Paytm · Any UPI App
            </p>
            <p className="text-2xl font-bold font-mono tabular-nums text-green-700 mt-1">
              ₹{Number(amount).toFixed(2)}
            </p>
          </div>

          <div className="inline-block p-3 bg-white border border-slate-300 rounded">
            <img
              src={qrDataUrl}
              alt={`UPI QR Code for ₹${amount}`}
              width={250}
              height={250}
              referrerPolicy="no-referrer"
              className="mx-auto block"
            />
          </div>

          <div className="text-xs font-mono text-slate-700 space-y-0.5 bg-slate-50 border border-slate-200 rounded p-2.5">
            <p>
              UPI ID: <strong className="text-slate-900">{upiId}</strong>
            </p>
            <p>Payee: {upiName}</p>
            <p>Ref: Dudrucs Bill {invoiceNo}</p>
          </div>

          <p className="text-[11px] text-amber-900 bg-amber-50 border border-amber-200 rounded p-2 text-left">
            Confirm payment on your clinic UPI soundbox or mobile app, then click{' '}
            <strong>Mark Paid (UPI)</strong> below.
          </p>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={saving}
              onClick={onMarkPaidUpi}
              className="py-2.5 px-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs font-bold rounded inline-flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={15} />
              {saving ? 'Saving...' : 'Mark Paid (UPI)'}
            </button>

            <button
              type="button"
              disabled={saving}
              onClick={onMarkPaidCash}
              className="py-2.5 px-3 bg-[#000080] hover:bg-blue-900 disabled:opacity-50 text-white text-xs font-bold rounded inline-flex items-center justify-center gap-1.5"
            >
              <Banknote size={15} />
              Mark Paid (Cash)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
