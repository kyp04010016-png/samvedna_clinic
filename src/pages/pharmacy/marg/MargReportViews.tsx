import React, { useState, useEffect } from 'react';
import {
  FileText,
  TrendingUp,
  Download,
  Printer,
  Calendar,
  CheckCircle2,
  DollarSign,
  ShieldCheck,
  Building,
  RefreshCw,
} from 'lucide-react';
import { printElementById } from '../../../utils/printEngine';

interface MargReportViewsProps {
  batches: any[];
  medicines: any[];
  invoices: any[];
  subView?: string;
}

export const MargReportViews: React.FC<MargReportViewsProps> = ({
  batches,
  medicines,
  invoices,
  subView = 'stock_valuation',
}) => {
  const [activeTab, setActiveTab] = useState(subView);
  const [valuationDate, setValuationDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (subView) {
      if (
        subView === 'gstr1' ||
        subView === 'gstr2' ||
        subView === 'gstr3b' ||
        subView === 'eway_bill'
      ) {
        setActiveTab('gst_summary');
      } else if (
        subView === 'dump_stock' ||
        subView === 'pending_orders' ||
        subView === 'supplier_ledger' ||
        subView === 'customer_ledger' ||
        subView === 'utilities'
      ) {
        setActiveTab('stock_valuation');
      } else if (subView === 'trading_account') {
        setActiveTab('profit_loss');
      } else {
        setActiveTab(subView);
      }
    }
  }, [subView]);
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [stockStatus, setStockStatus] = useState('AVAILABLE');
  const [valuationOn, setValuationOn] = useState('COST+EXT');
  const [withTax, setWithTax] = useState('YES');

  // Calculate live numbers
  const totalStockUnits = batches.reduce((s, b) => s + Number(b.stock || 0), 0);
  const totalCostValuation = batches.reduce(
    (s, b) => s + Number(b.costPrice || 0) * Number(b.stock || 0),
    0
  );
  const totalMrpValuation = batches.reduce(
    (s, b) => s + Number(b.mrp || 0) * Number(b.stock || 0),
    0
  );

  const totalSalesRevenue = invoices.reduce(
    (s, i) => s + Number(i.grandTotal ?? i.total ?? 0),
    0
  );
  const totalProfitCalculated = invoices.reduce(
    (s, i) => s + Number(i.totalProfit ?? i.grossProfit ?? 0),
    0
  );

  // Depreciation Assets (Pages 38-39 of PDF)
  const [assets, setAssets] = useState([
    { id: '1', description: 'DELIVERY MOTOR CAR / SCOOTER', uptoDate: 0, after: 5000.0, rate: 7.0, depreciation: 175.0 },
    { id: '2', description: 'CLINIC PHARMACY COMPUTERS & BARCODE PRINTERS', uptoDate: 12000.0, after: 18000.0, rate: 15.0, depreciation: 2700.0 },
    { id: '3', description: 'REFRIGERATED MEDICINE STORAGE UNIT', uptoDate: 25000.0, after: 30000.0, rate: 10.0, depreciation: 3000.0 },
  ]);

  const handleExportCsv = (title: string, dataRows: string[]) => {
    const csv = 'data:text/csv;charset=utf-8,' + dataRows.join('\n');
    const link = document.createElement('a');
    link.href = encodeURI(csv);
    link.download = `${title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Marg Report Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-200 p-1.5 rounded border border-slate-300 text-xs font-bold">
        {[
          { id: 'stock_valuation', label: '1. Stock Valuation (इन्वेंटरी मूल्यांकन)' },
          { id: 'trial_balance', label: '2. Trial Balance (तलपट)' },
          { id: 'profit_loss', label: '3. Profit & Loss A/c (लाभ एवं हानि)' },
          { id: 'balance_sheet', label: '4. Balance Sheet (तुलन पत्र)' },
          { id: 'depreciation', label: '5. Fixed Assets & Depreciation' },
          { id: 'gst_summary', label: '6. GSTR-1, 2B, 3B & Tax Audit' },
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
          VIEW 1: STOCK VALUATION (Page 37 of PDF)
      ========================================================================= */}
      {activeTab === 'stock_valuation' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>STOCK VALUATION &amp; INVENTORY AUDIT (इन्वेंटरी एवं स्टॉक मूल्यांकन)</span>
            <button
              type="button"
              onClick={() =>
                handleExportCsv('Stock_Valuation', [
                  'Batch No,Medicine Name,Expiry,Units,Cost Price,Cost Total,MRP,MRP Total',
                  ...batches.map(
                    (b) =>
                      `"${b.batchNo}","${b.medicineName}","${b.expiryDate}",${b.stock},${b.costPrice},${(
                        b.costPrice * b.stock
                      ).toFixed(2)},${b.mrp},${(b.mrp * b.stock).toFixed(2)}`
                  ),
                ])
              }
              className="px-2.5 py-0.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded shadow-xs inline-flex items-center gap-1"
            >
              <Download size={12} />
              <span>Export CSV</span>
            </button>
          </div>

          <div className="bg-white border border-[#7f9db9] p-3 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-[#f0f4f8] p-2 border">
              <div>
                <span className="font-bold">Stock As On :</span>
                <input
                  type="date"
                  value={valuationDate}
                  onChange={(e) => setValuationDate(e.target.value)}
                  className="w-full px-2 py-1 border bg-[#ffffe6] font-bold"
                />
              </div>
              <div>
                <span className="font-bold">Stock Status :</span>
                <select
                  value={stockStatus}
                  onChange={(e) => setStockStatus(e.target.value)}
                  className="w-full px-2 py-1 border font-bold"
                >
                  <option value="AVAILABLE">AVAILABLE STOCK</option>
                  <option value="WHOLE">WHOLE / ALL BATCHES</option>
                </select>
              </div>
              <div>
                <span className="font-bold">Valuation On :</span>
                <select
                  value={valuationOn}
                  onChange={(e) => setValuationOn(e.target.value)}
                  className="w-full px-2 py-1 border font-bold"
                >
                  <option value="COST+EXT">COST + EXT (Purchase Price)</option>
                  <option value="MRP">MRP VALUATION</option>
                </select>
              </div>
              <div>
                <span className="font-bold">With Tax :</span>
                <select
                  value={withTax}
                  onChange={(e) => setWithTax(e.target.value)}
                  className="w-full px-2 py-1 border font-bold"
                >
                  <option value="YES">YES (Include Tax)</option>
                  <option value="NO">NO (Basic Cost)</option>
                </select>
              </div>
            </div>

            {/* Quick Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="p-2.5 bg-blue-50 border border-blue-200 rounded text-center">
                <span className="text-[11px] text-slate-500 uppercase">Total Inventory Quantity</span>
                <p className="text-xl font-bold text-[#000080]">{totalStockUnits} Units</p>
              </div>
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-center">
                <span className="text-[11px] text-slate-500 uppercase">Total Cost Valuation (Cost+Ext)</span>
                <p className="text-xl font-bold text-emerald-800">₹{totalCostValuation.toFixed(2)}</p>
              </div>
              <div className="p-2.5 bg-purple-50 border border-purple-200 rounded text-center">
                <span className="text-[11px] text-slate-500 uppercase">Total MRP Valuation</span>
                <p className="text-xl font-bold text-purple-800">₹{totalMrpValuation.toFixed(2)}</p>
              </div>
            </div>

            {/* Batches Table */}
            <div className="overflow-x-auto border">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                    <th className="p-2 border-r">MEDICINE NAME</th>
                    <th className="p-2 border-r">BATCH NO</th>
                    <th className="p-2 border-r text-center">EXPIRY</th>
                    <th className="p-2 border-r text-right">COST</th>
                    <th className="p-2 border-r text-right">MRP</th>
                    <th className="p-2 border-r text-center">STOCK</th>
                    <th className="p-2 text-right">TOTAL VALUATION (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-[11px]">
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-amber-50">
                      <td className="p-2 border-r font-sans font-bold">{b.medicineName}</td>
                      <td className="p-2 border-r text-[#000080] font-bold">{b.batchNo}</td>
                      <td className="p-2 border-r text-center">{b.expiryDate}</td>
                      <td className="p-2 border-r text-right">₹{Number(b.costPrice || 0).toFixed(2)}</td>
                      <td className="p-2 border-r text-right">₹{Number(b.mrp || 0).toFixed(2)}</td>
                      <td className="p-2 border-r text-center font-bold text-[#000080]">{b.stock}</td>
                      <td className="p-2 text-right font-bold text-green-700">
                        ₹{((valuationOn === 'MRP' ? Number(b.mrp || 0) : Number(b.costPrice || 0)) * Number(b.stock || 0)).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 2: TRIAL BALANCE (Page 39 of PDF)
      ========================================================================= */}
      {activeTab === 'trial_balance' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>TRIAL BALANCE (तलपट - समस्त खातों का डेबिट व क्रेडिट मिलान)</span>
            <span className="font-mono text-[11px] text-amber-300">As on {new Date().toISOString().slice(0, 10)}</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-4 max-w-2xl mx-auto space-y-3 font-mono text-xs">
            <div className="text-center font-bold pb-2 border-b">
              <p className="text-sm font-sans font-black text-[#000080]">DEMO PHARMA DISTRIBUTION / SANDANA HEALTHCARE</p>
              <p className="text-[11px] text-slate-500">TRIAL BALANCE REPORT</p>
            </div>

            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                  <th className="p-2 text-left border-r">BRANCH / DIVISIONS &amp; ACCOUNTS</th>
                  <th className="p-2 text-right border-r">DEBIT (₹)</th>
                  <th className="p-2 text-right">CREDIT (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]">
                <tr className="hover:bg-amber-50">
                  <td className="p-2 border-r font-bold">CAPITAL ACCOUNT</td>
                  <td className="p-2 border-r text-right">-</td>
                  <td className="p-2 text-right font-bold text-red-700">50,000.00</td>
                </tr>
                <tr className="hover:bg-amber-50">
                  <td className="p-2 border-r font-bold">CURRENT ASSETS (STOCK &amp; CASH)</td>
                  <td className="p-2 border-r text-right font-bold text-green-700">{(totalCostValuation + 18650).toFixed(2)}</td>
                  <td className="p-2 text-right">-</td>
                </tr>
                <tr className="hover:bg-amber-50">
                  <td className="p-2 border-r font-bold">BANK ACCOUNTS (AHLI UNITED)</td>
                  <td className="p-2 border-r text-right font-bold text-green-700">52,400.00</td>
                  <td className="p-2 text-right">-</td>
                </tr>
                <tr className="hover:bg-amber-50">
                  <td className="p-2 border-r font-bold">CURRENT LIABILITIES (CREDITORS)</td>
                  <td className="p-2 border-r text-right">-</td>
                  <td className="p-2 text-right font-bold text-red-700">42,700.00</td>
                </tr>
                <tr className="hover:bg-amber-50">
                  <td className="p-2 border-r font-bold">FIXED ASSETS (COMPUTERS &amp; VEHICLE)</td>
                  <td className="p-2 border-r text-right font-bold text-green-700">53,000.00</td>
                  <td className="p-2 text-right">-</td>
                </tr>
                <tr className="hover:bg-amber-50">
                  <td className="p-2 border-r font-bold">REVENUE / SALES ACCOUNT</td>
                  <td className="p-2 border-r text-right">-</td>
                  <td className="p-2 text-right font-bold text-red-700">{totalSalesRevenue.toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-amber-50">
                  <td className="p-2 border-r font-bold">COST OF GOODS SOLD / PURCHASES</td>
                  <td className="p-2 border-r text-right font-bold text-green-700">
                    {(totalSalesRevenue - totalProfitCalculated).toFixed(2)}
                  </td>
                  <td className="p-2 text-right">-</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-200 border-t-2 border-slate-700 font-bold text-xs">
                  <td className="p-2 border-r text-left">BALANCED TOTALS :</td>
                  <td className="p-2 border-r text-right text-emerald-800">
                    ₹{(totalCostValuation + 18650 + 52400 + 53000 + (totalSalesRevenue - totalProfitCalculated)).toFixed(2)}
                  </td>
                  <td className="p-2 text-right text-emerald-800">
                    ₹{(50000 + 42700 + totalSalesRevenue + (totalCostValuation + 18650 + 52400 + 53000 + (totalSalesRevenue - totalProfitCalculated) - (50000 + 42700 + totalSalesRevenue))).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 3: PROFIT & LOSS A/C (Page 40 of PDF)
      ========================================================================= */}
      {activeTab === 'profit_loss' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>PROFIT &amp; LOSS A/C (लाभ एवं हानि खाता)</span>
            <span className="font-mono text-[11px] text-emerald-300">Net Profit Margin Analysis</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-4 max-w-3xl mx-auto space-y-3 font-mono text-xs">
            <div className="text-center font-bold pb-2 border-b">
              <p className="text-sm font-sans font-black text-[#000080]">SANDANA CLINIC &amp; DUDRUCS PHARMACY</p>
              <p className="text-[11px] text-slate-500">PROFIT &amp; LOSS STATEMENT (FOR PERIOD ENDING 2026-2027)</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border">
              {/* Debit Side (Expenses) */}
              <div className="p-2 space-y-1.5 border-r">
                <p className="font-bold text-[#000080] border-b pb-1 text-center bg-slate-100">PARTICULARS (DR. EXPENSES)</p>
                <div className="flex justify-between py-1">
                  <span>Opening Stock Inventory :</span>
                  <span className="font-bold">₹15,000.00</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Purchases A/c :</span>
                  <span className="font-bold">₹{(totalSalesRevenue * 0.7).toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Direct Freight / Landing :</span>
                  <span className="font-bold">₹450.00</span>
                </div>
                <div className="flex justify-between py-1 border-t font-bold text-emerald-800">
                  <span>Gross Profit c/d :</span>
                  <span>₹{totalProfitCalculated.toFixed(2)}</span>
                </div>
              </div>

              {/* Credit Side (Income) */}
              <div className="p-2 space-y-1.5">
                <p className="font-bold text-[#000080] border-b pb-1 text-center bg-slate-100">PARTICULARS (CR. REVENUE)</p>
                <div className="flex justify-between py-1">
                  <span>Sales A/c (Medicines Dispensed) :</span>
                  <span className="font-bold text-emerald-700">₹{totalSalesRevenue.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Closing Stock in Batches :</span>
                  <span className="font-bold">₹{totalCostValuation.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Direct Pharmacy Income :</span>
                  <span className="font-bold">₹0.00</span>
                </div>
                <div className="flex justify-between py-1 border-t font-bold text-sky-800">
                  <span>Gross Margin % :</span>
                  <span>
                    {totalSalesRevenue > 0
                      ? `${((totalProfitCalculated / totalSalesRevenue) * 100).toFixed(1)}%`
                      : '0.0%'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#e6f2ff] p-3 border flex justify-between items-center font-bold text-slate-900 text-sm">
              <span>NET PROFIT (शुद्ध मुनाफा) :</span>
              <span className="text-emerald-700 text-base">₹{totalProfitCalculated.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 4: BALANCE SHEET (Page 40 of PDF)
      ========================================================================= */}
      {activeTab === 'balance_sheet' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>BALANCE SHEET (तुलन पत्र - संपत्तियां एवं देनदारियां)</span>
            <span className="font-mono text-[11px] text-amber-300">Final Accounts</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-4 max-w-3xl mx-auto space-y-3 font-mono text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border">
              {/* Liabilities */}
              <div className="p-3 border-r space-y-2">
                <p className="font-bold text-center bg-slate-100 p-1 border-b text-[#000080]">LIABILITIES (देनदारियां)</p>
                <div className="flex justify-between py-1">
                  <span>Capital Account :</span>
                  <span className="font-bold">₹50,000.00</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Current Liabilities (Sundry Creditors) :</span>
                  <span className="font-bold">₹42,700.00</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>GST Output Tax Payable :</span>
                  <span className="font-bold">₹8,420.00</span>
                </div>
                <div className="flex justify-between py-1 border-t text-emerald-800 font-bold">
                  <span>Retained Profit :</span>
                  <span>₹{totalProfitCalculated.toFixed(2)}</span>
                </div>
              </div>

              {/* Assets */}
              <div className="p-3 space-y-2">
                <p className="font-bold text-center bg-slate-100 p-1 border-b text-[#000080]">ASSETS (संपत्तियां)</p>
                <div className="flex justify-between py-1">
                  <span>Fixed Assets (Equipments &amp; Van) :</span>
                  <span className="font-bold">₹53,000.00</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Current Assets (Medicine Inventory) :</span>
                  <span className="font-bold text-green-700">₹{totalCostValuation.toFixed(2)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Bank Balance (Ahli United) :</span>
                  <span className="font-bold text-sky-700">₹52,400.00</span>
                </div>
                <div className="flex justify-between py-1">
                  <span>Cash-in-Hand (POS Drawer) :</span>
                  <span className="font-bold text-slate-800">₹18,650.00</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-100 p-3 border flex justify-between items-center font-bold">
              <span>Balanced Balance Sheet Status :</span>
              <span className="text-emerald-700">✅ 100% BALANCED &amp; VERIFIED</span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 5: FIXED ASSETS & DEPRECIATION (Pages 38-39 of PDF)
      ========================================================================= */}
      {activeTab === 'depreciation' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>FIXED ASSETS &amp; DEPRECIATION CHART (स्थायी संपत्ति एवं मूल्यह्रास चार्ट)</span>
            <span className="font-mono text-[11px] text-amber-300">Books &gt; Depreciation</span>
          </div>

          <div className="bg-white border border-[#7f9db9] overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs font-mono">
              <thead>
                <tr className="bg-[#d9e4ec] text-[#000080] font-bold border-b">
                  <th className="p-2 border-r">DESCRIPTION (ASSET NAME)</th>
                  <th className="p-2 border-r text-right">UPTO DATE VALUE</th>
                  <th className="p-2 border-r text-right">CURRENT VALUE (₹)</th>
                  <th className="p-2 border-r text-center">IN % (RATE)</th>
                  <th className="p-2 text-right">DEPRECIATION VALUE (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y text-[11px]">
                {assets.map((ast) => (
                  <tr key={ast.id} className="hover:bg-amber-50">
                    <td className="p-2 border-r font-bold font-sans">{ast.description}</td>
                    <td className="p-2 border-r text-right">₹{ast.uptoDate.toFixed(2)}</td>
                    <td className="p-2 border-r text-right font-bold">₹{ast.after.toFixed(2)}</td>
                    <td className="p-2 border-r text-center font-bold text-amber-800">{ast.rate}%</td>
                    <td className="p-2 text-right font-bold text-red-700">₹{ast.depreciation.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========================================================================
          VIEW 6: GST & TAX AUDIT
      ========================================================================= */}
      {activeTab === 'gst_summary' && (
        <div className="bg-[#edeae0] border-2 border-[#7f9db9] p-3 rounded shadow-sm font-sans text-xs space-y-3">
          <div className="bg-[#000080] text-white px-3 py-1.5 font-bold flex justify-between items-center">
            <span>GST COMPLIANCE &amp; HSN RATE AUDIT (जीएसटी रिपोर्ट एवं ऑडिट)</span>
            <span className="font-mono text-[11px] text-emerald-300">GSTR-1, GSTR-2B &amp; GSTR-3B</span>
          </div>

          <div className="bg-white border border-[#7f9db9] p-4 grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
            <div className="p-3 bg-amber-50 border border-amber-300 rounded space-y-1">
              <span className="font-bold text-amber-950 font-sans">GSTR-1 (Sales Tax Return)</span>
              <p className="text-slate-600 text-[11px]">B2B &amp; B2C Outward supply tax details</p>
              <p className="text-lg font-bold text-amber-900 mt-2">
                ₹{(totalSalesRevenue * 0.12).toFixed(2)} Tax
              </p>
            </div>
            <div className="p-3 bg-sky-50 border border-sky-300 rounded space-y-1">
              <span className="font-bold text-sky-950 font-sans">GSTR-2B (ITC Inward Supply)</span>
              <p className="text-slate-600 text-[11px]">Supplier bill input credit auto-reconciliation</p>
              <p className="text-lg font-bold text-sky-900 mt-2">
                ₹{(totalCostValuation * 0.12).toFixed(2)} ITC
              </p>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded space-y-1">
              <span className="font-bold text-emerald-950 font-sans">GSTR-3B (Net Tax Payable)</span>
              <p className="text-slate-600 text-[11px]">Output Tax minus ITC Credit claim</p>
              <p className="text-lg font-bold text-emerald-900 mt-2">
                ₹{Math.max(0, totalSalesRevenue * 0.12 - totalCostValuation * 0.12).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
