import React from 'react';

interface QRDisplayProps {
  qrDataUrl: string;
  upiId: string;
  upiName: string;
  amount: number;
  invoiceNo: string;
  onConfirmUpiPayment: () => void;
  onClose: () => void;
  saving?: boolean;
}

export const QRDisplay: React.FC<QRDisplayProps> = ({
  qrDataUrl,
  upiId,
  upiName,
  amount,
  invoiceNo,
  onConfirmUpiPayment,
  onClose,
  saving = false,
}) => {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 text-center space-y-4">
      <div className="space-y-1">
        <p className="text-xs font-medium text-slate-500">
          Dudrucs Medical Store · Bill {invoiceNo}
        </p>
        <h3 className="text-lg font-bold text-slate-900">
          Scan with GPay, PhonePe, or Paytm
        </h3>
      </div>

      <div className="flex justify-center">
        <div className="p-3 bg-white border border-slate-200 rounded-xl inline-block">
          <img
            src={qrDataUrl}
            alt={`UPI QR Code for ₹${amount}`}
            width={260}
            height={260}
            referrerPolicy="no-referrer"
            className="mx-auto block"
          />
        </div>
      </div>

      <div className="pt-1 space-y-1">
        <p className="text-2xl font-bold font-mono tabular-nums text-green-700">
          Amount: ₹{Number(amount).toFixed(2)}
        </p>
        <p className="text-sm font-mono text-slate-700">
          UPI ID: <span className="font-semibold">{upiId}</span>
        </p>
        <p className="text-xs text-slate-500">Payee: {upiName}</p>
      </div>

      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 text-left">
        Verify payment confirmation on your clinic UPI soundbox or mobile app before clicking{' '}
        <span className="font-semibold">Payment Received (UPI)</span> below.
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        <button
          type="button"
          disabled={saving}
          onClick={onConfirmUpiPayment}
          className="w-full py-2.5 px-4 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
        >
          {saving ? 'Recording Payment...' : 'Payment Received (UPI)'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onClose}
          className="w-full sm:w-auto py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors whitespace-nowrap"
        >
          Close QR
        </button>
      </div>
    </div>
  );
};
