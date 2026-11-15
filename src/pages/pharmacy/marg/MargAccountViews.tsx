import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Plus,
  Save,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Calendar,
  X,
  Printer,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

interface MargAccountViewsProps {
  subView?: string;
  onRefreshData?: () => void;
}

export const MargAccountViews: React.FC<MargAccountViewsProps> = ({
  subView = 'voucher_payment',
}) => {
  const [activeTab, setActiveTab] = useState(subView);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (subView) {
      setActiveTab(subView);
    }
  }, [subView]);

  // 1. Payment Voucher State (Pages 30-31 of PDF)
  const [payVoucherNo, setPayVoucherNo] = useState('PV-2026-0041');
  const [payLedger, setPayLedger] = useState('AHLI UNITED BANK');
  const [payDrAccount, setPayDrAccount] = useState('ALKEM PHARMA DISTRIBUTORS');
  const [payAmount, setPayAmount] = useState('14200.00');
  const [payNarration, setPayNarration] = useState('Being payment made against Supplier Bill #AL-40291');

  // 2. Receipt Voucher State (Page 31 of PDF)
  const [rcptVoucherNo, setRcptVoucherNo] = useState('RV-2026-0089');
  const [rcptParty, setRcptParty] = useState('RAMESH KUMAR (PATIENT)');
  const [rcptAmount, setRcptAmount] = useState('1500.00');
  const [rcptMode, setRcptMode] = useState('CASH-IN-HAND');

  // 3. Cheque Book Management State (Pages 31-32 of PDF)
  const [showNewChequeModal, setShowNewChequeModal] = useState(false);
  const [chequeBooks, setChequeBooks] = useState([
    {
      id: '1',
      bank: 'AHLI UNITED BANK',
      from: '111200',
      to: '111250',
      total: 51,
      receivingDate: '2026-10-15',
      maxAmt: '500,000.00',
      remarks: 'Primary Dudrucs Supplier Payment Series',
    },
    {
      id: '2',
      bank: 'STATE BANK OF INDIA',
      from: '840101',
      to: '840150',
      total: 50,
      receivingDate: '2026-09-01',
      maxAmt: '1,000,000.00',
      remarks: 'Hospital Operational Account',
    },
  ]);
  const [newChequeBook, setNewChequeBook] = useState({
    bank: 'AHLI UNITED BANK',
    from: '111251',
    to: '111300',
    receivingDate: '2026-11-02',
    maxAmt: '500000.00',
    remarks: 'New Cheque Book Series 2026',
  });

  // 4. PDC Cheques / Cash (Pages 32-33 of PDF)
  const [pdcList, setPdcList] = useState([
    {
      entryNo: '001',
      tagNo: '0',
      entryDate: '2026-11-02',
      billNo: 'DU-2026-0790',
      party: 'DAWN CO. (CREDIT CUSTOMER)',
      chequeNo: '448102',
      dated: '2026-11-15',
      amount: '5000.00',
      bank: 'AHLI UNITED BANK',
      branch: 'Adliya Branch',
    },
    {
      entryNo: '002',
      tagNo: '0',
      entryDate: '2026-11-02',
      billNo: 'DU-2026-0811',
      party: 'KARTIK GENERAL SUPPLIERS',
      chequeNo: '992014',
      dated: '2026-11-20',
      amount: '2800.00',
      bank: 'NATIONAL BANK OF BAHRAIN',
      branch: 'Manama Central',
    },
  ]);

  // 5. Bank Reconciliation (Pages 34-35 of PDF)
  const [reconBank, setReconBank] = useState('AHLI UNITED BANK');
  const [reconDate, setReconDate] = useState('2026-11-02');
  const [reconItems, setReconItems] = useState([
    { id: '1', date: '2026-10-31', party: 'ABC PHARMA', chqNo: '111222', deposits: 500.0, withdrawals: 0, clearDt: '2026-11-02', status: 'CLEARED' },
    { id: '2', date: '2026-11-01', party: 'SUN PHARMA DEPOT', chqNo: '111223', deposits: 0, withdrawals: 1200.0, clearDt: '', status: 'UNCLEARED' },
    { id: '3', date: '2026-11-02', party: 'PATIENT CONSULTATION', chqNo: '448102', deposits: 5000.0, withdrawals: 0, clearDt: '', status: 'UNCLEARED' },
  ]);

  const handleCreateChequeBook = (e: React.FormEvent) => {
    e.preventDefault();
    const f = parseInt(newChequeBook.from, 10) || 0;
    const t = parseInt(newChequeBook.to, 10) || 0;
    const count = t >= f ? t - f + 1 : 0;
    const item = {
      id: String(Date.now()),
      bank: newChequeBook.bank,
      from: newChequeBook.from,
      to: newChequeBook.to,
      total: count,
      receivingDate: newChequeBook.receivingDate,
      maxAmt: newChequeBook.maxAmt,
      remarks: newChequeBook.remarks,
    };
    setChequeBooks([...chequeBooks, item]);
    setShowNewChequeModal(false);
    setToast(`✅ New Cheque Book (${newChequeBook.from} to ${newChequeBook.to}) successfully registered!`);
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className="p-2.5 bg-emerald-100 border border-emerald-300 text-xs font-bold text-emerald-900 rounded flex justify-between items-center">
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} className="underline text-[11px]">
            Dismiss
          </button>
        </div>
      )}

      {/* Marg Accounts Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-200 p-1.5 rounded border border-slate-300 text-xs font-bold">
        {[
          { id: 'voucher_payment', label: '1. Payment Voucher (सप्लायर भुगतान)' },
          { id: 'voucher_receipt', label: '2. Receipt Voucher (रसीद वाउचर)' },
          { id: 'cheque_management', label: '3. Cheque Book Management' },
          { id: 'pdc_cheques', label: '4. PDC Cheques / Cash (Receipt)' },
          { id: 'payin_slips', label: '5. Bank Pay-in Slips / Clearance' },
          { id: 'bank_reconciliation', label: '6. Bank Reconciliation' },
          { id: 'cheque_dishonoured', label: '7. Cheque Dishonoured' },
          { id: 'pd_payment', label: '8. Post-Dated Cheque Payment' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
              activeTab === t.id
                ? 'bg-[#000080] text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* =========================================================================
          VIEW 1: VOUCHER PAYMENT (Pages 30-31 of PDF)
      ========================================================================= */}
      {activeTab === 'voucher_payment' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>ACCOUNTS VOUCHER ENTRY [PAYMENT VOUCHER] (भुगतान वाउचर)</span>
            <span className="font-mono text-[11px] text-amber-300">Affects Cash Book / Bank Book</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-4 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#f0f4f8] p-2 border">
              <div>
                <span className="font-bold">Voucher Type :</span>
                <input type="text" readOnly value="PAYMENT VOUCHER" className="w-full px-2 py-1 border bg-slate-100 font-bold text-[#000080]" />
              </div>
              <div>
                <span className="font-bold">Voucher No :</span>
                <input
                  type="text"
                  value={payVoucherNo}
                  onChange={(e) => setPayVoucherNo(e.target.value)}
                  className="w-full px-2 py-1 border font-bold"
                />
              </div>
              <div>
                <span className="font-bold">Date :</span>
                <input type="date" defaultValue={new Date().toISOString().slice(0, 10)} className="w-full px-2 py-1 border font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Debit Account (Dr - Supplier / Expense) :</label>
                <select
                  value={payDrAccount}
                  onChange={(e) => setPayDrAccount(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-400 font-bold bg-[#ffffe6]"
                >
                  <option value="ALKEM PHARMA DISTRIBUTORS">ALKEM PHARMA DISTRIBUTORS (Balance: ₹14,200.00 Cr)</option>
                  <option value="CIPLA PHARMACEUTICALS">CIPLA PHARMACEUTICALS (Balance: ₹28,500.00 Cr)</option>
                  <option value="FREIGHT & TRANSPORT EXPENSE">FREIGHT &amp; TRANSPORT EXPENSE</option>
                  <option value="CLINIC ELECTRICITY & RENT">CLINIC ELECTRICITY &amp; RENT</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Payment By (Cr - Bank or Cash Drawer) :</label>
                <select
                  value={payLedger}
                  onChange={(e) => setPayLedger(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-400 font-bold bg-[#e6f2ff]"
                >
                  <option value="AHLI UNITED BANK">AHLI UNITED BANK (Balance: ₹52,400.00 Dr)</option>
                  <option value="CASH-IN-HAND">CASH-IN-HAND (Balance: ₹18,650.00 Dr)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount Paid (₹) :</label>
                <input
                  type="number"
                  step="0.01"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-400 font-bold text-base text-red-700 bg-[#ffffe6]"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 mb-1">Narration / Remarks :</label>
                <input
                  type="text"
                  value={payNarration}
                  onChange={(e) => setPayNarration(e.target.value)}
                  className="w-full px-2 py-1.5 border border-slate-400 font-sans"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() =>
                  setToast(
                    `✅ Payment Voucher #${payVoucherNo} saved! ₹${payAmount} debited to ${payDrAccount} and credited from ${payLedger}.`
                  )
                }
                className="px-4 py-1.5 bg-[#000080] hover:bg-blue-900 text-white font-bold rounded inline-flex items-center gap-1.5"
              >
                <Save size={13} />
                <span>Save Payment Voucher [Enter]</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: VOUCHER RECEIPT (Page 31 of PDF)
      ========================================================================= */}
      {activeTab === 'voucher_receipt' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>ACCOUNTS VOUCHER ENTRY [RECEIPTS VOUCHER] (रसीद वाउचर)</span>
            <span className="font-mono text-[11px] text-emerald-300">Customer Dues Recovery</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-4 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#f0f4f8] p-2 border">
              <div>
                <span className="font-bold">Voucher No :</span>
                <input
                  type="text"
                  value={rcptVoucherNo}
                  onChange={(e) => setRcptVoucherNo(e.target.value)}
                  className="w-full px-2 py-1 border font-bold"
                />
              </div>
              <div>
                <span className="font-bold">Customer / Patient :</span>
                <input
                  type="text"
                  value={rcptParty}
                  onChange={(e) => setRcptParty(e.target.value)}
                  className="w-full px-2 py-1 border bg-[#ffffe6] font-bold"
                />
              </div>
              <div>
                <span className="font-bold">Receipt In :</span>
                <select
                  value={rcptMode}
                  onChange={(e) => setRcptMode(e.target.value)}
                  className="w-full px-2 py-1 border font-bold"
                >
                  <option value="CASH-IN-HAND">CASH-IN-HAND (Cash Drawer)</option>
                  <option value="AHLI UNITED BANK">BANK A/C (UPI / Cheque)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Amount Received (₹) :</label>
              <input
                type="number"
                step="0.01"
                value={rcptAmount}
                onChange={(e) => setRcptAmount(e.target.value)}
                className="w-full sm:w-64 px-2.5 py-1.5 border border-slate-400 font-bold text-base text-green-700 bg-[#ffffe6]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() =>
                  setToast(
                    `✅ Receipt Voucher #${rcptVoucherNo} saved! ₹${rcptAmount} received from ${rcptParty} deposited into ${rcptMode}.`
                  )
                }
                className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded inline-flex items-center gap-1.5"
              >
                <Save size={13} />
                <span>Save Receipt Voucher</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: CHEQUE BOOK MANAGEMENT (Pages 31-32 of PDF)
      ========================================================================= */}
      {activeTab === 'cheque_management' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>CHEQUE BOOK MANAGEMENT (चेक बुक प्रबंधन प्रणाली)</span>
            <button
              type="button"
              onClick={() => setShowNewChequeModal(true)}
              className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 font-bold text-slate-950 rounded shadow-xs"
            >
              + Add New Cheque Book
            </button>
          </div>

          <div className="bg-white border border-[#7f9db9] overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                  <th className="p-2 border-r">Bank Name</th>
                  <th className="p-2 border-r text-center">Cheque From</th>
                  <th className="p-2 border-r text-center">Cheque To</th>
                  <th className="p-2 border-r text-center">Total Cheques</th>
                  <th className="p-2 border-r text-center">Receiving Date</th>
                  <th className="p-2 border-r text-right">Max Amount Limit</th>
                  <th className="p-2">Used For / Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono text-[11px]">
                {chequeBooks.map((cb) => (
                  <tr key={cb.id} className="hover:bg-amber-50">
                    <td className="p-2 border-r font-sans font-bold text-slate-900">{cb.bank}</td>
                    <td className="p-2 border-r text-center font-bold text-[#000080]">{cb.from}</td>
                    <td className="p-2 border-r text-center font-bold text-[#000080]">{cb.to}</td>
                    <td className="p-2 border-r text-center font-bold text-emerald-700">{cb.total} Leaves</td>
                    <td className="p-2 border-r text-center">{cb.receivingDate}</td>
                    <td className="p-2 border-r text-right font-bold">₹{cb.maxAmt}</td>
                    <td className="p-2 font-sans text-slate-600">{cb.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: PDC CHEQUES (Pages 32-33 of PDF)
      ========================================================================= */}
      {activeTab === 'pdc_cheques' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>PDC CHEQUES / CASH RECEIPT (पोस्ट-डेटेड चेक रसीद पंजी)</span>
            <span className="font-mono text-[11px] text-amber-300">Cheque Maturity Tracking</span>
          </div>

          <div className="bg-white border border-[#7f9db9] overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-mono">
              <thead>
                <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                  <th className="p-2 border-r">ENTRY NO</th>
                  <th className="p-2 border-r">PARTY / CUSTOMER NAME</th>
                  <th className="p-2 border-r">PDC CHEQUE NO</th>
                  <th className="p-2 border-r">MATURITY DATED</th>
                  <th className="p-2 border-r text-right">AMOUNT (₹)</th>
                  <th className="p-2 border-r">BANK NAME</th>
                  <th className="p-2">BRANCH</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]">
                {pdcList.map((pdc, i) => (
                  <tr key={i} className="hover:bg-amber-50">
                    <td className="p-2 border-r font-bold">{pdc.entryNo}</td>
                    <td className="p-2 border-r font-sans font-bold text-slate-900">{pdc.party}</td>
                    <td className="p-2 border-r font-bold text-[#000080]">{pdc.chequeNo}</td>
                    <td className="p-2 border-r font-bold text-purple-700">{pdc.dated}</td>
                    <td className="p-2 border-r text-right font-bold text-green-700">₹{pdc.amount}</td>
                    <td className="p-2 border-r font-sans">{pdc.bank}</td>
                    <td className="p-2 font-sans text-slate-500">{pdc.branch}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 6: BANK RECONCILIATION (Pages 34-35 of PDF)
      ========================================================================= */}
      {activeTab === 'bank_reconciliation' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>BANK RECONCILIATION STATEMENT (बैंक समाधान / रिकॉन्सिलिएशन विवरण)</span>
            <span className="font-mono text-[11px] text-emerald-300">Books &gt; Bank Reconciliation</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-3 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-[#f0f4f8] p-2 border">
              <div>
                <span className="font-bold">Bank Name : </span>
                <span className="font-bold text-[#000080]">{reconBank}</span>
              </div>
              <div>
                <span className="font-bold">Reconciliation Date : </span>
                <span>{reconDate}</span>
              </div>
              <div>
                <span className="font-bold">Computer Balance : </span>
                <span className="font-bold text-green-700">₹52,400.00 Dr</span>
              </div>
            </div>

            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                  <th className="p-2 border-r">DATE</th>
                  <th className="p-2 border-r">PARTY NAME</th>
                  <th className="p-2 border-r">CHEQUE NO</th>
                  <th className="p-2 border-r text-right">DEPOSITS</th>
                  <th className="p-2 border-r text-right">WITHDRAWALS</th>
                  <th className="p-2 border-r text-center">CLEAR DT.</th>
                  <th className="p-2 text-center">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]">
                {reconItems.map((item) => (
                  <tr key={item.id} className="hover:bg-amber-50">
                    <td className="p-2 border-r">{item.date}</td>
                    <td className="p-2 border-r font-sans font-bold">{item.party}</td>
                    <td className="p-2 border-r text-[#000080] font-bold">{item.chqNo}</td>
                    <td className="p-2 border-r text-right font-bold text-green-700">
                      {item.deposits > 0 ? `₹${item.deposits.toFixed(2)}` : '-'}
                    </td>
                    <td className="p-2 border-r text-right font-bold text-red-700">
                      {item.withdrawals > 0 ? `₹${item.withdrawals.toFixed(2)}` : '-'}
                    </td>
                    <td className="p-2 border-r text-center font-bold text-purple-700">{item.clearDt || 'Pending'}</td>
                    <td className="p-2 text-center">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.status === 'CLEARED' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD NEW CHEQUE BOOK (Pages 31-32 of PDF)
      ========================================================================= */}
      {showNewChequeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-3">
          <div className="bg-[#edeae0] border-2 border-[#7f9db9] rounded-lg shadow-2xl max-w-md w-full p-4 space-y-3 font-mono text-xs">
            <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
              <span>SELECT &lsquo;ADD NEW CHEQUE BOOK&rsquo;</span>
              <button
                type="button"
                onClick={() => setShowNewChequeModal(false)}
                className="text-white hover:text-red-300 font-bold"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateChequeBook} className="bg-white border p-3 space-y-2">
              <div>
                <label className="block font-bold text-slate-700">Bank :</label>
                <select
                  value={newChequeBook.bank}
                  onChange={(e) => setNewChequeBook({ ...newChequeBook, bank: e.target.value })}
                  className="w-full px-2 py-1 border font-bold"
                >
                  <option value="AHLI UNITED BANK">AHLI UNITED BANK</option>
                  <option value="STATE BANK OF INDIA">STATE BANK OF INDIA</option>
                  <option value="HDFC BANK PHARMACY">HDFC BANK PHARMACY</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700">Cheque From :</label>
                  <input
                    type="text"
                    required
                    value={newChequeBook.from}
                    onChange={(e) => setNewChequeBook({ ...newChequeBook, from: e.target.value })}
                    className="w-full px-2 py-1 border font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700">Cheque To :</label>
                  <input
                    type="text"
                    required
                    value={newChequeBook.to}
                    onChange={(e) => setNewChequeBook({ ...newChequeBook, to: e.target.value })}
                    className="w-full px-2 py-1 border font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700">Receiving Date :</label>
                <input
                  type="date"
                  value={newChequeBook.receivingDate}
                  onChange={(e) => setNewChequeBook({ ...newChequeBook, receivingDate: e.target.value })}
                  className="w-full px-2 py-1 border font-bold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700">Maximum Amount Limit (₹) :</label>
                <input
                  type="number"
                  value={newChequeBook.maxAmt}
                  onChange={(e) => setNewChequeBook({ ...newChequeBook, maxAmt: e.target.value })}
                  className="w-full px-2 py-1 border font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700">Used For / Remarks :</label>
                <input
                  type="text"
                  value={newChequeBook.remarks}
                  onChange={(e) => setNewChequeBook({ ...newChequeBook, remarks: e.target.value })}
                  className="w-full px-2 py-1 border"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowNewChequeModal(false)}
                  className="px-3 py-1 bg-slate-200 rounded font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 bg-[#000080] text-white font-bold rounded"
                >
                  Save Cheque Book
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
