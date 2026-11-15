import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';
import {
  IndianRupee,
  TrendingUp,
  AlertTriangle,
  Clock,
  Settings,
  Users,
  FileBarChart,
  ShoppingBag,
  Stethoscope,
  Activity,
  Sparkles,
  Boxes,
  CalendarCheck,
  ImagePlus,
  DatabaseBackup,
  ShieldCheck,
  HardDriveDownload,
  CreditCard,
  BookOpen,
} from 'lucide-react';
import { db } from '../../firebase';
import { seedInitialClinicData } from '../../utils/seedData';
import { getExpiryStatus } from '../../utils/invoiceNo';
import { StaffActivityRecord } from './ActivityLog';
import {
  createCloudBackupSnapshot,
  downloadSystemBackupJson,
} from '../../utils/backupRestore';

export const AdminDashboard: React.FC = () => {
  const [todaySales, setTodaySales] = useState(0);
  const [todayProfit, setTodayProfit] = useState(0);
  const [todayRazorpaySales, setTodayRazorpaySales] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [activeStaffCount, setActiveStaffCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [expiringSoonCount, setExpiringSoonCount] = useState(0);
  const [totalBackupSnapshots, setTotalBackupSnapshots] = useState(0);
  const [razorpayEnabled, setRazorpayEnabled] = useState(true);
  const [razorpayKeyId, setRazorpayKeyId] = useState(
    'rzp_test_SandanaDudrucs99'
  );
  const [razorpayMode, setRazorpayMode] = useState<'test' | 'live'>('live');
  const [togglingRzp, setTogglingRzp] = useState(false);
  const [recentActivity, setRecentActivity] = useState<StaffActivityRecord[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadStats = async () => {
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];

      const [
        invSnap,
        batchSnap,
        actSnap,
        apptSnap,
        bkpSnap,
        usersSnap,
        clinicSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'invoices')),
        getDocs(collection(db, 'batches')),
        getDocs(collection(db, 'staff_activity')),
        getDocs(collection(db, 'appointments')),
        getDocs(collection(db, 'backups')),
        getDocs(collection(db, 'users')),
        getDoc(doc(db, 'settings', 'clinic')),
      ]);

      if (clinicSnap.exists()) {
        const cData = clinicSnap.data() as any;
        setRazorpayEnabled(cData.razorpayEnabled !== false);
        setRazorpayKeyId(cData.razorpayKeyId || 'rzp_test_SandanaDudrucs99');
        setRazorpayMode(cData.razorpayMode === 'test' ? 'test' : 'live');
      }

      let salesSum = 0;
      let profitSum = 0;
      let rzpSum = 0;
      invSnap.docs.forEach((d) => {
        const data = d.data();
        const createdDate = String(data.createdAt || '').split('T')[0];
        const billAmt = Number(data.grandTotal ?? data.total ?? 0);
        if (createdDate === todayStr) {
          salesSum += billAmt;
          profitSum += Number(data.totalProfit ?? data.grossProfit ?? 0);
          if (data.paymentMode === 'razorpay' && data.paymentStatus === 'paid') {
            rzpSum += billAmt;
          }
        }
      });

      const todayApptCount = apptSnap.docs.filter(
        (a) => a.data().date === todayStr
      ).length;

      const staffActive = usersSnap.docs.filter(
        (u) => u.data().isActive !== false
      ).length;

      let lowCount = 0;
      let expCount = 0;

      batchSnap.docs.forEach((b) => {
        const data = b.data();
        const stockVal = Number(data.stock || 0);
        if (stockVal < 10) {
          lowCount += 1;
        }

        const expInfo = getExpiryStatus(String(data.expiryDate || ''));
        if (
          expInfo.status === 'expiring_soon' ||
          expInfo.status === 'expired'
        ) {
          expCount += 1;
        }
      });

      const actList: StaffActivityRecord[] = actSnap.docs
        .map((d) => ({
          id: d.id,
          ...(d.data() as Omit<StaffActivityRecord, 'id'>),
        }))
        .sort((a, b) =>
          String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
        )
        .slice(0, 6);

      setTodaySales(salesSum);
      setTodayProfit(profitSum);
      setTodayRazorpaySales(rzpSum);
      setTodayAppointments(todayApptCount);
      setActiveStaffCount(staffActive);
      setLowStockCount(lowCount);
      setExpiringSoonCount(expCount);
      setTotalBackupSnapshots(bkpSnap.size);
      setRecentActivity(actList);
    } catch (err) {
      console.error('Error loading admin stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const handleToggleRazorpayGateway = async () => {
    setTogglingRzp(true);
    setToastMsg(null);
    const nextState = !razorpayEnabled;
    try {
      await setDoc(
        doc(db, 'settings', 'clinic'),
        { razorpayEnabled: nextState },
        { merge: true }
      );
      setRazorpayEnabled(nextState);
      setToastMsg(
        nextState
          ? 'Razorpay Online Payment Gateway ENABLED in Pharmacy Billing!'
          : 'Razorpay Online Payment Gateway DISABLED in Pharmacy Billing.'
      );
    } catch (err: any) {
      setToastMsg(err?.message || 'Could not update Razorpay Gateway status.');
    } finally {
      setTogglingRzp(false);
    }
  };

  const handleSeedSampleData = async () => {
    setSeeding(true);
    setToastMsg(null);
    try {
      await seedInitialClinicData();
      await loadStats();
      setToastMsg(
        'Sample Marg Medicine Master, FIFO batches, ₹1 test sachet, and clinic settings loaded.'
      );
    } catch (err: any) {
      setToastMsg(err?.message || 'Could not seed sample data.');
    } finally {
      setSeeding(false);
    }
  };

  const handleQuickFullBackup = async () => {
    setBackingUp(true);
    setToastMsg(null);
    try {
      const snap = await createCloudBackupSnapshot(
        `Admin Quick Snapshot (${new Date().toLocaleString()})`,
        'Super Admin'
      );
      await downloadSystemBackupJson('Super Admin');
      await loadStats();
      setToastMsg(
        `Full Clinic & Pharmacy Cloud Snapshot saved AND JSON downloaded! Checksum: ${snap.checksum}`
      );
    } catch (err: any) {
      setToastMsg(err?.message || 'Backup failed.');
    } finally {
      setBackingUp(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Marg ERP Title Header */}
      <div className="bg-[#000080] text-white px-4 py-2.5 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-sm sm:text-base font-bold uppercase tracking-wide">
            MARG ERP 9+ — SANDANA CLINIC + DUDRUCS ADMIN CONTROL &amp; SECURITY
            CENTER
          </h1>
          <p className="text-[11px] text-blue-200">
            Ultimate Control: Sales, Razorpay Online Gateway, Full Backup &amp;
            Anytime Restore, Doctors, Staff &amp; UPI QR
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={backingUp}
            onClick={handleQuickFullBackup}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded transition-colors whitespace-nowrap"
          >
            <HardDriveDownload size={13} />
            {backingUp
              ? 'Creating Full Backup...'
              : '1-Click Full Backup (Cloud + JSON)'}
          </button>
          <Link
            to="/admin/backup"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-700 hover:bg-blue-600 border border-blue-400 text-white text-xs font-bold rounded transition-colors whitespace-nowrap"
          >
            <DatabaseBackup size={13} />
            Restore Anytime ({totalBackupSnapshots})
          </Link>
          <button
            type="button"
            disabled={seeding}
            onClick={handleSeedSampleData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold rounded transition-colors whitespace-nowrap"
          >
            <Sparkles size={13} />
            {seeding ? 'Loading Sample Data...' : 'Load Sample Data'}
          </button>
          <Link
            to="/admin/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded transition-colors whitespace-nowrap"
          >
            <Settings size={13} />
            Razorpay &amp; UPI Settings
          </Link>
        </div>
      </div>

      {/* ADMIN RAZORPAY GATEWAY LIVE CONTROL BAR */}
      <div className="bg-white border-2 border-sky-500/40 rounded-xl p-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
            <CreditCard size={20} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs sm:text-sm font-extrabold text-slate-900">
                Razorpay Online Payment Gateway (Pharmacy POS)
              </span>
              <span
                className={`px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full ${
                  razorpayEnabled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-red-100 text-red-700 border border-red-300'
                }`}
              >
                {razorpayEnabled
                  ? `ACTIVE (${razorpayMode.toUpperCase()})`
                  : 'DISABLED BY ADMIN'}
              </span>
              <span className="text-[11px] font-mono text-slate-500">
                Key: {razorpayKeyId}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              Today&apos;s Razorpay Online Pharmacy Collection:{' '}
              <strong className="font-mono text-sky-700">
                ₹{todayRazorpaySales.toFixed(2)}
              </strong>{' '}
              &middot; Supports UPI, Cards, NetBanking &amp; Wallets
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={togglingRzp}
            onClick={handleToggleRazorpayGateway}
            className={`px-3.5 py-2 rounded-lg text-xs font-extrabold transition-colors cursor-pointer ${
              razorpayEnabled
                ? 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {togglingRzp
              ? 'Updating...'
              : razorpayEnabled
              ? 'Disable Gateway in Pharmacy'
              : 'Enable Gateway in Pharmacy'}
          </button>
          <Link
            to="/admin/settings"
            className="px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Settings size={13} />
            <span>Configure Razorpay Keys</span>
          </Link>
        </div>
      </div>

      {toastMsg && (
        <div className="p-3 bg-green-50 border border-green-300 rounded text-xs font-bold text-green-800">
          {toastMsg}
        </div>
      )}

      {/* Complete Training Manual Book Banner Card */}
      <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-emerald-950 border-2 border-emerald-500/40 rounded-xl p-4 sm:p-5 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-md">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shrink-0 shadow-lg">
            <BookOpen size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                📖 अस्पताल संचालन पुस्तक एवं संपूर्ण प्रशिक्षण गाइड (PDF Manual Book)
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-black uppercase bg-emerald-500/30 text-emerald-300 rounded border border-emerald-400/30">
                A4 PDF Ready
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              फार्मेसी (सारे विकल्प), एडमिन, रिसेप्शन एवं डॉक्टर ओपीडी पैनल का सचित्र स्टेप-बाय-स्टेप उपयोग समझें। सीधे A4 साइज में PDF डाउनलोड व प्रिंट करें।
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full sm:w-auto">
          <Link
            to="/admin/manual"
            className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-extrabold text-xs sm:text-sm rounded-lg shadow-md transition-all inline-flex items-center justify-center gap-2"
          >
            <BookOpen size={16} />
            <span>पूरी पुस्तक खोलें व PDF प्रिंट करें</span>
          </Link>
        </div>
      </div>

      {/* 7 Marg KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        <div className="bg-white border border-slate-300 rounded p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase">
              Today&apos;s Sales
            </span>
            <IndianRupee size={16} className="text-[#000080]" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {loading ? '...' : `₹${todaySales.toFixed(2)}`}
          </p>
          <p className="text-[11px] text-slate-500">All Dudrucs bills today</p>
        </div>

        <div className="bg-white border border-slate-300 rounded p-4 space-y-1">
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase">
              Today&apos;s Profit
            </span>
            <TrendingUp size={16} className="text-green-700" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-green-700">
            {loading ? '...' : `₹${todayProfit.toFixed(2)}`}
          </p>
          <p className="text-[11px] text-slate-500">Net margin earned today</p>
        </div>

        <Link
          to="/admin/appointments"
          className="bg-white border border-slate-300 hover:border-green-500 rounded p-4 space-y-1 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase">Appointments</span>
            <CalendarCheck size={16} className="text-green-600" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
            {loading ? '...' : todayAppointments}
          </p>
          <p className="text-[11px] text-slate-500">Booked for today</p>
        </Link>

        <Link
          to="/admin/staff"
          className="bg-white border border-slate-300 hover:border-[#000080] rounded p-4 space-y-1 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase">Active Staff</span>
            <Users size={16} className="text-[#000080]" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#000080]">
            {loading ? '...' : activeStaffCount}
          </p>
          <p className="text-[11px] text-slate-500">Verified staff accounts</p>
        </Link>

        <Link
          to="/pharmacy/report?filter=low"
          className="bg-white border border-slate-300 hover:border-red-500 rounded p-4 space-y-1 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase">Low Stock</span>
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-red-600">
            {loading ? '...' : lowStockCount}
          </p>
          <p className="text-[11px] text-slate-500">Batches with stock &lt; 10</p>
        </Link>

        <Link
          to="/pharmacy/report?filter=expiry"
          className="bg-white border border-slate-300 hover:border-amber-500 rounded p-4 space-y-1 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase">Expiring Soon</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-700">
            {loading ? '...' : expiringSoonCount}
          </p>
          <p className="text-[11px] text-slate-500">Within 90 days / expired</p>
        </Link>

        <Link
          to="/admin/backup"
          className="bg-white border border-slate-300 hover:border-[#000080] rounded p-4 space-y-1 transition-colors"
        >
          <div className="flex items-center justify-between text-slate-600">
            <span className="text-xs font-bold uppercase">Cloud Backups</span>
            <ShieldCheck size={16} className="text-green-700" />
          </div>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#000080]">
            {loading ? '...' : totalBackupSnapshots}
          </p>
          <p className="text-[11px] text-green-700 font-semibold">
            Anytime Restore Ready
          </p>
        </Link>
      </div>

      {/* Center Modules + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white border border-slate-300 rounded p-4 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080] border-b border-slate-200 pb-2">
            Admin, Security, Backup &amp; Marg ERP Control Modules
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Link
              to="/admin/manual"
              className="p-3 border-2 border-emerald-600 bg-emerald-50/70 hover:bg-emerald-50 rounded flex items-start gap-2.5 transition-colors sm:col-span-2 shadow-xs"
            >
              <BookOpen
                size={20}
                className="text-emerald-700 shrink-0 mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-emerald-950">
                    📖 अस्पताल संचालन निर्देशिका व प्रशिक्षण पुस्तक (PDF Manual &amp; Book)
                  </p>
                  <span className="text-[10px] font-bold uppercase bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded">
                    Open Book
                  </span>
                </div>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  फार्मेसी (सारे विकल्प), एडमिन, रिसेप्शन एवं डॉक्टर ओपीडी पैनल का सचित्र स्टेप-बाय-स्टेप उपयोग समझें। A4 PDF प्रिंट करें।
                </p>
              </div>
            </Link>

            <Link
              to="/admin/appointments"
              className="p-3 border-2 border-green-600 bg-green-50/50 hover:bg-green-50 rounded flex items-start gap-2.5 transition-colors"
            >
              <CalendarCheck
                size={18}
                className="text-green-700 shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Appointments Control (Confirm / Reassign Doctor)
                </p>
                <p className="text-[11px] text-slate-600">
                  View all appointments, Confirm/Complete/Cancel &amp; change
                  assigned doctor
                </p>
              </div>
            </Link>

            <Link
              to="/admin/staff-reports"
              className="p-3 border-2 border-[#000080] bg-blue-50/50 hover:bg-blue-50 rounded flex items-start gap-2.5 transition-colors"
            >
              <FileBarChart
                size={18}
                className="text-[#000080] shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Staff-Wise Sales &amp; Profit Report (Drill-Down)
                </p>
                <p className="text-[11px] text-slate-600">
                  Click any Pharmacy Staff to inspect all their bills, profit &amp;
                  print A4 GST invoices
                </p>
              </div>
            </Link>

            <Link
              to="/admin/backup"
              className="p-3 border border-slate-300 hover:border-green-600 hover:bg-green-50/40 rounded flex items-start gap-2.5 transition-colors"
            >
              <DatabaseBackup
                size={18}
                className="text-green-700 shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Full Clinic + Pharmacy Backup &amp; Restore
                </p>
                <p className="text-[11px] text-slate-600">
                  1-Click Cloud Snapshot, Download JSON Backup &amp; Anytime
                  Restore
                </p>
              </div>
            </Link>

            <Link
              to="/admin/reports"
              className="p-3 border border-slate-300 hover:border-[#000080] hover:bg-blue-50/40 rounded flex items-start gap-2.5 transition-colors"
            >
              <FileBarChart
                size={18}
                className="text-[#000080] shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Master Admin MIS &amp; Financial Reports
                </p>
                <p className="text-[11px] text-slate-600">
                  Sales, GST, Profit, Expiry, Low Stock, Doctor OPD &amp; CSV
                  Exports
                </p>
              </div>
            </Link>

            <Link
              to="/admin/settings"
              className="p-3 border border-slate-300 hover:border-[#000080] hover:bg-blue-50/40 rounded flex items-start gap-2.5 transition-colors"
            >
              <ImagePlus size={18} className="text-green-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Clinic GST No., UPI ID &amp; Website Settings
                </p>
                <p className="text-[11px] text-slate-600">
                  Configure GST Number (`gstNo`), UPI ID, Clinic Name, Address &amp;
                  Slider
                </p>
              </div>
            </Link>

            <Link
              to="/pharmacy/sale"
              className="p-3 border border-slate-300 hover:border-[#000080] hover:bg-blue-50/40 rounded flex items-start gap-2.5 transition-colors"
            >
              <ShoppingBag
                size={18}
                className="text-green-700 shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Sale Billing (Barcode + FIFO + A4 GST Print)
                </p>
                <p className="text-[11px] text-slate-600">
                  Auto-focused barcode scanner, FIFO batch, UPI QR &amp; A4 GST
                  invoice print
                </p>
              </div>
            </Link>

            <Link
              to="/pharmacy/masters?tab=medicine"
              className="p-3 border border-slate-300 hover:border-[#000080] hover:bg-blue-50/40 rounded flex items-start gap-2.5 transition-colors"
            >
              <Boxes size={18} className="text-[#000080] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Medicine &amp; Batch Masters (Excel / CSV Import)
                </p>
                <p className="text-[11px] text-slate-600">
                  Add medicines, barcodes, bulk import/export .xlsx &amp; .csv
                </p>
              </div>
            </Link>

            <Link
              to="/pharmacy/report"
              className="p-3 border border-slate-300 hover:border-[#000080] hover:bg-blue-50/40 rounded flex items-start gap-2.5 transition-colors"
            >
              <FileBarChart
                size={18}
                className="text-amber-600 shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Stock &amp; Expiry Status Report (A4 Print + Excel)
                </p>
                <p className="text-[11px] text-slate-600">
                  Print A4 GST stock report or export to Excel (.xlsx) &amp; CSV
                </p>
              </div>
            </Link>

            <Link
              to="/admin/doctors"
              className="p-3 border border-slate-300 hover:border-[#000080] hover:bg-blue-50/40 rounded flex items-start gap-2.5 transition-colors"
            >
              <Stethoscope
                size={18}
                className="text-green-700 shrink-0 mt-0.5"
              />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Doctor Management
                </p>
                <p className="text-[11px] text-slate-600">
                  Add/Edit/Delete doctors, set OPD timings &amp; slots
                </p>
              </div>
            </Link>

            <Link
              to="/admin/staff"
              className="p-3 border border-slate-300 hover:border-[#000080] hover:bg-blue-50/40 rounded flex items-start gap-2.5 transition-colors"
            >
              <Users size={18} className="text-green-700 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Staff Management (10-Digit Mobile OTP)
                </p>
                <p className="text-[11px] text-slate-600">
                  Add Pharmacy, Doctor &amp; Reception staff by mobile number;
                  Activate/Deactivate
                </p>
              </div>
            </Link>

            <Link
              to="/admin/activity"
              className="p-3 border border-slate-300 hover:border-[#000080] hover:bg-blue-50/40 rounded flex items-start gap-2.5 transition-colors sm:col-span-2"
            >
              <Activity size={18} className="text-[#000080] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Staff Security Audit Log (`staff_activity`)
                </p>
                <p className="text-[11px] text-slate-600">
                  Audit trail of every bill created, payment marked, stock batch
                  added, backup restored, and staff login
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Staff Activity Panel */}
        <div className="lg:col-span-5 bg-white border border-slate-300 rounded p-4 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#000080]">
                Recent Security &amp; Staff Activity (`staff_activity`)
              </h2>
              <Link
                to="/admin/activity"
                className="text-[11px] font-bold text-green-700 hover:underline"
              >
                View All →
              </Link>
            </div>

            {recentActivity.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">
                No staff activity logged yet.
              </p>
            ) : (
              <div className="divide-y divide-slate-200">
                {recentActivity.map((act) => (
                  <div key={act.id} className="py-2 text-xs space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">
                        {act.staffName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">
                        {new Date(act.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-slate-700 text-[11px]">{act.details}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
