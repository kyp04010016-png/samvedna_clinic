import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
  IndianRupee,
  AlertTriangle,
  QrCode,
  FileSpreadsheet,
  Truck,
  Tag,
  Activity,
  DatabaseBackup,
  MapPin,
  Stethoscope,
  CreditCard,
} from 'lucide-react';
import { db } from '../../firebase';
import { getExpiryStatus, calculateMarginPercent } from '../../utils/invoiceNo';
import { generateUPIQR, UPIQRResult } from '../../utils/upiQR';
import { QRModal } from '../../components/QRModal';
import {
  RazorpayCheckoutModal,
  RazorpayGatewaySuccessPayload,
} from '../../components/RazorpayCheckoutModal';
import { BackupRestore } from '../admin/BackupRestore';
import { printElementById } from '../../utils/printEngine';
import { MargCompanyViews } from './marg/MargCompanyViews';
import { MargMasterViews } from './marg/MargMasterViews';
import { MargTransactionViews } from './marg/MargTransactionViews';
import { MargAccountViews } from './marg/MargAccountViews';
import { MargReportViews } from './marg/MargReportViews';

export const MargErpViews: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const activeView = searchParams.get('view') || 'desktop';
  const drugQueryParam = searchParams.get('q') || '';

  const [invoices, setInvoices] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [clinicSettings, setClinicSettings] = useState<any>({});
  const [loading, setLoading] = useState(true);

  const [searchMenuFilter, setSearchMenuFilter] = useState(drugQueryParam);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [razorpayModalOpen, setRazorpayModalOpen] = useState(false);
  const [qrData, setQrData] = useState<UPIQRResult | null>(null);
  const [selectedInvoiceForQr, setSelectedInvoiceForQr] = useState<any | null>(
    null
  );
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const loadAllErpData = async () => {
    setLoading(true);
    try {
      const [invSnap, batchSnap, medSnap, apptSnap, actSnap, setSnap] =
        await Promise.all([
          getDocs(collection(db, 'invoices')),
          getDocs(collection(db, 'batches')),
          getDocs(collection(db, 'medicines')),
          getDocs(collection(db, 'appointments')),
          getDocs(collection(db, 'staff_activity')),
          getDoc(doc(db, 'settings', 'clinic')),
        ]);

      setInvoices(
        invSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          )
      );
      setBatches(batchSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setMedicines(medSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setAppointments(
        apptSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) =>
            String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
          )
      );
      setActivities(
        actSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a: any, b: any) =>
            String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
          )
      );
      if (setSnap.exists()) {
        setClinicSettings(setSnap.data());
      }
    } catch (err) {
      console.error('Error loading Marg ERP data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllErpData();
  }, []);

  useEffect(() => {
    if (drugQueryParam) {
      setSearchMenuFilter(drugQueryParam);
    }
  }, [drugQueryParam]);

  const handleMarkOutstandingPaid = async (
    inv: any,
    mode: 'cash' | 'upi' | 'razorpay',
    razorpayDetails?: RazorpayGatewaySuccessPayload
  ) => {
    try {
      const payload: Record<string, any> = {
        paymentStatus: 'paid',
        paymentMode: mode,
      };
      if (razorpayDetails) {
        payload.razorpayPaymentId = razorpayDetails.razorpayPaymentId;
        payload.razorpayMethod = razorpayDetails.razorpayMethod;
      }
      await updateDoc(doc(db, 'invoices', inv.id), payload);
      setToastMsg(
        `Invoice #${inv.invoiceNo} marked PAID via ${mode.toUpperCase()}${
          razorpayDetails ? ` (${razorpayDetails.razorpayPaymentId})` : ''
        }!`
      );
      setQrModalOpen(false);
      setRazorpayModalOpen(false);
      await loadAllErpData();
    } catch (err) {
      console.error('Failed to update invoice:', err);
    }
  };

  const handleOpenInvoiceQr = async (inv: any) => {
    try {
      const amt = Number(inv.grandTotal ?? inv.total ?? 0);
      const qr = await generateUPIQR(amt, inv.invoiceNo);
      setSelectedInvoiceForQr(inv);
      setQrData(qr);
      setQrModalOpen(true);
    } catch (err: any) {
      setToastMsg(err?.message || 'Could not generate UPI QR.');
    }
  };

  const handleOpenInvoiceRazorpay = (inv: any) => {
    if (clinicSettings.razorpayEnabled === false) {
      setToastMsg(
        'Razorpay Online Gateway is currently disabled by Admin in Settings.'
      );
      return;
    }
    setSelectedInvoiceForQr(inv);
    setRazorpayModalOpen(true);
  };

  // Calculations for reports
  const todayStr = new Date().toISOString().split('T')[0];
  const todayInvoices = invoices.filter(
    (inv) => String(inv.createdAt || '').split('T')[0] === todayStr
  );
  const paidInvoices = invoices.filter((inv) => inv.paymentStatus === 'paid');
  const pendingInvoices = invoices.filter(
    (inv) => inv.paymentStatus === 'pending'
  );

  const cashTotal = paidInvoices
    .filter((i) => i.paymentMode === 'cash')
    .reduce((s, i) => s + Number(i.grandTotal ?? i.total ?? 0), 0);
  const upiTotal = paidInvoices
    .filter((i) => i.paymentMode === 'upi')
    .reduce((s, i) => s + Number(i.grandTotal ?? i.total ?? 0), 0);
  const razorpayTotal = paidInvoices
    .filter((i) => i.paymentMode === 'razorpay')
    .reduce((s, i) => s + Number(i.grandTotal ?? i.total ?? 0), 0);

  const todaySalesTotal = todayInvoices.reduce(
    (s, i) => s + Number(i.grandTotal ?? i.total ?? 0),
    0
  );
  const todayProfitTotal = todayInvoices.reduce(
    (s, i) => s + Number(i.totalProfit ?? i.grossProfit ?? 0),
    0
  );
  const allTimeSales = invoices.reduce(
    (s, i) => s + Number(i.grandTotal ?? i.total ?? 0),
    0
  );
  const allTimeProfit = invoices.reduce(
    (s, i) => s + Number(i.totalProfit ?? i.grossProfit ?? 0),
    0
  );

  // 1. DEFAULT MARG ERP 9+ DESKTOP HOME CANVAS (EXACT MATCH TO UPLOADED PHOTO)
  if (activeView === 'desktop') {
    return (
      <div className="h-full min-h-[470px] flex flex-col items-center justify-center relative select-none py-6 animate-fade-in-up">
        {/* Authentic Marg ERP 9+ Center Logo & Banner */}
        <div className="text-center space-y-2 max-w-xl mx-auto px-4">
          {/* Stylized "Marg" vector artwork matching the screenshot */}
          <div className="relative inline-block">
            <svg
              viewBox="0 0 460 150"
              className="w-72 sm:w-96 h-auto mx-auto drop-shadow-2xs"
            >
              {/* Pink/Coral M arch */}
              <path
                d="M25 125 C 60 35, 110 20, 145 75 C 175 25, 215 15, 225 110 L 195 115 C 190 55, 165 55, 140 98 C 115 55, 85 60, 45 125 Z"
                fill="#e28788"
              />
              {/* Blue "arg" script */}
              <text
                x="225"
                y="102"
                fontFamily="Georgia, serif"
                fontStyle="italic"
                fontWeight="bold"
                fontSize="86"
                fill="#7ea6cc"
              >
                arg
              </text>
              {/* Soft teal swoosh underline */}
              <path
                d="M15 138 Q 220 105, 435 128"
                stroke="#b2d0cc"
                strokeWidth="5"
                fill="none"
              />
            </svg>
          </div>

          <p className="text-2xl sm:text-4xl font-normal tracking-wide text-[#8c8c8c] -mt-2">
            The Business Backbone
          </p>

          <div className="mt-4 inline-block bg-[#b5d0cd] border border-[#9cbab7] px-10 sm:px-14 py-3 shadow-xs">
            <span
              className="text-3xl sm:text-5xl font-bold text-white tracking-wider"
              style={{ fontFamily: 'Times New Roman, Georgia, serif' }}
            >
              Marg ERP 9<sup className="text-2xl sm:text-3xl">+</sup>
            </span>
          </div>

          <p className="text-xs font-mono text-slate-600 pt-3">
            SANDANA CLINIC + DUDRUCS PHARMACY · FIFO BATCH &amp; UPI QR EDITION
          </p>

          {/* Page 5 of PDF: Marg Financial Dashboard Report Tiles */}
          <div className="pt-3 pb-1 max-w-2xl mx-auto w-full">
            <div className="bg-[#e6f2ff] p-2 border border-[#7f9db9] rounded-t text-center font-bold text-[#000080] text-xs">
              DASHBOARD REPORT (मार्ग वित्तीय डैशबोर्ड रिपोर्ट)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-2.5 border-x border-b border-[#7f9db9] rounded-b text-[11px] font-mono">
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'gross_profit' })}
                className="p-2 bg-slate-50 hover:bg-emerald-50 border rounded text-left transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 uppercase block font-bold">SALES / RETURN</span>
                <span className="font-bold text-emerald-800 text-xs">₹{todaySalesTotal.toFixed(2)}</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'purchase_challan' })}
                className="p-2 bg-slate-50 hover:bg-blue-50 border rounded text-left transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 uppercase block font-bold">PURCHASE INWARD</span>
                <span className="font-bold text-[#000080] text-xs">₹{(batches.reduce((s, b) => s + (b.costPrice * b.stock), 0)).toFixed(2)}</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'rio_opd' })}
                className="p-2 bg-slate-50 hover:bg-purple-50 border rounded text-left transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 uppercase block font-bold">PENDING ORDERS</span>
                <span className="font-bold text-purple-800 text-xs">{appointments.length} OPD Orders</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'cashbook' })}
                className="p-2 bg-slate-50 hover:bg-amber-50 border rounded text-left transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 uppercase block font-bold">CASH &amp; BANK</span>
                <span className="font-bold text-amber-800 text-xs">₹{(cashTotal + upiTotal).toFixed(2)}</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'ledger_master' })}
                className="p-2 bg-slate-50 hover:bg-sky-50 border rounded text-left transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 uppercase block font-bold">DEBTORS/CREDIT</span>
                <span className="font-bold text-sky-800 text-xs">6 Active A/c</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'outstanding' })}
                className="p-2 bg-slate-50 hover:bg-red-50 border rounded text-left transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 uppercase block font-bold">OUTSTANDING</span>
                <span className="font-bold text-red-800 text-xs">{pendingInvoices.length} Bills</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'bank_reconciliation' })}
                className="p-2 bg-slate-50 hover:bg-teal-50 border rounded text-left transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 uppercase block font-bold">BANK RECONCILE</span>
                <span className="font-bold text-teal-800 text-xs">Balanced</span>
              </button>
              <button
                type="button"
                onClick={() => setSearchParams({ view: 'stock_valuation' })}
                className="p-2 bg-slate-50 hover:bg-emerald-50 border rounded text-left transition-colors cursor-pointer"
              >
                <span className="text-[10px] text-slate-500 uppercase block font-bold">STOCK VALUATION</span>
                <span className="font-bold text-emerald-800 text-xs">{batches.length} Batches</span>
              </button>
            </div>
          </div>

          {/* Quick Interactive Launch Pills right below the logo */}
          <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/pharmacy/sale"
              className="px-3.5 py-1.5 bg-[#000080] hover:bg-blue-900 text-white text-xs font-bold border border-blue-950 shadow-2xs transition-transform hover:scale-105"
            >
              [Alt+N] Open Sale Billing
            </Link>
            <Link
              to="/pharmacy/erp?view=purchase_challan"
              className="px-3.5 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-bold border border-green-950 shadow-2xs transition-transform hover:scale-105"
            >
              [Alt+P] Purchase Challan
            </Link>
            <Link
              to="/pharmacy/report?filter=all"
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold border border-amber-800 shadow-2xs transition-transform hover:scale-105"
            >
              [Alt+S] Stock &amp; Expiry Status
            </Link>
            <button
              type="button"
              onClick={() => setSearchParams({ view: 'gross_profit' })}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold border border-slate-950 shadow-2xs transition-transform hover:scale-105"
            >
              Today&apos;s Gross Profit (₹{todayProfitTotal.toFixed(2)})
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Wrapper header for all active Marg ERP inner windows
  const renderWindowHeader = (title: string, subtitle: string) => (
    <div className="bg-[#000080] text-white px-3 py-2 flex flex-wrap items-center justify-between gap-2 border-b border-blue-950">
      <div>
        <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider">
          {title}
        </h2>
        <p className="text-[11px] text-blue-200">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={loadAllErpData}
          className="px-2.5 py-1 bg-blue-800 hover:bg-blue-700 text-white text-[11px] font-bold rounded inline-flex items-center gap-1"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
        <button
          type="button"
          onClick={() =>
            printElementById('marg-erp-active-window', {
              title: title.replace(/\s+/g, '_'),
            })
          }
          className="no-print px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-bold rounded inline-flex items-center gap-1"
        >
          <Printer size={12} />
          Print
        </button>
        <button
          type="button"
          onClick={() => setSearchParams({ view: 'desktop' })}
          className="no-print px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white text-[11px] font-bold rounded inline-flex items-center gap-1"
        >
          <ArrowLeft size={12} />
          [Esc] Marg Desktop
        </button>
      </div>
    </div>
  );

  return (
    <div
      id="marg-erp-active-window"
      className="bg-white border-2 border-[#7f9db9] shadow-md min-h-[470px] flex flex-col animate-fade-in-up"
    >
      {toastMsg && (
        <div className="p-2.5 bg-green-100 border-b border-green-300 text-xs font-bold text-green-900 flex items-center justify-between">
          <span>{toastMsg}</span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-green-800 underline text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 1. MARG COMPANY VIEWS (Pages 2-7, 9-11 of PDF) */}
      {[
        'company_creation',
        'company_gateway',
        'control_room',
        'operator_powers',
      ].includes(activeView) && (
        <div className="p-3">
          <MargCompanyViews
            clinicSettings={clinicSettings}
            onRefreshSettings={loadAllErpData}
            onNavigateView={(v) => setSearchParams({ view: v })}
            subView={activeView}
          />
        </div>
      )}

      {/* 2. MARG MASTER VIEWS (Pages 11-21 of PDF) */}
      {[
        'item_master',
        'new_item',
        'company_masters',
        'group_masters',
        'category_masters',
        'ledger_master',
        'new_ledger',
        'ledger_list',
        'price_list',
        'currency_rates',
        'ledger_statement',
      ].includes(activeView) && (
        <div className="p-3">
          <MargMasterViews
            medicines={medicines}
            batches={batches}
            onRefreshData={loadAllErpData}
            subView={activeView}
          />
        </div>
      )}

      {/* 3. MARG TRANSACTION VIEWS (Pages 22-30, 38 of PDF) */}
      {[
        'purchase_order',
        'purchase_challan',
        'purchase_bill',
        'purchase_return',
        'quotation',
        'sales_order',
        'delivery_challan',
        'sales_return',
        'stock_transfer',
        'purchase_register',
      ].includes(activeView) && (
        <div className="p-3">
          <MargTransactionViews
            medicines={medicines}
            batches={batches}
            invoices={invoices}
            subView={activeView}
            onRefreshData={loadAllErpData}
          />
        </div>
      )}

      {/* 4. MARG ACCOUNT & VOUCHER VIEWS (Pages 30-36 of PDF) */}
      {[
        'voucher_payment',
        'voucher_receipt',
        'cheque_management',
        'pdc_cheques',
        'payin_slips',
        'bank_reconciliation',
        'cheque_dishonoured',
        'pd_payment',
      ].includes(activeView) && (
        <div className="p-3">
          <MargAccountViews
            subView={activeView}
            onRefreshData={loadAllErpData}
          />
        </div>
      )}

      {/* 5. MARG FINAL REPORTS & VALUATION (Pages 37-40 of PDF) */}
      {[
        'stock_valuation',
        'trial_balance',
        'profit_loss',
        'balance_sheet',
        'depreciation',
        'dump_stock',
        'pending_orders',
        'supplier_ledger',
        'customer_ledger',
        'utilities',
        'gstr1',
        'gstr2',
        'gstr3b',
        'eway_bill',
        'trading_account',
      ].includes(activeView) && (
        <div className="p-3">
          <MargReportViews
            batches={batches}
            medicines={medicines}
            invoices={invoices}
            subView={activeView}
          />
        </div>
      )}

      {/* VIEW: CASH & BANK BOOK / CONNECTED BANKING */}
      {(activeView === 'cashbook' || activeView === 'connected_banking') && (
        <>
          {renderWindowHeader(
            'MARG CASH, UPI & RAZORPAY ONLINE GATEWAY RECONCILIATION',
            'Live ledger summary of Cash Drawer, UPI QR, and Razorpay Online Gateway'
          )}
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded">
                <p className="text-[11px] font-bold uppercase text-emerald-800">
                  Cash In Hand (Paid Cash)
                </p>
                <p className="text-2xl font-bold font-mono text-emerald-900 mt-1">
                  ₹{cashTotal.toFixed(2)}
                </p>
              </div>
              <div className="p-3.5 bg-blue-50 border border-blue-300 rounded">
                <p className="text-[11px] font-bold uppercase text-blue-800">
                  UPI Bank A/c ({clinicSettings.upiId || 'sandanaclinic@okaxis'})
                </p>
                <p className="text-2xl font-bold font-mono text-blue-900 mt-1">
                  ₹{upiTotal.toFixed(2)}
                </p>
              </div>
              <div className="p-3.5 bg-sky-50 border border-sky-300 rounded">
                <p className="text-[11px] font-bold uppercase text-sky-800">
                  Razorpay Online Gateway
                </p>
                <p className="text-2xl font-bold font-mono text-sky-900 mt-1">
                  ₹{razorpayTotal.toFixed(2)}
                </p>
              </div>
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded">
                <p className="text-[11px] font-bold uppercase text-amber-800">
                  Total Realized Balance
                </p>
                <p className="text-2xl font-bold font-mono text-slate-900 mt-1">
                  ₹{(cashTotal + upiTotal + razorpayTotal).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-300">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                    <th className="py-2 px-3 font-bold">Date</th>
                    <th className="py-2 px-3 font-bold">Voucher / Invoice No</th>
                    <th className="py-2 px-3 font-bold">Party / Customer</th>
                    <th className="py-2 px-3 font-bold">Book Type</th>
                    <th className="py-2 px-3 font-bold text-right">Debit (Inflow)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {paidInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-blue-50/50">
                      <td className="py-2 px-3 font-mono">
                        {String(inv.createdAt || '').split('T')[0]}
                      </td>
                      <td className="py-2 px-3 font-mono font-bold text-[#000080]">
                        {inv.invoiceNo}
                      </td>
                      <td className="py-2 px-3 font-semibold">
                        {inv.customerName || 'Walk-in Customer'}
                      </td>
                      <td className="py-2 px-3 uppercase font-mono font-bold">
                        {inv.paymentMode === 'razorpay'
                          ? `RAZORPAY GATEWAY${
                              inv.razorpayPaymentId
                                ? ` (${inv.razorpayPaymentId})`
                                : ''
                            }`
                          : inv.paymentMode === 'upi'
                          ? 'BANK A/C (UPI QR)'
                          : 'CASH BOOK'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-green-700">
                        ₹{Number(inv.grandTotal ?? inv.total ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW: OUTSTANDING RECEIVABLES (PENDING BILLS) */}
      {activeView === 'outstanding' && (
        <>
          {renderWindowHeader(
            'MARG OUTSTANDING RECEIVABLES (PENDING BILLS)',
            'Collect pending payments via Razorpay Online Gateway, Instant UPI QR, or Cash'
          )}
          <div className="p-4 space-y-4">
            {pendingInvoices.length === 0 ? (
              <div className="p-8 text-center text-xs text-green-700 font-bold bg-green-50 border border-green-200 rounded">
                Zero Outstanding Bills! All Dudrucs Pharmacy invoices are settled.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-300">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                      <th className="py-2 px-3 font-bold">Invoice No</th>
                      <th className="py-2 px-3 font-bold">Date</th>
                      <th className="py-2 px-3 font-bold">Customer</th>
                      <th className="py-2 px-3 font-bold text-right">
                        Outstanding Amt
                      </th>
                      <th className="py-2 px-3 font-bold text-right">
                        Quick Settle
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {pendingInvoices.map((inv) => (
                      <tr key={inv.id} className="bg-amber-50/60">
                        <td className="py-2 px-3 font-mono font-bold text-[#000080]">
                          {inv.invoiceNo}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {String(inv.createdAt || '').split('T')[0]}
                        </td>
                        <td className="py-2 px-3 font-bold">
                          {inv.customerName} ({inv.customerPhone || 'N/A'})
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-red-600">
                          ₹{Number(inv.grandTotal ?? inv.total ?? 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right space-x-1.5">
                          {clinicSettings.razorpayEnabled !== false && (
                            <button
                              type="button"
                              onClick={() => handleOpenInvoiceRazorpay(inv)}
                              className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white font-bold rounded inline-flex items-center gap-1"
                            >
                              <CreditCard size={12} />
                              Pay Online (Razorpay)
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenInvoiceQr(inv)}
                            className="px-2.5 py-1 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded inline-flex items-center gap-1"
                          >
                            <QrCode size={12} />
                            UPI QR
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleMarkOutstandingPaid(inv, 'cash')
                            }
                            className="px-2.5 py-1 bg-green-700 hover:bg-green-800 text-white font-bold rounded inline-flex items-center gap-1"
                          >
                            <CheckCircle2 size={12} />
                            Mark Cash Paid
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* VIEW: TODAY'S GROSS PROFIT & DAILY ANALYSIS (MIS) */}
      {(activeView === 'gross_profit' ||
        activeView === 'daily_mis' ||
        activeView === 'analysis') && (
        <>
          {renderWindowHeader(
            "MARG TODAY'S GROSS PROFIT & DAILY MIS ANALYSIS",
            'Invoice-wise Cost vs Selling Price, Margin %, and Net Realized Profit'
          )}
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-100 border border-slate-300 rounded">
                <p className="text-[11px] font-bold text-slate-600 uppercase">
                  Today&apos;s Sales
                </p>
                <p className="text-xl font-bold font-mono text-slate-900 mt-0.5">
                  ₹{todaySalesTotal.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-green-50 border border-green-300 rounded">
                <p className="text-[11px] font-bold text-green-800 uppercase">
                  Today&apos;s Gross Profit
                </p>
                <p className="text-xl font-bold font-mono text-green-700 mt-0.5">
                  ₹{todayProfitTotal.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-300 rounded">
                <p className="text-[11px] font-bold text-blue-800 uppercase">
                  Cumulative Sales
                </p>
                <p className="text-xl font-bold font-mono text-blue-900 mt-0.5">
                  ₹{allTimeSales.toFixed(2)}
                </p>
              </div>
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded">
                <p className="text-[11px] font-bold text-emerald-800 uppercase">
                  Cumulative Profit
                </p>
                <p className="text-xl font-bold font-mono text-emerald-800 mt-0.5">
                  ₹{allTimeProfit.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-300">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                    <th className="py-2 px-3 font-bold">Invoice No</th>
                    <th className="py-2 px-3 font-bold">Date</th>
                    <th className="py-2 px-3 font-bold">Customer</th>
                    <th className="py-2 px-3 font-bold">Operator</th>
                    <th className="py-2 px-3 font-bold text-right">Bill Total</th>
                    <th className="py-2 px-3 font-bold text-right">
                      Net Profit Earned
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoices.map((inv) => {
                    const billAmt = Number(inv.grandTotal ?? inv.total ?? 0);
                    const profAmt = Number(
                      inv.totalProfit ?? inv.grossProfit ?? 0
                    );
                    return (
                      <tr key={inv.id} className="hover:bg-blue-50/40">
                        <td className="py-2 px-3 font-mono font-bold text-[#000080]">
                          {inv.invoiceNo}
                        </td>
                        <td className="py-2 px-3 font-mono">
                          {String(inv.createdAt || '').split('T')[0]}
                        </td>
                        <td className="py-2 px-3 font-semibold">
                          {inv.customerName || 'Walk-in'}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-600">
                          {inv.staffName || 'Operator'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          ₹{billAmt.toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-green-700">
                          +₹{profAmt.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW: STOCK & SALES ANALYSIS / PHARMANXT DRUG HELPLINE SEARCH */}
      {(activeView === 'stock_sales_analysis' ||
        activeView === 'drug_search' ||
        activeView === 'gst_summary') && (
        <>
          {renderWindowHeader(
            'MARG STOCK, BATCH MARGIN & GST ANALYSIS',
            'Batch-wise Cost, MRP, Sell Rate, Margin %, and Stock Valuation'
          )}
          <div className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Search size={15} className="text-slate-500" />
              <input
                type="text"
                value={searchMenuFilter}
                onChange={(e) => setSearchMenuFilter(e.target.value)}
                placeholder="Filter by Medicine Name or Batch No..."
                className="w-full max-w-md px-3 py-1.5 text-xs border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-[#000080]"
              />
            </div>

            <div className="overflow-x-auto border border-slate-300">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                    <th className="py-2 px-3 font-bold">Medicine Name</th>
                    <th className="py-2 px-3 font-bold">Batch No</th>
                    <th className="py-2 px-3 font-bold">Expiry</th>
                    <th className="py-2 px-3 font-bold text-right">Cost</th>
                    <th className="py-2 px-3 font-bold text-right">MRP</th>
                    <th className="py-2 px-3 font-bold text-right">Sell Rate</th>
                    <th className="py-2 px-3 font-bold text-right">Margin %</th>
                    <th className="py-2 px-3 font-bold text-right">Stock</th>
                    <th className="py-2 px-3 font-bold text-right">
                      Stock Value (Cost)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {batches
                    .filter((b) => {
                      const q = searchMenuFilter.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        String(b.medicineName || '')
                          .toLowerCase()
                          .includes(q) ||
                        String(b.batchNo || '')
                          .toLowerCase()
                          .includes(q)
                      );
                    })
                    .map((b) => {
                      const margin =
                        typeof b.marginPercent === 'number'
                          ? b.marginPercent
                          : calculateMarginPercent(
                              Number(b.costPrice || 0),
                              Number(b.sellPrice || 0)
                            );
                      const exp = getExpiryStatus(String(b.expiryDate || ''));
                      return (
                        <tr key={b.id} className="hover:bg-blue-50/40">
                          <td className="py-2 px-3 font-bold text-slate-900">
                            {b.medicineName}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-[#000080]">
                            {b.batchNo}
                          </td>
                          <td className="py-2 px-3 font-mono">
                            {b.expiryDate} ({exp.label})
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            ₹{Number(b.costPrice || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono">
                            ₹{Number(b.mrp || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            ₹{Number(b.sellPrice || 0).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-green-700">
                            {margin.toFixed(1)}%
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            {b.stock}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold">
                            ₹
                            {(
                              Number(b.costPrice || 0) * Number(b.stock || 0)
                            ).toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW: DISPATCH SUMMARY / BILL TAGGING / E-WAY / E-RETAIL */}
      {(activeView === 'dispatch' ||
        activeView === 'bill_tagging' ||
        activeView === 'eretail') && (
        <>
          {renderWindowHeader(
            'MARG DISPATCH SUMMARY & BILL TAGGING REGISTER',
            'Track dispensed bills by Payment Mode (UPI QR vs Cash) and Delivery Status'
          )}
          <div className="p-4">
            <div className="overflow-x-auto border border-slate-300">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                    <th className="py-2 px-3 font-bold">Bill No</th>
                    <th className="py-2 px-3 font-bold">Customer &amp; Phone</th>
                    <th className="py-2 px-3 font-bold">Items Dispensed</th>
                    <th className="py-2 px-3 font-bold">Payment Tag</th>
                    <th className="py-2 px-3 font-bold">Status</th>
                    <th className="py-2 px-3 font-bold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-[#000080]">
                        {inv.invoiceNo}
                      </td>
                      <td className="py-2 px-3 font-semibold">
                        {inv.customerName} · {inv.customerPhone || 'Local'}
                      </td>
                      <td className="py-2 px-3">
                        {Array.isArray(inv.items) ? inv.items.length : 1} batch
                        item(s)
                      </td>
                      <td className="py-2 px-3 uppercase font-mono font-bold">
                        {inv.paymentMode}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                            inv.paymentStatus === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inv.paymentStatus}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-bold">
                        ₹{Number(inv.grandTotal ?? inv.total ?? 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW: RIO SERVICES / ORDER CRM (CLINIC OPD APPOINTMENTS SYNC) */}
      {(activeView === 'rio_opd' || activeView === 'order_crm') && (
        <>
          {renderWindowHeader(
            'MARG RIO SERVICES — SANDANA CLINIC OPD & PRESCRIPTION QUEUE',
            'Live outpatient appointments synced from Sandana Clinic for pharmacy dispensing'
          )}
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-slate-700">
                Total Synced OPD Patients: {appointments.length}
              </span>
              <Link
                to="/pharmacy/sale"
                className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white text-xs font-bold rounded"
              >
                + Create Pharmacy Bill for Patient
              </Link>
            </div>
            <div className="overflow-x-auto border border-slate-300">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                    <th className="py-2 px-3 font-bold">Token</th>
                    <th className="py-2 px-3 font-bold">Date &amp; Slot</th>
                    <th className="py-2 px-3 font-bold">Patient Name</th>
                    <th className="py-2 px-3 font-bold">Mobile</th>
                    <th className="py-2 px-3 font-bold">Consulting Doctor</th>
                    <th className="py-2 px-3 font-bold">OPD Status</th>
                    <th className="py-2 px-3 font-bold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {appointments.map((appt) => (
                    <tr key={appt.id} className="hover:bg-blue-50/40">
                      <td className="py-2 px-3 font-mono font-bold text-green-700">
                        #{appt.tokenNo || 1}
                      </td>
                      <td className="py-2 px-3 font-mono">
                        {appt.date} · {appt.slot}
                      </td>
                      <td className="py-2 px-3 font-bold">{appt.patientName}</td>
                      <td className="py-2 px-3 font-mono">{appt.phone}</td>
                      <td className="py-2 px-3">{appt.doctorName}</td>
                      <td className="py-2 px-3 uppercase font-mono font-bold text-[#000080]">
                        {appt.status}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <Link
                          to="/pharmacy/sale"
                          className="px-2.5 py-1 bg-[#000080] text-white font-bold rounded text-[11px]"
                        >
                          Bill Medicines →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW: CLOUD BACKUP & ANYTIME RESTORE */}
      {activeView === 'cloud_backup' && (
        <>
          {renderWindowHeader(
            'MARG ERP 9+ — FULL CLOUD BACKUP & ANYTIME RESTORE VAULT',
            'Backup all Clinic & Pharmacy records to JSON or Cloud Snapshots and restore anytime'
          )}
          <div className="p-4">
            <BackupRestore />
          </div>
        </>
      )}

      {/* VIEW: OPERATOR'S AUDIT TRAIL / SYSTEM TOOLS */}
      {(activeView === 'operators' || activeView === 'audit_trail') && (
        <>
          {renderWindowHeader(
            'MARG OPERATOR AUDIT TRAIL & CLOUD FIRESTORE SYNC',
            'Real-time log of every operator transaction in Sandana Clinic + Dudrucs'
          )}
          <div className="p-4 space-y-3">
            <div className="p-3 bg-green-50 border border-green-300 rounded flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-green-900 flex items-center gap-2">
                <DatabaseBackup size={16} className="text-green-700" />
                Firebase Cloud Backup Status: LIVE SYNCED ({medicines.length}{' '}
                Medicines, {batches.length} Batches, {invoices.length} Invoices)
              </span>
              <Link
                to="/pharmacy/erp?view=cloud_backup"
                className="px-3 py-1 bg-[#000080] text-white font-bold rounded text-[11px]"
              >
                Open Full Backup &amp; Restore Vault →
              </Link>
            </div>

            <div className="overflow-x-auto border border-slate-300">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-300 text-slate-800">
                    <th className="py-2 px-3 font-bold">Timestamp</th>
                    <th className="py-2 px-3 font-bold">Operator</th>
                    <th className="py-2 px-3 font-bold">Action</th>
                    <th className="py-2 px-3 font-bold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {activities.map((act) => (
                    <tr key={act.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono text-[11px]">
                        {new Date(act.timestamp).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 font-bold">{act.staffName}</td>
                      <td className="py-2 px-3 font-mono font-bold text-[#000080]">
                        {act.action}
                      </td>
                      <td className="py-2 px-3">{act.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* VIEW: SEARCH MENU / ASK ME / HOT KEYS / CARE */}
      {(activeView === 'search_menu' ||
        activeView === 'ask_me' ||
        activeView === 'hot_keys') && (
        <>
          {renderWindowHeader(
            'MARG ERP 9+ — INSTANT MENU FINDER & HOT KEYS',
            'Click any module below to jump directly to that Marg ERP screen'
          )}
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              {[
                {
                  name: 'Sale Bill (Retail / Wholesale)',
                  key: 'Alt + N',
                  to: '/pharmacy/sale',
                },
                {
                  name: 'Purc. Challan / Batch Entry',
                  key: 'Alt + P',
                  to: '/pharmacy/masters?tab=batch',
                },
                {
                  name: 'Medicine Item Master',
                  key: 'Ctrl + I',
                  to: '/pharmacy/masters?tab=medicine',
                },
                {
                  name: 'Party / Ledger Master',
                  key: 'Ctrl + L',
                  to: '/pharmacy/masters?tab=ledger',
                },
                {
                  name: 'Stock Status Report',
                  key: 'Alt + S',
                  to: '/pharmacy/report?filter=all',
                },
                {
                  name: 'S/R & P/R Expiry Report',
                  key: 'Alt + E',
                  to: '/pharmacy/report?filter=expiry',
                },
                {
                  name: 'Low Stock Re-Order Report',
                  key: 'Alt + O',
                  to: '/pharmacy/report?filter=low',
                },
                {
                  name: 'Receipt & Invoices Register',
                  key: 'Alt + R',
                  to: '/pharmacy/invoices',
                },
                {
                  name: 'Clinic OPD Appointments',
                  key: 'F10',
                  to: '/pharmacy/erp?view=rio_opd',
                },
              ].map((m) => (
                <Link
                  key={m.name}
                  to={m.to}
                  className="p-3 bg-slate-50 hover:bg-blue-50 border border-slate-300 hover:border-[#000080] rounded flex items-center justify-between font-bold text-slate-900 transition-colors"
                >
                  <span>{m.name}</span>
                  <span className="px-2 py-0.5 bg-[#000080] text-white font-mono text-[10px] rounded">
                    {m.key}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {selectedInvoiceForQr && (
        <RazorpayCheckoutModal
          isOpen={razorpayModalOpen}
          amount={Number(
            selectedInvoiceForQr.grandTotal ?? selectedInvoiceForQr.total ?? 0
          )}
          invoiceNo={selectedInvoiceForQr.invoiceNo}
          customerName={
            selectedInvoiceForQr.customerName || 'Walk-in Customer'
          }
          customerPhone={selectedInvoiceForQr.customerPhone || ''}
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
          onSuccess={(rzpPayload) =>
            handleMarkOutstandingPaid(
              selectedInvoiceForQr,
              'razorpay',
              rzpPayload
            )
          }
          onClose={() => setRazorpayModalOpen(false)}
        />
      )}

      {qrData && selectedInvoiceForQr && (
        <QRModal
          isOpen={qrModalOpen}
          qrDataUrl={qrData.qrDataUrl}
          upiId={qrData.upiId}
          upiName={qrData.upiName}
          amount={qrData.amount}
          invoiceNo={qrData.invoiceNo}
          onMarkPaidUpi={() =>
            handleMarkOutstandingPaid(selectedInvoiceForQr, 'upi')
          }
          onMarkPaidCash={() =>
            handleMarkOutstandingPaid(selectedInvoiceForQr, 'cash')
          }
          onClose={() => setQrModalOpen(false)}
        />
      )}
    </div>
  );
};

export default MargErpViews;
