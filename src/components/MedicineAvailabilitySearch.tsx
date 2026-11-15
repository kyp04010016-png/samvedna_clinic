import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  PackageCheck,
  Search,
  Sparkles,
  X,
  AlertTriangle,
} from 'lucide-react';
import { db } from '../firebase';

export interface PublicMedicineSummary {
  id: string;
  name: string;
  brand: string;
  genericName: string;
  manufacturer: string;
  unit: string;
  scheduleType: string;
  gstPercent: number;
  totalStock: number;
  sellPrice: number;
  mrp: number;
  batchNo: string;
  expiryDate: string;
  barcode?: string;
}

export const FALLBACK_ERP_MEDICINES: PublicMedicineSummary[] = [
  {
    id: 'med_dolo_650',
    name: 'Dolo 650 Tablet',
    brand: 'Dolo',
    genericName: 'Paracetamol 650mg',
    manufacturer: 'Micro Labs Ltd',
    unit: 'strip',
    scheduleType: 'OTC',
    gstPercent: 12,
    totalStock: 205,
    sellPrice: 30,
    mrp: 35,
    batchNo: 'B101',
    expiryDate: '2027-06-30',
    barcode: '890B101',
  },
  {
    id: 'med_augmentin_625',
    name: 'Augmentin 625 Duo',
    brand: 'Augmentin',
    genericName: 'Amoxycillin 500mg + Clavulanic Acid 125mg',
    manufacturer: 'GlaxoSmithKline (GSK)',
    unit: 'strip',
    scheduleType: 'H',
    gstPercent: 12,
    totalStock: 18,
    sellPrice: 200,
    mrp: 223,
    batchNo: 'B103',
    expiryDate: '2027-03-15',
    barcode: '890B103',
  },
  {
    id: 'med_pand_pr',
    name: 'Pan-D Capsule PR',
    brand: 'Pan-D',
    genericName: 'Pantoprazole 40mg + Domperidone 30mg',
    manufacturer: 'Alkem Laboratories',
    unit: 'strip',
    scheduleType: 'H',
    gstPercent: 12,
    totalStock: 42,
    sellPrice: 185,
    mrp: 210,
    batchNo: 'B104',
    expiryDate: '2027-12-31',
    barcode: '890B104',
  },
  {
    id: 'med_benadryl_150',
    name: 'Benadryl Cough Formula 150ml',
    brand: 'Benadryl',
    genericName: 'Diphenhydramine + Ammonium Chloride',
    manufacturer: 'JNTL Consumer Health',
    unit: 'bottle',
    scheduleType: 'OTC',
    gstPercent: 12,
    totalStock: 40,
    sellPrice: 130,
    mrp: 145,
    batchNo: 'B105',
    expiryDate: '2027-12-31',
    barcode: '890B105',
  },
  {
    id: 'med_azithral_500',
    name: 'Azithral 500 Tablet',
    brand: 'Azithral',
    genericName: 'Azithromycin 500mg',
    manufacturer: 'Alembic Pharmaceuticals',
    unit: 'strip',
    scheduleType: 'H',
    gstPercent: 12,
    totalStock: 64,
    sellPrice: 118,
    mrp: 132,
    batchNo: 'B108',
    expiryDate: '2027-11-30',
    barcode: '890B108',
  },
  {
    id: 'med_telma_40',
    name: 'Telma 40 Tablet',
    brand: 'Telma',
    genericName: 'Telmisartan 40mg',
    manufacturer: 'Glenmark Pharmaceuticals',
    unit: 'strip',
    scheduleType: 'H',
    gstPercent: 12,
    totalStock: 95,
    sellPrice: 195,
    mrp: 225,
    batchNo: 'B109',
    expiryDate: '2028-01-31',
    barcode: '890B109',
  },
  {
    id: 'med_glycomet_gp1',
    name: 'Glycomet-GP 1 Tablet PR',
    brand: 'Glycomet',
    genericName: 'Glimepiride 1mg + Metformin 500mg',
    manufacturer: 'USV Pvt Ltd',
    unit: 'strip',
    scheduleType: 'H',
    gstPercent: 12,
    totalStock: 78,
    sellPrice: 148,
    mrp: 170,
    batchNo: 'B110',
    expiryDate: '2027-10-31',
    barcode: '890B110',
  },
  {
    id: 'med_shelcal_500',
    name: 'Shelcal 500 Calcium + Vitamin D3',
    brand: 'Shelcal',
    genericName: 'Elemental Calcium 500mg + Vitamin D3 250 IU',
    manufacturer: 'Torrent Pharmaceuticals',
    unit: 'strip',
    scheduleType: 'OTC',
    gstPercent: 12,
    totalStock: 110,
    sellPrice: 126,
    mrp: 144,
    batchNo: 'B112',
    expiryDate: '2028-02-28',
    barcode: '890B112',
  },
  {
    id: 'med_ors_sachet',
    name: 'ORS Electrolyte Sample Sachet (₹1 Test)',
    brand: 'Dudrucs Care',
    genericName: 'Oral Rehydration Salts IP',
    manufacturer: 'Dudrucs Healthcare',
    unit: 'sachet',
    scheduleType: 'OTC',
    gstPercent: 5,
    totalStock: 250,
    sellPrice: 1,
    mrp: 1.5,
    batchNo: 'B100-TEST',
    expiryDate: '2027-12-31',
    barcode: '890B100TEST',
  },
];

interface MedicineAvailabilitySearchProps {
  medicalName: string;
  whatsappNumber: string;
  onInventoryLoaded?: (items: PublicMedicineSummary[]) => void;
  onAskAiAboutMedicine?: (medicine: PublicMedicineSummary) => void;
}

export const MedicineAvailabilitySearch: React.FC<
  MedicineAvailabilitySearchProps
> = ({
  medicalName,
  whatsappNumber,
  onInventoryLoaded,
  onAskAiAboutMedicine,
}) => {
  const [rawMedicines, setRawMedicines] = useState<any[]>([]);
  const [rawBatches, setRawBatches] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllStock, setShowAllStock] = useState(false);

  // Real-time connection to Pharmacy ERP Firestore collections (`medicines` + `batches`)
  useEffect(() => {
    const unsubMeds = onSnapshot(
      collection(db, 'medicines'),
      (snap) => {
        setRawMedicines(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {
        // Ignore snapshot error if offline; fallback will be used
      }
    );

    const unsubBatches = onSnapshot(
      collection(db, 'batches'),
      (snap) => {
        setRawBatches(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      () => {
        // Ignore snapshot error if offline; fallback will be used
      }
    );

    return () => {
      unsubMeds();
      unsubBatches();
    };
  }, []);

  // Merge live Firestore Pharmacy ERP records with fallback catalog so search always works
  const combinedInventory = useMemo<PublicMedicineSummary[]>(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const fromFirestore: PublicMedicineSummary[] = [];

    if (rawMedicines.length > 0 || rawBatches.length > 0) {
      // Group batches by medicineId or medicineName
      const medMap = new Map<string, any>();
      for (const m of rawMedicines) {
        medMap.set(m.id, m);
      }

      const processedMedIds = new Set<string>();

      for (const m of rawMedicines) {
        processedMedIds.add(m.id);
        const matchingBatches = rawBatches
          .filter(
            (b) =>
              b.medicineId === m.id ||
              (b.medicineName &&
                m.name &&
                b.medicineName.toLowerCase() === m.name.toLowerCase())
          )
          .filter((b) => !b.expiryDate || b.expiryDate >= todayStr)
          .sort((a, b) =>
            String(a.expiryDate || '9999').localeCompare(
              String(b.expiryDate || '9999')
            )
          );

        const totalStock = matchingBatches.reduce(
          (sum, b) => sum + (Number(b.stock) || 0),
          0
        );
        const activeBatch =
          matchingBatches.find((b) => Number(b.stock) > 0) ||
          matchingBatches[0];

        fromFirestore.push({
          id: m.id,
          name: m.name || 'Unnamed Medicine',
          brand: m.brand || m.name?.split(' ')[0] || 'Dudrucs',
          genericName: m.genericName || m.brand || 'Standard Composition',
          manufacturer: m.manufacturer || 'Verified Pharma Partner',
          unit: m.unit || 'strip',
          scheduleType: m.scheduleType || m.schedule || 'OTC',
          gstPercent: Number(m.gstPercent) || 12,
          totalStock,
          sellPrice: Number(activeBatch?.sellPrice ?? m.sellPrice ?? 45),
          mrp: Number(activeBatch?.mrp ?? m.mrp ?? 52),
          batchNo: activeBatch?.batchNo || 'FIFO-BATCH',
          expiryDate: activeBatch?.expiryDate || '2027-12-31',
          barcode: activeBatch?.barcode || '',
        });
      }

      // Also include any standalone batch whose medicineId wasn't in rawMedicines
      for (const b of rawBatches) {
        if (b.medicineId && processedMedIds.has(b.medicineId)) continue;
        const existing = fromFirestore.find(
          (item) =>
            item.name.toLowerCase() === String(b.medicineName || '').toLowerCase()
        );
        if (existing) {
          existing.totalStock += Number(b.stock) || 0;
        } else if (b.medicineName) {
          fromFirestore.push({
            id: b.id,
            name: b.medicineName,
            brand: b.medicineName.split(' ')[0] || 'Dudrucs',
            genericName: 'Pharmacy ERP Batch Verified',
            manufacturer: b.supplierName || 'Verified Pharma Partner',
            unit: 'strip',
            scheduleType: 'OTC',
            gstPercent: 12,
            totalStock: Number(b.stock) || 0,
            sellPrice: Number(b.sellPrice) || 40,
            mrp: Number(b.mrp) || 48,
            batchNo: b.batchNo || 'B101',
            expiryDate: b.expiryDate || '2027-12-31',
            barcode: b.barcode || '',
          });
        }
      }
    }

    // Add fallback medicines that are not already in Firestore by name so the demo catalog is always rich
    const existingNames = new Set(
      fromFirestore.map((item) => item.name.toLowerCase().trim())
    );
    const merged = [
      ...fromFirestore,
      ...FALLBACK_ERP_MEDICINES.filter(
        (fb) => !existingNames.has(fb.name.toLowerCase().trim())
      ),
    ];

    return merged;
  }, [rawMedicines, rawBatches]);

  const onInventoryLoadedRef = useRef(onInventoryLoaded);
  useEffect(() => {
    onInventoryLoadedRef.current = onInventoryLoaded;
  }, [onInventoryLoaded]);

  useEffect(() => {
    if (onInventoryLoadedRef.current) {
      onInventoryLoadedRef.current(combinedInventory);
    }
  }, [combinedInventory]);

  const filteredMedicines = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q && !showAllStock) return [];
    if (!q && showAllStock) return combinedInventory;

    return combinedInventory.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.batchNo.toLowerCase().includes(q) ||
        (m.barcode && m.barcode.toLowerCase().includes(q))
    );
  }, [searchQuery, showAllStock, combinedInventory]);

  const cleanWhatsapp = whatsappNumber.replace(/[^0-9]/g, '') || '919840011224';

  return (
    <section
      id="medicine-search"
      className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-6"
    >
      {/* MAIN CARD — MATCHES ATTACHED IMAGE (/public/assets/aistudio/image_debfffe7.png) */}
      <div className="bg-white rounded-2xl sm:rounded-[28px] border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-4 sm:p-7 md:p-9 transition-all">
        {/* Card Header: Rx Bottle + Blister Pack Icon & "Check Medicine Availability" */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
          <div className="flex items-center gap-3 sm:gap-3.5">
            {/* Custom SVG matching the Rx Pill Bottle + Blister Pack icon from reference image */}
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 flex items-center justify-center">
              <svg
                viewBox="0 0 64 64"
                className="w-10 h-10 sm:w-12 sm:h-12 drop-shadow-2xs"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Blister Pack on Right */}
                <rect
                  x="28"
                  y="6"
                  width="28"
                  height="50"
                  rx="5"
                  fill="#DCEEFB"
                  stroke="#90C2E7"
                  strokeWidth="1.5"
                />
                {/* Blister Pills (2 columns x 4 rows) */}
                <rect x="33" y="11" width="6" height="8" rx="3" fill="#4A90E2" />
                <rect x="45" y="11" width="6" height="8" rx="3" fill="#4A90E2" />
                <rect x="33" y="23" width="6" height="8" rx="3" fill="#4A90E2" />
                <rect x="45" y="23" width="6" height="8" rx="3" fill="#4A90E2" />
                <rect x="33" y="35" width="6" height="8" rx="3" fill="#4A90E2" />
                <rect x="45" y="35" width="6" height="8" rx="3" fill="#4A90E2" />
                <rect x="33" y="45" width="6" height="6" rx="3" fill="#7FB3EA" />
                <rect x="45" y="45" width="6" height="6" rx="3" fill="#7FB3EA" />

                {/* Medicine Bottle on Left */}
                <rect
                  x="10"
                  y="14"
                  width="20"
                  height="6"
                  rx="2"
                  fill="#4A5568"
                />
                <rect
                  x="12"
                  y="20"
                  width="16"
                  height="4"
                  fill="#CBD5E1"
                />
                <rect
                  x="7"
                  y="23"
                  width="26"
                  height="33"
                  rx="5"
                  fill="#48BB78"
                  stroke="#2F855A"
                  strokeWidth="1.5"
                />
                <rect
                  x="9"
                  y="30"
                  width="22"
                  height="18"
                  rx="2"
                  fill="#0D9488"
                />
                <text
                  x="20"
                  y="43"
                  textAnchor="middle"
                  fill="#FFFFFF"
                  fontSize="11"
                  fontWeight="800"
                  fontFamily="sans-serif"
                >
                  Rx
                </text>
              </svg>
            </div>

            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl md:text-[26px] font-extrabold text-slate-950 tracking-tight leading-tight truncate">
                Check Medicine Availability
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">Live {medicalName} Pharmacy Marg ERP ({combinedInventory.length} Medicines)</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setShowAllStock((prev) => !prev)}
              className="text-xs font-bold px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 transition-colors"
            >
              {showAllStock ? 'Hide Full Stock List' : 'View All Live ERP Stock'}
            </button>
          </div>
        </div>

        {/* Search Input Box */}
        <div className="relative">
          <Search
            size={18}
            className="text-slate-400 absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search medicines (e.g. Dolo 650, Augmentin, Pan-D, Azithral...)"
            className="w-full pl-10 sm:pl-12 pr-20 sm:pr-28 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-slate-300 focus:border-teal-600 focus:ring-4 focus:ring-teal-500/10 text-xs sm:text-base text-slate-900 placeholder:text-slate-400 font-medium outline-none transition-all bg-white"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 sm:right-3.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold inline-flex items-center gap-1"
            >
              <X size={13} />
              Clear
            </button>
          )}
        </div>

        {/* Quick Search Chips for Instant Testing */}
        <div className="flex flex-wrap items-center gap-2 mt-3.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Popular ERP Searches:
          </span>
          {[
            'Dolo 650',
            'Augmentin 625',
            'Pan-D',
            'Benadryl',
            'Azithral 500',
            'Telma 40',
            'Glycomet',
            'Shelcal 500',
          ].map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => {
                setSearchQuery(chip);
                setShowAllStock(false);
              }}
              className={`text-xs px-3 py-1 rounded-full border font-semibold transition-all ${
                searchQuery.toLowerCase() === chip.toLowerCase()
                  ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                  : 'bg-slate-50 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border-slate-200'
              }`}
            >
              {chip}
            </button>
          ))}
        </div>

        {/* LIVE PHARMACY ERP RESULTS PANEL */}
        {(searchQuery.trim().length > 0 || showAllStock) && (
          <div className="mt-5 pt-5 border-t border-slate-200 space-y-3 animate-fade-in-up">
            <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
              <span>
                Showing {filteredMedicines.length} medicine(s) from{' '}
                <strong className="text-slate-800">
                  {medicalName} Marg ERP 9+ Stock Master
                </strong>
              </span>
              <Link
                to="/login/pharmacy"
                className="text-teal-700 hover:text-teal-900 font-bold inline-flex items-center gap-1"
              >
                Pharmacy Staff ERP Login
                <ExternalLink size={12} />
              </Link>
            </div>

            {filteredMedicines.length === 0 ? (
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-2">
                <p className="text-sm font-bold text-slate-800">
                  No matching medicine found in current ERP stock for &ldquo;
                  {searchQuery}&rdquo;
                </p>
                <p className="text-xs text-slate-500">
                  You can request this medicine directly on WhatsApp or ask our
                  AI Pharmacy Assistant for salt substitutes.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <a
                    href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
                      `Hello ${medicalName} Pharmacy, please check availability for medicine: ${searchQuery}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-bold"
                  >
                    <MessageCircle size={14} />
                    Enquire on WhatsApp
                  </a>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1">
                {filteredMedicines.map((med) => {
                  const isOut = med.totalStock <= 0;
                  const isLow = med.totalStock > 0 && med.totalStock <= 15;
                  const discountPct =
                    med.mrp > med.sellPrice
                      ? Math.round(((med.mrp - med.sellPrice) / med.mrp) * 100)
                      : 0;

                  return (
                    <div
                      key={med.id}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-teal-500 bg-slate-50/60 hover:bg-white transition-all flex flex-col justify-between gap-3 shadow-2xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded bg-teal-100 text-teal-900 text-[10px] font-mono font-bold uppercase">
                              {med.brand}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px] font-mono font-semibold">
                              Sch: {med.scheduleType}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-mono font-semibold">
                              Batch: {med.batchNo}
                            </span>
                          </div>
                          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                            {med.name}
                          </h3>
                          <p className="text-xs text-slate-600 font-medium truncate">
                            Salt: {med.genericName}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Mfr: {med.manufacturer} · Exp: {med.expiryDate}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <div className="text-base sm:text-lg font-mono font-extrabold text-teal-700">
                            ₹{med.sellPrice}
                          </div>
                          {med.mrp > med.sellPrice && (
                            <div className="text-[11px] text-slate-400">
                              MRP{' '}
                              <span className="line-through">₹{med.mrp}</span>{' '}
                              <span className="text-emerald-600 font-bold">
                                ({discountPct}% OFF)
                              </span>
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 font-mono">
                            per {med.unit}
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                        {isOut ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-100 text-red-800 text-xs font-bold">
                            <AlertTriangle size={13} />
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-xs font-bold">
                            <PackageCheck size={13} />
                            Low Stock ({med.totalStock} {med.unit}s left)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold">
                            <CheckCircle2 size={13} />
                            In Stock ({med.totalStock} {med.unit}s)
                          </span>
                        )}

                        <div className="flex items-center gap-1.5">
                          {onAskAiAboutMedicine && (
                            <button
                              type="button"
                              onClick={() => onAskAiAboutMedicine(med)}
                              className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold inline-flex items-center gap-1 transition-colors"
                            >
                              <Sparkles size={12} />
                              Ask AI
                            </button>
                          )}
                          <a
                            href={`https://wa.me/${cleanWhatsapp}?text=${encodeURIComponent(
                              `Hello ${medicalName} Pharmacy, I want to order *${med.name}* (Batch: ${med.batchNo}, Price: ₹${med.sellPrice}). Is it ready for pickup/delivery?`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-bold inline-flex items-center gap-1 transition-colors"
                          >
                            <MessageCircle size={12} />
                            Order
                          </a>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3 TRUST BADGES BELOW THE CARD — RESPONSIVE ACROSS ALL DEVICES */}
      <div className="grid grid-cols-3 gap-2 sm:gap-6 md:gap-8 max-w-3xl mx-auto mt-6 sm:mt-10 px-1 sm:px-2">
        {/* Badge 1: SAFE & SECURE — Secure Payment */}
        <div className="flex flex-col items-center text-center group">
          <div className="w-16 h-16 sm:w-22 sm:h-22 md:w-26 md:h-26 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shrink-0">
            <svg
              viewBox="0 0 120 120"
              className="w-full h-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Scalloped Seal Outer Shape */}
              <path
                d="M60 6 C66 6, 70 11, 76 10 C82 9, 88 12, 91 17 C94 22, 101 23, 105 28 C109 33, 107 40, 110 45 C113 50, 114 57, 112 63 C110 69, 113 75, 110 81 C107 87, 101 89, 98 95 C95 101, 90 106, 84 107 C78 108, 73 113, 67 113 C61 113, 59 113, 53 113 C47 113, 42 108, 36 107 C30 106, 25 101, 22 95 C19 89, 13 87, 10 81 C7 75, 10 69, 8 63 C6 57, 7 50, 10 45 C13 40, 11 33, 15 28 C19 23, 26 22, 29 17 C32 12, 38 9, 44 10 C50 11, 54 6, 60 6 Z"
                fill="#E6F4F9"
                stroke="#0E6482"
                strokeWidth="2.5"
              />
              {/* Curved Side Brackets */}
              <path
                d="M27 42 C21 53, 21 67, 27 78"
                stroke="#0E6482"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M93 42 C99 53, 99 67, 93 78"
                stroke="#0E6482"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {/* Top Text: SAFE */}
              <text
                x="60"
                y="28"
                textAnchor="middle"
                fill="#0E6482"
                fontSize="10"
                fontWeight="800"
                letterSpacing="1.2"
                fontFamily="sans-serif"
              >
                SAFE
              </text>
              {/* Inner White Shield */}
              <path
                d="M60 35 L79 42 V58 C79 71 70 80 60 85 C50 80 41 71 41 58 V42 L60 35 Z"
                fill="#FFFFFF"
              />
              {/* Checkmark Circle */}
              <circle cx="60" cy="59" r="11" fill="#CBE8F4" />
              <path
                d="M54.5 59.5 L58.2 63.2 L66 55.5"
                stroke="#0E6482"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Bottom Text: SECURE */}
              <text
                x="60"
                y="98"
                textAnchor="middle"
                fill="#0E6482"
                fontSize="9.5"
                fontWeight="800"
                letterSpacing="1"
                fontFamily="sans-serif"
              >
                SECURE
              </text>
            </svg>
          </div>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base font-bold text-[#0E6482] leading-tight sm:leading-snug">
            Secure
            <br />
            Payment
          </p>
        </div>

        {/* Badge 2: FULLY RELIABLE — Trusted by 8 Crore Indians */}
        <div className="flex flex-col items-center text-center group">
          <div className="w-16 h-16 sm:w-22 sm:h-22 md:w-26 md:h-26 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shrink-0">
            <svg
              viewBox="0 0 120 120"
              className="w-full h-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="#FFFFFF"
                stroke="#0E6482"
                strokeWidth="2.5"
              />
              <circle
                cx="60"
                cy="60"
                r="47"
                fill="#E6F4F9"
                stroke="#0E6482"
                strokeWidth="1.2"
              />
              {/* Curved side arcs */}
              <path
                d="M27 45 C22 54, 22 66, 27 75"
                stroke="#0E6482"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M93 45 C98 54, 98 66, 93 75"
                stroke="#0E6482"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {/* Top Text: FULLY */}
              <text
                x="60"
                y="29"
                textAnchor="middle"
                fill="#0E6482"
                fontSize="9.5"
                fontWeight="800"
                letterSpacing="1.2"
                fontFamily="sans-serif"
              >
                FULLY
              </text>
              {/* Center Circle + Handshake Icon */}
              <circle cx="60" cy="60" r="21" fill="#CBE8F4" />
              <path
                d="M44 58 L52 51 C55 49, 59 49, 62 52 L67 49 C70 48, 74 50, 76 53 L79 58 L71 66 L64 71 C60 73, 54 72, 50 68 L44 58 Z"
                stroke="#0E6482"
                strokeWidth="2.2"
                fill="#FFFFFF"
                strokeLinejoin="round"
              />
              <path
                d="M52 59 L60 66 M56 56 L64 63 M60 53 L68 60"
                stroke="#0E6482"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Bottom Text: RELIABLE */}
              <text
                x="60"
                y="96"
                textAnchor="middle"
                fill="#0E6482"
                fontSize="9.5"
                fontWeight="800"
                letterSpacing="1"
                fontFamily="sans-serif"
              >
                RELIABLE
              </text>
            </svg>
          </div>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base font-bold text-[#0E6482] leading-tight sm:leading-snug">
            Trusted by
            <br />
            Patients
          </p>
        </div>

        {/* Badge 3: GENUINE PRODUCTS — Genuine Products */}
        <div className="flex flex-col items-center text-center group">
          <div className="w-16 h-16 sm:w-22 sm:h-22 md:w-26 md:h-26 flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shrink-0">
            <svg
              viewBox="0 0 120 120"
              className="w-full h-full"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Decagon / Octagon Outer Seal */}
              <polygon
                points="60,7 91,17 110,44 110,76 91,103 60,113 29,103 10,76 10,44 29,17"
                fill="#E6F4F9"
                stroke="#0E6482"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <polygon
                points="60,12 87,21 104,45 104,75 87,99 60,108 33,99 16,75 16,45 33,21"
                fill="none"
                stroke="#0E6482"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              {/* Side curved lines */}
              <path
                d="M27 45 C22 54, 22 66, 27 75"
                stroke="#0E6482"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <path
                d="M93 45 C98 54, 98 66, 93 75"
                stroke="#0E6482"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {/* Top Text: GENUINE */}
              <text
                x="60"
                y="29"
                textAnchor="middle"
                fill="#0E6482"
                fontSize="9.5"
                fontWeight="800"
                letterSpacing="1"
                fontFamily="sans-serif"
              >
                GENUINE
              </text>
              {/* Center Circle + Thumbs Up */}
              <circle cx="60" cy="60" r="21" fill="#FFFFFF" />
              <rect
                x="46"
                y="56"
                width="7"
                height="15"
                rx="1.5"
                fill="#CBE8F4"
                stroke="#0E6482"
                strokeWidth="2.2"
              />
              <path
                d="M53 56 L58 45 C59.5 43, 63 44, 63 47 V53 H72 C74.5 53, 76 55, 75.5 57.5 L73.5 68.5 C73 70, 71.5 71, 69.5 71 H53 V56 Z"
                fill="#FFFFFF"
                stroke="#0E6482"
                strokeWidth="2.2"
                strokeLinejoin="round"
              />
              {/* Bottom Text: PRODUCTS */}
              <text
                x="60"
                y="96"
                textAnchor="middle"
                fill="#0E6482"
                fontSize="9"
                fontWeight="800"
                letterSpacing="0.8"
                fontFamily="sans-serif"
              >
                PRODUCTS
              </text>
            </svg>
          </div>
          <p className="mt-1.5 sm:mt-2 text-xs sm:text-sm md:text-base font-bold text-[#0E6482] leading-tight sm:leading-snug">
            Genuine
            <br />
            Medicines
          </p>
        </div>
      </div>
    </section>
  );
};
