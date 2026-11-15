import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from './firestoreError';

export interface NextInvoicePreview {
  invoiceNo: string;
  nextNumber: number;
}

/**
 * Reads counters/invoice and computes the next sequential invoice number
 * in the format DUD-YYYY-XXX (e.g. DUD-2026-001).
 */
export async function previewNextInvoiceNo(): Promise<NextInvoicePreview> {
  const counterRef = doc(db, 'counters', 'invoice');
  let lastNumber = 0;
  try {
    const snap = await getDoc(counterRef);
    if (snap.exists()) {
      const data = snap.data();
      lastNumber = typeof data.lastNumber === 'number' ? data.lastNumber : 0;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'counters/invoice');
  }
  const nextNumber = lastNumber + 1;
  const year = new Date().getFullYear();
  const padded = String(nextNumber).padStart(3, '0');
  return {
    invoiceNo: `DUD-${year}-${padded}`,
    nextNumber,
  };
}

/**
 * Commits the incremented invoice counter to counters/invoice.
 */
export async function commitInvoiceCounter(nextNumber: number): Promise<void> {
  const counterRef = doc(db, 'counters', 'invoice');
  try {
    await setDoc(counterRef, { lastNumber: nextNumber });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'counters/invoice');
  }
}

/**
 * Reads counters/batch and returns a suggested batch number (e.g. B-101).
 */
export async function previewNextBatchNo(): Promise<{ batchNo: string; nextNumber: number }> {
  const counterRef = doc(db, 'counters', 'batch');
  let lastNumber = 100;
  try {
    const snap = await getDoc(counterRef);
    if (snap.exists()) {
      const data = snap.data();
      lastNumber = typeof data.lastNumber === 'number' ? data.lastNumber : 100;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'counters/batch');
  }
  const nextNumber = lastNumber + 1;
  return {
    batchNo: `B${nextNumber}`,
    nextNumber,
  };
}

export async function commitBatchCounter(nextNumber: number): Promise<void> {
  const counterRef = doc(db, 'counters', 'batch');
  try {
    await setDoc(counterRef, { lastNumber: nextNumber });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'counters/batch');
  }
}

/**
 * Marg-style Margin % (on selling price):
 * marginPercent = ((sellPrice - costPrice) / sellPrice) * 100
 */
export function calculateMarginPercent(costPrice: number, sellPrice: number): number {
  if (!sellPrice || sellPrice <= 0) return 0;
  const raw = ((sellPrice - costPrice) / sellPrice) * 100;
  return Number(raw.toFixed(2));
}

/**
 * Suggested sell price from defaultMarginPercent (markup on cost, rounded to nearest rupee):
 * suggestedSellPrice = costPrice + (costPrice * defaultMarginPercent / 100)
 */
export function calculateSuggestedSellPrice(
  costPrice: number,
  defaultMarginPercent: number
): number {
  if (!costPrice || costPrice <= 0) return 0;
  return Math.round(costPrice + (costPrice * defaultMarginPercent) / 100);
}

/**
 * Line profit excluding GST:
 * lineProfit = (sellPrice - costPrice) * qty
 */
export function calculateLineProfit(
  costPrice: number,
  sellPrice: number,
  qty: number
): number {
  return Number(((sellPrice - costPrice) * qty).toFixed(2));
}

/**
 * Margin % color helper:
 * > 15% -> green
 * 5% - 15% -> yellow/amber
 * < 5% or negative -> red
 */
export function getMarginColorClass(marginPercent: number): string {
  if (marginPercent > 15) {
    return 'text-green-700 font-semibold';
  }
  if (marginPercent >= 5) {
    return 'text-amber-700 font-semibold';
  }
  return 'text-red-600 font-semibold';
}

/**
 * Expiry status helper:
 * returns 'expired' | 'expiring_soon' (within 90 days) | 'ok'
 */
export function getExpiryStatus(expiryDateStr: string): {
  status: 'expired' | 'expiring_soon' | 'ok';
  daysLeft: number;
  label: string;
} {
  if (!expiryDateStr) return { status: 'ok', daysLeft: 999, label: 'Valid' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDateStr);
  exp.setHours(0, 0, 0, 0);
  const diffMs = exp.getTime() - today.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (daysLeft < 0) {
    return { status: 'expired', daysLeft, label: 'Expired' };
  }
  if (daysLeft <= 90) {
    return { status: 'expiring_soon', daysLeft, label: `${daysLeft}d left` };
  }
  return { status: 'ok', daysLeft, label: 'Valid' };
}
