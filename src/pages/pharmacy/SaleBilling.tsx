import React, { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  Save,
  QrCode,
  CheckCircle2,
  Banknote,
  Barcode,
  Printer,
  CreditCard,
  Upload,
  Download,
  FileSpreadsheet,
  Camera,
  X,
  Phone,
  LogOut,
  HelpCircle,
} from 'lucide-react';
import { db } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { generateUPIQR, UPIQRResult } from '../../utils/upiQR';
import { A4BillTemplate } from '../../components/A4BillTemplate';
import {
  calculateMarginPercent,
  commitInvoiceCounter,
  previewNextInvoiceNo,
} from '../../utils/invoiceNo';
import { logStaffActivity } from '../../utils/activityLogger';
import {
  commitPurchaseBillToFirestore,
  downloadSamplePurchaseBillExcel,
  parseSupplierPurchaseSpreadsheet,
} from '../../utils/purchaseBillExcel';
import { saveRecordToSql } from '../../utils/sqlSyncBridge';
import {
  exportPharmacyInventoryAndBillsExcel,
  getLocalSelfBackupMeta,
  isAutoLocalPcDownloadEnabled,
  restoreFromLocalSelfBackup,
  saveAutoSelfBackupAndSyncHost,
  setAutoLocalPcDownloadEnabled,
} from '../../utils/backupRestore';
import { printElementById, openPrintWindow } from '../../utils/printEngine';
import { QRModal } from '../../components/QRModal';
import {
  RazorpayCheckoutModal,
  RazorpayGatewaySuccessPayload,
} from '../../components/RazorpayCheckoutModal';
import { InvoiceLineItem, InvoiceRecord, Receipt } from '../../components/Receipt';
import { ClinicSettingsDoc } from '../public/Home';
import { BatchDoc, MedicineMasterDoc } from './Stock';
import { handleFirestoreError, OperationType } from '../../utils/firestoreError';
import { PrescriptionExplorer } from '../../components/PrescriptionExplorer';
import { PrescriptionRecord } from '../../components/PrescriptionModal';

export type MargEntryMode = 'SALE' | 'PURC' | 'SC' | 'PC' | 'SR' | 'PR' | 'BE';

interface SaleBillRow extends InvoiceLineItem {
  rowId: string;
  pack: string;
  tabQty: number;
  freeQty?: number;
  expiryDate: string;
  maxStock: number;
  marginPercent: number;
  lineProfit: number;
}

/**
 * Parses tablets per strip from pack string (e.g. "1*10" -> 10, "1*15" -> 15, "10 TAB" -> 10, "1 BTL" -> 1)
 */
function parsePackTablets(packStr?: string): number {
  const s = String(packStr || '1*10').trim().toUpperCase();
  const starMatch = s.match(/(\d+)\s*[\*X]\s*(\d+)/);
  if (starMatch) {
    return Math.max(1, parseInt(starMatch[2], 10) || 10);
  }
  if (s.includes('BTL') || s.includes('ML') || s.includes('SYR') || s.includes('VIAL') || s.includes('TUBE')) {
    return 1;
  }
  const numMatch = s.match(/(\d+)/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n > 1 && n <= 100) return n;
  }
  return 10;
}

/**
 * Formats decimal strip stock into human-readable Strips + Loose Tablets (e.g. 18.5 on 1*10 -> "18 Str + 5 Tab")
 */
function formatStockUnits(stockStrips: number, packStr?: string): string {
  const num = Math.max(0, Number(stockStrips || 0));
  const tabsPerStrip = parsePackTablets(packStr);
  if (tabsPerStrip <= 1) {
    return `${Math.round(num)} Unit`;
  }
  const wholeStrips = Math.floor(num + 1e-6);
  const remFraction = Math.max(0, num - wholeStrips);
  const looseTabs = Math.round(remFraction * tabsPerStrip);
  if (looseTabs > 0) {
    return `${wholeStrips} Str + ${looseTabs} Tab`;
  }
  return `${wholeStrips} Str`;
}

const MODE_META: Record<
  MargEntryMode,
  {
    headerTitle: string;
    bottomBanner: string;
    historyTitle: string;
    isPurchaseSide: boolean;
    isReturnSide: boolean;
    headerBg: string;
    gridHeaderBg: string;
  }
> = {
  SALE: {
    headerTitle: 'SALE ENTRY',
    bottomBanner: 'SALE',
    historyTitle: 'SALES HISTORY [ Click to Copy ]',
    isPurchaseSide: false,
    isReturnSide: false,
    headerBg: 'bg-[#dff0fa]',
    gridHeaderBg: 'bg-[#cde5f5]',
  },
  PURC: {
    headerTitle: 'PURCHASE BILL ENTRY',
    bottomBanner: 'PURCHASE',
    historyTitle: 'PURCHASE HISTORY [ Click to Copy ]',
    isPurchaseSide: true,
    isReturnSide: false,
    headerBg: 'bg-[#dce8cc]',
    gridHeaderBg: 'bg-[#c6ddb0]',
  },
  SC: {
    headerTitle: 'SALE CHALLAN ENTRY',
    bottomBanner: 'SALE CHALLAN',
    historyTitle: 'SALES HISTORY [ Click to Copy ]',
    isPurchaseSide: false,
    isReturnSide: false,
    headerBg: 'bg-[#dff0fa]',
    gridHeaderBg: 'bg-[#cde5f5]',
  },
  PC: {
    headerTitle: 'PURCHASE CHALLAN ENTRY',
    bottomBanner: 'PURCHASE CHALLAN',
    historyTitle: 'PURCHASE HISTORY [ Click to Copy ]',
    isPurchaseSide: true,
    isReturnSide: false,
    headerBg: 'bg-[#dce8cc]',
    gridHeaderBg: 'bg-[#c6ddb0]',
  },
  SR: {
    headerTitle: 'SALE RETURN / CREDIT NOTE ENTRY',
    bottomBanner: 'SALE RETURN',
    historyTitle: 'SALES HISTORY [ Click to Copy ]',
    isPurchaseSide: false,
    isReturnSide: true,
    headerBg: 'bg-[#f9e2e2]',
    gridHeaderBg: 'bg-[#f2cccc]',
  },
  PR: {
    headerTitle: 'PURCHASE RETURN / DEBIT NOTE ENTRY',
    bottomBanner: 'PURC. RETURN',
    historyTitle: 'PURCHASE HISTORY [ Click to Copy ]',
    isPurchaseSide: true,
    isReturnSide: true,
    headerBg: 'bg-[#f9e2e2]',
    gridHeaderBg: 'bg-[#f2cccc]',
  },
  BE: {
    headerTitle: 'BREAKAGE / EXPIRY RECEIVE ENTRY',
    bottomBanner: 'BRK / EXPIRY',
    historyTitle: 'EXPIRY HISTORY [ Click to Copy ]',
    isPurchaseSide: false,
    isReturnSide: true,
    headerBg: 'bg-[#fef3c7]',
    gridHeaderBg: 'bg-[#fde68a]',
  },
};

export const SaleBilling: React.FC = () => {
  const { firebaseUser, userProfile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [entryMode, setEntryMode] = useState<MargEntryMode>('SALE');
  const [now, setNow] = useState(new Date());

  const [medicines, setMedicines] = useState<MedicineMasterDoc[]>([]);
  const [batches, setBatches] = useState<BatchDoc[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<InvoiceRecord[]>([]);
  const [clinicSettings, setClinicSettings] = useState<Partial<ClinicSettingsDoc>>({});

  // Header fields matching image_3ede2b19.png
  const [invoicePreview, setInvoicePreview] = useState<{
    invoiceNo: string;
    nextNumber: number;
  }>({ invoiceNo: 'A000001', nextNumber: 1 });
  const [customBillNo, setCustomBillNo] = useState('A000001');
  const [billDate, setBillDate] = useState(format(new Date(), 'dd-MM-yyyy'));
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [doctorCode, setDoctorCode] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [doctorRegNo, setDoctorRegNo] = useState('');

  // Refs for keyboard navigation across header and inline grid
  const billNoInputRef = useRef<HTMLInputElement | null>(null);
  const patientPhoneRef = useRef<HTMLInputElement | null>(null);
  const patientNameRef = useRef<HTMLInputElement | null>(null);
  const patientAddressRef = useRef<HTMLInputElement | null>(null);
  const doctorCodeRef = useRef<HTMLInputElement | null>(null);
  const doctorNameRef = useRef<HTMLInputElement | null>(null);
  const doctorRegRef = useRef<HTMLInputElement | null>(null);

  // Inline Grid New Row Draft State (directly inside the dark-green cursor bar)
  const [isEditingInlineRow, setIsEditingInlineRow] = useState(false);
  const [showItemPopup, setShowItemPopup] = useState(false);
  const [popupHighlightIdx, setPopupHighlightIdx] = useState(0);
  const [inlineProduct, setInlineProduct] = useState('');
  const [inlinePack, setInlinePack] = useState('1*10');
  const [inlineBatchNo, setInlineBatchNo] = useState('');
  const [inlineBatchId, setInlineBatchId] = useState('');
  const [inlineMedicineId, setInlineMedicineId] = useState('');
  const [inlineExpiry, setInlineExpiry] = useState('2028-12-31');
  const [inlineStri, setInlineStri] = useState('1');
  const [inlineTab, setInlineTab] = useState('0');
  const [inlineMrp, setInlineMrp] = useState('');
  const [inlineCostPrice, setInlineCostPrice] = useState(0);
  const [inlineGstPercent, setInlineGstPercent] = useState(12);
  const [inlineMaxStock, setInlineMaxStock] = useState(999);

  const inlineProductRef = useRef<HTMLInputElement | null>(null);
  const inlinePackRef = useRef<HTMLInputElement | null>(null);
  const inlineBatchRef = useRef<HTMLInputElement | null>(null);
  const inlineStriRef = useRef<HTMLInputElement | null>(null);
  const inlineTabRef = useRef<HTMLInputElement | null>(null);
  const inlineMrpRef = useRef<HTMLInputElement | null>(null);

  const purchaseExcelRef = useRef<HTMLInputElement | null>(null);
  const a4PrintRef = useRef<HTMLDivElement | null>(null);
  const [importingPurchaseExcel, setImportingPurchaseExcel] = useState(false);

  // Live Database Search & Auto-Backup State
  const [dbSearchQuery, setDbSearchQuery] = useState('');
  const [autoPcBackup, setAutoPcBackup] = useState<boolean>(() =>
    isAutoLocalPcDownloadEnabled()
  );
  const [selfBackupMeta, setSelfBackupMeta] = useState(() =>
    getLocalSelfBackupMeta()
  );
  const [runningBackupAction, setRunningBackupAction] = useState(false);

  // Bill rows & selection
  const [billItems, setBillItems] = useState<SaleBillRow[]>([]);
  const [activeRowBatchId, setActiveRowBatchId] = useState<string | null>(null);
  const [discountInput, setDiscountInput] = useState('0');

  // Clipboard & Hold states for COPY / PASTE / HOLD buttons
  const [copiedRowsBuffer, setCopiedRowsBuffer] = useState<SaleBillRow[]>([]);
  const [heldBillBuffer, setHeldBillBuffer] = useState<{
    customerName: string;
    customerPhone: string;
    items: SaleBillRow[];
  } | null>(null);

  // Modals & Popups
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [savedInvoiceRecord, setSavedInvoiceRecord] = useState<InvoiceRecord | null>(null);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);
  const [qrData, setQrData] = useState<UPIQRResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showRxHub, setShowRxHub] = useState(false);
  const [showEarnModal, setShowEarnModal] = useState(false);
  const [showGstModal, setShowGstModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync mode & excel trigger from URL query params
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const modeParam = (params.get('mode') || '').toUpperCase();
    if (
      modeParam === 'SALE' ||
      modeParam === 'PURC' ||
      modeParam === 'SC' ||
      modeParam === 'PC' ||
      modeParam === 'SR' ||
      modeParam === 'PR' ||
      modeParam === 'BE'
    ) {
      setEntryMode(modeParam as MargEntryMode);
    } else if (modeParam === 'COUNTER') {
      setEntryMode('SALE');
    }

    if (params.get('import') === 'excel') {
      setTimeout(() => {
        purchaseExcelRef.current?.click();
      }, 250);
    }
  }, [location.search]);

  // Load Medicines, Batches, Recent Invoices, and Next Bill No
  const loadBillingData = async () => {
    try {
      const [medSnap, batchSnap, settingsSnap, nextInv, invSnap] = await Promise.all([
        getDocs(collection(db, 'medicines')),
        getDocs(collection(db, 'batches')),
        getDoc(doc(db, 'settings', 'clinic')),
        previewNextInvoiceNo(),
        getDocs(query(collection(db, 'invoices'), orderBy('createdAt', 'desc'), limit(25))),
      ]);

      const medList: MedicineMasterDoc[] = medSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<MedicineMasterDoc, 'id'>),
      }));
      medList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      const batchList: BatchDoc[] = batchSnap.docs.map((b) => {
        const raw = b.data() as any;
        const matchedMed = medList.find((m) => m.id === raw.medicineId);
        const currentStock = Number(raw.stock ?? raw.stockQuantity ?? 0);
        const soldQty = Number(raw.soldQty ?? 0);
        const purchasedQty = Number(
          raw.purchasedQty ?? Math.max(currentStock + soldQty, currentStock)
        );
        return {
          id: b.id,
          medicineId: raw.medicineId || '',
          medicineName:
            raw.medicineName ||
            matchedMed?.name ||
            'Medicine',
          pack: raw.pack || matchedMed?.pack || (matchedMed?.unit === 'bottle' ? '1 BTL' : '1*10'),
          batchNo: raw.batchNo || raw.batchNumber || 'BATCH-01',
          expiryDate: raw.expiryDate || '2028-12-31',
          stock: currentStock,
          purchasedQty,
          soldQty,
          costPrice: Number(raw.costPrice ?? 10),
          sellPrice: Number(raw.sellPrice ?? raw.mrp ?? 15),
          mrp: Number(raw.mrp ?? raw.sellPrice ?? 15),
          gstPercent: Number(raw.gstPercent ?? matchedMed?.gstPercent ?? 12),
          marginPercent: Number(raw.marginPercent ?? 25),
          supplierName: raw.supplierName || 'Standard Pharma',
          supplierBillNo: raw.supplierBillNo || raw.challanNo || '',
          purchaseDate: raw.purchaseDate || new Date().toISOString().slice(0, 10),
          createdAt: raw.createdAt || new Date().toISOString(),
        };
      });
      // FIFO: sort earliest expiry date first
      batchList.sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));

      const recentList: InvoiceRecord[] = invSnap.docs.map((d) => ({
        ...(d.data() as InvoiceRecord),
      }));

      setMedicines(medList);
      setBatches(batchList);
      setRecentInvoices(recentList);
      setInvoicePreview(nextInv);
      setCustomBillNo(`A${String(nextInv.nextNumber).padStart(6, '0')}`);
      setSelfBackupMeta(getLocalSelfBackupMeta());

      if (settingsSnap.exists()) {
        setClinicSettings(settingsSnap.data() as Partial<ClinicSettingsDoc>);
      }
    } catch (err) {
      console.error('Error loading SaleBilling data:', err);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, []);

  // Local keyboard handler for Esc (closing popups/inline edit before MainLayout navigates back) and F1/F2/F10
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showItemPopup) {
          e.preventDefault();
          e.stopPropagation();
          setShowItemPopup(false);
          return;
        }
        if (isEditingInlineRow) {
          e.preventDefault();
          e.stopPropagation();
          setIsEditingInlineRow(false);
          return;
        }
        if (showRxHub || showEarnModal || showGstModal || showHelpModal || qrModalOpen || razorpayModalOpen) {
          e.preventDefault();
          e.stopPropagation();
          setShowRxHub(false);
          setShowEarnModal(false);
          setShowGstModal(false);
          setShowHelpModal(false);
          setQrModalOpen(false);
          setRazorpayModalOpen(false);
          return;
        }
        // Otherwise MainLayout's Esc handler will navigate back to /pharmacy/erp?view=desktop
      } else if (e.key === 'F1') {
        e.preventDefault();
        doctorCodeRef.current?.focus();
      } else if (e.key === 'F2') {
        e.preventDefault();
        patientPhoneRef.current?.focus();
      } else if (e.key === 'F10' || e.key === 'End') {
        e.preventDefault();
        handlePrimarySaveAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  });

  // Filtered stock items for the inline Marg Item Selection Popup
  const popupStockItems = React.useMemo(() => {
    const q = inlineProduct.trim().toLowerCase();
    const results: {
      medId: string;
      medName: string;
      pack: string;
      batchId: string;
      batchNo: string;
      expiryDate: string;
      stock: number;
      purchasedQty: number;
      soldQty: number;
      supplierName: string;
      mrp: number;
      sellPrice: number;
      costPrice: number;
      gstPercent: number;
    }[] = [];

    batches.forEach((b) => {
      if (!MODE_META[entryMode].isPurchaseSide && b.stock <= 0) return;
      const med = medicines.find((m) => m.id === b.medicineId);
      const medName = b.medicineName || med?.name || 'MEDICINE';
      const packStr = b.pack || med?.pack || (med?.unit === 'bottle' ? '1 BTL' : '1*10');
      if (
        !q ||
        medName.toLowerCase().includes(q) ||
        (b.batchNo || '').toLowerCase().includes(q) ||
        (med?.genericName || '').toLowerCase().includes(q) ||
        (b.supplierName || '').toLowerCase().includes(q)
      ) {
        results.push({
          medId: b.medicineId || med?.id || `med-${b.id}`,
          medName,
          pack: packStr,
          batchId: b.id,
          batchNo: b.batchNo,
          expiryDate: b.expiryDate,
          stock: b.stock,
          purchasedQty: Number(b.purchasedQty ?? b.stock),
          soldQty: Number(b.soldQty ?? 0),
          supplierName: b.supplierName || 'Standard Pharma',
          mrp: Number(b.mrp || b.sellPrice || 15),
          sellPrice: Number(b.sellPrice || b.mrp || 15),
          costPrice: Number(b.costPrice || 10),
          gstPercent: Number((med as any)?.gstPercent || (med as any)?.gstPercentage || 12),
        });
      }
    });

    // Also include medicines that don't have a batch yet (especially useful for Purchase Entry)
    medicines.forEach((m) => {
      const hasBatchInResults = results.some((r) => r.medId === m.id);
      if (!hasBatchInResults) {
        if (!q || m.name.toLowerCase().includes(q) || (m.genericName || '').toLowerCase().includes(q)) {
          results.push({
            medId: m.id,
            medName: m.name,
            pack: m.pack || (m.unit === 'bottle' ? '1 BTL' : '1*10'),
            batchId: `new-batch-${m.id}`,
            batchNo: 'NEW01',
            expiryDate: '2028-12-31',
            stock: 0,
            purchasedQty: 0,
            soldQty: 0,
            supplierName: m.brand || 'New Supplier',
            mrp: 50,
            sellPrice: 45,
            costPrice: 32,
            gstPercent: Number((m as any)?.gstPercent || (m as any)?.gstPercentage || 12),
          });
        }
      }
    });

    return results.slice(0, 30);
  }, [batches, medicines, inlineProduct, entryMode]);

  const handlePickPopupItem = (
    item: (typeof popupStockItems)[0],
    forcedMode?: MargEntryMode
  ) => {
    const targetMode = forcedMode || entryMode;
    const isPurchase = MODE_META[targetMode].isPurchaseSide;
    const defaultStri = isPurchase ? 10 : 1;
    const cost = Number(item.costPrice || 10);
    const sellRate = Number(isPurchase ? item.mrp || item.sellPrice || cost * 1.3 : item.sellPrice || item.mrp || 15);
    const mrpRate = Math.max(sellRate, Number(item.mrp || sellRate));
    const activeRate = isPurchase ? cost : sellRate;
    const lineTotal = Number((defaultStri * activeRate).toFixed(2));
    const lineProfit = Number(((sellRate - cost) * defaultStri).toFixed(2));
    const newRowId = `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    const newRow: SaleBillRow = {
      rowId: newRowId,
      medicineId: item.medId,
      medicineName: (item.medName || 'MEDICINE').toUpperCase(),
      pack: (item.pack || '1*10').toUpperCase(),
      batchId: item.batchId,
      batchNo: (item.batchNo || 'B001').toUpperCase(),
      expiryDate: item.expiryDate || '2028-12-31',
      qty: defaultStri,
      tabQty: 0,
      freeQty: 0,
      costPrice: cost,
      sellPrice: sellRate,
      mrp: mrpRate,
      gstPercent: item.gstPercent || 12,
      lineTotal,
      lineProfit,
      maxStock: isPurchase ? 99999 : Math.max(0.1, item.stock),
      marginPercent: calculateMarginPercent(cost, sellRate),
    };

    // Immediately append as a distinct medicine row in the current bill so the user can add unlimited medicines one below another!
    setBillItems((prev) => [...prev, newRow]);
    setActiveRowBatchId(newRowId);

    // Clear the dark-green inline row so it sits right below this medicine ready for the next medicine
    setInlineProduct('');
    setInlinePack('1*10');
    setInlineBatchNo('');
    setInlineBatchId('');
    setInlineMedicineId('');
    setInlineExpiry('2028-12-31');
    setInlineStri(isPurchase ? '10' : '1');
    setInlineTab('0');
    setInlineCostPrice(0);
    setInlineMrp('');
    setShowItemPopup(false);
    setErrorMessage(null);

    setTimeout(() => {
      inlineProductRef.current?.focus();
    }, 30);
  };

  // Build a SaleBillRow from the current inline dark-green bar state
  const buildInlineDraftRow = (): SaleBillRow | null => {
    const prodName = inlineProduct.trim().toUpperCase();
    if (!prodName) return null;

    const isPurchase = MODE_META[entryMode].isPurchaseSide;
    const rawStri = parseInt(inlineStri, 10);
    const striQty = Number.isNaN(rawStri) ? (isPurchase ? 10 : 1) : Math.max(0, rawStri);
    const tabOrFreeQty = Math.max(0, parseInt(inlineTab, 10) || 0);
    const finalStri = striQty === 0 && tabOrFreeQty === 0 ? 1 : striQty;

    const packStr = (inlinePack.trim() || '1*10').toUpperCase();
    const tabsPerStrip = parsePackTablets(packStr);

    const matchedExistingBatch = batches.find(
      (b) =>
        (b.id === inlineBatchId && !inlineBatchId.startsWith('new-batch-')) ||
        (b.medicineName.toUpperCase() === prodName &&
          b.batchNo.toUpperCase() === (inlineBatchNo.trim() || 'BATCH01').toUpperCase()) ||
        b.medicineName.toUpperCase() === prodName
    );

    const enteredMrpOrSell = Math.max(
      0.01,
      parseFloat(inlineMrp) ||
        matchedExistingBatch?.sellPrice ||
        matchedExistingBatch?.mrp ||
        (inlineCostPrice > 0 ? Number((inlineCostPrice * 1.3).toFixed(2)) : 25)
    );
    const cost =
      inlineCostPrice > 0
        ? inlineCostPrice
        : matchedExistingBatch?.costPrice
        ? matchedExistingBatch.costPrice
        : Number((enteredMrpOrSell * (isPurchase ? 0.72 : 0.75)).toFixed(2));

    const sellRate = enteredMrpOrSell;
    const mrpRate = Math.max(sellRate, cost, matchedExistingBatch?.mrp || 0);

    const effectiveQty = isPurchase
      ? finalStri
      : Number((finalStri + (tabOrFreeQty > 0 ? tabOrFreeQty / tabsPerStrip : 0)).toFixed(3));

    const activeRateForAmount = isPurchase ? cost : sellRate;
    const lineTotal = Number((effectiveQty * activeRateForAmount).toFixed(2));
    const lineProfit = Number(((sellRate - cost) * effectiveQty).toFixed(2));

    const batchIdToUse =
      matchedExistingBatch?.id ||
      (inlineBatchId && !inlineBatchId.startsWith('new-batch-')
        ? inlineBatchId
        : `manual_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const medIdToUse =
      matchedExistingBatch?.medicineId ||
      inlineMedicineId ||
      `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const batchNoToUse = (
      inlineBatchNo.trim() ||
      matchedExistingBatch?.batchNo ||
      `B${String(billItems.length + 1).padStart(3, '0')}`
    ).toUpperCase();

    return {
      rowId: `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      medicineId: medIdToUse,
      medicineName: prodName,
      pack: packStr,
      batchId: batchIdToUse,
      batchNo: batchNoToUse,
      expiryDate: inlineExpiry || matchedExistingBatch?.expiryDate || '2028-12-31',
      qty: finalStri,
      tabQty: isPurchase ? 0 : tabOrFreeQty,
      freeQty: isPurchase ? tabOrFreeQty : 0,
      costPrice: cost,
      sellPrice: sellRate,
      mrp: mrpRate,
      gstPercent: inlineGstPercent || 12,
      lineTotal,
      lineProfit,
      maxStock: matchedExistingBatch ? matchedExistingBatch.stock : inlineMaxStock || 9999,
      marginPercent: calculateMarginPercent(cost, sellRate),
    };
  };

  // Commit the inline active row into billItems as a new row below previous items
  const handleCommitInlineRow = () => {
    const draftRow = buildInlineDraftRow();
    if (!draftRow) {
      setErrorMessage('कृपया दवा का नाम (Product Name) लिखें या लिस्ट से चुनें।');
      inlineProductRef.current?.focus();
      return;
    }

    const isPurchase = MODE_META[entryMode].isPurchaseSide;
    setBillItems((prev) => [...prev, draftRow]);
    setActiveRowBatchId(draftRow.rowId);

    // Reset inline fields for next medicine row below!
    setInlineProduct('');
    setInlinePack('1*10');
    setInlineBatchNo('');
    setInlineBatchId('');
    setInlineMedicineId('');
    setInlineStri(isPurchase ? '10' : '1');
    setInlineTab('0');
    setInlineCostPrice(0);
    setInlineMrp('');
    setShowItemPopup(false);
    setErrorMessage(null);
    setTimeout(() => {
      inlineProductRef.current?.focus();
    }, 30);
  };

  // Directly append a new blank editable row into the table so the user can type multiple medicines row-by-row
  const handleAddBlankEditableRow = () => {
    if (inlineProduct.trim()) {
      handleCommitInlineRow();
      return;
    }
    const isPurchase = MODE_META[entryMode].isPurchaseSide;
    const newRowId = `row_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const defaultStri = isPurchase ? 10 : 1;
    const blankRow: SaleBillRow = {
      rowId: newRowId,
      medicineId: `manual_med_${Date.now()}`,
      medicineName: '',
      pack: '1*10',
      batchId: `manual_batch_${Date.now()}`,
      batchNo: `B${String(billItems.length + 1).padStart(3, '0')}`,
      expiryDate: '2028-12-31',
      qty: defaultStri,
      tabQty: 0,
      freeQty: 0,
      costPrice: 15,
      sellPrice: 20,
      mrp: 20,
      gstPercent: 12,
      lineTotal: isPurchase ? 150 : 20,
      lineProfit: isPurchase ? 50 : 5,
      maxStock: 9999,
      marginPercent: 25,
    };
    setBillItems((prev) => [...prev, blankRow]);
    setActiveRowBatchId(newRowId);
    setShowItemPopup(false);
  };

  // Load Doctor Prescription into Grid
  const handleLoadPrescriptionIntoBill = (rx: PrescriptionRecord) => {
    setCustomerName(rx.patientName || '');
    setCustomerPhone(rx.phone || '');
    setDoctorName(rx.doctorName || '');
    let itemsAdded = 0;

    rx.medicines?.forEach((m, idx) => {
      if (!m.name.trim()) return;
      const lower = m.name.toLowerCase().trim();
      const matchedMed = medicines.find(
        (med) =>
          med.name.toLowerCase().includes(lower) ||
          lower.includes(med.name.toLowerCase()) ||
          (med.genericName && med.genericName.toLowerCase().includes(lower))
      );

      const candidateBatches = batches
        .filter((b) =>
          matchedMed
            ? b.medicineId === matchedMed.id
            : b.medicineName.toLowerCase().includes(lower) ||
              lower.includes(b.medicineName.toLowerCase())
        )
        .filter((b) => Number(b.stock) > 0)
        .sort((a, b) => (a.expiryDate || '').localeCompare(b.expiryDate || ''));

      if (candidateBatches.length > 0) {
        const bestBatch = candidateBatches[0];
        const sellPrice = Number(bestBatch.sellPrice || 15);
        const costPrice = Number(bestBatch.costPrice || 10);
        const mrp = Number(bestBatch.mrp || 15);
        const gstPercent = Number((matchedMed as any)?.gstPercent || 12);

        setBillItems((prev) => [
          ...prev,
          {
            rowId: `rx_row_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
            medicineId: bestBatch.medicineId,
            medicineName: bestBatch.medicineName,
            pack: bestBatch.pack || '1*10',
            batchId: bestBatch.id,
            batchNo: bestBatch.batchNo,
            expiryDate: bestBatch.expiryDate,
            maxStock: bestBatch.stock,
            qty: 1,
            tabQty: 0,
            freeQty: 0,
            costPrice,
            sellPrice,
            mrp,
            gstPercent,
            marginPercent: calculateMarginPercent(costPrice, sellPrice),
            lineTotal: sellPrice,
            lineProfit: sellPrice - costPrice,
          },
        ]);
        itemsAdded += 1;
      }
    });

    setToastMessage(
      `✓ Loaded ${itemsAdded} medicines from ${rx.doctorName}'s prescription for "${rx.patientName}" into the grid!`
    );
    setShowRxHub(false);
  };

  // Update existing row cells inline (identifies each row by its unique rowId)
  const handleUpdateExistingRow = (
    rowId: string,
    field:
      | 'medicineName'
      | 'pack'
      | 'batchNo'
      | 'expiryDate'
      | 'qty'
      | 'tabQty'
      | 'freeQty'
      | 'costPrice'
      | 'sellPrice',
    value: string
  ) => {
    const isPurchase = MODE_META[entryMode].isPurchaseSide;
    setBillItems((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId && row.batchId !== rowId) return row;
        const updated = { ...row };
        if (field === 'medicineName') {
          const upperName = value.toUpperCase();
          updated.medicineName = upperName;
          // Auto-fill pack, batch, expiry & rates if typed name matches a known batch in stock
          const matchedBatch = batches.find(
            (b) => b.medicineName.toUpperCase() === upperName.trim()
          );
          if (matchedBatch) {
            updated.medicineId = matchedBatch.medicineId || updated.medicineId;
            updated.batchId = matchedBatch.id;
            updated.pack = matchedBatch.pack || updated.pack || '1*10';
            updated.batchNo = matchedBatch.batchNo || updated.batchNo;
            updated.expiryDate = matchedBatch.expiryDate || updated.expiryDate;
            updated.costPrice = Number(matchedBatch.costPrice || updated.costPrice);
            updated.sellPrice = Number(matchedBatch.sellPrice || matchedBatch.mrp || updated.sellPrice);
            updated.mrp = Number(matchedBatch.mrp || updated.sellPrice);
            updated.maxStock = matchedBatch.stock;
          }
        }
        if (field === 'pack') updated.pack = value.toUpperCase();
        if (field === 'batchNo') updated.batchNo = value.toUpperCase();
        if (field === 'expiryDate') updated.expiryDate = value;
        if (field === 'qty') {
          updated.qty = Math.max(0, parseInt(value, 10) || 0);
        }
        if (field === 'tabQty') {
          updated.tabQty = Math.max(0, parseInt(value, 10) || 0);
        }
        if (field === 'freeQty') {
          updated.freeQty = Math.max(0, parseInt(value, 10) || 0);
        }
        if (field === 'costPrice') {
          updated.costPrice = Math.max(0, parseFloat(value) || 0);
          if (updated.sellPrice < updated.costPrice) {
            updated.sellPrice = Number((updated.costPrice * 1.25).toFixed(2));
            updated.mrp = updated.sellPrice;
          }
        }
        if (field === 'sellPrice') {
          updated.sellPrice = Math.max(0, parseFloat(value) || 0);
          updated.mrp = Math.max(updated.mrp, updated.sellPrice);
        }
        const tabsPerStrip = parsePackTablets(updated.pack);
        const effQty = isPurchase
          ? updated.qty
          : Number((updated.qty + (updated.tabQty > 0 ? updated.tabQty / tabsPerStrip : 0)).toFixed(3));
        const activeRate = isPurchase ? updated.costPrice : updated.sellPrice;
        updated.lineTotal = Number((effQty * activeRate).toFixed(2));
        updated.lineProfit = Number(
          ((updated.sellPrice - updated.costPrice) * effQty).toFixed(2)
        );
        return updated;
      })
    );
  };

  const handleRemoveRow = (rowId: string) => {
    setBillItems((prev) => prev.filter((r) => r.rowId !== rowId && r.batchId !== rowId));
  };

  // Excel Import: Populates the 10-row Marg Grid directly AND syncs stock to Firestore!
  const handleQuickPurchaseExcelImport = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportingPurchaseExcel(true);
    setErrorMessage(null);
    setToastMessage(null);
    try {
      const parsedBill = await parseSupplierPurchaseSpreadsheet(
        file,
        customerName.trim() || 'ALKEM PHARMA DISTRIBUTOR',
        customBillNo || `PUR-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
        Number((clinicSettings as any)?.defaultMarginPercent || 20)
      );
      if (parsedBill.items.length === 0) {
        setErrorMessage(
          `No valid medicine rows found in "${file.name}". Click "Sample Excel" to download the template.`
        );
        return;
      }

      // 1. Populate all Excel rows directly into the Marg Grid so the user can view/edit them manually!
      const isPurchase = MODE_META[entryMode].isPurchaseSide;
      const importedGridRows: SaleBillRow[] = parsedBill.items.map((item, idx) => {
        const cost = Number(item.costPrice || 15);
        const sell = Number(item.sellPrice || item.mrp || cost * 1.25);
        const mrp = Number(item.mrp || sell);
        const qty = Number(item.qty || 10);
        const freeQty = Number(item.freeQty || 0);
        const rateForTotal = isPurchase ? cost : sell;
        return {
          rowId: `excel_row_${Date.now()}_${idx}`,
          medicineId: `excel_med_${Date.now()}_${idx}`,
          medicineName: (item.medicineName || 'MEDICINE').toUpperCase(),
          pack: item.pack || '1*10',
          batchId: `excel_batch_${Date.now()}_${idx}`,
          batchNo: (item.batchNo || `B${100 + idx}`).toUpperCase(),
          expiryDate: item.expiryDate || '2028-12-31',
          qty,
          tabQty: 0,
          freeQty,
          costPrice: cost,
          sellPrice: sell,
          mrp,
          gstPercent: Number(item.gstPercent || 12),
          lineTotal: Number((qty * rateForTotal).toFixed(2)),
          lineProfit: Number(((sell - cost) * qty).toFixed(2)),
          maxStock: 99999,
          marginPercent: calculateMarginPercent(cost, sell),
        };
      });

      setBillItems((prev) => [...prev, ...importedGridRows]);
      if (!customerName && parsedBill.supplierName) {
        setCustomerName(parsedBill.supplierName.toUpperCase());
      }
      if (!doctorCode && parsedBill.supplierBillNo) {
        setDoctorCode(parsedBill.supplierBillNo.toUpperCase());
      }

      // 2. Also commit the imported batches into Firestore so stock is immediately available
      const res = await commitPurchaseBillToFirestore(
        parsedBill,
        userProfile?.name || firebaseUser?.email || 'Pharmacy Staff'
      );
      await loadBillingData();

      setToastMessage(
        `✅ Excel "${file.name}" Imported! ${importedGridRows.length} rows loaded into Marg Grid (+${res.totalUnitsAdded} strips added to database stock & backed up).`
      );
    } catch (err: any) {
      setErrorMessage(
        err?.message || 'Failed to import Excel/CSV file.'
      );
    } finally {
      setImportingPurchaseExcel(false);
      e.target.value = '';
    }
  };

  // Summary calculations
  const totalStri = billItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
  const totalTab = billItems.reduce((sum, item) => sum + Number(item.tabQty || 0), 0);
  const totalFree = billItems.reduce((sum, item) => sum + Number(item.freeQty || 0), 0);
  const mrpValueTotal = Number(
    billItems.reduce((sum, item) => sum + item.mrp * item.qty, 0).toFixed(2)
  );
  const subtotal = Number(
    billItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
  );
  const totalDiscount = Math.max(
    0,
    Math.min(subtotal, Number(discountInput) || 0)
  );
  const totalGst = Number(
    billItems
      .reduce((sum, item) => sum + (item.lineTotal * item.gstPercent) / 100, 0)
      .toFixed(2)
  );
  const grandTotal = Number(
    Math.max(0, subtotal - totalDiscount + totalGst).toFixed(2)
  );
  const totalCost = Number(
    billItems.reduce((sum, item) => sum + item.costPrice * item.qty, 0).toFixed(2)
  );
  const estimatedProfit = Number(
    (
      billItems.reduce((sum, item) => sum + item.lineProfit, 0) - totalDiscount
    ).toFixed(2)
  );

  // Save Purchase Entry / Purchase Challan / Return to Firestore + SQL + Auto-Backup
  const executeSavePurchaseOrReturn = async () => {
    setErrorMessage(null);
    setToastMessage(null);

    const pendingDraft = buildInlineDraftRow();
    const effectiveItems = pendingDraft
      ? [...billItems, pendingDraft]
      : billItems.filter((r) => r.medicineName.trim().length > 0);

    if (effectiveItems.length === 0) {
      setErrorMessage('Cannot save an empty entry. Add at least 1 medicine row in the grid or import Excel.');
      return;
    }

    setSaving(true);
    try {
      const staffName = userProfile?.name || firebaseUser?.email || 'Pharmacy Staff';
      const supplierPartyName = (customerName.trim() || 'Wholesale Pharma Distributor').slice(0, 120);
      const supplierInvoiceNo = (doctorCode.trim() || customBillNo || 'PUR-001').slice(0, 60);
      const supplierLabel = `${supplierPartyName} (Bill: ${supplierInvoiceNo})`.slice(0, 120);
      let totalAddedUnits = 0;

      for (const item of effectiveItems) {
        const cleanMedName = item.medicineName.trim().toUpperCase();
        if (!cleanMedName) continue;
        // 1. Find or create medicine in Medicine Master
        const existingMed = medicines.find(
          (m) => (m.name || '').toLowerCase() === cleanMedName.toLowerCase()
        );
        let medId = existingMed?.id;
        if (!medId) {
          medId = `med_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const medPayload = {
            id: medId,
            name: cleanMedName,
            genericName: cleanMedName,
            brand: supplierPartyName,
            manufacturer: supplierPartyName,
            hsnCode: '30049099',
            category: 'Tablet',
            unit: item.pack?.includes('BTL') ? 'bottle' : 'strip',
            pack: item.pack || '1*10',
            gstPercent: (item.gstPercent || 12) as 5 | 12 | 18,
            scheduleType: 'OTC',
            reorderLevel: 10,
            barcode: `890${Math.floor(1000000 + Math.random() * 9000000)}`,
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'medicines', medId), medPayload);
          await saveRecordToSql('medicines', medId, medPayload);
        }

        // 2. Find or create batch in Batches collection
        const cleanBatchNo = (item.batchNo || 'BATCH01').trim().toUpperCase();
        const existingBatch = batches.find(
          (b) =>
            (b.medicineId === medId || b.medicineName.toUpperCase() === cleanMedName) &&
            (b.batchNo || '').toUpperCase() === cleanBatchNo
        );

        const totalRowStrips = Number(item.qty || 0) + Number(item.freeQty || 0);
        // PURC, PC, SR, BE -> increases stock; PR -> decreases stock
        const stockDelta = entryMode === 'PR' ? -totalRowStrips : totalRowStrips;
        totalAddedUnits += stockDelta;

        const safeCost = Number(Math.max(0.01, item.costPrice || 10).toFixed(2));
        const safeSell = Number(Math.max(safeCost, item.sellPrice || item.mrp || safeCost * 1.25).toFixed(2));
        const safeMrp = Number(Math.max(safeSell, item.mrp || safeSell).toFixed(2));
        const safeExpiry = item.expiryDate || '2028-12-31';

        if (existingBatch) {
          const prevStock = Number(existingBatch.stock || 0);
          const nextStock = Number(Math.max(0, prevStock + stockDelta).toFixed(2));
          const prevPurchased = Number(existingBatch.purchasedQty ?? prevStock);
          const nextPurchased =
            stockDelta > 0
              ? Number((prevPurchased + stockDelta).toFixed(2))
              : prevPurchased;

          const batchUpdatePayload = {
            medicineId: existingBatch.medicineId || medId,
            medicineName: cleanMedName,
            pack: item.pack || existingBatch.pack || '1*10',
            batchNo: cleanBatchNo,
            batchNumber: cleanBatchNo,
            expiryDate: safeExpiry,
            costPrice: safeCost,
            sellPrice: safeSell,
            mrp: safeMrp,
            marginPercent: calculateMarginPercent(safeCost, safeSell),
            stock: nextStock,
            stockQuantity: nextStock,
            purchasedQty: nextPurchased,
            soldQty: Number(existingBatch.soldQty ?? 0),
            supplierName: supplierLabel,
            supplierBillNo: supplierInvoiceNo,
            purchaseDate: new Date().toISOString().slice(0, 10),
            updatedAt: new Date().toISOString(),
          };
          await updateDoc(doc(db, 'batches', existingBatch.id), batchUpdatePayload);
          await saveRecordToSql('batches', existingBatch.id, {
            id: existingBatch.id,
            ...batchUpdatePayload,
          });
        } else {
          const newBatchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          const initialStock = Number(Math.max(0, stockDelta).toFixed(2));
          const newBatchPayload = {
            id: newBatchId,
            medicineId: medId,
            medicineName: cleanMedName,
            pack: item.pack || '1*10',
            batchNo: cleanBatchNo,
            batchNumber: cleanBatchNo,
            expiryDate: safeExpiry,
            costPrice: safeCost,
            sellPrice: safeSell,
            mrp: safeMrp,
            marginPercent: calculateMarginPercent(safeCost, safeSell),
            stock: initialStock,
            stockQuantity: initialStock,
            purchasedQty: initialStock,
            soldQty: 0,
            supplierName: supplierLabel,
            supplierBillNo: supplierInvoiceNo,
            challanNo: customBillNo,
            purchaseDate: new Date().toISOString().slice(0, 10),
            createdAt: new Date().toISOString(),
          };
          await setDoc(doc(db, 'batches', newBatchId), newBatchPayload);
          await saveRecordToSql('batches', newBatchId, newBatchPayload);
        }
      }

      const effSubtotal = Number(
        effectiveItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
      );
      const effDiscount = Math.max(0, Math.min(effSubtotal, Number(discountInput) || 0));
      const effGst = Number(
        effectiveItems
          .reduce((sum, item) => sum + (item.lineTotal * item.gstPercent) / 100, 0)
          .toFixed(2)
      );
      const effGrandTotal = Number(Math.max(0, effSubtotal - effDiscount + effGst).toFixed(2));
      const effTotalCost = Number(
        effectiveItems.reduce((sum, item) => sum + item.costPrice * item.qty, 0).toFixed(2)
      );
      const effProfit = Number(
        (effectiveItems.reduce((sum, item) => sum + item.lineProfit, 0) - effDiscount).toFixed(2)
      );

      // 3. Also record Purchase / Return Voucher in `invoices` so History & Daily Reports stay synced
      const purchaseRecordPayload = {
        invoiceNo: `${entryMode}-${customBillNo || Date.now().toString().slice(-5)}`,
        invoiceType: entryMode,
        supplierBillNo: supplierInvoiceNo,
        customerName: supplierPartyName,
        customerPhone: customerPhone.trim().slice(0, 25),
        items: effectiveItems.map((i) => ({
          medicineId: i.medicineId,
          medicineName: i.medicineName,
          pack: i.pack || '1*10',
          batchId: i.batchId,
          batchNo: i.batchNo,
          qty: Number(i.qty || 0) + Number(i.freeQty || 0),
          costPrice: i.costPrice,
          sellPrice: i.sellPrice,
          mrp: i.mrp,
          gstPercent: i.gstPercent,
          lineTotal: i.lineTotal,
        })),
        subtotal: effSubtotal,
        totalDiscount: effDiscount,
        totalGst: effGst,
        grandTotal: effGrandTotal,
        totalCost: effTotalCost,
        grossProfit: effProfit,
        totalProfit: effProfit,
        paymentStatus: 'paid' as const,
        paymentMode: 'cash' as const,
        staffId: userProfile?.uid || firebaseUser?.uid || 'pharmacy_staff',
        staffName,
        createdAt: new Date().toISOString(),
      };
      try {
        const purRef = await addDoc(collection(db, 'invoices'), purchaseRecordPayload);
        if (purRef?.id) {
          await saveRecordToSql('invoices', purRef.id, purchaseRecordPayload);
        }
      } catch (e) {
        console.warn('Could not log purchase invoice record:', e);
      }

      await logStaffActivity(
        `Saved ${MODE_META[entryMode].headerTitle}`,
        `${staffName} saved ${MODE_META[entryMode].headerTitle} #${customBillNo} from ${supplierPartyName} (${
          effectiveItems.length
        } medicines, ${totalAddedUnits >= 0 ? `+${totalAddedUnits}` : totalAddedUnits} strips, ₹${effGrandTotal.toFixed(2)})`,
        staffName
      );

      // 4. Trigger 3-Tier Auto Self-Backup + Domain/Host Daily Sync + Optional Local PC Download
      await saveAutoSelfBackupAndSyncHost(
        staffName,
        `${entryMode}_SAVED_${customBillNo}`
      );

      await loadBillingData();
      setToastMessage(
        `✅ ${MODE_META[entryMode].headerTitle} #${customBillNo} (${supplierPartyName}) में कुल ${effectiveItems.length} दवाइयां डेटाबेस में सेव हो गईं! (+${totalAddedUnits} Strips स्टॉक में जुड़ गए और ऑटो-बैकअप अपडेट हो गया)`
      );
      setBillItems([]);
      setInlineProduct('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  // Core Save Sale Bill Function (Deducts exact Strips + Loose Tablets from Purchased Batch Stock!)
  const executeSaveBill = async (
    paymentStatus: 'pending' | 'paid',
    paymentMode: 'cash' | 'upi' | 'razorpay',
    razorpayDetails?: RazorpayGatewaySuccessPayload
  ): Promise<void> => {
    if (entryMode !== 'SALE' && entryMode !== 'SC') {
      await executeSavePurchaseOrReturn();
      return;
    }

    setErrorMessage(null);
    setToastMessage(null);

    const pendingDraft = buildInlineDraftRow();
    const effectiveItems = pendingDraft
      ? [...billItems, pendingDraft]
      : billItems.filter((r) => r.medicineName.trim().length > 0);

    if (effectiveItems.length === 0 && !savedInvoiceRecord) {
      setErrorMessage('Cannot save an empty bill. Add at least one medicine in the grid.');
      return;
    }

    if (savedInvoiceId && savedInvoiceRecord && paymentStatus === 'paid') {
      setSaving(true);
      try {
        const updatePayload: Record<string, any> = {
          paymentStatus: 'paid',
          paymentMode,
        };
        if (razorpayDetails) {
          updatePayload.razorpayPaymentId = razorpayDetails.razorpayPaymentId;
          updatePayload.razorpayMethod = razorpayDetails.razorpayMethod;
        }
        await updateDoc(doc(db, 'invoices', savedInvoiceId), updatePayload);
        const updatedRecord: InvoiceRecord = {
          ...savedInvoiceRecord,
          paymentStatus: 'paid',
          paymentMode,
          ...(razorpayDetails
            ? {
                razorpayPaymentId: razorpayDetails.razorpayPaymentId,
                razorpayMethod: razorpayDetails.razorpayMethod,
              }
            : {}),
        };
        setSavedInvoiceRecord(updatedRecord);
        setQrModalOpen(false);
        setRazorpayModalOpen(false);
        setToastMessage(
          `Bill #${updatedRecord.invoiceNo} marked as PAID (${paymentMode.toUpperCase()}).`
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `invoices/${savedInvoiceId}`);
      } finally {
        setSaving(false);
      }
      return;
    }

    setSaving(true);
    try {
      const nextInv = await previewNextInvoiceNo();
      const staffName =
        userProfile?.name || firebaseUser?.email || 'Pharmacy Staff';

      const effSubtotal = Number(
        effectiveItems.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)
      );
      const effDiscount = Math.max(0, Math.min(effSubtotal, Number(discountInput) || 0));
      const effGst = Number(
        effectiveItems
          .reduce((sum, item) => sum + (item.lineTotal * item.gstPercent) / 100, 0)
          .toFixed(2)
      );
      const effGrandTotal = Number(Math.max(0, effSubtotal - effDiscount + effGst).toFixed(2));
      const effTotalCost = Number(
        effectiveItems.reduce((sum, item) => sum + item.costPrice * item.qty, 0).toFixed(2)
      );
      const effProfit = Number(
        (effectiveItems.reduce((sum, item) => sum + item.lineProfit, 0) - effDiscount).toFixed(2)
      );
      const effTotalStri = effectiveItems.reduce((sum, item) => sum + Number(item.qty || 0), 0);
      const effTotalTab = effectiveItems.reduce((sum, item) => sum + Number(item.tabQty || 0), 0);

      const invoicePayload: InvoiceRecord & { totalProfit: number } = {
        invoiceNo: customBillNo || nextInv.invoiceNo,
        customerName: customerName.trim().slice(0, 120) || 'Walk-in Customer',
        customerPhone: customerPhone.trim().slice(0, 25),
        items: effectiveItems.map((i) => {
          const tabsPerStrip = parsePackTablets(i.pack);
          const effectiveUnits = Number(
            (Number(i.qty || 0) + (Number(i.tabQty || 0) > 0 ? Number(i.tabQty) / tabsPerStrip : 0)).toFixed(2)
          );
          return {
            medicineId: i.medicineId,
            medicineName: i.medicineName,
            batchId: i.batchId,
            batchNo: i.batchNo,
            qty: effectiveUnits,
            costPrice: i.costPrice,
            sellPrice: i.sellPrice,
            mrp: i.mrp,
            gstPercent: i.gstPercent,
            lineTotal: i.lineTotal,
          };
        }),
        subtotal: effSubtotal,
        totalDiscount: effDiscount,
        totalGst: effGst,
        grandTotal: effGrandTotal,
        totalCost: effTotalCost,
        grossProfit: effProfit,
        totalProfit: effProfit,
        paymentStatus,
        paymentMode,
        ...(razorpayDetails
          ? {
               razorpayPaymentId: razorpayDetails.razorpayPaymentId,
              razorpayMethod: razorpayDetails.razorpayMethod,
            }
          : {}),
        staffId: userProfile?.uid || firebaseUser?.uid || 'pharmacy_staff',
        staffName,
        createdAt: new Date().toISOString(),
      };

      let createdDocRef;
      try {
        createdDocRef = await addDoc(collection(db, 'invoices'), invoicePayload);
        if (createdDocRef?.id) {
          await saveRecordToSql('invoices', createdDocRef.id, invoicePayload);
        }
      } catch (invErr) {
        handleFirestoreError(invErr, OperationType.CREATE, 'invoices');
      }

      // Deduct exact Strips + Loose Tablets sold from Purchased Batch Stock in Firestore AND SQL!
      for (const item of effectiveItems) {
        const tabsPerStrip = parsePackTablets(item.pack);
        const unitsSold = Number(
          (Number(item.qty || 0) + (Number(item.tabQty || 0) > 0 ? Number(item.tabQty) / tabsPerStrip : 0)).toFixed(2)
        );
        if (unitsSold <= 0) continue;

        // Match by batchId first, or fallback by (medicineName + batchNo) or FIFO medicineName
        let targetBatchId = item.batchId;
        let batchSnap =
          targetBatchId && !targetBatchId.startsWith('manual_')
            ? await getDoc(doc(db, 'batches', targetBatchId))
            : null;

        if (!batchSnap || !batchSnap.exists()) {
          const fallbackBatch =
            batches.find(
              (b) =>
                b.medicineName.toLowerCase() === item.medicineName.toLowerCase() &&
                b.batchNo.toLowerCase() === item.batchNo.toLowerCase()
            ) ||
            batches.find(
              (b) =>
                b.medicineName.toLowerCase() === item.medicineName.toLowerCase() &&
                b.stock > 0
            );
          if (fallbackBatch) {
            targetBatchId = fallbackBatch.id;
            batchSnap = await getDoc(doc(db, 'batches', targetBatchId));
          }
        }

        if (batchSnap && batchSnap.exists()) {
          const data = batchSnap.data();
          const currentStock = Number(data.stock ?? data.stockQuantity ?? 0);
          const prevSold = Number(data.soldQty ?? 0);
          const prevPurchased = Number(
            data.purchasedQty ?? Math.max(currentStock + prevSold, currentStock)
          );
          const newStock = Number(Math.max(0, currentStock - unitsSold).toFixed(2));
          const newSold = Number((prevSold + unitsSold).toFixed(2));

          const batchUpdate = {
            medicineId: data.medicineId || item.medicineId,
            medicineName: data.medicineName || item.medicineName,
            pack: data.pack || item.pack || '1*10',
            batchNo: data.batchNo || item.batchNo,
            expiryDate: data.expiryDate || item.expiryDate || '2028-12-31',
            costPrice: Number(data.costPrice ?? item.costPrice ?? 10),
            mrp: Number(data.mrp ?? item.mrp ?? 15),
            sellPrice: Number(data.sellPrice ?? item.sellPrice ?? 15),
            stock: newStock,
            stockQuantity: newStock,
            purchasedQty: prevPurchased,
            soldQty: newSold,
            updatedAt: new Date().toISOString(),
          };
          await updateDoc(doc(db, 'batches', targetBatchId), batchUpdate);
          await saveRecordToSql('batches', targetBatchId, {
            id: targetBatchId,
            ...data,
            ...batchUpdate,
          });
        }
      }

      await commitInvoiceCounter(nextInv.nextNumber);
      await logStaffActivity(
        `Created Bill (${paymentMode.toUpperCase()})`,
        `${staffName} created Bill #${invoicePayload.invoiceNo} with ${effectiveItems.length} medicines (₹${effGrandTotal.toFixed(2)})`,
        staffName
      );

      // Trigger 3-Tier Auto Self-Backup + Domain/Host Daily Sync + Optional Local PC Download
      await saveAutoSelfBackupAndSyncHost(
        staffName,
        `SALE_BILL_${invoicePayload.invoiceNo}`
      );

      setInlineProduct('');
      setSavedInvoiceId(createdDocRef?.id || null);
      setSavedInvoiceRecord(invoicePayload);
      setQrModalOpen(false);
      setRazorpayModalOpen(false);
      setToastMessage(
        `✅ Bill #${invoicePayload.invoiceNo} (${effectiveItems.length} दवाइयां) सेव हो गया! बेची गई दवा (${effTotalStri} Str${effTotalTab > 0 ? ` + ${effTotalTab} Tab` : ''}) Purchase स्टॉक से घटा दी गई है और ऑटो-बैकअप सुरक्षित हो गया है।`
      );
      await loadBillingData();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save bill.');
    } finally {
      setSaving(false);
    }
  };

  // Manual 1-Click Backup & Local PC Download Handlers
  const handleManualLocalPcJsonBackup = async () => {
    setRunningBackupAction(true);
    try {
      const staffName = userProfile?.name || firebaseUser?.email || 'Pharmacy Staff';
      await saveAutoSelfBackupAndSyncHost(staffName, 'MANUAL_LOCAL_PC_BACKUP', true);
      setSelfBackupMeta(getLocalSelfBackupMeta());
      setToastMessage(
        '💻 पूरा डेटाबेस बैकअप (.JSON) आपके Local PC पर डाउनलोड हो गया और Domain/Host सर्वर + Cloud में भी सुरक्षित हो गया!'
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Backup failed.');
    } finally {
      setRunningBackupAction(false);
    }
  };

  const handleManualLocalPcExcelExport = async () => {
    setRunningBackupAction(true);
    try {
      await exportPharmacyInventoryAndBillsExcel();
      setToastMessage(
        '📊 फार्मेसी का पूरा Purchase vs Sale स्टॉक रजिस्टर (.XLSX) आपके Local PC पर डाउनलोड हो गया!'
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Excel export failed.');
    } finally {
      setRunningBackupAction(false);
    }
  };

  const handleRestoreSelfBackup = async () => {
    setRunningBackupAction(true);
    try {
      const res = await restoreFromLocalSelfBackup();
      await loadBillingData();
      setToastMessage(
        `♻️ Self-Backup से ${res.totalRestored} रिकॉर्ड्स (${res.collectionsRestored} कलेक्शंस) सफलतापूर्वक रीस्टोर (Restore) हो गए!`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Self-backup restore failed.');
    } finally {
      setRunningBackupAction(false);
    }
  };

  const handleToggleAutoPcDownload = () => {
    const nextVal = !autoPcBackup;
    setAutoLocalPcDownloadEnabled(nextVal);
    setAutoPcBackup(nextVal);
    setToastMessage(
      nextVal
        ? '✅ Auto Local PC Backup चालू (ON) हो गया! अब हर बिल सेव होने पर आपके कंप्यूटर पर ऑटोमैटिक बैकअप फाइल भी सेव होगी।'
        : 'ℹ️ Auto Local PC Download बंद (OFF) किया गया। (ऐप के अंदर Self-Backup और Domain/Host Daily Backup हमेशा चालू रहेंगे)'
    );
  };

  const handlePrimarySaveAction = () => {
    if (entryMode === 'SALE' || entryMode === 'SC') {
      executeSaveBill('paid', 'cash');
    } else {
      executeSavePurchaseOrReturn();
    }
  };

  const handleOpenRazorpayGateway = () => {
    setErrorMessage(null);
    if (billItems.length === 0 && !inlineProduct.trim() && !savedInvoiceRecord) {
      setErrorMessage('Add items to the grid before launching Razorpay.');
      return;
    }
    setRazorpayModalOpen(true);
  };

  const handleOpenUpiQrModal = async () => {
    setErrorMessage(null);
    if (billItems.length === 0 && !inlineProduct.trim() && !savedInvoiceRecord) {
      setErrorMessage('Add items to the grid before generating a UPI QR code.');
      return;
    }
    const targetAmount = savedInvoiceRecord
      ? savedInvoiceRecord.grandTotal
      : grandTotal;
    const targetInvNo = savedInvoiceRecord
      ? savedInvoiceRecord.invoiceNo
      : customBillNo;
    try {
      const qr = await generateUPIQR(targetAmount, targetInvNo);
      if (qr) {
        setQrData(qr);
        setQrModalOpen(true);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'UPI ID not configured.');
    }
  };

  const handleResetNewBill = async () => {
    setSavedInvoiceId(null);
    setSavedInvoiceRecord(null);
    setBillItems([]);
    setInlineProduct('');
    setDiscountInput('0');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setToastMessage(null);
    setErrorMessage(null);
    await loadBillingData();
  };

  const handleCopyInvoiceFromHistory = (inv: InvoiceRecord) => {
    const copied: SaleBillRow[] = (inv.items || []).map((it, idx) => ({
      rowId: `hist_row_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      medicineId: it.medicineId || `hist_med_${idx}`,
      medicineName: it.medicineName,
      pack: (it as any).pack || '1*10',
      batchId: it.batchId || `hist_batch_${idx}`,
      batchNo: it.batchNo || 'B001',
      expiryDate: '2028-12-31',
      qty: Number(it.qty || 1),
      tabQty: 0,
      freeQty: 0,
      costPrice: Number(it.costPrice || 10),
      sellPrice: Number(it.sellPrice || 15),
      mrp: Number(it.mrp || it.sellPrice || 15),
      gstPercent: Number(it.gstPercent || 12),
      lineTotal: Number(it.lineTotal || 15),
      lineProfit: Number(((it.sellPrice - it.costPrice) * it.qty).toFixed(2)),
      maxStock: 999,
      marginPercent: 20,
    }));
    setBillItems(copied);
    if (inv.customerName && inv.customerName !== 'Walk-in Customer') {
      setCustomerName(inv.customerName);
    }
    if (inv.customerPhone) {
      setCustomerPhone(inv.customerPhone);
    }
    setToastMessage(
      `✓ बिल #${inv.invoiceNo} की सभी ${copied.length} दवाइयां ग्रिड में लोड हो गईं! आप इसके नीचे और भी दवाइयां जोड़ सकते हैं।`
    );
  };

  const handlePrintA4Bill = () => {
    printElementById('sandana-a4-bill-print', {
      title: savedInvoiceRecord
        ? `GST_Invoice_${savedInvoiceRecord.invoiceNo}`
        : `GST_Invoice_${customBillNo}`,
    });
  };

  const handleOpenPrintPageA4 = () => {
    openPrintWindow(
      'sandana-a4-bill-print',
      `GST Invoice - ${savedInvoiceRecord?.invoiceNo || customBillNo}`
    );
  };

  const currentMeta = MODE_META[entryMode];
  const activeRow =
    billItems.find((r) => r.rowId === activeRowBatchId || r.batchId === activeRowBatchId) ||
    billItems[billItems.length - 1] ||
    null;

  return (
    <div className="bg-[#e0e0e0] min-h-[calc(100vh-80px)] select-none sm:select-auto font-mono text-xs">
      {/* Hidden Excel File Input */}
      <input
        ref={purchaseExcelRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleQuickPurchaseExcelImport}
        className="hidden"
      />

      {/* Error / Toast Notification Strip */}
      {errorMessage && (
        <div className="bg-red-700 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between border-b border-black">
          <span>⚠️ {errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="underline text-[11px] cursor-pointer"
          >
            [Dismiss]
          </button>
        </div>
      )}

      {toastMessage && (
        <div className="bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold flex items-center justify-between border-b border-black">
          <span>{toastMessage}</span>
          <div className="flex items-center gap-2">
            {savedInvoiceRecord && (
              <button
                type="button"
                onClick={handleResetNewBill}
                className="px-2.5 py-0.5 bg-amber-400 text-slate-950 font-bold rounded-xs cursor-pointer"
              >
                + New Bill [Alt+N]
              </button>
            )}
            <button
              type="button"
              onClick={() => setToastMessage(null)}
              className="underline text-[11px] cursor-pointer"
            >
              [Dismiss]
            </button>
          </div>
        </div>
      )}

      {/* Printable Invoice View After Saving a Sale Bill */}
      {savedInvoiceRecord && (
        <div className="p-4 space-y-4 bg-white border border-slate-400">
          <div className="no-print flex flex-wrap items-center justify-between gap-2 bg-slate-100 border border-slate-300 p-3 font-sans">
            <div className="text-xs font-bold text-[#000080]">
              Invoice #{savedInvoiceRecord.invoiceNo} Saved · Customer:{' '}
              {savedInvoiceRecord.customerName} · Net: ₹
              {savedInvoiceRecord.grandTotal.toFixed(2)}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handlePrintA4Bill}
                className="px-3.5 py-1.5 bg-[#000080] hover:bg-blue-900 text-white text-xs font-bold rounded-xs inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                Print A4 GST Bill
              </button>
              <button
                type="button"
                onClick={handleOpenPrintPageA4}
                className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#000080] border border-blue-300 text-xs font-bold rounded-xs cursor-pointer"
              >
                Open Print Window
              </button>
              <button
                type="button"
                onClick={handleOpenUpiQrModal}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded-xs inline-flex items-center gap-1 cursor-pointer"
              >
                <QrCode size={14} />
                Show UPI QR
              </button>
              <button
                type="button"
                onClick={handleResetNewBill}
                className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xs cursor-pointer"
              >
                + New Entry [Esc / Alt+N]
              </button>
            </div>
          </div>

          <A4BillTemplate
            ref={a4PrintRef}
            invoice={savedInvoiceRecord}
            clinicSettings={clinicSettings as any}
            qrDataUrl={qrData?.qrDataUrl}
          />

          <Receipt
            invoice={savedInvoiceRecord}
            clinicName={clinicSettings.clinicName}
            medicalName={clinicSettings.medicalName}
            clinicAddress={clinicSettings.clinicAddress}
            medicalPhone={clinicSettings.medicalPhone}
            onClose={handleResetNewBill}
          />
        </div>
      )}

      {/* =========================================================================
          EXACT MARG ERP AI+ SPLIT-SCREEN ENTRY WINDOW (MATCHING image_3ede2b19.png)
          Left (73%): SALE / PURCHASE / CHALLAN / RETURN ENTRY
          Right (27%): SALES / PURCHASE HISTORY [ Click to Copy ]
      ========================================================================= */}
      {!savedInvoiceRecord && (
        <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[calc(100vh-84px)] bg-[#e0e0e0]">
          {/* =====================================================================
              LEFT 73% MAIN ENTRY WINDOW
          ===================================================================== */}
          <div className="lg:col-span-9 flex flex-col justify-between border-r-2 border-[#4b6b66] bg-[#e8e8e8]">
            <div>
              {/* 1. TOP DARK SLATE-TEAL BAR (SALE ENTRY | 11-11-2026|Wed|P|16:26:25) */}
              <div className="bg-[#4b6b66] text-white px-2.5 py-1 flex flex-wrap items-center justify-between gap-2 border-b border-black">
                <div className="flex items-center gap-3">
                  <span className="text-xs sm:text-sm font-sans font-bold tracking-wide uppercase">
                    {currentMeta.headerTitle}
                  </span>
                  {/* Quick Excel Import & Sample Template Buttons right in Header */}
                  <button
                    type="button"
                    disabled={importingPurchaseExcel}
                    onClick={() => purchaseExcelRef.current?.click()}
                    className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-sans font-extrabold text-[10px] rounded-xs inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                    title="Import Purchase or Sale Excel (.xlsx / .csv) directly into the Marg Grid"
                  >
                    <Upload size={11} />
                    <span>
                      {importingPurchaseExcel
                        ? 'Importing Excel...'
                        : 'Import Excel (.XLSX)'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadSamplePurchaseBillExcel}
                    className="px-2 py-0.5 bg-white/20 hover:bg-white/30 text-white font-sans font-bold text-[10px] rounded-xs inline-flex items-center gap-1 cursor-pointer"
                    title="Download Sample Purchase Excel Template"
                  >
                    <Download size={10} />
                    <span>Sample Excel</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold tracking-wider">
                    {format(now, 'dd-MM-yyyy')}|{format(now, 'EEE')}|P|
                    {format(now, 'HH:mm:ss')}
                  </span>
                </div>
              </div>

              {/* 2. HEADER FIELDS BLOCK (Bill No., Date, Patient F2, Name, Address, Doctor F1, Name, Reg.No.) */}
              <div
                className={`${currentMeta.headerBg} border-b border-black px-3 py-2 text-xs text-[#003380] space-y-1 font-mono`}
              >
                {/* Row 1: Bill No. : A000001 | Date : 11-11-2026 */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-7 flex items-center gap-1">
                    <span className="w-24 shrink-0">
                      {currentMeta.isPurchaseSide ? 'Entry No. :' : 'Bill No.  :'}
                    </span>
                    <input
                      ref={billNoInputRef}
                      type="text"
                      value={customBillNo}
                      onChange={(e) => setCustomBillNo(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          patientPhoneRef.current?.focus();
                        }
                      }}
                      className="bg-transparent focus:bg-[#ffffcc] px-1 py-0 text-sm font-bold text-black w-40 focus:outline-none border-b border-transparent focus:border-black"
                    />
                  </div>
                  <div className="sm:col-span-5 flex items-center gap-1">
                    <span className="w-20 shrink-0">Date   :</span>
                    <input
                      type="text"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          patientPhoneRef.current?.focus();
                        }
                      }}
                      className="bg-transparent focus:bg-[#ffffcc] px-1 py-0 text-sm font-bold text-black w-32 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 2: Patient F2: ... Name: ... | Address: ... */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-4 flex items-center gap-1">
                    <span className="w-24 shrink-0">
                      {currentMeta.isPurchaseSide ? 'Party F2 :' : 'Patient F2:'}
                    </span>
                    <input
                      ref={patientPhoneRef}
                      type="text"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          patientNameRef.current?.focus();
                        }
                      }}
                      placeholder=""
                      className="w-full bg-transparent focus:bg-[#ffffcc] border-b border-[#7ea6cc]/60 px-1 py-0 text-black font-bold focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3 flex items-center gap-1">
                    <span className="w-12 shrink-0">Name:</span>
                    <input
                      ref={patientNameRef}
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          patientAddressRef.current?.focus();
                        }
                      }}
                      placeholder=""
                      className="w-full bg-transparent focus:bg-[#ffffcc] border-b border-[#7ea6cc]/60 px-1 py-0 text-black font-bold focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-5 flex items-center gap-1">
                    <span className="w-20 shrink-0">Address:</span>
                    <input
                      ref={patientAddressRef}
                      type="text"
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          doctorCodeRef.current?.focus();
                        }
                      }}
                      placeholder=""
                      className="w-full bg-transparent focus:bg-[#ffffcc] border-b border-[#7ea6cc]/60 px-1 py-0 text-black font-bold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Row 3: Doctor F1: ... Name: ... | Reg.No.: ... */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <div className="sm:col-span-4 flex items-center gap-1">
                    <span className="w-24 shrink-0">
                      {currentMeta.isPurchaseSide ? 'Party Inv:' : 'Doctor  F1:'}
                    </span>
                    <input
                      ref={doctorCodeRef}
                      type="text"
                      value={doctorCode}
                      onChange={(e) => setDoctorCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          doctorNameRef.current?.focus();
                        }
                      }}
                      className="w-full bg-transparent focus:bg-[#ffffcc] border-b border-[#7ea6cc]/60 px-1 py-0 text-black font-bold focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-3 flex items-center gap-1">
                    <span className="w-12 shrink-0">Name:</span>
                    <input
                      ref={doctorNameRef}
                      type="text"
                      value={doctorName}
                      onChange={(e) => setDoctorName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          doctorRegRef.current?.focus();
                        }
                      }}
                      className="w-full bg-transparent focus:bg-[#ffffcc] border-b border-[#7ea6cc]/60 px-1 py-0 text-black font-bold focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-5 flex items-center gap-1">
                    <span className="w-20 shrink-0">
                      {currentMeta.isPurchaseSide ? 'GSTIN  :' : 'Reg.No.:'}
                    </span>
                    <input
                      ref={doctorRegRef}
                      type="text"
                      value={doctorRegNo}
                      onChange={(e) => setDoctorRegNo(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setIsEditingInlineRow(true);
                          setShowItemPopup(true);
                          setTimeout(() => inlineProductRef.current?.focus(), 20);
                        }
                      }}
                      className="w-full bg-transparent focus:bg-[#ffffcc] border-b border-[#7ea6cc]/60 px-1 py-0 text-black font-bold focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* 3. AUTHENTIC 10-ROW MARG ENTRY GRID WITH DARK-GREEN INLINE CURSOR BAR */}
              <div className="relative bg-white">
                <table className="w-full text-xs border-collapse font-mono table-fixed">
                  <thead>
                    {currentMeta.isPurchaseSide ? (
                      <tr className={`${currentMeta.gridHeaderBg} border-b border-black text-black`}>
                        <th className="py-1 px-2 text-left font-normal text-xs border-r border-slate-400 w-[28%]">
                          PRODUCT (दवा का नाम)
                        </th>
                        <th className="py-1 px-1 text-left font-normal text-xs border-r border-slate-400 w-[8%]">
                          PACK
                        </th>
                        <th className="py-1 px-1 text-left font-normal text-xs border-r border-slate-400 w-[11%]">
                          BATCH
                        </th>
                        <th className="py-1 px-1 text-left font-normal text-xs border-r border-slate-400 w-[11%]">
                          EXPIRY
                        </th>
                        <th className="py-1 px-1 text-right font-normal text-xs border-r border-slate-400 w-[7%]">
                          STRI
                        </th>
                        <th className="py-1 px-1 text-right font-normal text-xs border-r border-slate-400 w-[6%]">
                          FREE
                        </th>
                        <th className="py-1 px-1 text-right font-normal text-xs border-r border-slate-400 w-[9%]">
                          P.RATE/S
                        </th>
                        <th className="py-1 px-1 text-right font-normal text-xs border-r border-slate-400 w-[9%]">
                          M.R.P./S
                        </th>
                        <th className="py-1 px-2 text-right font-normal text-xs w-[11%]">
                          AMOUNT
                        </th>
                      </tr>
                    ) : (
                      <tr className={`${currentMeta.gridHeaderBg} border-b border-black text-black`}>
                        <th className="py-1 px-2 text-left font-normal text-sm border-r border-slate-400 w-[38%]">
                          PRODUCT
                        </th>
                        <th className="py-1 px-1.5 text-left font-normal text-sm border-r border-slate-400 w-[10%]">
                          PACK
                        </th>
                        <th className="py-1 px-1.5 text-left font-normal text-sm border-r border-slate-400 w-[13%]">
                          BATCH
                        </th>
                        <th className="py-1 px-1.5 text-right font-normal text-sm border-r border-slate-400 w-[8%]">
                          STRI
                        </th>
                        <th className="py-1 px-1.5 text-right font-normal text-sm border-r border-slate-400 w-[8%]">
                          TAB.
                        </th>
                        <th className="py-1 px-1.5 text-right font-normal text-sm border-r border-slate-400 w-[11%]">
                          M.R.P./S
                        </th>
                        <th className="py-1 px-2 text-right font-normal text-sm w-[12%]">
                          AMOUNT
                        </th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {/* Existing Committed Rows (Editable Inline, Row-by-Row!) */}
                    {billItems.map((row, rowIdx) => {
                      const rowKey = row.rowId || `${row.batchId}_${rowIdx}`;
                      const isSelected = activeRowBatchId === rowKey || activeRowBatchId === row.batchId;
                      return (
                        <tr
                          key={rowKey}
                          onClick={() => setActiveRowBatchId(rowKey)}
                          className={`h-7 border-b border-slate-300 cursor-pointer ${
                            isSelected ? 'bg-[#cce8ff] font-bold' : 'bg-white hover:bg-blue-50/40'
                          }`}
                        >
                          <td className="px-2 border-r border-slate-300">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[10px] font-bold text-[#000080] shrink-0">
                                {rowIdx + 1}.
                              </span>
                              <input
                                type="text"
                                list="pharmacy-med-datalist"
                                value={row.medicineName}
                                placeholder="TYPE MEDICINE NAME..."
                                onChange={(e) =>
                                  handleUpdateExistingRow(rowKey, 'medicineName', e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    inlineProductRef.current?.focus();
                                  }
                                }}
                                className="w-full bg-transparent font-bold text-black focus:bg-[#ffffcc] focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveRow(rowKey);
                                }}
                                className="text-red-600 hover:text-red-800 text-[10px] font-sans font-bold px-1 cursor-pointer"
                                title="Delete Medicine Row"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                          <td className="px-1 border-r border-slate-300">
                            <input
                              type="text"
                              value={row.pack || '1*10'}
                              onChange={(e) =>
                                handleUpdateExistingRow(rowKey, 'pack', e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  inlineProductRef.current?.focus();
                                }
                              }}
                              className="w-full bg-transparent text-slate-900 focus:bg-[#ffffcc] focus:outline-none"
                            />
                          </td>
                          <td className="px-1 border-r border-slate-300">
                            <input
                              type="text"
                              value={row.batchNo}
                              onChange={(e) =>
                                handleUpdateExistingRow(rowKey, 'batchNo', e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  inlineProductRef.current?.focus();
                                }
                              }}
                              className="w-full bg-transparent font-bold text-[#000080] focus:bg-[#ffffcc] focus:outline-none"
                            />
                          </td>
                          {currentMeta.isPurchaseSide && (
                            <td className="px-1 border-r border-slate-300">
                              <input
                                type="text"
                                value={row.expiryDate || '2028-12-31'}
                                onChange={(e) =>
                                  handleUpdateExistingRow(rowKey, 'expiryDate', e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    inlineProductRef.current?.focus();
                                  }
                                }}
                                className="w-full bg-transparent text-slate-800 focus:bg-[#ffffcc] focus:outline-none"
                              />
                            </td>
                          )}
                          <td className="px-1 border-r border-slate-300 text-right">
                            <input
                              type="number"
                              min={0}
                              value={row.qty}
                              onChange={(e) =>
                                handleUpdateExistingRow(rowKey, 'qty', e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  inlineProductRef.current?.focus();
                                }
                              }}
                              className="w-full text-right bg-transparent font-bold text-black focus:bg-[#ffffcc] focus:outline-none"
                            />
                          </td>
                          <td className="px-1 border-r border-slate-300 text-right">
                            <input
                              type="number"
                              min={0}
                              value={currentMeta.isPurchaseSide ? row.freeQty || 0 : row.tabQty || 0}
                              onChange={(e) =>
                                handleUpdateExistingRow(
                                  rowKey,
                                  currentMeta.isPurchaseSide ? 'freeQty' : 'tabQty',
                                  e.target.value
                                )
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  inlineProductRef.current?.focus();
                                }
                              }}
                              className="w-full text-right bg-transparent text-slate-800 focus:bg-[#ffffcc] focus:outline-none"
                            />
                          </td>
                          {currentMeta.isPurchaseSide && (
                            <td className="px-1 border-r border-slate-300 text-right">
                              <input
                                type="number"
                                step="0.01"
                                value={row.costPrice}
                                onChange={(e) =>
                                  handleUpdateExistingRow(rowKey, 'costPrice', e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    inlineProductRef.current?.focus();
                                  }
                                }}
                                className="w-full text-right bg-transparent font-bold text-amber-900 focus:bg-[#ffffcc] focus:outline-none"
                              />
                            </td>
                          )}
                          <td className="px-1 border-r border-slate-300 text-right">
                            <input
                              type="number"
                              step="0.01"
                              value={row.sellPrice}
                              onChange={(e) =>
                                handleUpdateExistingRow(rowKey, 'sellPrice', e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  inlineProductRef.current?.focus();
                                }
                              }}
                              className="w-full text-right bg-transparent font-bold text-slate-900 focus:bg-[#ffffcc] focus:outline-none"
                            />
                          </td>
                          <td className="px-2 text-right font-bold text-black">
                            {row.lineTotal.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* ACTIVE DARK-GREEN INLINE ENTRY ROW (Always sits right below the last added medicine!) */}
                    <tr
                      onClick={() => {
                        if (!isEditingInlineRow) {
                          setIsEditingInlineRow(true);
                          setShowItemPopup(true);
                          setTimeout(() => inlineProductRef.current?.focus(), 20);
                        }
                      }}
                      className="h-7 bg-[#254132] text-white border-b border-slate-400 cursor-text"
                    >
                      <td className="px-2 border-r border-slate-400 relative">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-emerald-300 shrink-0">
                            {billItems.length + 1}.
                          </span>
                          <input
                            ref={inlineProductRef}
                            type="text"
                            value={inlineProduct}
                            onFocus={() => {
                              setIsEditingInlineRow(true);
                              setShowItemPopup(true);
                            }}
                            onChange={(e) => {
                              setInlineProduct(e.target.value);
                              setIsEditingInlineRow(true);
                              setShowItemPopup(true);
                              setPopupHighlightIdx(0);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'ArrowLeft' && !inlineProduct) {
                                e.preventDefault();
                                setShowItemPopup(false);
                                billNoInputRef.current?.focus();
                                billNoInputRef.current?.select();
                              } else if (e.key === 'ArrowDown' && showItemPopup) {
                                e.preventDefault();
                                setPopupHighlightIdx((prev) =>
                                  Math.min(popupStockItems.length - 1, prev + 1)
                                );
                              } else if (e.key === 'ArrowUp' && showItemPopup) {
                                e.preventDefault();
                                setPopupHighlightIdx((prev) => Math.max(0, prev - 1));
                              } else if (e.key === 'Enter') {
                                e.preventDefault();
                                if (showItemPopup && popupStockItems[popupHighlightIdx]) {
                                  handlePickPopupItem(popupStockItems[popupHighlightIdx]);
                                } else if (inlineProduct.trim()) {
                                  setShowItemPopup(false);
                                  inlinePackRef.current?.focus();
                                  inlinePackRef.current?.select();
                                } else {
                                  setShowItemPopup(true);
                                }
                              }
                            }}
                            placeholder={
                              billItems.length === 0
                                ? '←key to change Bill No. (Type Medicine e.g. Dolo 650 or Press Enter)'
                                : `+ अगली दवा का नाम लिखें (Row #${billItems.length + 1} - Type Next Medicine or Press Enter)`
                            }
                            className="w-full bg-transparent text-white placeholder-white/95 font-sans text-xs focus:outline-none"
                          />
                        </div>
                      </td>
                      <td className="px-1 border-r border-slate-400">
                        <input
                          ref={inlinePackRef}
                          type="text"
                          value={isEditingInlineRow || inlineProduct ? inlinePack : ''}
                          onChange={(e) => setInlinePack(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              inlineBatchRef.current?.focus();
                              inlineBatchRef.current?.select();
                            }
                          }}
                          placeholder=""
                          className="w-full bg-transparent text-white font-mono text-xs focus:bg-[#1a3024] focus:outline-none"
                        />
                      </td>
                      <td className="px-1 border-r border-slate-400">
                        <input
                          ref={inlineBatchRef}
                          type="text"
                          value={isEditingInlineRow || inlineProduct ? inlineBatchNo : ''}
                          onChange={(e) => setInlineBatchNo(e.target.value.toUpperCase())}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              inlineStriRef.current?.focus();
                              inlineStriRef.current?.select();
                            }
                          }}
                          placeholder={isEditingInlineRow ? 'BATCH' : ''}
                          className="w-full bg-transparent text-amber-200 font-mono font-bold text-xs focus:bg-[#1a3024] focus:outline-none"
                        />
                      </td>
                      {currentMeta.isPurchaseSide && (
                        <td className="px-1 border-r border-slate-400">
                          <input
                            type="text"
                            value={isEditingInlineRow || inlineProduct ? inlineExpiry : ''}
                            onChange={(e) => setInlineExpiry(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                inlineStriRef.current?.focus();
                                inlineStriRef.current?.select();
                              }
                            }}
                            placeholder="YYYY-MM-DD"
                            className="w-full bg-transparent text-white font-mono text-xs focus:bg-[#1a3024] focus:outline-none"
                          />
                        </td>
                      )}
                      <td className="px-1 border-r border-slate-400 text-right">
                        <input
                          ref={inlineStriRef}
                          type="number"
                          min={0}
                          value={isEditingInlineRow || inlineProduct ? inlineStri : ''}
                          onChange={(e) => setInlineStri(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              inlineTabRef.current?.focus();
                              inlineTabRef.current?.select();
                            }
                          }}
                          className="w-full bg-transparent text-right text-white font-mono font-bold text-xs focus:bg-[#1a3024] focus:outline-none"
                        />
                      </td>
                      <td className="px-1 border-r border-slate-400 text-right">
                        <input
                          ref={inlineTabRef}
                          type="number"
                          min={0}
                          value={isEditingInlineRow || inlineProduct ? inlineTab : ''}
                          onChange={(e) => setInlineTab(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              inlineMrpRef.current?.focus();
                              inlineMrpRef.current?.select();
                            }
                          }}
                          className="w-full bg-transparent text-right text-white font-mono text-xs focus:bg-[#1a3024] focus:outline-none"
                        />
                      </td>
                      {currentMeta.isPurchaseSide && (
                        <td className="px-1 border-r border-slate-400 text-right">
                          <input
                            type="number"
                            step="0.01"
                            value={isEditingInlineRow || inlineProduct ? inlineCostPrice || '' : ''}
                            onChange={(e) => {
                              const c = parseFloat(e.target.value) || 0;
                              setInlineCostPrice(c);
                              if (!inlineMrp || parseFloat(inlineMrp) < c) {
                                setInlineMrp(String(Number((c * 1.3).toFixed(2))));
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                inlineMrpRef.current?.focus();
                                inlineMrpRef.current?.select();
                              }
                            }}
                            placeholder="P.Rate"
                            className="w-full bg-transparent text-right text-amber-200 font-mono font-bold text-xs focus:bg-[#1a3024] focus:outline-none"
                          />
                        </td>
                      )}
                      <td className="px-1 border-r border-slate-400 text-right">
                        <input
                          ref={inlineMrpRef}
                          type="number"
                          step="0.01"
                          value={isEditingInlineRow || inlineProduct ? inlineMrp : ''}
                          onChange={(e) => setInlineMrp(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCommitInlineRow();
                            }
                          }}
                          placeholder={isEditingInlineRow ? '0.00' : ''}
                          className="w-full bg-transparent text-right text-emerald-200 font-mono font-bold text-xs focus:bg-[#1a3024] focus:outline-none"
                        />
                      </td>
                      <td className="px-1 text-right font-bold text-white">
                        {inlineProduct.trim() ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCommitInlineRow();
                            }}
                            className="px-1.5 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-sans font-extrabold text-[10px] rounded-xs cursor-pointer"
                            title="इस दवा को बिल में जोड़ें और अगली लाइन पर जाएं"
                          >
                            + Add [↵]
                          </button>
                        ) : (
                          ''
                        )}
                      </td>
                    </tr>

                    {/* Remaining Blank Grid Rows: Clicking any blank row auto-commits typed medicine or opens next row! */}
                    {Array.from({
                      length: Math.max(0, 9 - billItems.length),
                    }).map((_, emptyIdx) => (
                      <tr
                        key={`blank-row-${emptyIdx}`}
                        onClick={() => {
                          if (inlineProduct.trim()) {
                            handleCommitInlineRow();
                          } else {
                            setIsEditingInlineRow(true);
                            setShowItemPopup(true);
                            setTimeout(() => inlineProductRef.current?.focus(), 20);
                          }
                        }}
                        className="h-7 border-b border-slate-300 bg-white hover:bg-emerald-50/40 cursor-pointer"
                        title="यहाँ क्लिक करके अगली दवा जोड़ें (Click to add next medicine row)"
                      >
                        <td className="px-2 border-r border-slate-300 text-[10px] text-slate-400 font-sans">
                          {emptyIdx === 0 && billItems.length > 0
                            ? `↳ यहाँ क्लिक करें या ऊपर हरी पट्टी में अगली दवा (#${billItems.length + 1}) जोड़ें...`
                            : ''}
                        </td>
                        <td className="px-1 border-r border-slate-300" />
                        <td className="px-1 border-r border-slate-300" />
                        {currentMeta.isPurchaseSide && <td className="px-1 border-r border-slate-300" />}
                        <td className="px-1 border-r border-slate-300" />
                        <td className="px-1 border-r border-slate-300" />
                        {currentMeta.isPurchaseSide && <td className="px-1 border-r border-slate-300" />}
                        <td className="px-1 border-r border-slate-300" />
                        <td className="px-2" />
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Datalist for inline medicine autocomplete in any row */}
                <datalist id="pharmacy-med-datalist">
                  {batches.map((b) => (
                    <option key={b.id} value={b.medicineName}>
                      {b.pack} | Batch: {b.batchNo} | Stock: {b.stock} | MRP: ₹{b.mrp}
                    </option>
                  ))}
                </datalist>

                {/* MULTI-MEDICINE QUICK ADD BAR (Ensures 1-click multi-medicine entry in the same bill) */}
                <div className="bg-[#dce8f5] border-t border-black px-2.5 py-1 flex flex-wrap items-center justify-between gap-2 font-sans text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-[#000080] text-white font-bold rounded-xs">
                      इस बिल में कुल दवाइयां (Medicines in Bill #{customBillNo}): {billItems.length}
                    </span>
                    <span className="text-slate-700 font-medium hidden sm:inline">
                      (एक ही बिल में जितनी चाहें उतनी दवाइयां एक के नीचे एक जोड़ें — जैसे 1. Dolo 650, 2. Pan-D, 3. Augmentin)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (inlineProduct.trim()) {
                          handleCommitInlineRow();
                        } else {
                          setIsEditingInlineRow(true);
                          setShowItemPopup(true);
                          setTimeout(() => inlineProductRef.current?.focus(), 20);
                        }
                      }}
                      className="px-2.5 py-0.5 bg-[#254132] hover:bg-emerald-900 text-white font-bold rounded-xs cursor-pointer"
                    >
                      + लिस्ट से अगली दवा चुनें (Select Next Medicine)
                    </button>
                    <button
                      type="button"
                      onClick={handleAddBlankEditableRow}
                      className="px-2.5 py-0.5 bg-amber-400 hover:bg-amber-300 text-slate-950 border border-amber-700 font-bold rounded-xs cursor-pointer"
                    >
                      + नीचे नई खाली लाइन जोड़ें (Add New Medicine Row)
                    </button>
                  </div>
                </div>

                {/* MARG ITEM SELECTION POPUP WINDOW (Opens when typing/pressing Enter on the dark-green row) */}
                {showItemPopup && (
                  <div className="absolute left-2 top-16 z-40 w-[98%] max-w-4xl bg-[#edeae0] border-2 border-[#000080] shadow-2xl">
                    <div className="bg-[#000080] text-white px-2.5 py-1 flex items-center justify-between text-[11px] font-bold">
                      <span>
                        SELECT MEDICINE FROM LIVE DATABASE STOCK (↑/↓ &amp; Enter to Pick · Or Type New Medicine &amp; Press Tab)
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setShowItemPopup(false);
                            inlinePackRef.current?.focus();
                          }}
                          className="px-2 py-0.5 bg-amber-400 text-slate-950 font-bold rounded-xs cursor-pointer"
                        >
                          [Tab] Manual New Medicine Entry
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowItemPopup(false)}
                          className="text-white hover:text-red-300 cursor-pointer"
                        >
                          [Esc] ✕
                        </button>
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto bg-white">
                      <table className="w-full text-[11px] border-collapse font-mono">
                        <thead>
                          <tr className="bg-[#d9e4ec] text-[#000080] border-b border-slate-400 font-bold">
                            <th className="py-1 px-2 text-left border-r">ITEM DESCRIPTION</th>
                            <th className="py-1 px-1.5 text-left border-r">PACK</th>
                            <th className="py-1 px-1.5 text-left border-r">BATCH</th>
                            <th className="py-1 px-1.5 text-center border-r">EXPIRY</th>
                            <th className="py-1 px-1.5 text-right border-r">PURCHASED</th>
                            <th className="py-1 px-1.5 text-right border-r">SOLD</th>
                            <th className="py-1 px-1.5 text-right border-r">AVAIL. STOCK</th>
                            <th className="py-1 px-1.5 text-right border-r">M.R.P.</th>
                            <th className="py-1 px-2 text-right">P.RATE</th>
                          </tr>
                        </thead>
                        <tbody>
                          {popupStockItems.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="p-3 text-center text-slate-600">
                                No matching stock item for &ldquo;{inlineProduct}&rdquo;. Press{' '}
                                <strong>Tab</strong> or click <strong>[Manual New Medicine Entry]</strong> to enter
                                this new medicine directly in the row!
                              </td>
                            </tr>
                          ) : (
                            popupStockItems.map((it, idx) => {
                              const isHighlighted = idx === popupHighlightIdx;
                              return (
                                <tr
                                  key={`${it.medId}-${it.batchId}-${idx}`}
                                  onClick={() => handlePickPopupItem(it)}
                                  className={`cursor-pointer border-b border-slate-200 ${
                                    isHighlighted
                                      ? 'bg-[#254132] text-white font-bold'
                                      : 'hover:bg-blue-50 text-slate-900'
                                  }`}
                                >
                                  <td className="py-1 px-2 border-r">{it.medName}</td>
                                  <td className="py-1 px-1.5 border-r">{it.pack}</td>
                                  <td className="py-1 px-1.5 border-r">{it.batchNo}</td>
                                  <td className="py-1 px-1.5 text-center border-r">
                                    {it.expiryDate}
                                  </td>
                                  <td className="py-1 px-1.5 text-right border-r">
                                    {it.purchasedQty} Str
                                  </td>
                                  <td className="py-1 px-1.5 text-right border-r">
                                    {it.soldQty} Str
                                  </td>
                                  <td className="py-1 px-1.5 text-right border-r font-bold">
                                    {formatStockUnits(it.stock, it.pack)}
                                  </td>
                                  <td className="py-1 px-1.5 text-right border-r">
                                    {it.mrp.toFixed(2)}
                                  </td>
                                  <td className="py-1 px-2 text-right">
                                    {it.costPrice.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* =====================================================================
                BOTTOM TELEMETRY, TOOLBAR & FOOTER (EXACT MATCH TO image_3ede2b19.png)
            ===================================================================== */}
            <div>
              {/* 4. 3-COLUMN BOTTOM TELEMETRY PANEL (Item/Batch/Expiry/Stock | MRP Value/Amount/Balance | VALUE OF GOODS/DISCOUNT/GST%) */}
              <div
                className={`${currentMeta.headerBg} border-t border-black grid grid-cols-1 md:grid-cols-12 text-xs text-[#003380] font-mono`}
              >
                {/* Left Column: Item, Batch, Expiry, Stock, Chall., Date, Cal:9,2,TAB.:0(0) */}
                <div className="md:col-span-5 p-2 border-b md:border-b-0 md:border-r border-black flex flex-col justify-between min-h-[118px]">
                  <div className="space-y-1">
                    <div className="flex items-center">
                      <span className="w-16 shrink-0">Item  :</span>
                      <span className="font-bold text-black truncate">
                        {activeRow?.medicineName || inlineProduct || ''}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-16 shrink-0">Batch :</span>
                      <span className="font-bold text-black">
                        {activeRow?.batchNo || inlineBatchNo || ''}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center">
                        <span className="w-16 shrink-0">Expiry:</span>
                        <span className="font-bold text-black">
                          {activeRow?.expiryDate || inlineExpiry || ''}
                        </span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-14 shrink-0">Stock:</span>
                        <span className="font-bold text-black">
                          {activeRow
                            ? formatStockUnits(activeRow.maxStock, activeRow.pack)
                            : ''}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center">
                        <span className="w-16 shrink-0">Chall.:</span>
                        <span className="font-bold text-black">{customBillNo}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="w-14 shrink-0">Date :</span>
                        <span className="font-bold text-black">{billDate}</span>
                      </div>
                    </div>
                  </div>
                  <div className="pt-1 text-[11px] font-sans text-black">
                    Cal:9,2,{currentMeta.isPurchaseSide ? `FREE:${totalFree}` : `TAB.:${totalTab}`}({totalStri})
                  </div>
                </div>

                {/* Middle Column: MRP Value, Amount, Balance */}
                <div className="md:col-span-3 p-2 border-b md:border-b-0 border-black space-y-1 text-black">
                  <div className="flex items-center justify-between">
                    <span>MRP Value :</span>
                    <span className="font-bold">{mrpValueTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Amount    :</span>
                    <span className="font-bold">{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Balance   :</span>
                    <span className="font-bold">0</span>
                  </div>
                </div>

                {/* Right Column: VALUE OF GOODS, DISCOUNT, GST%, etc. */}
                <div className="md:col-span-4 p-2 space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span>VALUE OF GOODS :</span>
                    <span className="font-bold text-black">{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>DISCOUNT       :</span>
                    <input
                      type="number"
                      min={0}
                      max={subtotal}
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      className="w-20 text-right bg-transparent border-b border-[#7ea6cc] font-bold text-black focus:bg-[#ffffcc] focus:outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>GST%           :</span>
                    <span className="font-bold text-black">{totalGst.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="pl-14">:</span>
                    <span className="text-black">{(totalGst / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="pl-14">:</span>
                    <span className="text-black">{(totalGst / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="pl-14">:</span>
                    <span className="font-bold text-black">{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* 5. DARK SLATE-TEAL ACTION TOOLBAR (HELP | SALE | PURC | SC | PC | COPY | PASTE | SR | GST | RIO | BE | CASH | VOU | HOLD | PRES | EARN | SAVE | Icons) */}
              <div className="bg-[#4b6b66] text-white px-1.5 py-1 border-y border-black flex flex-wrap items-center justify-between gap-1 font-serif text-[11px]">
                <div className="flex flex-wrap items-center gap-1">
                  {/* Red HELP Oval */}
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white font-sans font-black text-[10px] rounded-full border border-white cursor-pointer"
                  >
                    HELP
                  </button>

                  {/* Mode & Utility Buttons */}
                  {[
                    {
                      id: 'SALE',
                      label: 'SALE',
                      active: entryMode === 'SALE',
                      onClick: () => setEntryMode('SALE'),
                    },
                    {
                      id: 'PURC',
                      label: 'PURC',
                      active: entryMode === 'PURC',
                      onClick: () => setEntryMode('PURC'),
                    },
                    {
                      id: 'SC',
                      label: 'SC',
                      active: entryMode === 'SC',
                      onClick: () => setEntryMode('SC'),
                    },
                    {
                      id: 'PC',
                      label: 'PC',
                      active: entryMode === 'PC',
                      onClick: () => setEntryMode('PC'),
                    },
                    {
                      id: 'COPY',
                      label: 'COPY',
                      active: false,
                      onClick: () => {
                        setCopiedRowsBuffer([...billItems]);
                        setToastMessage(`✓ Copied ${billItems.length} rows to clipboard buffer.`);
                      },
                    },
                    {
                      id: 'PASTE',
                      label: 'PASTE',
                      active: false,
                      onClick: () => {
                        if (copiedRowsBuffer.length === 0) {
                          setErrorMessage('Clipboard buffer is empty. Click COPY on a bill first.');
                        } else {
                          setBillItems((prev) => [...prev, ...copiedRowsBuffer]);
                          setToastMessage(
                            `✓ Pasted ${copiedRowsBuffer.length} rows into active grid!`
                          );
                        }
                      },
                    },
                    {
                      id: 'SR',
                      label: 'SR',
                      active: entryMode === 'SR',
                      onClick: () => setEntryMode('SR'),
                    },
                    {
                      id: 'GST',
                      label: 'GST',
                      active: showGstModal,
                      onClick: () => setShowGstModal((prev) => !prev),
                    },
                    {
                      id: 'RIO',
                      label: 'RIO',
                      active: false,
                      onClick: () => setShowRxHub(true),
                    },
                    {
                      id: 'BE',
                      label: 'BE',
                      active: entryMode === 'BE',
                      onClick: () => setEntryMode('BE'),
                    },
                    {
                      id: 'CASH',
                      label: 'CASH',
                      active: false,
                      onClick: () => handlePrimarySaveAction(),
                    },
                    {
                      id: 'VOU',
                      label: 'VOU',
                      active: false,
                      onClick: () => navigate('/pharmacy/erp?view=voucher_receipt'),
                    },
                    {
                      id: 'HOLD',
                      label: 'HOLD',
                      active: !!heldBillBuffer,
                      onClick: () => {
                        if (billItems.length > 0) {
                          setHeldBillBuffer({
                            customerName,
                            customerPhone,
                            items: [...billItems],
                          });
                          setBillItems([]);
                          setToastMessage(
                            '⏸ Current bill placed on HOLD. Click HOLD again to restore it!'
                          );
                        } else if (heldBillBuffer) {
                          setCustomerName(heldBillBuffer.customerName);
                          setCustomerPhone(heldBillBuffer.customerPhone);
                          setBillItems(heldBillBuffer.items);
                          setHeldBillBuffer(null);
                          setToastMessage('▶️ Held bill restored into the grid!');
                        } else {
                          setToastMessage('No active items to hold.');
                        }
                      },
                    },
                    {
                      id: 'PRES',
                      label: 'PRES',
                      active: showRxHub,
                      onClick: () => setShowRxHub(true),
                    },
                  ].map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      onClick={btn.onClick}
                      className={`px-2 py-0.5 border text-[11px] font-bold tracking-tight cursor-pointer ${
                        btn.active
                          ? 'bg-amber-300 text-slate-950 border-white'
                          : 'bg-[#5d7d78] hover:bg-[#6e918b] text-white border-[#8fa9a5]'
                      }`}
                    >
                      {btn.label}
                    </button>
                  ))}

                  {/* Red EARN Button */}
                  <button
                    type="button"
                    onClick={() => setShowEarnModal((prev) => !prev)}
                    className="px-2 py-0.5 bg-red-600 hover:bg-red-500 text-white border border-white text-[11px] font-bold cursor-pointer"
                  >
                    EARN
                  </button>

                  {/* Dark Maroon SAVE Button */}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handlePrimarySaveAction}
                    className="px-2.5 py-0.5 bg-[#4a1c1c] hover:bg-[#632626] text-white border border-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                    title="Save Entry & Update Inventory [F10]"
                  >
                    {saving ? '...' : 'SAVE'}
                  </button>
                </div>

                {/* Right Toolbar Icons (QR, Rupee/Razorpay, Phone, Excel, Printer, Exit) */}
                <div className="flex items-center gap-1.5 pr-1">
                  <button
                    type="button"
                    onClick={handleOpenUpiQrModal}
                    className="p-0.5 bg-white text-black rounded-xs hover:bg-amber-200 cursor-pointer"
                    title="Generate Dynamic UPI QR Code"
                  >
                    <QrCode size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenRazorpayGateway}
                    className="w-5 h-5 rounded-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-sans font-black text-[11px] flex items-center justify-center cursor-pointer"
                    title="Razorpay Online Payment"
                  >
                    ₹
                  </button>
                  <button
                    type="button"
                    onClick={() => patientPhoneRef.current?.focus()}
                    className="p-0.5 text-amber-200 hover:text-white cursor-pointer"
                    title="Focus Patient / Party Phone [F2]"
                  >
                    <Phone size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => purchaseExcelRef.current?.click()}
                    className="p-0.5 text-emerald-300 hover:text-white cursor-pointer"
                    title="Import Purchase / Sale Excel (.XLSX)"
                  >
                    <FileSpreadsheet size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="p-0.5 text-slate-200 hover:text-white cursor-pointer"
                    title="Print Current Screen"
                  >
                    <Printer size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/pharmacy/erp?view=desktop')}
                    className="p-0.5 text-amber-300 hover:text-red-300 cursor-pointer"
                    title="Exit to Marg Desktop [Esc]"
                  >
                    <LogOut size={13} />
                  </button>
                </div>
              </div>

              {/* 6. BOTTOM FOOTER STRIP: Bold Italic "SALE" + Large STRI | TAB. | Invoice Value + Last Bills */}
              <div className="bg-[#e8e8e8] px-3 pt-2 pb-1.5 flex flex-col justify-between min-h-[90px]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* Left Bold Italic Mode Title */}
                  <div className="text-2xl sm:text-3xl font-sans font-black italic tracking-wide text-black">
                    {currentMeta.bottomBanner}
                  </div>

                  {/* Center-Right STRI | TAB. | Invoice Value */}
                  <div className="flex items-center gap-8 sm:gap-12 pr-4 font-mono">
                    <div className="text-center">
                      <div className="text-sm sm:text-base text-black">STRI</div>
                      <div className="text-lg sm:text-xl font-black text-black">
                        {totalStri}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-sm sm:text-base text-black">
                        {currentMeta.isPurchaseSide ? 'FREE' : 'TAB.'}
                      </div>
                      <div className="text-lg sm:text-xl font-black text-black">
                        {currentMeta.isPurchaseSide ? totalFree : totalTab}
                      </div>
                    </div>
                    <div className="text-right min-w-[140px]">
                      <div className="text-sm sm:text-base text-black">
                        Invoice Value
                      </div>
                      <div className="text-lg sm:text-xl font-black text-black">
                        {grandTotal.toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom-most Last Bills line */}
                <div className="text-[11px] font-sans text-black pt-2 truncate">
                  Last Bills :{' '}
                  {recentInvoices.slice(0, 4).map((inv, idx) => (
                    <span key={idx} className="mr-3 font-mono">
                      #{inv.invoiceNo} (₹{Number(inv.grandTotal || 0).toFixed(2)})
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* =====================================================================
              RIGHT 27% PANEL: SALES HISTORY [ Click to Copy ] (MATCHING image_3ede2b19.png)
          ===================================================================== */}
          <div className="lg:col-span-3 flex flex-col bg-[#e0e0e0]">
            {/* Top Bar (#4b6b66) */}
            <div className="bg-[#4b6b66] text-white px-2 py-1 flex items-center gap-2 border-b border-black">
              <span className="px-1 bg-red-600 text-white text-[9px] font-bold border border-white leading-tight">
                x
              </span>
              <span className="text-xs font-mono tracking-wide">
                {currentMeta.historyTitle}
              </span>
            </div>

            {/* History List Body */}
            <div className="flex-1 p-2 overflow-y-auto space-y-2">
              {/* Quick Mode / Excel / Shortcut Helper Box */}
              <div className="bg-white/80 border border-slate-400 p-2 text-[11px] space-y-1.5">
                <div className="font-bold text-[#000080] flex items-center justify-between">
                  <span>QUICK ACTIONS &amp; EXCEL</span>
                  <span className="text-[10px] text-emerald-700">[Esc = Back]</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => purchaseExcelRef.current?.click()}
                    className="px-2 py-1 bg-emerald-700 hover:bg-emerald-800 text-white font-sans font-bold text-[10px] rounded-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Upload size={11} />
                    <span>Import Excel</span>
                  </button>
                  <button
                    type="button"
                    onClick={downloadSamplePurchaseBillExcel}
                    className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-900 font-sans font-bold text-[10px] rounded-xs flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Download size={11} />
                    <span>Sample .XLSX</span>
                  </button>
                </div>
              </div>

              {/* Recent Invoices (Bill-Wise Multi-Medicine Breakdown & Click to Copy into Active Grid!) */}
              {recentInvoices.length === 0 ? (
                <div className="text-center text-slate-500 py-8 text-[11px]">
                  No previous bills yet.
                </div>
              ) : (
                recentInvoices.map((inv, i) => (
                  <div
                    key={`${inv.invoiceNo}-${i}`}
                    onClick={() => handleCopyInvoiceFromHistory(inv)}
                    className="bg-white hover:bg-[#cce8ff] border border-slate-400 p-2 cursor-pointer transition-colors"
                    title="Click to copy all medicines from this bill into the active entry grid"
                  >
                    <div className="flex items-center justify-between font-bold text-[#000080]">
                      <div className="flex items-center gap-1.5">
                        <span>#{inv.invoiceNo}</span>
                        <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9px] font-sans rounded-xs">
                          {(inv.items || []).length} दवाइयां
                        </span>
                      </div>
                      <span className="text-black">
                        ₹{Number(inv.grandTotal || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-700 truncate">
                      {inv.customerName || 'Walk-in'} ·{' '}
                      {inv.createdAt ? inv.createdAt.slice(0, 10) : ''}
                    </div>
                    <div className="mt-1 space-y-0.5 border-t border-slate-200 pt-1 text-[10px] text-slate-800">
                      {(inv.items || []).map((it, mIdx) => (
                        <div key={mIdx} className="flex items-center justify-between gap-1 truncate">
                          <span className="truncate font-semibold">
                            {mIdx + 1}. {it.medicineName}
                          </span>
                          <span className="text-slate-600 shrink-0">
                            {it.qty} Str · ₹{Number(it.lineTotal || 0).toFixed(0)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          LIVE PHARMACY DATABASE REGISTER (PURCHASE VS SALE STOCK) &
          3-TIER AUTO-BACKUP + LOCAL PC BACKUP CENTER
      ========================================================================= */}
      <div className="no-print border-t-2 border-[#000080] bg-[#eef2f6] p-3 space-y-3 font-sans">
        {/* Top 3-Tier Backup & Local PC Control Strip */}
        <div className="bg-white border border-slate-300 p-2.5 flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="space-y-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold text-[#000080]">
                🛡️ 3-Tier Auto-Backup (Self + Domain/Host Server + Local PC)
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold rounded-xs">
                ● Live Sync Active ({batches.length} Batches · {medicines.length} Medicines)
              </span>
              {selfBackupMeta && (
                <span className="text-[11px] text-slate-600 font-medium">
                  Last Self-Backup: {selfBackupMeta.savedAt.slice(0, 19).replace('T', ' ')} ({selfBackupMeta.totalRecords} records)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600">
              जब भी आप <strong>Purchase (`PURC`/`PC`)</strong> या <strong>Sale (`SALE`)</strong> सेव करते हैं, डेटा अपने आप ऐप के <strong>Self-Backup</strong>, <strong>Domain/Host Daily Server (`.sql` &amp; `.json`)</strong> और <strong>Cloud Firestore</strong> में सुरक्षित हो जाता है।
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              disabled={runningBackupAction}
              onClick={handleManualLocalPcJsonBackup}
              className="px-2.5 py-1.5 bg-[#000080] hover:bg-blue-900 text-white text-[11px] font-bold rounded-xs inline-flex items-center gap-1 cursor-pointer"
              title="अपने कंप्यूटर (Local PC) पर पूरा डेटाबेस बैकअप (.JSON) डाउनलोड करें"
            >
              <Download size={12} />
              <span>Save Backup to Local PC (.JSON)</span>
            </button>

            <button
              type="button"
              disabled={runningBackupAction}
              onClick={handleManualLocalPcExcelExport}
              className="px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-xs inline-flex items-center gap-1 cursor-pointer"
              title="Purchase vs Sale Stock Register Excel (.XLSX) अपने कंप्यूटर पर डाउनलोड करें"
            >
              <FileSpreadsheet size={12} />
              <span>Export Stock &amp; Bills Excel (.XLSX)</span>
            </button>

            <a
              href="/api/sql/export.sql"
              download={`sandana_pharmacy_${format(now, 'yyyy_MM_dd')}.sql`}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold rounded-xs inline-flex items-center gap-1 cursor-pointer"
              title="Domain / Host SQL Database (.SQL) अपने कंप्यूटर पर डाउनलोड करें"
            >
              <Download size={12} />
              <span>Download Host SQL (.SQL)</span>
            </a>

            <button
              type="button"
              onClick={handleToggleAutoPcDownload}
              className={`px-2.5 py-1.5 border text-[11px] font-bold rounded-xs cursor-pointer ${
                autoPcBackup
                  ? 'bg-amber-400 text-slate-950 border-amber-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
              }`}
              title="चालू करने पर हर बिल सेव होते ही आपके Local PC पर ऑटोमैटिक बैकअप फाइल डाउनलोड होगी"
            >
              {autoPcBackup ? '✓ Auto Local PC Save: ON' : 'Auto Local PC Save: OFF'}
            </button>

            {selfBackupMeta && (
              <button
                type="button"
                disabled={runningBackupAction}
                onClick={handleRestoreSelfBackup}
                className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-400 text-[11px] font-bold rounded-xs cursor-pointer"
                title="यदि कभी डेटा डिलीट हो जाए, तो ऐप के Self-Backup से 1-क्लिक में वापस लाएं"
              >
                ♻️ Restore Self-Backup
              </button>
            )}
          </div>
        </div>

        {/* Live Pharmacy Database Register: Purchased vs Sold vs Remaining Stock */}
        <div className="bg-white border border-slate-300 shadow-2xs">
          <div className="bg-[#254132] text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs sm:text-sm font-bold">
                📦 लाइव फार्मेसी डेटाबेस रजिस्टर (Purchase Bill Entry vs Sale Deduction vs Available Stock)
              </span>
              <span className="ml-2 text-[11px] text-emerald-200">
                (किसी भी दवा के आगे + Sale या + Purchase दबाकर वर्तमान बिल में एक के नीचे एक जोड़ें)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={dbSearchQuery}
                onChange={(e) => setDbSearchQuery(e.target.value)}
                placeholder="🔍 दवा, बैच या सप्लायर खोजें..."
                className="px-2.5 py-1 bg-white text-slate-900 text-xs rounded-xs border border-slate-300 w-56 focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto">
            <table className="w-full text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-[#d9e4ec] text-[#000080] border-b border-slate-300 font-bold sticky top-0">
                  <th className="py-1.5 px-2 text-left border-r border-slate-300">
                    MEDICINE NAME (दवा का नाम)
                  </th>
                  <th className="py-1.5 px-2 text-left border-r border-slate-300">PACK</th>
                  <th className="py-1.5 px-2 text-left border-r border-slate-300">BATCH NO.</th>
                  <th className="py-1.5 px-2 text-center border-r border-slate-300">EXPIRY</th>
                  <th className="py-1.5 px-2 text-left border-r border-slate-300">
                    SUPPLIER &amp; BILL NO.
                  </th>
                  <th className="py-1.5 px-2 text-right border-r border-slate-300 bg-emerald-50">
                    PURCHASED (खरीद)
                  </th>
                  <th className="py-1.5 px-2 text-right border-r border-slate-300 bg-amber-50">
                    SOLD (बिक्री)
                  </th>
                  <th className="py-1.5 px-2 text-right border-r border-slate-300 bg-blue-50">
                    AVAIL. STOCK (बचा स्टॉक)
                  </th>
                  <th className="py-1.5 px-2 text-right border-r border-slate-300">P.RATE</th>
                  <th className="py-1.5 px-2 text-right border-r border-slate-300">M.R.P./SALE</th>
                  <th className="py-1.5 px-2 text-center">QUICK BILLING</th>
                </tr>
              </thead>
              <tbody>
                {batches
                  .filter((b) => {
                    const q = dbSearchQuery.trim().toLowerCase();
                    if (!q) return true;
                    return (
                      (b.medicineName || '').toLowerCase().includes(q) ||
                      (b.batchNo || '').toLowerCase().includes(q) ||
                      (b.supplierName || '').toLowerCase().includes(q)
                    );
                  })
                  .map((b) => {
                    const packStr = b.pack || '1*10';
                    const purchased = Number(
                      b.purchasedQty ?? Math.max(Number(b.stock || 0) + Number(b.soldQty || 0), Number(b.stock || 0))
                    );
                    const sold = Number(b.soldQty ?? 0);
                    const remStock = Number(b.stock || 0);
                    return (
                      <tr
                        key={b.id}
                        className="border-b border-slate-200 hover:bg-blue-50/50 text-slate-900"
                      >
                        <td className="py-1.5 px-2 border-r border-slate-200 font-bold text-black">
                          {b.medicineName}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200">{packStr}</td>
                        <td className="py-1.5 px-2 border-r border-slate-200 font-bold text-[#000080]">
                          {b.batchNo}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-center">
                          {b.expiryDate}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-[11px] truncate max-w-[180px]">
                          {b.supplierName || 'Standard Pharma'}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-right font-bold text-emerald-800 bg-emerald-50/40">
                          {formatStockUnits(purchased, packStr)}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-right font-bold text-amber-800 bg-amber-50/40">
                          {formatStockUnits(sold, packStr)}
                        </td>
                        <td
                          className={`py-1.5 px-2 border-r border-slate-200 text-right font-extrabold ${
                            remStock <= 0
                              ? 'text-red-600 bg-red-50'
                              : 'text-[#000080] bg-blue-50/40'
                          }`}
                        >
                          {formatStockUnits(remStock, packStr)}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-right">
                          ₹{Number(b.costPrice || 0).toFixed(2)}
                        </td>
                        <td className="py-1.5 px-2 border-r border-slate-200 text-right font-bold">
                          ₹{Number(b.sellPrice || b.mrp || 0).toFixed(2)}
                        </td>
                        <td className="py-1 px-2 text-center font-sans">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEntryMode('SALE');
                                handlePickPopupItem(
                                  {
                                    medId: b.medicineId,
                                    medName: b.medicineName,
                                    pack: packStr,
                                    batchId: b.id,
                                    batchNo: b.batchNo,
                                    expiryDate: b.expiryDate,
                                    stock: b.stock,
                                    purchasedQty: purchased,
                                    soldQty: sold,
                                    supplierName: b.supplierName,
                                    mrp: b.mrp,
                                    sellPrice: b.sellPrice,
                                    costPrice: b.costPrice,
                                    gstPercent: 12,
                                  },
                                  'SALE'
                                );
                              }}
                              className="px-2 py-0.5 bg-[#000080] hover:bg-blue-900 text-white text-[10px] font-bold rounded-xs cursor-pointer"
                            >
                              + Sale Row
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEntryMode('PURC');
                                handlePickPopupItem(
                                  {
                                    medId: b.medicineId,
                                    medName: b.medicineName,
                                    pack: packStr,
                                    batchId: b.id,
                                    batchNo: b.batchNo,
                                    expiryDate: b.expiryDate,
                                    stock: b.stock,
                                    purchasedQty: purchased,
                                    soldQty: sold,
                                    supplierName: b.supplierName,
                                    mrp: b.mrp,
                                    sellPrice: b.sellPrice,
                                    costPrice: b.costPrice,
                                    gstPercent: 12,
                                  },
                                  'PURC'
                                );
                              }}
                              className="px-2 py-0.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[10px] font-bold rounded-xs cursor-pointer"
                            >
                              + Purchase Row
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* EARN (Profit & Margin) Popup Modal */}
      {showEarnModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="bg-[#edeae0] border-2 border-[#000080] max-w-md w-full p-4 space-y-3 font-mono text-xs shadow-2xl">
            <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
              <span>BILL PROFIT &amp; MARGIN ANALYSIS [EARN]</span>
              <button
                type="button"
                onClick={() => setShowEarnModal(false)}
                className="cursor-pointer"
              >
                [Esc] ✕
              </button>
            </div>
            <div className="bg-white border p-3 space-y-2">
              <div className="flex justify-between">
                <span>Total Purchase Cost :</span>
                <span className="font-bold">₹{totalCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Net Sale Value :</span>
                <span className="font-bold">₹{(subtotal - totalDiscount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm font-bold text-emerald-800">
                <span>Estimated Net Profit :</span>
                <span>+₹{estimatedProfit.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GST Breakup Modal */}
      {showGstModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="bg-[#edeae0] border-2 border-[#000080] max-w-md w-full p-4 space-y-3 font-mono text-xs shadow-2xl">
            <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
              <span>GST TAX SUMMARY BREAKUP [GST]</span>
              <button
                type="button"
                onClick={() => setShowGstModal(false)}
                className="cursor-pointer"
              >
                [Esc] ✕
              </button>
            </div>
            <div className="bg-white border p-3 space-y-1.5">
              <div className="flex justify-between">
                <span>Taxable Value :</span>
                <span className="font-bold">₹{(subtotal - totalDiscount).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>CGST (6%) :</span>
                <span className="font-bold">₹{(totalGst / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>SGST (6%) :</span>
                <span className="font-bold">₹{(totalGst / 2).toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5 font-bold text-[#000080]">
                <span>Total GST :</span>
                <span>₹{totalGst.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* HELP Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-3">
          <div className="bg-[#edeae0] border-2 border-[#000080] max-w-lg w-full p-4 space-y-3 font-mono text-xs shadow-2xl">
            <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
              <span>MARG ERP 9+ KEYBOARD SHORTCUTS &amp; ENTRY HELP</span>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="cursor-pointer"
              >
                [Esc] ✕
              </button>
            </div>
            <div className="bg-white border p-3 space-y-1.5 text-[11px]">
              <p>
                <strong>• Left Arrow (←) on Product Row:</strong> Jump to Bill No. to edit Bill/Entry Number.
              </p>
              <p>
                <strong>• Enter / Type on Dark-Green Row:</strong> Search stock medicine or type manual item, then press Enter across PACK → BATCH → STRI → TAB. → M.R.P./S to add row.
              </p>
              <p>
                <strong>• Alt + N:</strong> Sale Entry &nbsp;|&nbsp; <strong>Alt + P:</strong> Purchase Entry &nbsp;|&nbsp; <strong>Alt + C:</strong> Purchase Challan
              </p>
              <p>
                <strong>• F1:</strong> Doctor Field &nbsp;|&nbsp; <strong>F2:</strong> Patient / Party Field &nbsp;|&nbsp; <strong>F10 / End:</strong> Save Bill
              </p>
              <p>
                <strong>• Esc Key:</strong> Close popup or go BACK to Marg Desktop Home.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Razorpay Online Payment Gateway Modal */}
      <RazorpayCheckoutModal
        isOpen={razorpayModalOpen}
        amount={savedInvoiceRecord ? savedInvoiceRecord.grandTotal : grandTotal}
        invoiceNo={
          savedInvoiceRecord ? savedInvoiceRecord.invoiceNo : customBillNo
        }
        customerName={
          savedInvoiceRecord
            ? savedInvoiceRecord.customerName
            : customerName || 'Walk-in Customer'
        }
        customerPhone={
          savedInvoiceRecord ? savedInvoiceRecord.customerPhone : customerPhone
        }
        merchantName={
          clinicSettings.razorpayMerchantName ||
          clinicSettings.medicalName ||
          'Sandana Clinic & Dudrucs Pharmacy'
        }
        razorpayKeyId={
          clinicSettings.razorpayKeyId || 'rzp_test_SandanaDudrucs99'
        }
        razorpayMode={clinicSettings.razorpayMode || 'live'}
        themeColor={clinicSettings.razorpayThemeColor || '#0284C7'}
        logoUrl={clinicSettings.logoUrl}
        allowedMethods={clinicSettings.razorpayMethods}
        saving={saving}
        onSuccess={(rzpPayload) => {
          executeSaveBill('paid', 'razorpay', rzpPayload);
        }}
        onClose={() => setRazorpayModalOpen(false)}
      />

      {/* UPI QR Popup Modal */}
      {qrData && (
        <QRModal
          isOpen={qrModalOpen}
          qrDataUrl={qrData.qrDataUrl}
          upiId={qrData.upiId}
          upiName={qrData.upiName}
          amount={savedInvoiceRecord ? savedInvoiceRecord.grandTotal : grandTotal}
          invoiceNo={
            savedInvoiceRecord ? savedInvoiceRecord.invoiceNo : customBillNo
          }
          saving={saving}
          onMarkPaidUpi={() => executeSaveBill('paid', 'upi')}
          onMarkPaidCash={() => executeSaveBill('paid', 'cash')}
          onClose={() => setQrModalOpen(false)}
        />
      )}

      {/* Doctor Prescriptions & Parchi Explorer Modal */}
      {showRxHub && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
          <div className="relative bg-slate-50 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col border border-slate-300 overflow-hidden font-sans">
            <div className="bg-[#000080] text-white px-5 py-3.5 flex items-center justify-between shrink-0 shadow-xs">
              <span className="font-extrabold text-sm sm:text-base flex items-center gap-2">
                <Camera size={18} className="text-amber-400" />
                <span>
                  Doctor Prescriptions &amp; Parchi (डॉक्टर की पर्चियां) — Direct Billing Mode
                </span>
              </span>
              <button
                type="button"
                onClick={() => setShowRxHub(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <PrescriptionExplorer
                role="pharmacy"
                onLoadIntoBill={handleLoadPrescriptionIntoBill}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
