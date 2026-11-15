import QRCode from 'qrcode';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

export interface UPIQRResult {
  qrDataUrl: string;
  upiUri: string;
  upiId: string;
  upiName: string;
  amount: number;
  invoiceNo: string;
}

export function buildUpiUri(params: {
  upiId: string;
  upiName: string;
  amount: number;
  invoiceNo: string;
}): string {
  const cleanUpi = params.upiId.trim();
  const cleanName = encodeURIComponent(params.upiName.trim() || 'Dudrucs');
  const formattedAmt = Number(params.amount || 0).toFixed(2);
  const note = encodeURIComponent(`Bill_${params.invoiceNo}`);
  return `upi://pay?pa=${cleanUpi}&pn=${cleanName}&am=${formattedAmt}&cu=INR&tn=${note}`;
}

export async function generateUPIQR(
  amount: number,
  invoiceNo: string
): Promise<UPIQRResult> {
  const snap = await getDoc(doc(db, 'settings', 'clinic'));
  const data = snap.exists() ? snap.data() : {};
  const upiId = String(data.upiId || 'sandanaclinic@okaxis').trim();
  const upiName = String(data.upiName || 'Dudrucs').trim();

  if (!upiId) {
    throw new Error('UPI ID not set by admin. Go to Admin > Website & UPI Settings.');
  }

  const upiUri = buildUpiUri({ upiId, upiName, amount, invoiceNo });
  const qrDataUrl = await QRCode.toDataURL(upiUri, {
    width: 260,
    margin: 1,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });

  return {
    qrDataUrl,
    upiUri,
    upiId,
    upiName,
    amount,
    invoiceNo,
  };
}

export async function generateUpiQRDataUrl(params: {
  upiId: string;
  upiName: string;
  amount: number;
  invoiceNo: string;
}): Promise<{ uri: string; dataUrl: string }> {
  const uri = buildUpiUri(params);
  const dataUrl = await QRCode.toDataURL(uri, {
    width: 260,
    margin: 1,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
  return { uri, dataUrl };
}
