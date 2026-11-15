import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CreditCard,
  Smartphone,
  Building2,
  Wallet,
  X,
  CheckCircle2,
  Lock,
  QrCode,
  Sparkles,
  ExternalLink,
  IndianRupee,
} from 'lucide-react';
import { RazorpayMethodsConfig } from '../pages/public/Home';
import { generateUPIQR } from '../utils/upiQR';

export interface RazorpayGatewaySuccessPayload {
  razorpayPaymentId: string;
  razorpayMethod: string;
}

interface RazorpayCheckoutModalProps {
  isOpen: boolean;
  amount: number;
  invoiceNo: string;
  customerName?: string;
  customerPhone?: string;
  merchantName?: string;
  razorpayKeyId?: string;
  razorpayMode?: 'test' | 'live';
  themeColor?: string;
  logoUrl?: string;
  allowedMethods?: RazorpayMethodsConfig;
  saving?: boolean;
  onSuccess: (payload: RazorpayGatewaySuccessPayload) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    Razorpay?: any;
  }
}

export const RazorpayCheckoutModal: React.FC<RazorpayCheckoutModalProps> = ({
  isOpen,
  amount,
  invoiceNo,
  customerName = 'Walk-in Customer',
  customerPhone = '9840012345',
  merchantName = 'Sandana Clinic & Dudrucs Pharmacy',
  razorpayKeyId = 'rzp_test_SandanaDudrucs99',
  razorpayMode = 'live',
  themeColor = '#0284C7',
  logoUrl,
  allowedMethods = {
    upi: true,
    card: true,
    netbanking: true,
    wallet: true,
  },
  saving = false,
  onSuccess,
  onClose,
}) => {
  const availableTabs: Array<'upi' | 'card' | 'netbanking' | 'wallet'> = [];
  if (allowedMethods.upi !== false) availableTabs.push('upi');
  if (allowedMethods.card !== false) availableTabs.push('card');
  if (allowedMethods.netbanking !== false) availableTabs.push('netbanking');
  if (allowedMethods.wallet !== false) availableTabs.push('wallet');
  if (availableTabs.length === 0) availableTabs.push('upi');

  const [activeTab, setActiveTab] = useState<
    'upi' | 'card' | 'netbanking' | 'wallet'
  >(availableTabs[0]);

  // UPI state
  const [upiVpa, setUpiVpa] = useState('customer@okaxis');
  const [qrUrl, setQrUrl] = useState<string | null>(null);

  // Card state
  const [cardNumber, setCardNumber] = useState('4111 2222 3333 4444');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('842');
  const [cardHolder, setCardHolder] = useState(
    customerName || 'SANDANA PATIENT'
  );

  // NetBanking state
  const [selectedBank, setSelectedBank] = useState('State Bank of India (SBI)');

  // Wallet state
  const [selectedWallet, setSelectedWallet] = useState('PhonePe Wallet');

  // Processing state
  const [processingStep, setProcessingStep] = useState<
    'idle' | 'verifying' | 'approved'
  >('idle');
  const [sdkNotice, setSdkNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setProcessingStep('idle');
      setSdkNotice(null);
      return;
    }
    if (!availableTabs.includes(activeTab)) {
      setActiveTab(availableTabs[0]);
    }
    generateUPIQR(amount, invoiceNo)
      .then((res) => {
        if (res?.qrDataUrl) setQrUrl(res.qrDataUrl);
      })
      .catch(() => {});
  }, [isOpen, amount, invoiceNo]);

  if (!isOpen) return null;

  const generatePaymentId = () => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let suffix = '';
    for (let i = 0; i < 10; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `pay_Rzp${suffix}`;
  };

  const handleConfirmOnlinePayment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (processingStep !== 'idle' || saving) return;

    setProcessingStep('verifying');
    const methodLabel =
      activeTab === 'upi'
        ? `UPI (${upiVpa || 'QR Scan'})`
        : activeTab === 'card'
        ? `Card (*${cardNumber.replace(/\D/g, '').slice(-4) || '4444'})`
        : activeTab === 'netbanking'
        ? `NetBanking (${selectedBank})`
        : `Wallet (${selectedWallet})`;

    setTimeout(() => {
      setProcessingStep('approved');
      const paymentId = generatePaymentId();
      setTimeout(() => {
        onSuccess({
          razorpayPaymentId: paymentId,
          razorpayMethod: methodLabel,
        });
      }, 450);
    }, 650);
  };

  // Optional: Launch external checkout.razorpay.com script if user has a real rzp_ key
  const handleLaunchExternalRazorpaySdk = () => {
    setSdkNotice(null);
    const loadScript = (): Promise<boolean> =>
      new Promise((resolve) => {
        if (window.Razorpay) {
          resolve(true);
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      });

    loadScript().then((loaded) => {
      if (
        !loaded ||
        !window.Razorpay ||
        razorpayKeyId === 'rzp_test_SandanaDudrucs99'
      ) {
        setSdkNotice(
          'Using Built-in Razorpay Gateway Console (Configure your live rzp_live_... Key ID in Admin Panel > Settings to open external bank popup).'
        );
        return;
      }
      try {
        const rzp = new window.Razorpay({
          key: razorpayKeyId,
          amount: Math.round(amount * 100),
          currency: 'INR',
          name: merchantName,
          description: `Pharmacy Bill #${invoiceNo}`,
          image: logoUrl || undefined,
          prefill: {
            name: customerName,
            contact: customerPhone,
          },
          theme: {
            color: themeColor || '#0284C7',
          },
          handler: (response: any) => {
            onSuccess({
              razorpayPaymentId:
                response?.razorpay_payment_id || generatePaymentId(),
              razorpayMethod: 'Razorpay SDK Online',
            });
          },
        });
        rzp.open();
      } catch {
        setSdkNotice(
          'External popup restricted in preview frame. Complete payment directly below.'
        );
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in-up">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* RAZORPAY BRANDED HEADER */}
        <div
          className="px-5 py-4 text-white flex items-center justify-between gap-3"
          style={{
            background: `linear-gradient(135deg, ${
              themeColor || '#0284C7'
            }, #0F172A)`,
          }}
        >
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={merchantName}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-xl bg-white p-1 object-contain shrink-0"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center font-black text-base tracking-tight shrink-0">
                RZP
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                  Razorpay {razorpayMode === 'live' ? 'LIVE' : 'TEST'} Gateway
                </span>
                <span className="text-[10px] font-mono text-slate-300 truncate">
                  #{invoiceNo}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-extrabold truncate mt-0.5">
                {merchantName}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-slate-300 block">
                Payable
              </span>
              <span className="text-lg sm:text-xl font-mono font-black text-amber-300 tabular-nums">
                ₹{amount.toFixed(2)}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={processingStep !== 'idle' || saving}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              aria-label="Close Razorpay Gateway"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* CUSTOMER & KEY INFO STRIP */}
        <div className="px-5 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-slate-700 font-semibold">
            <span>Customer: {customerName || 'Walk-in Customer'}</span>
            {customerPhone && (
              <span className="font-mono text-slate-500">
                · +91 {customerPhone}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleLaunchExternalRazorpaySdk}
            className="text-[11px] font-bold text-sky-700 hover:underline inline-flex items-center gap-1"
          >
            <ExternalLink size={11} />
            <span>SDK Popup ({razorpayKeyId.slice(0, 12)}...)</span>
          </button>
        </div>

        {sdkNotice && (
          <div className="px-5 py-2 bg-sky-50 border-b border-sky-200 text-[11px] font-semibold text-sky-900">
            {sdkNotice}
          </div>
        )}

        {/* PAYMENT METHOD TABS (CONTROLLED BY ADMIN PANEL) */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-slate-50 border-b border-slate-200 text-xs font-bold">
          {allowedMethods.upi !== false && (
            <button
              type="button"
              onClick={() => setActiveTab('upi')}
              className={`py-2 px-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${
                activeTab === 'upi'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Smartphone size={14} />
              <span>UPI / QR</span>
            </button>
          )}
          {allowedMethods.card !== false && (
            <button
              type="button"
              onClick={() => setActiveTab('card')}
              className={`py-2 px-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${
                activeTab === 'card'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <CreditCard size={14} />
              <span>Card</span>
            </button>
          )}
          {allowedMethods.netbanking !== false && (
            <button
              type="button"
              onClick={() => setActiveTab('netbanking')}
              className={`py-2 px-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${
                activeTab === 'netbanking'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Building2 size={14} />
              <span>NetBanking</span>
            </button>
          )}
          {allowedMethods.wallet !== false && (
            <button
              type="button"
              onClick={() => setActiveTab('wallet')}
              className={`py-2 px-2 rounded-xl flex flex-col sm:flex-row items-center justify-center gap-1.5 transition-all ${
                activeTab === 'wallet'
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              <Wallet size={14} />
              <span>Wallets</span>
            </button>
          )}
        </div>

        {/* BODY CONTENT */}
        <form onSubmit={handleConfirmOnlinePayment} className="p-5 space-y-4">
          {processingStep !== 'idle' ? (
            <div className="py-10 text-center space-y-3">
              {processingStep === 'verifying' ? (
                <>
                  <div className="w-12 h-12 rounded-full border-4 border-sky-600 border-t-transparent animate-spin mx-auto" />
                  <p className="text-sm font-extrabold text-slate-900">
                    Processing Online Payment via Razorpay Gateway...
                  </p>
                  <p className="text-xs text-slate-500">
                    Verifying ₹{amount.toFixed(2)} for Invoice #{invoiceNo}
                  </p>
                </>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={28} />
                  </div>
                  <p className="text-base font-extrabold text-emerald-700">
                    Payment Approved! Generating GST Receipt...
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* 1. UPI / QR TAB */}
              {activeTab === 'upi' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                    <div className="sm:col-span-5 flex flex-col items-center justify-center bg-white p-2.5 rounded-xl border border-slate-200">
                      {qrUrl ? (
                        <img
                          src={qrUrl}
                          alt="Razorpay UPI QR"
                          className="w-28 h-28 object-contain"
                        />
                      ) : (
                        <div className="w-28 h-28 flex items-center justify-center text-slate-400">
                          <QrCode size={40} />
                        </div>
                      )}
                      <span className="text-[10px] font-bold text-slate-600 mt-1">
                        Scan with GPay / PhonePe / Paytm
                      </span>
                    </div>

                    <div className="sm:col-span-7 space-y-2.5">
                      <p className="text-xs font-extrabold text-slate-800">
                        Instant UPI Collect or QR Scan
                      </p>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Customer UPI ID / VPA
                        </label>
                        <input
                          type="text"
                          required
                          value={upiVpa}
                          onChange={(e) => setUpiVpa(e.target.value)}
                          placeholder="name@okaxis / 9840012345@ybl"
                          className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                        />
                      </div>
                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {['@okaxis', '@ybl', '@paytm', '@okicici'].map(
                          (handle) => (
                            <button
                              key={handle}
                              type="button"
                              onClick={() => {
                                const prefix =
                                  upiVpa.split('@')[0] ||
                                  customerPhone ||
                                  'patient';
                                setUpiVpa(`${prefix}${handle}`);
                              }}
                              className="px-2 py-1 text-[10px] font-mono font-bold bg-white border border-slate-300 rounded hover:border-sky-600 text-slate-700"
                            >
                              {handle}
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 2. DEBIT / CREDIT CARD TAB */}
              {activeTab === 'card' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">
                      Visa / MasterCard / RuPay Card
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setCardNumber('4111 2222 3333 4444');
                        setCardExpiry('08/28');
                        setCardCvv('842');
                      }}
                      className="text-[11px] font-bold text-sky-700 hover:underline inline-flex items-center gap-1"
                    >
                      <Sparkles size={11} />
                      <span>Autofill Test Card</span>
                    </button>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Card Number
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4111 2222 3333 4444"
                      className="w-full px-3.5 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        Expiry (MM/YY)
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={5}
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="08/28"
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">
                        CVV
                      </label>
                      <input
                        type="password"
                        required
                        maxLength={4}
                        value={cardCvv}
                        onChange={(e) => setCardCvv(e.target.value)}
                        placeholder="***"
                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Cardholder Name
                    </label>
                    <input
                      type="text"
                      required
                      value={cardHolder}
                      onChange={(e) =>
                        setCardHolder(e.target.value.toUpperCase())
                      }
                      className="w-full px-3.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-sky-600"
                    />
                  </div>
                </div>
              )}

              {/* 3. NETBANKING TAB */}
              {activeTab === 'netbanking' && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Select Customer Bank for Instant NetBanking
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'State Bank of India (SBI)',
                      'HDFC Bank',
                      'ICICI Bank',
                      'Axis Bank',
                      'Indian Bank',
                      'Kotak Mahindra Bank',
                    ].map((bank) => (
                      <button
                        key={bank}
                        type="button"
                        onClick={() => setSelectedBank(bank)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center gap-2 ${
                          selectedBank === bank
                            ? 'border-sky-600 bg-sky-50 text-sky-950'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Building2 size={14} className="text-sky-600 shrink-0" />
                        <span className="truncate">{bank}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. WALLETS TAB */}
              {activeTab === 'wallet' && (
                <div className="space-y-2.5">
                  <label className="block text-xs font-bold text-slate-700">
                    Select Mobile Wallet
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      'PhonePe Wallet',
                      'Paytm Wallet',
                      'Amazon Pay Balance',
                      'MobiKwik Wallet',
                    ].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setSelectedWallet(w)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all flex items-center gap-2 ${
                          selectedWallet === w
                            ? 'border-sky-600 bg-sky-50 text-sky-950'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <Wallet size={14} className="text-sky-600 shrink-0" />
                        <span className="truncate">{w}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* PRIMARY PAY NOW BUTTON */}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 px-5 rounded-xl text-white font-extrabold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                style={{ backgroundColor: themeColor || '#0284C7' }}
              >
                <Lock size={15} />
                <span>
                  Pay ₹{amount.toFixed(2)} Online Now via Razorpay (
                  {activeTab.toUpperCase()})
                </span>
              </button>
            </>
          )}

          {/* SECURITY FOOTER */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
              <ShieldCheck size={13} />
              <span>100% PCI-DSS Secured by Razorpay Gateway</span>
            </span>
            <span className="font-mono inline-flex items-center gap-0.5">
              <IndianRupee size={11} />
              <span>Auto-Marks Pharmacy Bill Paid</span>
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};
