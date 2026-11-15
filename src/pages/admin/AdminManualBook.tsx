import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Printer,
  Download,
  BookOpen,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Search,
  Building2,
  Pill,
  Users,
  Stethoscope,
  ClipboardList,
  ShieldCheck,
  Receipt,
  CreditCard,
  QrCode,
  CalendarCheck,
  ArrowRight,
  Clock,
  Sparkles,
  HelpCircle,
  Info,
  FileText,
  Camera,
  Laptop,
  KeyRound,
  Eye,
  RefreshCw,
  DatabaseBackup,
  Layers,
  FileCheck,
  PhoneCall,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { printElementById, openPrintWindow } from '../../utils/printEngine';

export const AdminManualBook: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'all' | 'overview' | 'pharmacy' | 'admin' | 'reception' | 'doctor' | 'faq'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadProgressText, setDownloadProgressText] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const toggleSection = (id: string) => {
    setCollapsedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const expandAll = () => setCollapsedSections({});
  const collapseAll = () => {
    setCollapsedSections({
      ch1: true,
      ch2_1: true,
      ch2_2: true,
      ch2_3: true,
      ch2_4: true,
      ch2_5: true,
      ch2_6: true,
      ch2_7: true,
      ch2_8: true,
      ch3: true,
      ch4: true,
      ch5: true,
      ch6: true,
    });
  };

  const handleDownloadPdf = () => {
    setIsDownloadingPdf(true);
    setDownloadProgressText('PDF फाइल सीधे आपके कंप्यूटर पर डाउनलोड हो रही है... (Downloading Sandana_Hospital_Operations_Manual_2026.pdf)');
    
    try {
      const link = document.createElement('a');
      link.href = '/api/manual/download-pdf';
      link.setAttribute('download', 'Sandana_Hospital_Operations_Manual_2026.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setTimeout(() => {
        setIsDownloadingPdf(false);
        setDownloadSuccess(true);
        setDownloadProgressText(null);
        setTimeout(() => setDownloadSuccess(false), 7000);
      }, 1500);
    } catch (err) {
      console.warn('Fallback to native print:', err);
      window.open('/api/manual/download-pdf', '_blank');
      setIsDownloadingPdf(false);
    }
  };

  const handleOpenPrintWindow = () => {
    expandAll();
    setActiveTab('all');
    setTimeout(() => {
      openPrintWindow('manual-book-document', 'Sandana_Hospital_Operations_Manual_2026');
    }, 250);
  };

  const handlePrint = () => {
    expandAll();
    setActiveTab('all');
    setTimeout(() => {
      window.print();
    }, 250);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-16 print:bg-white print:p-0 print:pb-0">
      {/* =========================================================================
          TOP ACTION BAR (Screen Only - Hidden in Print)
      ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-300 shadow-sm print:hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-sky-700 flex items-center justify-center text-white shadow-md">
              <BookOpen size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  अस्पताल संचालन निर्देशिका एवं प्रशिक्षण पुस्तक
                </h1>
                <span className="px-2 py-0.5 text-[11px] font-extrabold uppercase bg-emerald-100 text-emerald-800 rounded-full border border-emerald-300">
                  Official Manual 2026
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Complete Operating Guide, Step-by-Step SOPs &amp; User Manual (Hindi &amp; English)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="खोजें / Search topics..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg w-44 sm:w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
              />
            </div>

            {/* Quick Actions */}
            <button
              onClick={expandAll}
              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 cursor-pointer"
              title="Expand All Chapters"
            >
              सभी खोलें
            </button>
            <button
              onClick={collapseAll}
              className="px-2.5 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg border border-slate-300 cursor-pointer"
              title="Collapse All Chapters"
            >
              सभी समेटें
            </button>

            {/* Direct Download PDF File Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs sm:text-sm font-black rounded-xl shadow-md hover:shadow-lg inline-flex items-center gap-2 transition-all cursor-pointer transform active:scale-95 disabled:opacity-50"
              title="पूरा ऑपरेटिंग मैन्युअल PDF फाइल के रूप में तुरंत डाउनलोड करें"
            >
              <Download size={16} className={isDownloadingPdf ? 'animate-bounce text-amber-300' : ''} />
              <span>
                {isDownloadingPdf ? '⏳ PDF तैयार हो रही है...' : '⬇️ PDF डाउनलोड करें (Download PDF)'}
              </span>
            </button>

            {/* Print / System Dialog Button */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isDownloadingPdf}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
              title="ब्राउज़र प्रिंट डायलॉग या A4 पेपर प्रिंट खोलें"
            >
              <Printer size={15} />
              <span>🖨️ प्रिंट करें</span>
            </button>

            {/* Open in Separate Tab / Window */}
            <button
              type="button"
              onClick={handleOpenPrintWindow}
              className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-800 text-xs sm:text-sm font-bold rounded-xl border border-slate-300 inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
              title="पूरा मैन्युअल नई विंडो में खोलें"
            >
              <ExternalLink size={14} />
              <span>अलग विंडो</span>
            </button>

            <Link
              to="/admin"
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 transition-colors"
            >
              एडमिन डैशबोर्ड ↩
            </Link>
          </div>
        </div>

        {/* Download Progress / Success Banner */}
        {downloadProgressText && (
          <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-black flex items-center justify-center gap-2 animate-pulse border-y border-amber-600 shadow-inner">
            <RefreshCw size={14} className="animate-spin" />
            <span>{downloadProgressText}</span>
          </div>
        )}

        {downloadSuccess && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-black flex items-center justify-center gap-2 animate-fade-in shadow-md">
            <CheckCircle2 size={16} className="text-emerald-200" />
            <span>
              🎉 PDF फाइल सफलतापूर्वक डाउनलोड हो गई है! (File saved: Sandana_Hospital_Operations_Manual_2026.pdf)
            </span>
          </div>
        )}

        {/* Chapter Quick Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-1.5 flex items-center gap-1.5 overflow-x-auto text-xs font-medium border-t border-slate-200">
          <span className="text-slate-400 shrink-0 font-bold uppercase text-[10px] mr-1">अध्याय:</span>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white font-bold shadow-xs'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            संपूर्ण पुस्तक (All)
          </button>
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-sky-700 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            1. सिस्टम ओवरव्यू
          </button>
          <button
            onClick={() => setActiveTab('pharmacy')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'pharmacy'
                ? 'bg-emerald-700 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            2. फार्मेसी पैनल (सारे ऑप्शन)
          </button>
          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'admin'
                ? 'bg-purple-700 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            3. एडमिन पैनल
          </button>
          <button
            onClick={() => setActiveTab('reception')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'reception'
                ? 'bg-teal-700 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            4. रिसेप्शन पैनल
          </button>
          <button
            onClick={() => setActiveTab('doctor')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'doctor'
                ? 'bg-blue-700 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            5. डॉक्टर ओपीडी पैनल
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-3 py-1 rounded-md transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'faq'
                ? 'bg-amber-700 text-white font-bold'
                : 'text-slate-600 hover:bg-slate-200'
            }`}
          >
            6. सवाल-जवाब व हेल्प
          </button>
        </div>
      </header>

      {/* =========================================================================
          PRINT STYLING (Custom CSS inside component for perfect A4 book printing)
      ========================================================================= */}
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 14mm 14mm 14mm;
          }
          body {
            background-color: #ffffff !important;
            color: #0f172a !important;
            font-size: 11pt !important;
            line-height: 1.4 !important;
          }
          .page-break-before {
            page-break-before: always !important;
            break-before: page !important;
          }
          .avoid-break {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          nav, header, footer, .print-hide {
            display: none !important;
          }
          .book-container {
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
          }
          .print-border {
            border: 1px solid #cbd5e1 !important;
          }
          .print-header {
            display: block !important;
          }
        }
      `}</style>

      {/* =========================================================================
          MAIN BOOK CONTAINER
      ========================================================================= */}
      <main id="manual-book-document" className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-8 book-container">

        {/* -----------------------------------------------------------------------
            BOOK COVER / FRONT MATTER
        ------------------------------------------------------------------------ */}
        <div className="bg-gradient-to-br from-slate-900 via-sky-950 to-emerald-950 text-white rounded-2xl p-6 sm:p-10 shadow-xl relative overflow-hidden border border-slate-800 avoid-break">
          <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute left-1/3 bottom-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-400/30 rounded-full text-emerald-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles size={14} />
                <span>अस्पताल एवं फार्मेसी प्रबंधन प्रणाली (HMS &amp; Marg ERP 9+)</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
                संपूर्ण संचालन निर्देशिका एवं प्रशिक्षण पुस्तक
              </h1>
              <p className="text-sm sm:text-base text-slate-300 max-w-2xl font-normal leading-relaxed">
                चारों प्रमुख पोर्टल्स (फार्मेसी, एडमिन, रिसेप्शन, डॉक्टर ओपीडी) का सरल हिंदी एवं तकनीकी अंग्रेजी में सचित्र, चरण-दर-चरण मार्गदर्शन।
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs text-slate-300">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-emerald-400" />
                  अधिकृत एडमिन एवं स्टाफ प्रशिक्षण दस्तावेज
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-sky-400" />
                  नवीनतम अपडेट: 2026 (Live Release)
                </span>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4 text-center shrink-0 w-full md:w-60 avoid-break space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">PDF डाउनलोड व प्रिंट</p>
              <p className="text-xs text-slate-200">
                पूरी किताब को PDF फाइल के रूप में डाउनलोड करें या A4 प्रिंट निकालें
              </p>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-black text-xs rounded-lg shadow-md transition-all inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Download size={15} className={isDownloadingPdf ? 'animate-bounce' : ''} />
                <span>{isDownloadingPdf ? 'PDF तैयार हो रहा है...' : '⬇️ Download PDF Manual'}</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="w-full py-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs rounded-lg border border-white/20 transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer size={13} />
                <span>🖨️ Print / A4 Paper</span>
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="mt-8 pt-6 border-t border-white/15 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xl sm:text-2xl font-mono font-bold text-emerald-400">4+</p>
              <p className="text-xs text-slate-300 font-medium">समर्पित पोर्टल्स</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xl sm:text-2xl font-mono font-bold text-sky-400">100%</p>
              <p className="text-xs text-slate-300 font-medium">सचित्र स्टेप-बाय-स्टेप</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xl sm:text-2xl font-mono font-bold text-purple-400">RBAC</p>
              <p className="text-xs text-slate-300 font-medium">सुरक्षित रोल-बेस्ड लॉगिन</p>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <p className="text-xl sm:text-2xl font-mono font-bold text-amber-400">Marg 9+</p>
              <p className="text-xs text-slate-300 font-medium">फुल फार्मेसी इन्वेंटरी</p>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------------
            TABLE OF CONTENTS / अनुक्रमणिका
        ------------------------------------------------------------------------ */}
        <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm avoid-break">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 border-b border-slate-200 pb-3">
            <ClipboardList size={18} className="text-emerald-600" />
            <span>पुस्तक अनुक्रमणिका (Table of Contents)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 text-xs">
            <div className="space-y-2">
              <a
                href="#chapter-1"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
              >
                <span className="font-bold text-slate-800">अध्याय 1: सिस्टम ओवरव्यू एवं समग्र कार्यप्रवाह</span>
                <span className="text-slate-400 font-mono">पृष्ठ 02</span>
              </a>
              <a
                href="#chapter-2"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-emerald-50/50 border border-emerald-200 transition-colors"
              >
                <span className="font-bold text-emerald-800">अध्याय 2: फार्मेसी पैनल संपूर्ण गाइड (Marg ERP 9+ के सारे विकल्प सचित्र)</span>
                <span className="text-emerald-600 font-bold font-mono">पृष्ठ 03</span>
              </a>
              <div className="pl-4 space-y-1 text-slate-600">
                <p>• 2.1 Marg ERP 9+ शीर्ष मेनू बार परिचय (14 मेनू का सचित्र अवलोकन)</p>
                <p>• 2.2 दायां मेनू बार के 17 त्वरित विकल्प (Right Sidebar 17 Actions)</p>
                <p>• 2.3 मास्टर मेनू (Masters: Item, Batch, Ledger, Rate &amp; Marg Setup)</p>
                <p>• 2.4 ट्रांजैक्शन मेनू (Transactions: Sale POS Alt+N, Purc. Challan, S/R, P/R)</p>
                <p>• 2.5 अकाउंट्स मेनू (Accounts: Receipt, Payment, Cash &amp; Bank, Ledger, Outstanding)</p>
                <p>• 2.6 डिजिटल सर्विसेज (Digital: Dynamic UPI QR, WhatsApp/SMS Sharing)</p>
                <p>• 2.7 बुक्स व अंतिम वित्तीय रिपोर्ट (Books, P&amp;L, Balance Sheet, Trading A/c)</p>
                <p>• 2.8 जीएसटी ऑडिट व ई-वे बिल (GST GSTR-1/2B/3B, HSN &amp; e-Way Bill)</p>
                <p>• 2.9 स्टॉक्स व इन्वेंटरी (Stocks: FIFO Batch, 90-दिन एक्सपायरी, री-ऑर्डर लिस्ट)</p>
                <p>• 2.10 दैनिक रिपोर्ट्स व प्रबंधन एमआईएस (Daily MIS, Sales Book, Gross Profit)</p>
                <p>• 2.11 हॉट कीज तालिका व की-बोर्ड शॉर्टकट (Hot Keys: Alt+N, Alt+P, F1, F2, F10, Esc)</p>
              </div>
            </div>

            <div className="space-y-2">
              <a
                href="#chapter-3"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
              >
                <span className="font-bold text-slate-800">अध्याय 3: एडमिन पैनल संपूर्ण गाइड</span>
                <span className="text-slate-400 font-mono">पृष्ठ 08</span>
              </a>
              <a
                href="#chapter-4"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
              >
                <span className="font-bold text-slate-800">अध्याय 4: रिसेप्शन पैनल संपूर्ण गाइड</span>
                <span className="text-slate-400 font-mono">पृष्ठ 11</span>
              </a>
              <a
                href="#chapter-5"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
              >
                <span className="font-bold text-slate-800">अध्याय 5: डॉक्टर ओपीडी पैनल व डिजिटल पर्ची</span>
                <span className="text-slate-400 font-mono">पृष्ठ 13</span>
              </a>
              <a
                href="#chapter-6"
                className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 border border-slate-200 transition-colors"
              >
                <span className="font-bold text-slate-800">अध्याय 6: मुख्य की-बोर्ड शॉर्टकट व अक्सर पूछे जाने वाले सवाल</span>
                <span className="text-slate-400 font-mono">पृष्ठ 16</span>
              </a>
            </div>
          </div>
        </div>

        {/* -----------------------------------------------------------------------
            CHAPTER 1: SYSTEM OVERVIEW & ARCHITECTURE
        ------------------------------------------------------------------------ */}
        {(activeTab === 'all' || activeTab === 'overview') && (
          <section id="chapter-1" className="space-y-4 page-break-before">
            <div className="bg-sky-900 text-white p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-sky-700 flex items-center justify-center font-bold text-sm">
                  1
                </span>
                <div>
                  <h2 className="text-lg font-black tracking-tight">
                    अध्याय 1: सिस्टम ओवरव्यू एवं समग्र कार्यप्रवाह (End-to-End Workflow)
                  </h2>
                  <p className="text-xs text-sky-200">
                    मरीज के क्लीनिक में आने से लेकर दवा मिलने तक की संपूर्ण डिजिटल प्रक्रिया
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-5">
              <p className="text-sm leading-relaxed text-slate-700">
                यह हॉस्पिटल एवं फार्मेसी मैनेजमेंट सिस्टम एक संयुक्त प्लेटफॉर्म है जिसे विशेष रूप से ओपीडी क्लीनिकों, डॉक्टरों, दवा दुकानों और प्रबंधकों के दैनिक कार्यों को तेज, पारदर्शी और सटीक बनाने के लिए डिजाइन किया गया है।
              </p>

              {/* Visual Flow Diagram */}
              <div className="border border-sky-200 bg-sky-50/50 rounded-xl p-4 space-y-3 avoid-break">
                <h3 className="text-xs font-bold uppercase tracking-wider text-sky-900 flex items-center gap-2">
                  <Layers size={16} className="text-sky-700" />
                  <span>मरीज का 5-चरणीय चक्र (Patient Clinical Lifecycle Diagram)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="bg-white p-3 rounded-lg border border-sky-300 shadow-xs flex flex-col justify-between">
                    <span className="w-6 h-6 mx-auto rounded-full bg-sky-600 text-white font-bold text-xs flex items-center justify-center">1</span>
                    <p className="font-bold text-slate-800 mt-2">मरीज का आगमन</p>
                    <p className="text-[11px] text-slate-500 mt-1">ऑनलाइन बुकिंग या सीधे रिसेप्शन डेस्क</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-teal-300 shadow-xs flex flex-col justify-between">
                    <span className="w-6 h-6 mx-auto rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center">2</span>
                    <p className="font-bold text-slate-800 mt-2">रिसेप्शन व टोकन</p>
                    <p className="text-[11px] text-slate-500 mt-1">पंजीकरण, डॉक्टर चयन, पर्ची व टोकन प्रिंट</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-blue-300 shadow-xs flex flex-col justify-between">
                    <span className="w-6 h-6 mx-auto rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center">3</span>
                    <p className="font-bold text-slate-800 mt-2">डॉक्टर परामर्श (OPD)</p>
                    <p className="text-[11px] text-slate-500 mt-1">जांच, वाइटल्स, हाथ से लिखी या डिजिटल पर्ची</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-emerald-300 shadow-xs flex flex-col justify-between">
                    <span className="w-6 h-6 mx-auto rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">4</span>
                    <p className="font-bold text-slate-800 mt-2">फार्मेसी व बिलिंग</p>
                    <p className="text-[11px] text-slate-500 mt-1">दवा वितरण, बारकोड स्कैन, रसीद प्रिंट, पेमेंट</p>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-purple-300 shadow-xs flex flex-col justify-between">
                    <span className="w-6 h-6 mx-auto rounded-full bg-purple-600 text-white font-bold text-xs flex items-center justify-center">5</span>
                    <p className="font-bold text-slate-800 mt-2">एडमिन ऑडिट</p>
                    <p className="text-[11px] text-slate-500 mt-1">दैनिक कमाई, ग्रॉस प्रॉफिट, क्लाउड बैकअप</p>
                  </div>
                </div>

                {/* Website Header & Portal Login Access */}
                <div className="mt-2 border border-sky-300 rounded-lg overflow-hidden bg-white shadow-xs">
                  <div className="bg-sky-100 px-3 py-1 flex items-center justify-between text-[11px] font-bold text-sky-900 border-b border-sky-200">
                    <span>सचित्र इंटरफेस: वेबसाइट का मुख्य नेविगेशन बार एवं पोर्टल लॉगिन प्रवेश द्वार (Portal Login)</span>
                    <span className="text-[10px] text-sky-600 font-mono">Navbar</span>
                  </div>
                  <div className="p-1.5 flex justify-center bg-slate-900">
                    <img
                      src="/assets/aistudio/image_4186a118.png"
                      alt="Website Navigation Bar and Portal Login"
                      className="max-h-16 w-auto object-contain rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Security & Access Policy */}
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 text-xs space-y-2 avoid-break">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <ShieldCheck size={16} className="text-amber-700" />
                  <span>रोल-बेस्ड सुरक्षा नियम (Role-Based Access Control):</span>
                </div>
                <p className="text-amber-800 leading-relaxed">
                  प्रत्येक स्टाफ सदस्य को केवल एडमिन पैनल द्वारा ही यूनिक लॉगिन आईडी (ईमेल) और पासवर्ड दिया जाता है। कोई भी कर्मचारी किसी अन्य पैनल में प्रवेश नहीं कर सकता। उदाहरण के लिए:
                </p>
                <ul className="list-disc list-inside space-y-1 text-slate-700 font-medium">
                  <li><strong>फार्मासिस्ट:</strong> केवल फार्मेसी इन्वेंटरी, दवा बिलिंग और स्टॉक रिपोर्ट्स देख सकता है।</li>
                  <li><strong>डॉक्टर:</strong> केवल अपने संबंधित चैम्बर में बुक मरीजों की ओपीडी कतार व पर्ची बना सकता है।</li>
                  <li><strong>रिसेप्शनिस्ट:</strong> मरीज का पंजीकरण, टोकन निकालना और डॉक्टर अपॉइंटमेंट बुक कर सकता है।</li>
                  <li><strong>सुपर एडमिन:</strong> पूरे अस्पताल का वित्तीय हिसाब, डॉक्टर व स्टाफ आईडी बनाने का एकमात्र अधिकार।</li>
                </ul>

                {/* Staff & Admin Login Screen Reference */}
                <div className="mt-3 border border-amber-300 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-amber-100 px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-amber-950 border-b border-amber-200">
                    <span>सचित्र इंटरफेस: स्टाफ व एडमिन लॉगिन पोर्टल (Role-Based Login Authentication)</span>
                    <span className="text-[10px] text-amber-700 font-mono">/login</span>
                  </div>
                  <div className="p-2 bg-slate-50 flex justify-center">
                    <img
                      src="/assets/aistudio/image_7892dea9.png"
                      alt="Staff & Admin Portal Login Screen"
                      className="max-h-64 w-auto rounded border border-slate-200 object-contain shadow-xs"
                    />
                  </div>
                </div>

                {/* Public Website Interface Screenshot */}
                <div className="mt-3 border border-sky-300 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-sky-100 px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-sky-950 border-b border-sky-200">
                    <span>सचित्र इंटरफेस: ऑनलाइन मरीज ओपीडी बुकिंग पोर्टल एवं डिजिटल सेवा केंद्र</span>
                    <span className="text-[10px] text-sky-700 font-mono">Public Portal</span>
                  </div>
                  <div className="p-2 bg-slate-50 flex justify-center">
                    <img
                      src="/assets/aistudio/image_1d776de9.png"
                      alt="Patient Online Booking & Consultation Portal"
                      className="max-h-64 w-auto rounded border border-slate-200 object-contain shadow-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* -----------------------------------------------------------------------
            CHAPTER 2: PHARMACY PANEL - EVERY OPTION EXPLAINED (DEEP DIVE)
        ------------------------------------------------------------------------ */}
        {(activeTab === 'all' || activeTab === 'pharmacy') && (
          <section id="chapter-2" className="space-y-5 page-break-before">
            {/* Chapter Header */}
            <div className="bg-emerald-900 text-white p-5 rounded-2xl flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-emerald-700 flex items-center justify-center font-black text-base shadow">
                  2
                </span>
                <div>
                  <h2 className="text-xl font-black tracking-tight">
                    अध्याय 2: फार्मेसी पैनल संपूर्ण गाइड - Marg ERP 9+ (All Options &amp; Menus Deep Dive)
                  </h2>
                  <p className="text-xs text-emerald-200 mt-0.5">
                    मास्टर्स, ट्रांजैक्शन, अकाउंट्स, बुक्स, जीएसटी, स्टॉक्स व हॉट कीज का विस्तृत सचित्र, चरण-दर-चरण यूजर गाइड
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline px-3.5 py-1.5 bg-emerald-800 text-emerald-200 text-xs font-black rounded-full border border-emerald-700">
                Marg ERP 9+ Professional
              </span>
            </div>

            {/* -------------------------------------------------------------
                2.1 TOP MENU BAR (14 MAIN MENUS) - USER ATTACHMENT HIGHLIGHT
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <Laptop size={17} className="text-emerald-700" />
                  <span>2.1 Marg ERP 9+ शीर्ष मेनू बार परिचय (Top Menu Bar: 14 Modules Overview)</span>
                </h3>
                <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-300">
                  Header Menu Navigation
                </span>
              </div>

              {/* User Attached Screen Header Image */}
              <div className="border border-emerald-400 rounded-xl overflow-hidden shadow-sm bg-slate-50">
                <div className="bg-emerald-700 text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold">
                  <span>सचित्र इंटरफेस: Marg ERP 9+ मुख्य मेनू बार (Top Menu Strip)</span>
                  <span className="text-[10px] text-emerald-200 font-mono">Masters | Transactions | Accounts | Digital | Books | Final Reports | Gst | e-Way | Stocks | Daily Reports | Reports | Hot Keys | Links | Exit</span>
                </div>
                <div className="p-2.5 bg-sky-50 flex justify-center">
                  <img
                    src="/assets/aistudio/image_4f1572d1.png"
                    alt="Marg ERP 9+ Top Menu Bar (Masters, Transactions, Accounts, Digital, Books, GST, Stocks, Hot Keys)"
                    className="max-h-20 w-auto rounded border border-slate-300 object-contain shadow-sm"
                  />
                </div>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                फार्मेसी के दैनिक संचालन के लिए Marg ERP 9+ मेनू बार में 14 प्रमुख वर्ग दिए गए हैं। प्रत्येक वर्ग का कार्य एवं उपयोग नीचे विस्तार से समझाया गया है:
              </p>

              {/* 14 Top Menus Breakdown Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">1</span>
                    <span>Masters (मास्टर मेनू)</span>
                  </p>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    दवाइयों के नाम, फॉर्मूला/साल्ट, HSN कोड, जीएसटी दरें, बैच नंबर, एक्सपायरी, डिस्ट्रीब्यूटर लेजर और अस्पताल सेटिंग्स को एक बार दर्ज व प्रबंधित करने का केंद्रीय स्थान।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">2</span>
                    <span>Transactions (लेन-देन मेनू)</span>
                  </p>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    दैनिक खरीद-बिक्री के सभी कार्य: काउंटर सेल (Alt+N), थोक खरीद चालान (Purchase Challan), मरीज से दवा वापसी (Sale Return S/R), और सप्लायर को डैमेज वापसी (P/R)।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50/50 space-y-1">
                  <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">3</span>
                    <span>Accounts (अकाउंट्स मेनू - वित्तीय लेखा-जोखा)</span>
                  </p>
                  <p className="text-emerald-900 leading-relaxed text-[11px]">
                    रसीद वाउचर (Receipt), सप्लायर भुगतान (Payment), दैनिक रोकड़ व बैंक बही (Cash &amp; Bank Book), खाता बही (Ledger A/c), बकाया उधारी (Outstanding), व कॉन्ट्रा वाउचर।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-sky-300 bg-sky-50/50 space-y-1">
                  <p className="font-bold text-sky-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-sky-700 text-white text-[11px] font-bold flex items-center justify-center">4</span>
                    <span>Digital (डिजिटल सर्विसेज)</span>
                  </p>
                  <p className="text-sky-900 leading-relaxed text-[11px]">
                    डायनामिक यूपीआई क्यूआर कोड (Dynamic QR), मरीज के मोबाइल पर व्हाट्सएप/एसएमएस द्वारा बिल भेजना, और नेटबैंकिंग/क्रेडिट कार्ड पेमेंट गेटवे एकीकरण।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">5</span>
                    <span>Books (बहीखाता / लेजर बुक्स)</span>
                  </p>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    रोकड़ बही (Cash Book), बैंक बही (Bank Book), जर्नल बही (Journal Book), लेजर बही (Ledger Book), और दिन भर के वाउचर्स की कालक्रमानुसार सूची (Day Book)।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-purple-200 bg-purple-50/40 space-y-1">
                  <p className="font-bold text-purple-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-purple-700 text-white text-[11px] font-bold flex items-center justify-center">6</span>
                    <span>Final Reports (अंतिम वित्तीय रिपोर्ट)</span>
                  </p>
                  <p className="text-purple-900 leading-relaxed text-[11px]">
                    वार्षिक व मासिक बैलेंस शीट (Balance Sheet), लाभ एवं हानि खाता (Profit &amp; Loss A/c), तलपट (Trial Balance), और व्यापार खाता (Trading Account)।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-amber-300 bg-amber-50/40 space-y-1">
                  <p className="font-bold text-amber-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-amber-700 text-white text-[11px] font-bold flex items-center justify-center">7</span>
                    <span>Gst (जीएसटी रिपोर्ट एवं ऑडिट)</span>
                  </p>
                  <p className="text-amber-900 leading-relaxed text-[11px]">
                    GSTR-1 (सेल इनवॉइस विवरण), GSTR-2B (परचेज इनपुट टैक्स क्रेडिट मिलान), GSTR-3B मासिक रिटर्न समरी, और दवा HSN टैक्स ऑडिट।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">8</span>
                    <span>e-Way (ई-वे बिल सिस्टम)</span>
                  </p>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    ₹50,000 से अधिक के थोक माल के परिवहन हेतु ई-वे बिल पार्ट-A व पार्ट-B जनरेशन, वाहन नंबर प्रविष्टि व सरकारी पोर्टल से सीधा सत्यापन।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-emerald-300 bg-emerald-50/40 space-y-1">
                  <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-emerald-700 text-white text-[11px] font-bold flex items-center justify-center">9</span>
                    <span>Stocks (स्टॉक इन्वेंटरी)</span>
                  </p>
                  <p className="text-emerald-900 leading-relaxed text-[11px]">
                    लाइव स्टॉक स्थिति (Stock Status), एफआईएफओ बैच ट्रैकिंग, 90-दिन एक्सपायरी चेतावनी, डंप/स्लो-मूविंग स्टॉक रिपोर्ट और री-ऑर्डर लिस्ट।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">10</span>
                    <span>Daily Reports &amp; MIS (दैनिक रिपोर्ट)</span>
                  </p>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    आज की कुल बिक्री, कुल नकद आवक, यूपीआई कलेक्शन, सेल्स बुक, डिस्पैच समरी, बिल टैगिंग, और आज का कुल सकल मुनाफा (Todays Gross Profit)।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">11</span>
                    <span>Reports (विस्तृत ऑडिट व विश्लेषण)</span>
                  </p>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    दवा-वार व डॉक्टर-वार बिक्री विश्लेषण, सप्लायर खरीद दर तुलना, फास्ट-मूविंग दवाओं की सूची और ऑपरेटर एक्टिविटी ऑडिट लॉग।
                  </p>
                </div>

                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded bg-slate-800 text-white text-[11px] font-bold flex items-center justify-center">12</span>
                    <span>Hot Keys &amp; Exit (शॉर्टकट व निकास)</span>
                  </p>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    Alt+N (सेल), Alt+P (प्रिंट), F1 (सर्च), F2 (आइटम), F10 (सेव), Esc (बैक) की-बोर्ड शॉर्टकट तालिका और सुरक्षित लॉगआउट।
                  </p>
                </div>
              </div>

              {/* Complete Pictorial Gallery of All 16 Authentic Marg ERP 9+ Menus & Entry Screens */}
              <div className="mt-4 pt-4 border-t border-slate-200 space-y-4">
                <div className="bg-emerald-950 text-white px-4 py-2.5 rounded-xl flex items-center justify-between">
                  <div>
                    <h4 className="text-xs sm:text-sm font-black">
                      📸 Marg ERP 9+ सभी मेनू, सब-मेनू एवं एंट्री स्क्रीन्स का सचित्र विवरण (All 16 Live Screens)
                    </h4>
                    <p className="text-[11px] text-emerald-200">
                      नीचे दिए गए सभी मेनू विकल्प और SALE ENTRY / PURCHASE CHALLAN ENTRY स्क्रीन फार्मेसी पोर्टल (/pharmacy) में हूबहू लाइव कार्यरत हैं:
                    </p>
                  </div>
                </div>

                {/* Highlight 0: Full-Screen Split SALE ENTRY + SALES HISTORY (image_3ede2b19.png) */}
                <div className="border-2 border-[#4b6b66] rounded-xl overflow-hidden bg-white shadow-sm avoid-break">
                  <div className="bg-[#4b6b66] text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold">
                    <span>
                      ★ पूर्ण-स्क्रीन SALE / PURCHASE ENTRY + SALES HISTORY [ Click to Copy ] (image_3ede2b19.png)
                    </span>
                    <span className="text-[10px] text-emerald-200 font-mono">
                      [Alt+N Sale] · [Alt+P Purchase + Excel Import] · [Esc Back]
                    </span>
                  </div>
                  <div className="p-2 bg-slate-100 flex justify-center">
                    <img
                      src="/assets/aistudio/image_3ede2b19.png"
                      alt="Marg ERP AI+ Full-Screen Sale Entry with Sales History and Inline Dark Green Cursor Bar"
                      className="max-h-80 w-auto object-contain rounded border border-slate-300"
                    />
                  </div>
                  <div className="p-3 text-[11px] text-slate-700 bg-emerald-50/70 border-t border-emerald-200 grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <p className="font-bold text-emerald-950">1. सीधी इनलाइन ग्रिड एंट्री (Direct Grid Entry):</p>
                      <p>
                        गहरे हरे रंग की पट्टी (<strong>&larr;key to change Bill No.</strong>) में सीधे दवा का नाम टाइप करें या <strong>Enter</strong> दबाकर सूची से चुनें, फिर <strong>PACK &rarr; BATCH &rarr; STRI &rarr; TAB. &rarr; M.R.P./S</strong> भरें।
                      </p>
                    </div>
                    <div>
                      <p className="font-bold text-emerald-950">2. Purchase में Excel डेटा इम्पोर्ट (.XLSX/.CSV):</p>
                      <p>
                        <strong>PURC (Alt+P)</strong> मोड में <strong>[Excel Import]</strong> बटन दबाकर सप्लायर की एक्सेल शीट अपलोड करें—सारा डेटा अपने आप इसी ग्रिड में मैन्युअल एंट्री की तरह भर जाएगा और स्टॉक अपडेट हो जाएगा।
                      </p>
                    </div>
                    <div>
                      <p className="font-bold text-emerald-950">3. Esc बैक बटन व नीचे का टूलबार:</p>
                      <p>
                        नीचे <strong>SALE | PURC | SC | PC | COPY | PASTE | SR | GST | RIO | BE | CASH | VOU | HOLD | PRES | EARN | SAVE</strong> के सारे बटन सक्रिय हैं और <strong>Esc</strong> दबाने पर तुरंत मुख्य डेस्कटॉप स्क्रीन पर वापस आ जाते हैं।
                      </p>
                    </div>
                  </div>
                </div>

                {/* Highlight 1: SALE ENTRY & PURCHASE CHALLAN ENTRY Full Screens */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="border-2 border-sky-400 rounded-xl overflow-hidden bg-white shadow-sm avoid-break">
                    <div className="bg-sky-900 text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold">
                      <span>1. SALE ENTRY स्क्रीन (Transactions ▸ Sale ▸ Bill ALT+N)</span>
                      <span className="text-[10px] text-sky-200 font-mono">SALE ENTRY.PNG</span>
                    </div>
                    <div className="p-2 bg-slate-100 flex justify-center">
                      <img
                        src="/assets/aistudio/SALE_ENTRY_f407e348.PNG"
                        alt="Marg ERP 9+ Sale Entry Screen"
                        className="max-h-64 w-auto object-contain rounded border border-slate-300"
                      />
                    </div>
                    <div className="p-2.5 text-[11px] text-slate-700 bg-sky-50/60 border-t border-sky-200 space-y-1">
                      <p className="font-bold text-sky-950">कैसे काम करता है (Step-by-Step):</p>
                      <p>• ऊपर <strong>Bill No., Date, Patient F2, Name, Address</strong> और <strong>Doctor F1</strong> दर्ज करें।</p>
                      <p>• नीली ग्रिड में <strong>PRODUCT | PACK | BATCH | STRI | TAB. | M.R.P./S | AMOUNT</strong> भरें और <strong>F10</strong> से सेव व प्रिंट करें।</p>
                    </div>
                  </div>

                  <div className="border-2 border-emerald-500 rounded-xl overflow-hidden bg-white shadow-sm avoid-break">
                    <div className="bg-emerald-900 text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold">
                      <span>2. PURCHASE CHALLAN ENTRY स्क्रीन (Transactions ▸ Purchase ▸ Challan)</span>
                      <span className="text-[10px] text-emerald-200 font-mono">PURCHASE CHALLAN ENTRY.PNG</span>
                    </div>
                    <div className="p-2 bg-slate-100 flex justify-center">
                      <img
                        src="/assets/aistudio/PURCHASE_CHALLAN_ENTRY_85e82830.PNG"
                        alt="Marg ERP 9+ Purchase Challan Entry Screen"
                        className="max-h-64 w-auto object-contain rounded border border-slate-300"
                      />
                    </div>
                    <div className="p-2.5 text-[11px] text-slate-700 bg-emerald-50/60 border-t border-emerald-200 space-y-1">
                      <p className="font-bold text-emerald-950">कैसे काम करता है (Step-by-Step):</p>
                      <p>• सप्लायर का <strong>Name, Date, Entry No., Party No</strong> दर्ज करें या <strong>Excel Import (.XLSX)</strong> करें।</p>
                      <p>• हरी ग्रिड में <strong>PRODUCT | PACK | BATCH | STRI | TAB. | FREE | P.RATE/S | DIS1% | AMOUNT</strong> भरकर सेव करें; स्टॉक तुरंत बढ़ जाएगा।</p>
                    </div>
                  </div>
                </div>

                {/* Highlight 2: All 14 Dropdown Menus & Sub-Menus Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {[
                    {
                      img: '/assets/aistudio/MASTER_27786562.PNG',
                      title: 'Masters मेनू',
                      desc: 'Ledger Master, Inventory Master, Account Groups, Rate & Discount Master, Marg Setups',
                    },
                    {
                      img: '/assets/aistudio/Transaction_5ec1150d.PNG',
                      title: 'Transactions मेनू',
                      desc: 'Sale, Purchase, Sale Return, Purchase Return, Brk/Exp, Stock Issue/Receive',
                    },
                    {
                      img: '/assets/aistudio/SALE_a59306aa.PNG',
                      title: 'Sale सब-मेनू (Submenu)',
                      desc: 'Bill (ALT+N), Challan, Counter Sale, Modify Bill (ALT+M), Cancel',
                    },
                    {
                      img: '/assets/aistudio/purchase_de7decda.PNG',
                      title: 'Purchase सब-मेनू',
                      desc: 'Bill (ALT+P), Challan, Return Without Bill, Modify Bill/Challan, Pending Orders',
                    },
                    {
                      img: '/assets/aistudio/Accounts_6922e673.PNG',
                      title: 'Accounts मेनू',
                      desc: 'Voucher Entry (ALT+V), Single Entry, Cheques/Cash, Bill Taging, Bank-Pay-In-Slip',
                    },
                    {
                      img: '/assets/aistudio/Digital_2d0656f7.PNG',
                      title: 'Digital मेनू',
                      desc: 'Connected Banking, Marg Wallet, MargPay, Healthcare QRCode, ABHA Ayushman Bharat',
                    },
                    {
                      img: '/assets/aistudio/Book_1490277f.PNG',
                      title: 'Books मेनू',
                      desc: 'Cash & Bank Book, All Ledgers (ALT+L), Purchase/Sale Register, Outstandings (ALT+O)',
                    },
                    {
                      img: '/assets/aistudio/Final_Report_de2b4b1a.PNG',
                      title: 'Final Reports मेनू',
                      desc: 'Trial Balance, Profit & Loss, Balance Sheet, Group Summary, Ratio Analysis',
                    },
                    {
                      img: '/assets/aistudio/Gst_7b03a7d7.PNG',
                      title: 'Gst मेनू',
                      desc: 'Generate eInvoice, GSTR 1, GSTR 2, GSTR 2A-2B Reconciliation, GSTR 3B, GSTR 9',
                    },
                    {
                      img: '/assets/aistudio/e-Way_fa6f1be2.PNG',
                      title: 'e-Way मेनू',
                      desc: 'Generate Individual/Consolidated, Update Vehicle/Transporter, Cancel EWAY Bill',
                    },
                    {
                      img: '/assets/aistudio/Stocks_2643524f.PNG',
                      title: 'Stocks मेनू',
                      desc: 'Current Stock (ALT+S), Filtered Stock, Today’s Re-Order, Expiry Stock, Batch Wise',
                    },
                    {
                      img: '/assets/aistudio/Daily_Reports_a6ee4e1a.PNG',
                      title: 'Daily Reports मेनू',
                      desc: 'Daily Working, Fast Reports, Business Analysis, Sale/Purchase/Inventory Reports',
                    },
                    {
                      img: '/assets/aistudio/Reports_25b48fa7.PNG',
                      title: 'Reports मेनू',
                      desc: 'Sale Analysis, Purchase Analysis, Inventory Analysis, Accounts Analysis, Management Report',
                    },
                    {
                      img: '/assets/aistudio/Hot_Keys_3e8b2705.PNG',
                      title: 'Hot Keys मेनू',
                      desc: 'Change Company (F1), Modify Bill (CTRL+F3), Item List (CTRL+I), Party List (CTRL+L)',
                    },
                  ].map((card, i) => (
                    <div
                      key={i}
                      className="border border-slate-300 rounded-lg overflow-hidden bg-white shadow-2xs flex flex-col justify-between avoid-break"
                    >
                      <div>
                        <div className="bg-slate-800 text-white px-2.5 py-1 text-[11px] font-bold truncate">
                          {card.title}
                        </div>
                        <div className="p-1.5 bg-slate-50 flex justify-center items-center h-36">
                          <img
                            src={card.img}
                            alt={card.title}
                            className="max-h-32 w-auto object-contain rounded border border-slate-200"
                          />
                        </div>
                      </div>
                      <p className="p-2 text-[10px] text-slate-600 bg-white border-t border-slate-100 leading-snug">
                        {card.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                2.2 RIGHT-HAND SIDEBAR (17 QUICK BUTTONS IN MARG ERP)
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <ClipboardList size={17} className="text-emerald-700" />
                  <span>2.2 दायां मेनू बार के 17 त्वरित विकल्प (Right Sidebar 17 Action Buttons)</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">Quick Operations Desk</span>
              </div>

              {/* Marg ERP 9+ Full Window Screenshot */}
              <div className="border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-slate-50">
                <div className="bg-slate-800 text-white px-3 py-1.5 flex items-center justify-between text-xs font-bold">
                  <span>सचित्र इंटरफेस: Marg ERP 9+ मुख्य स्क्रीन एवं दायां एक्शन पैनल (Right Sidebar)</span>
                  <span className="text-[10px] text-emerald-300 font-mono">17 Quick Shortcuts</span>
                </div>
                <div className="p-2 bg-white flex justify-center">
                  <img
                    src="/assets/aistudio/image_ea47c9e5.png"
                    alt="Marg ERP 9+ Full Screen Interface with Right Sidebar Buttons"
                    className="max-h-80 w-auto rounded border border-slate-200 object-contain shadow-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="font-bold text-emerald-950">1. Sale (Alt + N / F10)</p>
                  <p className="text-emerald-800 text-[11px]">मरीज के लिए तुरंत नया रिटेल या ओपीडी बिल बनाने हेतु।</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-900">2. Purc. Challan</p>
                  <p className="text-slate-600 text-[11px]">डिस्ट्रीब्यूटर से आई नई दवाइयों का इनवर्ड चालान चढ़ाने हेतु।</p>
                </div>
                <div className="p-2.5 bg-red-50 rounded-lg border border-red-200">
                  <p className="font-bold text-red-950">3. S/R Expiry</p>
                  <p className="text-red-800 text-[11px]">मरीज द्वारा लाई गई दवा वापस लेकर स्टॉक बढ़ाने व रिफंड हेतु।</p>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="font-bold text-amber-950">4. P/R Expiry</p>
                  <p className="text-amber-800 text-[11px]">एक्सपायर या डैमेज दवा सप्लायर को वापस भेजकर डेबिट नोट काटना।</p>
                </div>
                <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200">
                  <p className="font-bold text-sky-950">5. Receipt</p>
                  <p className="text-sky-800 text-[11px]">उधार लेने वाले मरीज या पार्टी से बकाया रकम जमा करना।</p>
                </div>
                <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="font-bold text-purple-950">6. Payment</p>
                  <p className="text-purple-800 text-[11px]">दवा सप्लायर को बैंक चेक, यूटीआर या नकद भुगतान काटना।</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-900">7. Cash &amp; Bank Book</p>
                  <p className="text-slate-600 text-[11px]">आज का कुल नकद गल्ला व बैंक बैलेंस का लाइव खाता देखना।</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-900">8. Ledger A/c</p>
                  <p className="text-slate-600 text-[11px]">किसी भी सप्लायर, मरीज या डॉक्टर का व्यक्तिगत खाता खोलना।</p>
                </div>
                <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-200">
                  <p className="font-bold text-rose-950">9. Outstanding</p>
                  <p className="text-rose-800 text-[11px]">कुल लेनदारों और देनदारों की बकाया सूची व देय तिथियां।</p>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <p className="font-bold text-emerald-950">10. Stock Status</p>
                  <p className="text-emerald-800 text-[11px]">वर्तमान में दुकान में किस दवा की कितनी स्ट्रिप/बोतल बची है।</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-900">11. Stock &amp; Sales Analysis</p>
                  <p className="text-slate-600 text-[11px]">कौन सी दवा तेजी से बिक रही है और किसमें अधिक मुनाफा है।</p>
                </div>
                <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="font-bold text-amber-950">12. Re-Order</p>
                  <p className="text-amber-800 text-[11px]">खत्म होने वाली दवाओं का 1-क्लिक आर्डर डिस्ट्रीब्यूटर को भेजना।</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-900">13. Sales Book</p>
                  <p className="text-slate-600 text-[11px]">आज कटे सभी बिलों की क्रमवार सूची व संशोधन।</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-900">14. Dispatch Summary</p>
                  <p className="text-slate-600 text-[11px]">पैकिंग, मरीज हैंडओवर और इनडोर वार्ड दवा वितरण ट्रैकिंग।</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-bold text-slate-900">15. Bill Taging</p>
                  <p className="text-slate-600 text-[11px]">विशिष्ट बिलों को ऑडिट, इंश्योरेंस या आयुष्मान हेतु टैग करना।</p>
                </div>
                <div className="p-2.5 bg-sky-50 rounded-lg border border-sky-200">
                  <p className="font-bold text-sky-950">16. Daily Analysis (MIS)</p>
                  <p className="text-sky-800 text-[11px]">प्रबंधन हेतु आज का कुल व्यापार, औसत बिल राशि व प्रदर्शन।</p>
                </div>
                <div className="p-2.5 bg-teal-50 rounded-lg border border-teal-200">
                  <p className="font-bold text-teal-950">17. Todays Gross Profit</p>
                  <p className="text-teal-800 text-[11px]">आज की बिक्री पर वास्तविक मुनाफा (Sale Price - Cost Price)।</p>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                2.3 MASTERS PANEL (ITEM, BATCH, LEDGER, RATE & SETUP)
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <Pill size={17} className="text-emerald-700" />
                  <span>2.3 मास्टर मेनू (Masters Panel - Item, Batch, Ledger &amp; Setup)</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">Shortcut: Alt+M या F2</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <p className="font-bold text-slate-900">नया आइटम व दवा मास्टर बनाने के चरण:</p>
                  <ol className="list-decimal list-inside space-y-1.5 text-slate-700">
                    <li>शीर्ष मेनू से <strong>Masters &gt; Item Master</strong> चुनें या <strong>F2</strong> दबाएं।</li>
                    <li><strong>Item Name (दवा का नाम):</strong> दवा का पूरा नाम भरें (उदा. Dolo 650mg Tab, Augmentin 625 Duo, Pan-D)।</li>
                    <li><strong>Salt / Formula (साल्ट):</strong> रासायनिक घटक (उदा. Paracetamol 650mg, Pantoprazole + Domperidone)।</li>
                    <li><strong>Category (प्रकार):</strong> Tablet, Syrup, Injection, Capsule, Ointment, IV Fluid, Drops।</li>
                    <li><strong>Manufacturer (कंपनी):</strong> दवा निर्माता का नाम (उदा. Cipla, Sun Pharma, Alkem, Mankind)।</li>
                    <li><strong>HSN Code &amp; GST:</strong> दवा का HSN कोड (उदा. 300490) और GST स्लैब (0%, 5%, 12%, 18%) सेट करें।</li>
                    <li><strong>Reorder Level:</strong> न्यूनतम सुरक्षित मात्रा (उदा. 20 स्ट्रिप्स)। इससे कम होने पर अलर्ट आएगा।</li>
                    <li><strong>Save दबाएं:</strong> दवा मास्टर में तुरंत सुरक्षित हो जाएगी।</li>
                  </ol>
                </div>

                <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5 space-y-2 text-[11px]">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <Info size={14} className="text-emerald-600" />
                    <span>दवा मास्टर एवं बैच एंट्री स्क्रीन विवरण (UI Guide):</span>
                  </p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 font-mono space-y-1 text-slate-700">
                    <div className="flex justify-between border-b pb-1">
                      <span className="text-slate-400">ITEM NAME:</span>
                      <span className="font-bold text-slate-900">AUGMENTIN 625 DUO TAB</span>
                    </div>
                    <div className="flex justify-between border-b py-1">
                      <span className="text-slate-400">GENERIC / SALT:</span>
                      <span className="text-emerald-700 font-semibold">Amoxicillin + Potassium Clavulanate</span>
                    </div>
                    <div className="flex justify-between border-b py-1">
                      <span className="text-slate-400">BATCH NO:</span>
                      <span className="text-sky-700 font-bold">AG-9824 (Exp: 10/2027)</span>
                    </div>
                    <div className="flex justify-between border-b py-1">
                      <span className="text-slate-400">PURCHASE RATE / MRP:</span>
                      <span className="text-slate-800">₹142.00 / ₹201.50</span>
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-slate-400">BARCODE / SKU:</span>
                      <span className="text-purple-700 font-bold">8901117283910</span>
                    </div>
                  </div>
                  <p className="text-slate-500 italic">
                    * बैच वार इन्वेंटरी में फर्स्ट-इन फर्स्ट-आउट (FIFO) स्वतः लागू रहता है।
                  </p>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                2.4 TRANSACTIONS PANEL (POS BILLING, CHALLAN, S/R, P/R)
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <Receipt size={17} className="text-emerald-700" />
                  <span>2.4 ट्रांजैक्शन मेनू (Transactions Panel - Sale POS, Purc. Challan, Returns)</span>
                </h3>
                <span className="text-xs font-mono text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-300">
                  Shortcut: Alt+N या F10
                </span>
              </div>

              <div className="space-y-3 text-xs text-slate-700">
                <p>
                  काउंटर पर मरीज के लिए उच्च गति से सेल बिल बनाने और डिस्ट्रीब्यूटर खरीद दर्ज करने की चरणबद्ध प्रक्रिया:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="font-bold text-slate-900">सेल बिल बनाने का 6-चरणीय नियम (POS Sale SOP):</p>
                    <ol className="list-decimal list-inside space-y-1.5 text-slate-700">
                      <li><strong>नया बिल खोलें:</strong> की-बोर्ड पर Alt+N दबाएं या राइट मेनू में &quot;Sale&quot; पर क्लिक करें।</li>
                      <li><strong>मरीज पहचान:</strong> मरीज का 10-अंकीय मोबाइल नंबर या नाम डालें। ओपीडी पर्ची बनी होने पर नाम स्वतः आ जाएगा।</li>
                      <li><strong>बारकोड स्कैन या दवा सर्च:</strong> बारकोड स्कैनर से स्ट्रिप स्कैन करें या दवा का नाम लिखें।</li>
                      <li><strong>FIFO बैच ऑटो-सिलेक्शन:</strong> सिस्टम निकटतम एक्सपायरी वाले बैच को अपने आप चुन लेगा।</li>
                      <li><strong>मात्रा व डिस्काउंट:</strong> मरीज को दी जाने वाली गोलियों की संख्या भरें व आवश्यकतानुसार 5% या 10% छूट दें।</li>
                      <li><strong>सेव व प्रिंट (F10):</strong> भुगतान विधि (Cash/UPI) चुनकर प्रिंट दबाएं। 80mm थर्मल या A4 रसीद निकल आएगी।</li>
                    </ol>
                  </div>

                  {/* UI Bill Illustration */}
                  <div className="bg-slate-900 text-emerald-400 p-4 rounded-xl font-mono text-xs space-y-2 border border-slate-700 shadow-inner">
                    <div className="text-center text-white border-b border-slate-700 pb-2">
                      <p className="font-black text-sm text-emerald-300">*** DUDRUCS PHARMACY INVOICE ***</p>
                      <p className="text-[10px] text-slate-400">Bill No: DU-2026-0842 | Date: 02-11-2026</p>
                    </div>
                    <div className="text-[11px] text-slate-300 flex justify-between">
                      <span>Pt: Ramesh Kumar (9431254000)</span>
                      <span>Dr: Dr. S. K. Verma</span>
                    </div>
                    <div className="border-t border-b border-slate-700 py-1 text-[10px] text-slate-400 flex justify-between font-bold">
                      <span className="w-1/2">ITEM NAME</span>
                      <span className="w-1/6 text-center">QTY</span>
                      <span className="w-1/6 text-right">MRP</span>
                      <span className="w-1/6 text-right">TOTAL</span>
                    </div>
                    <div className="space-y-1 text-[11px] text-emerald-200">
                      <div className="flex justify-between">
                        <span className="w-1/2 truncate">Dolo 650mg Tab (B: DL98)</span>
                        <span className="w-1/6 text-center">15</span>
                        <span className="w-1/6 text-right">30.00</span>
                        <span className="w-1/6 text-right">30.00</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="w-1/2 truncate">Augmentin 625 (B: AG24)</span>
                        <span className="w-1/6 text-center">10</span>
                        <span className="w-1/6 text-right">201.50</span>
                        <span className="w-1/6 text-right">201.50</span>
                      </div>
                    </div>
                    <div className="border-t border-slate-700 pt-2 text-white font-bold flex justify-between text-xs">
                      <span>NET PAYABLE (GST Incl):</span>
                      <span className="text-emerald-400 font-mono text-sm">₹231.50</span>
                    </div>
                    <p className="text-[10px] text-center text-slate-500 pt-1">
                      [STATUS: SAVED IN FIREBASE &bull; PRINTED VIA THERMAL/A4]
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                2.5 ACCOUNTS PANEL - DEEP USER DEMAND (RECEIPT, PAYMENT, LEDGER)
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <CreditCard size={17} className="text-sky-700" />
                  <span>2.5 अकाउंट्स मेनू (Accounts Panel - Receipt, Payment, Ledger &amp; Outstanding)</span>
                </h3>
                <span className="text-xs font-mono text-sky-700 font-bold bg-sky-50 px-2.5 py-0.5 rounded border border-sky-300">
                  Financial Accounting
                </span>
              </div>

              <p className="text-xs text-slate-700 leading-relaxed">
                फार्मेसी में पैसों का लेन-देन, सप्लायर बिलों का भुगतान, उधारी वसूली और रोकड़ बही का मिलान अकाउंट्स मेनू से किया जाता है। इसके 6 प्रमुख भाग हैं:
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* 1. Receipt Voucher */}
                <div className="p-3.5 bg-emerald-50/60 rounded-xl border border-emerald-200 space-y-2">
                  <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Receipt size={15} className="text-emerald-700" />
                    <span>1. Receipt Voucher (रसीद वाउचर - पैसा प्राप्त होना)</span>
                  </p>
                  <p className="text-emerald-900 text-[11px] leading-relaxed">
                    जब किसी पुराने मरीज या क्रेडिट ग्राहक से बकाया दवा बिल का पैसा प्राप्त होता है:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-emerald-800 text-[11px]">
                    <li><strong>Party / Customer:</strong> ग्राहक का नाम या मोबाइल नंबर चुनें।</li>
                    <li><strong>Amount:</strong> प्राप्त कुल नकद या ऑनलाइन रकम भरें।</li>
                    <li><strong>Mode:</strong> Cash (गल्ला) या Bank A/c (चेक / ऑनलाइन UTR)।</li>
                    <li>सेव होते ही ग्राहक के बकाए में से यह राशि तुरंत कम हो जाती है।</li>
                  </ul>
                </div>

                {/* 2. Payment Voucher */}
                <div className="p-3.5 bg-purple-50/60 rounded-xl border border-purple-200 space-y-2">
                  <p className="font-bold text-purple-950 flex items-center gap-1.5">
                    <CreditCard size={15} className="text-purple-700" />
                    <span>2. Payment Voucher (भुगतान वाउचर - सप्लायर को देना)</span>
                  </p>
                  <p className="text-purple-900 text-[11px] leading-relaxed">
                    जब दवा थोक विक्रेता (Medicine Distributor) के बिल का भुगतान किया जाता है:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-purple-800 text-[11px]">
                    <li><strong>Supplier Ledger:</strong> डिस्ट्रीब्यूटर (उदा. Alkem Agency) चुनें।</li>
                    <li><strong>Amount:</strong> चुकाई गई राशि दर्ज करें।</li>
                    <li><strong>Cheque / UTR No.:</strong> बैंक चेक नंबर या एनईएफटी रेफरेंस नंबर दर्ज करें।</li>
                    <li>सप्लायर के लेजर में यह भुगतान रीयल-टाइम में क्रेडिट हो जाता है।</li>
                  </ul>
                </div>

                {/* 3. Cash & Bank Book */}
                <div className="p-3.5 bg-sky-50/60 rounded-xl border border-sky-200 space-y-2">
                  <p className="font-bold text-sky-950 flex items-center gap-1.5">
                    <Building2 size={15} className="text-sky-700" />
                    <span>3. Cash &amp; Bank Book (रोकड़ एवं बैंक बही)</span>
                  </p>
                  <p className="text-sky-900 text-[11px] leading-relaxed">
                    दिन भर में दुकान के गल्ले और बैंक खाते का सटीक संतुलन देखने के लिए:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-sky-800 text-[11px]">
                    <li><strong>Opening Cash:</strong> सुबह दुकान खोलते समय गल्ले में कुल नकदी।</li>
                    <li><strong>Total Cash Inflow:</strong> आज की नकद बिक्री व रसीदें।</li>
                    <li><strong>Total Cash Outflow:</strong> दुकान के खर्चे या सप्लायर को दी गई नकदी।</li>
                    <li><strong>Closing Balance:</strong> शाम को दुकान बंद करते समय गल्ले का वास्तविक मिलान।</li>
                  </ul>
                </div>

                {/* 4. Ledger A/c & Outstanding */}
                <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
                  <p className="font-bold text-amber-950 flex items-center gap-1.5">
                    <FileText size={15} className="text-amber-700" />
                    <span>4. Ledger A/c व Outstanding Statement (खाता बही व उधारी)</span>
                  </p>
                  <p className="text-amber-900 text-[11px] leading-relaxed">
                    सप्लायर और ग्राहकों का संपूर्ण व्यक्तिगत हिसाब-किताब:
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-amber-800 text-[11px]">
                    <li><strong>Ledger Account:</strong> 1-क्लिक में तारीखवार डेबिट-क्रेडिट स्टेटमेंट (PDF/Excel में)।</li>
                    <li><strong>Payables:</strong> किस-किस सप्लायर का कितना बिल बाकी है और कब तक देना है।</li>
                    <li><strong>Receivables:</strong> किन मरीजों पर उधारी बाकी है (Aging: 30, 60, 90 दिन)।</li>
                    <li><strong>Contra &amp; Journal:</strong> गल्ले से बैंक में जमा करने या बैंक से नकद निकालने की एंट्री।</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                2.6 DIGITAL & CONNECTED BANKING
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <QrCode size={17} className="text-emerald-700" />
                  <span>2.6 डिजिटल सर्विसेज (Digital Panel - Dynamic UPI QR, WhatsApp &amp; SMS)</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">Fast Cashless Checkout</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="border border-sky-300 bg-sky-50/50 rounded-lg p-3 space-y-1">
                  <p className="font-bold text-sky-950 flex items-center gap-1.5">
                    <QrCode size={14} className="text-sky-700" />
                    <span>डायनामिक UPI QR कोड</span>
                  </p>
                  <p className="text-sky-900 text-[11px] leading-relaxed">
                    बिल बनते ही काउंटर स्क्रीन पर ठीक उसी राशि का QR कोड बन जाता है। मरीज PhonePe, Google Pay या Paytm से 5 सेकंड में स्कैन करके भुगतान कर सकता है।
                  </p>
                </div>

                <div className="border border-emerald-300 bg-emerald-50/50 rounded-lg p-3 space-y-1">
                  <p className="font-bold text-emerald-950 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-emerald-700" />
                    <span>व्हाट्सएप व एसएमएस बिल शेयरिंग</span>
                  </p>
                  <p className="text-emerald-900 text-[11px] leading-relaxed">
                    बिल सुरक्षित होते ही मरीज के मोबाइल पर डिजिटल इनवॉइस का लिंक व्हाट्सएप द्वारा भेजा जा सकता है, जिससे कागज की बचत और मरीज का रिकॉर्ड सुरक्षित रहता है।
                  </p>
                </div>

                <div className="border border-purple-300 bg-purple-50/50 rounded-lg p-3 space-y-1">
                  <p className="font-bold text-purple-950 flex items-center gap-1.5">
                    <CreditCard size={14} className="text-purple-700" />
                    <span>Razorpay एवं कार्ड स्वाइप</span>
                  </p>
                  <p className="text-purple-900 text-[11px] leading-relaxed">
                    क्रेडिट कार्ड, डेबिट कार्ड व नेटबैंकिंग से भुगतान प्राप्त करने पर ऑटोमैटिक ट्रांजैक्शन आईडी दर्ज होती है और रसीद पर मर्चेंट रेफरेंस प्रिंट होता है।
                  </p>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                2.7 BOOKS & FINAL REPORTS
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <BookOpen size={17} className="text-emerald-700" />
                  <span>2.7 बुक्स एवं अंतिम वित्तीय रिपोर्ट (Books &amp; Final Reports)</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">Day Book, P&amp;L, Balance Sheet</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-700">
                <div className="space-y-1.5">
                  <p className="font-bold text-slate-900">बुक्स (Books &amp; Day Book) की कार्यप्रणाली:</p>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li><strong>Day Book:</strong> आज कटे सभी सेल बिल, परचेज चालान, रसीदें और भुगतानों की क्रमवार सूची।</li>
                    <li><strong>Cash Book:</strong> दैनिक नकद आवक-जावक का पूर्ण मिलान।</li>
                    <li><strong>Bank Book:</strong> बैंक खातों में चेक क्लीयरेंस और ऑनलाइन ट्रांसफर का लेजर।</li>
                    <li><strong>Journal Book:</strong> बिना कैश वाले सभी छूट व एडजस्टमेंट वाउचर।</li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <p className="font-bold text-slate-900">फाइनल रिपोर्ट्स (Final Financial Statements):</p>
                  <ul className="list-disc list-inside space-y-1 text-[11px]">
                    <li><strong>Trading A/c:</strong> दवाइयों की कुल खरीद, ओपनिंग स्टॉक, क्लोजिंग स्टॉक और सकल मार्जिन।</li>
                    <li><strong>Profit &amp; Loss A/c:</strong> बिजली, दुकान किराया, स्टाफ वेतन घटाकर शुद्ध मासिक/वार्षिक मुनाफा।</li>
                    <li><strong>Balance Sheet:</strong> अस्पताल की कुल संपत्तियां (स्टॉक, कैश, देनदार) और कुल देनदारियां।</li>
                    <li><strong>Trial Balance:</strong> डेबिट और क्रेडिट का संपूर्ण संतुलन मिलान।</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                2.8 GST & E-WAY BILL
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <ShieldCheck size={17} className="text-amber-700" />
                  <span>2.8 जीएसटी ऑडिट एवं ई-वे बिल (GST Compliance &amp; e-Way Bill)</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">Govt Portal Sync</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-amber-50/50 rounded-lg border border-amber-200 space-y-1">
                  <p className="font-bold text-amber-950">GSTR-1 (सेल रिटर्न)</p>
                  <p className="text-amber-900 text-[11px] leading-relaxed">
                    माह भर में बेची गई दवाओं का B2B (जीएसटी नंबर वाले ग्राहक) और B2C (सामान्य रिटेल मरीज) अलग-अलग टैक्स विभाजन।
                  </p>
                </div>
                <div className="p-3 bg-sky-50/50 rounded-lg border border-sky-200 space-y-1">
                  <p className="font-bold text-sky-950">GSTR-2B (इनपुट टैक्स क्रेडिट)</p>
                  <p className="text-sky-900 text-[11px] leading-relaxed">
                    दवा कंपनियों और सप्लायरों द्वारा जीएसटी पोर्टल पर चढ़ाए गए बिलों का स्वचालित मिलान (ITC Reconcile)।
                  </p>
                </div>
                <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-1">
                  <p className="font-bold text-emerald-950">e-Way Bill Generation</p>
                  <p className="text-emerald-900 text-[11px] leading-relaxed">
                    ₹50,000 से अधिक के थोक माल के परिवहन हेतु सरकारी ई-वे बिल पोर्टल के लिए पार्ट-A व पार्ट-B जनरेशन।
                  </p>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                2.9 STOCKS & INVENTORY MANAGEMENT
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <Clock size={17} className="text-red-700" />
                  <span>2.9 स्टॉक्स एवं इन्वेंटरी प्रबंधन (Stocks, Expiry &amp; Re-Order SOP)</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">Live FIFO Control</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                  <p className="font-bold text-slate-900">1. Stock Status (लाइव स्टॉक)</p>
                  <p className="text-slate-600 text-[11px] leading-relaxed">
                    प्रत्येक दवा की उपलब्ध स्ट्रिप्स, शीशियों की संख्या, बैच नंबर और वर्तमान एमआरपी की लाइव सूची।
                  </p>
                </div>

                <div className="border border-amber-300 bg-amber-50/50 rounded-lg p-3 space-y-1">
                  <p className="font-bold text-amber-950 flex items-center gap-1">
                    <AlertTriangle size={14} className="text-amber-600" />
                    <span>2. 90-दिन एक्सपायरी चेतावनी</span>
                  </p>
                  <p className="text-amber-900 text-[11px] leading-relaxed">
                    जिस बैच की एक्सपायरी 90 दिनों के भीतर आ रही है, उस पर पीला चेतावनी बैज दिखता है ताकि उसे पहले बेचा या कंपनी को लौटाया जा सके।
                  </p>
                </div>

                <div className="border border-red-300 bg-red-50/50 rounded-lg p-3 space-y-1">
                  <p className="font-bold text-red-950 flex items-center gap-1">
                    <CheckCircle2 size={14} className="text-red-600" />
                    <span>3. एक्सपायर्ड स्टॉक ब्लॉक</span>
                  </p>
                  <p className="text-red-900 text-[11px] leading-relaxed">
                    तारीख निकल चुकी दवा की बिलिंग सिस्टम पूरी तरह ब्लॉक कर देता है। मरीज को गलती से भी एक्सपायर्ड दवा नहीं जा सकती।
                  </p>
                </div>
              </div>

              {/* Medicine Stock Search Interface Screenshot */}
              <div className="mt-2 border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-slate-50">
                <div className="bg-slate-200 px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-slate-800 border-b border-slate-300">
                  <span>सचित्र इंटरफेस: दवा उपलब्धता व लाइव स्टॉक सर्च इंजन (Medicine Stock Check &amp; Lookup)</span>
                  <span className="text-[10px] text-slate-500 font-mono">Stock Search Engine</span>
                </div>
                <div className="p-2 bg-white flex justify-center">
                  <img
                    src="/assets/aistudio/image_debfffe7.png"
                    alt="Check Medicine Availability & Live Stock Search"
                    className="max-h-56 w-auto rounded border border-slate-200 object-contain shadow-xs"
                  />
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                2.10 DAILY REPORTS & MIS
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <FileText size={17} className="text-emerald-700" />
                  <span>2.10 दैनिक रिपोर्ट्स व प्रबंधन एमआईएस (Daily Analysis &amp; Gross Profit)</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">Route: /pharmacy/report</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-200 space-y-1">
                  <p className="font-bold text-emerald-950">दैनिक बिक्री रिपोर्ट (Daily Sales Book)</p>
                  <p className="text-emerald-900 text-[11px] leading-relaxed">
                    दिन भर में कितने बिल कटे, कुल नकद कितना आया, यूपीआई कितना जमा हुआ और कुल बिक्री का 1-क्लिक समरी स्टेटमेंट।
                  </p>
                </div>
                <div className="p-3 bg-sky-50/50 rounded-lg border border-sky-200 space-y-1">
                  <p className="font-bold text-sky-950">आज का सकल मुनाफा (Todays Gross Profit)</p>
                  <p className="text-sky-900 text-[11px] leading-relaxed">
                    प्रत्येक दवा की खरीद दर (Cost Price) और बिक्री दर (MRP) के आधार पर आज का शुद्ध मार्जिन रीयल-टाइम में दिखेगा।
                  </p>
                </div>
                <div className="p-3 bg-red-50/50 rounded-lg border border-red-200 space-y-1">
                  <p className="font-bold text-red-950">री-ऑर्डर लिस्ट (Low Stock Alert)</p>
                  <p className="text-red-900 text-[11px] leading-relaxed">
                    जिन दवाओं का स्टॉक 10 से कम बचा है, उनकी सूची सीधे सप्लायर को व्हाट्सऐप या ईमेल पर आर्डर भेजने हेतु तैयार मिलती है।
                  </p>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------
                2.11 HOT KEYS & SHORTCUT TABLE
            -------------------------------------------------------------- */}
            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-2">
                  <Sparkles size={17} className="text-emerald-700" />
                  <span>2.11 मुख्य की-बोर्ड शॉर्टकट तालिका (Hot Keys Reference)</span>
                </h3>
                <span className="text-xs font-mono text-slate-500">High-Speed Keyboard Navigation</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border border-slate-200 rounded-lg overflow-hidden font-sans">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="p-2.5">हॉट की (Key)</th>
                      <th className="p-2.5">कार्य (Function)</th>
                      <th className="p-2.5">विस्तृत विवरण (Description)</th>
                      <th className="p-2.5">उपयोग का स्थान</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-emerald-800">Alt + N</td>
                      <td className="p-2.5 font-bold text-slate-900">New Sale Bill</td>
                      <td className="p-2.5 text-slate-600">नया रिटेल या ओपीडी सेल इनवॉइस तुरंत खोलें।</td>
                      <td className="p-2.5 text-slate-500">फार्मेसी मुख्य स्क्रीन</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-emerald-800">Alt + P</td>
                      <td className="p-2.5 font-bold text-slate-900">Print Last Invoice</td>
                      <td className="p-2.5 text-slate-600">अंतिम कटे बिल की रसीद दोबारा प्रिंट करें।</td>
                      <td className="p-2.5 text-slate-500">सेल बिलिंग काउंटर</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-sky-800">F1</td>
                      <td className="p-2.5 font-bold text-slate-900">Search Item / Help</td>
                      <td className="p-2.5 text-slate-600">दवा का स्टॉक व लेजर खाता तुरंत खोजें।</td>
                      <td className="p-2.5 text-slate-500">किसी भी स्क्रीन पर</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-sky-800">F2</td>
                      <td className="p-2.5 font-bold text-slate-900">Add Item / Date</td>
                      <td className="p-2.5 text-slate-600">त्वरित नई दवा जोड़ें या बिलिंग दिनांक बदलें।</td>
                      <td className="p-2.5 text-slate-500">मास्टर्स व बिलिंग</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-purple-800">F8</td>
                      <td className="p-2.5 font-bold text-slate-900">Modify Bill</td>
                      <td className="p-2.5 text-slate-600">कटे हुए बिल में दवा या मात्रा में बदलाव करें।</td>
                      <td className="p-2.5 text-slate-500">इनवॉइस हिस्ट्री</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-emerald-800">F10</td>
                      <td className="p-2.5 font-bold text-slate-900">Finalize &amp; Save</td>
                      <td className="p-2.5 text-slate-600">बिल को अंतिम रूप देकर सुरक्षित व प्रिंट करें।</td>
                      <td className="p-2.5 text-slate-500">बिलिंग विंडो</td>
                    </tr>
                    <tr className="hover:bg-slate-50">
                      <td className="p-2.5 font-mono font-bold text-red-800">Esc</td>
                      <td className="p-2.5 font-bold text-slate-900">Close / Back</td>
                      <td className="p-2.5 text-slate-600">वर्तमान डायलॉग बंद कर वापस डैशबोर्ड पर जाएं।</td>
                      <td className="p-2.5 text-slate-500">सभी विंडो</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

        {/* -----------------------------------------------------------------------
            CHAPTER 3: ADMIN PANEL (COMPLETE SOP)
        ------------------------------------------------------------------------ */}
        {(activeTab === 'all' || activeTab === 'admin') && (
          <section id="chapter-3" className="space-y-4 page-break-before">
            <div className="bg-purple-900 text-white p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-purple-700 flex items-center justify-center font-bold text-sm">
                  3
                </span>
                <div>
                  <h2 className="text-lg font-black tracking-tight">
                    अध्याय 3: एडमिन पैनल संपूर्ण गाइड (Admin Executive Panel)
                  </h2>
                  <p className="text-xs text-purple-200">
                    डॉक्टर व स्टाफ लॉगिन क्रेडेंशियल्स, ओपीडी शेड्यूलिंग, क्लाउड बैकअप व सुरक्षा ऑडिट
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline px-3 py-1 bg-purple-800 text-purple-200 text-xs font-bold rounded-full">
                Super Admin Rights
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-5">
              {/* Doctor Accounts */}
              <div className="space-y-2 border-b border-slate-200 pb-4 avoid-break">
                <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                  <Stethoscope size={16} className="text-purple-600" />
                  <span>3.1 डॉक्टर प्रबंधन एवं अलग-अलग लॉगिन आईडी निर्माण (Doctor Accounts &amp; Schedules)</span>
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  प्रत्येक डॉक्टर के नाम से एडमिन पैनल द्वारा अलग-अलग लॉगिन आईडी (ईमेल) और गुप्त पासवर्ड बनाया जाता है। जिस डॉक्टर के पास अपॉइंटमेंट बुक होगा, वह केवल उसी डॉक्टर के लॉगिन पैनल में दिखेगा।
                </p>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs space-y-1.5 text-purple-950 font-medium">
                  <p className="font-bold">डॉक्टर प्रोफाइल में आवश्यक फील्ड्स:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>&bull; <strong>डॉक्टर का नाम व उपाधि:</strong> (उदा. Dr. S. K. Verma, MD Medicine)</div>
                    <div>&bull; <strong>कंसल्टेशन फीस:</strong> (उदा. ₹300 या ₹500)</div>
                    <div>&bull; <strong>ओपीडी चैम्बर समय:</strong> (उदा. प्रातः 10:00 से दोपहर 02:00)</div>
                  </div>
                </div>

                {/* Doctor Chambers UI Screenshot */}
                <div className="mt-3 border border-purple-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-purple-100 px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-purple-950 border-b border-purple-200">
                    <span>सचित्र इंटरफेस: अस्पताल के विशेषज्ञ डॉक्टर चैंबर एवं कंसल्टेशन समय सारिणी</span>
                    <span className="text-[10px] text-purple-700 font-mono">Chambers</span>
                  </div>
                  <div className="p-2 bg-slate-50 flex justify-center">
                    <img
                      src="/assets/aistudio/image_519c2c62.png"
                      alt="Doctor Consultation Chambers & Specialists"
                      className="max-h-60 w-auto rounded border border-slate-200 object-contain shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Staff Login Credentials */}
              <div className="space-y-2 border-b border-slate-200 pb-4 avoid-break">
                <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                  <KeyRound size={16} className="text-purple-600" />
                  <span>3.2 स्टाफ लॉगिन क्रेडेंशियल्स एवं एक्सेस कंट्रोल (Staff Login IDs &amp; Roles)</span>
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  एडमिन के अलावा कोई भी बाहरी व्यक्ति या कर्मचारी मनमर्जी से किसी ईमेल से लॉगिन नहीं कर सकता। एडमिन पैनल के <strong>&quot;Staff &amp; Login IDs&quot;</strong> टैब से नए कर्मचारी का नाम, पद (Role: Pharmacy / Reception / Doctor) और सुरक्षित पासवर्ड सेट किया जाता है। यदि कोई कर्मचारी नौकरी छोड़ता है, तो एडमिन तुरंत उसकी आईडी <strong>&quot;Deactivate&quot;</strong> या <strong>&quot;Delete&quot;</strong> कर सकता है।
                </p>
              </div>

              {/* Cloud Snapshot & MySQL SQL Backup */}
              <div className="space-y-2 border-b border-slate-200 pb-4 avoid-break">
                <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                  <DatabaseBackup size={16} className="text-emerald-600" />
                  <span>3.3 क्लाउड बैकअप व डेटाबेस रीस्टोर (Cloud Snapshots &amp; SQL Backup)</span>
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  अस्पताल का डेटा कभी न खोए, इसके लिए एडमिन पैनल में पूर्ण ऑटोमैटिक व मैनुअल क्लाउड बैकअप की व्यवस्था है:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                  <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg">
                    <p className="font-bold text-slate-900">1. सुरक्षित क्लाउड स्नैपशॉट (Cloud Snapshot):</p>
                    <p className="text-slate-600 text-[11px] mt-1">
                      एक क्लिक में संपूर्ण क्लिनिकल डेटा, मरीजों की पर्चियां, दवा स्टॉक और बिल का स्नैपशॉट क्लाउड में सुरक्षित हो जाता है। किसी भी समय &quot;Restore&quot; बटन दबाकर डेटा वापस लाया जा सकता है।
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-300 rounded-lg">
                    <p className="font-bold text-slate-900">2. ऑफलाइन बैकअप (.JSON / SQL Dump):</p>
                    <p className="text-slate-600 text-[11px] mt-1">
                      एडमिन अपने कंप्यूटर या पेनड्राइव में डेटा का ऑफलाइन बैकअप डाउनलोड करके रख सकता है।
                    </p>
                  </div>
                </div>
              </div>

              {/* Security Audit Log */}
              <div className="space-y-2 avoid-break">
                <h3 className="text-sm font-bold text-purple-900 flex items-center gap-2">
                  <ShieldCheck size={16} className="text-sky-600" />
                  <span>3.4 सिक्योरिटी ऑडिट ट्रेल (Security Audit Log)</span>
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  किस स्टाफ ने कितने बजे किस कंप्यूटर से लॉगिन किया, कौन सा बिल बनाया, दवा स्टॉक में क्या बदलाव किया गया — यह सारी जानकारी टाइमस्टैम्प और आईपी पते के साथ <strong>&quot;Security Audit Log&quot;</strong> में रिकॉर्ड होती है, जिससे गबन या हेराफेरी की कोई गुंजाइश नहीं रहती।
                </p>
              </div>
            </div>
          </section>
        )}

        {/* -----------------------------------------------------------------------
            CHAPTER 4: RECEPTION PANEL (COMPLETE SOP)
        ------------------------------------------------------------------------ */}
        {(activeTab === 'all' || activeTab === 'reception') && (
          <section id="chapter-4" className="space-y-4 page-break-before">
            <div className="bg-teal-900 text-white p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-teal-700 flex items-center justify-center font-bold text-sm">
                  4
                </span>
                <div>
                  <h2 className="text-lg font-black tracking-tight">
                    अध्याय 4: रिसेप्शन पैनल संपूर्ण गाइड (Reception Desk &amp; Patient OPD Token)
                  </h2>
                  <p className="text-xs text-teal-200">
                    मरीज पंजीकरण, डॉक्टर आवंटन, ओपीडी पर्ची व टोकन प्रिंटिंग, एवं लाइव कतार प्रबंधन
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline px-3 py-1 bg-teal-800 text-teal-200 text-xs font-bold rounded-full">
                Front Desk Operations
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-4 avoid-break">
              <div className="space-y-3 text-xs text-slate-700">
                <p className="font-semibold text-slate-900">रिसेप्शनिस्ट के लिए दैनिक कार्यप्रवाह (Step-by-Step SOP):</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2.5">
                    <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-lg">
                      <p className="font-bold text-teal-950">1. मरीज का विवरण दर्ज करना (Patient Registration):</p>
                      <p className="text-teal-800 text-[11px] mt-1 leading-relaxed">
                        मरीज का पूरा नाम, 10-अंकीय मोबाइल नंबर, आयु (Age), लिंग (Male/Female/Other), और शहर/गांव का नाम भरें। यदि मरीज का ABHA ID उपलब्ध है, तो उसे भी दर्ज करें।
                      </p>
                    </div>

                    <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-lg">
                      <p className="font-bold text-teal-950">2. डॉक्टर का चयन एवं फीस संग्रह:</p>
                      <p className="text-teal-800 text-[11px] mt-1 leading-relaxed">
                        जिस विशेषज्ञ डॉक्टर से मरीज को परामर्श लेना है, उसे चुनें। डॉक्टर की निर्धारित कंसल्टेशन फीस (उदा. ₹300) मरीज से नकद या काउंटर QR कोड स्कैन करवाकर लें।
                      </p>
                    </div>

                    <div className="p-3 bg-teal-50/50 border border-teal-200 rounded-lg">
                      <p className="font-bold text-teal-950">3. ओपीडी पर्ची व टोकन नंबर प्रिंट (Print Slip):</p>
                      <p className="text-teal-800 text-[11px] mt-1 leading-relaxed">
                        <strong>&quot;Book &amp; Print Slip&quot;</strong> पर क्लिक करें। सिस्टम ऑटोमैटिक टोकन नंबर (उदा. <strong>Token #07</strong>) जनरेट करेगा। यह पर्ची मरीज को दें।
                      </p>
                    </div>
                  </div>

                  {/* Token Slip Mockup */}
                  <div className="bg-slate-50 border border-slate-300 rounded-xl p-4 font-mono text-xs space-y-2 text-slate-800">
                    <div className="text-center border-b border-dashed border-slate-400 pb-2">
                      <p className="font-black text-sm text-teal-800">संवेदना क्लीनिक - ओपीडी पर्ची</p>
                      <p className="text-[10px] text-slate-500">OPD TOKEN SLIP &bull; RECEPTION COUNTER</p>
                    </div>
                    <div className="py-2 text-center bg-teal-100/70 border border-teal-300 rounded-lg">
                      <p className="text-[10px] text-teal-800 font-bold uppercase tracking-wider">टोकन संख्या (TOKEN NO)</p>
                      <p className="text-3xl font-black text-teal-900 font-mono">TK-07</p>
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">मरीज का नाम:</span>
                        <span className="font-bold text-slate-900">रमेश कुमार (30 Yrs / M)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">मोबाइल नंबर:</span>
                        <span>9431254000</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">परामर्श डॉक्टर:</span>
                        <span className="font-bold text-teal-800">Dr. S. K. Verma (MD)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">तारीख व समय:</span>
                        <span>02 Nov 2026, 10:15 AM</span>
                      </div>
                      <div className="flex justify-between border-t border-dashed border-slate-300 pt-1 font-bold">
                        <span>कंसल्टेशन फीस:</span>
                        <span className="text-teal-900 font-mono">₹300.00 (PAID)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* -----------------------------------------------------------------------
            CHAPTER 5: DOCTOR OPD PANEL & DIGITAL PRESCRIPTIONS (DEEP DIVE)
        ------------------------------------------------------------------------ */}
        {(activeTab === 'all' || activeTab === 'doctor') && (
          <section id="chapter-5" className="space-y-4 page-break-before">
            <div className="bg-blue-900 text-white p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-blue-700 flex items-center justify-center font-bold text-sm">
                  5
                </span>
                <div>
                  <h2 className="text-lg font-black tracking-tight">
                    अध्याय 5: डॉक्टर ओपीडी पैनल व डिजिटल पर्ची (Doctor Chamber &amp; Rx Builder)
                  </h2>
                  <p className="text-xs text-blue-200">
                    डॉक्टर का व्यक्तिगत लॉगिन, मरीज की क्लिनिकल हिस्ट्री, हाथ से लिखी पर्ची अपलोड एवं डिजिटल प्रिस्क्रिप्शन
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline px-3 py-1 bg-blue-800 text-blue-200 text-xs font-bold rounded-full">
                Clinical Chamber
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-5">
              {/* Doctor Queue */}
              <div className="space-y-2 border-b border-slate-200 pb-4 avoid-break">
                <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <UserCheck size={16} className="text-blue-600" />
                  <span>5.1 डॉक्टर का व्यक्तिगत लॉगिन व चैम्बर कतार (Assigned Doctor Queue)</span>
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  डॉक्टर अपने एडमिन द्वारा दिए गए ईमेल और पासवर्ड से लॉगिन करते हैं। डॉक्टर को केवल उन्हीं मरीजों की सूची दिखाई देती है जिन्होंने उस डॉक्टर का टोकन लिया है। कतार में मरीज का नाम, टोकन नंबर और वेटिंग स्टेटस प्रदर्शित होता है।
                </p>
              </div>

              {/* Upload Handwritten Parchi */}
              <div className="space-y-3 border-b border-slate-200 pb-4 avoid-break">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                    <Camera size={16} className="text-emerald-600" />
                    <span>5.2 डॉक्टर की हाथ से लिखी पर्ची / फोटो अपलोड (Handwritten Parchi Camera &amp; File Upload)</span>
                  </h3>
                  <span className="text-xs font-bold bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-300">
                    Always Saved in Patient Profile
                  </span>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  यदि डॉक्टर कंप्यूटर में टाइप करने के बजाय अपने पारंपरिक लेटरहेड या पैड पर पेन से दवा लिखना पसंद करते हैं, तो वे अपनी लिखी हुई पर्ची की फोटो मोबाइल या वेबकैम से खींचकर सीधे अपलोड कर सकते हैं:
                </p>

                <div className="bg-emerald-50/50 border-2 border-dashed border-emerald-300 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                      <Camera size={24} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-emerald-950">
                        कैमरा या फाइल से पर्ची अपलोड करें
                      </p>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        यह पर्ची मरीज के रिकॉर्ड में जीवनभर सुरक्षित रहेगी। मरीज जब भी भविष्य में आएगा, डॉक्टर पिछली पर्ची एक क्लिक में देख सकेंगे।
                      </p>
                    </div>
                  </div>
                  <div className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs shrink-0 shadow-xs flex items-center gap-2">
                    <Camera size={14} />
                    <span>पर्ची / फोटो अपलोड करें</span>
                  </div>
                </div>

                {/* Real UI Screenshot Reference */}
                <div className="mt-3 border border-slate-300 rounded-xl overflow-hidden shadow-sm bg-slate-50">
                  <div className="bg-slate-200 px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-slate-700 border-b border-slate-300">
                    <span>सचित्र इंटरफेस: डॉक्टर ओपीडी एवं हाथ से लिखी पर्ची अपलोड स्क्रीन</span>
                    <span className="text-[10px] text-slate-500 font-mono">Live System UI</span>
                  </div>
                  <div className="p-2 bg-white flex justify-center">
                    <img
                      src="/assets/aistudio/image_83608ee1.png"
                      alt="Doctor OPD & Handwritten Parchi UI"
                      className="max-h-80 w-auto rounded border border-slate-200 object-contain shadow-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Digital Rx Builder Step-by-Step */}
              <div className="space-y-3 avoid-break">
                <h3 className="text-sm font-bold text-blue-900 flex items-center gap-2">
                  <FileCheck size={16} className="text-blue-600" />
                  <span>5.3 डिजिटल प्रिस्क्रिप्शन जनरेटर (Step-by-Step Digital Rx Builder)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                    <p className="font-bold text-slate-900">1. वाइटल्स एवं लक्षण (Vitals &amp; Complaints):</p>
                    <p className="text-slate-600 text-[11px]">
                      बीपी (उदा. 120/80), पल्स (72 bpm), तापमान (98.6°F), वजन (65 kg) और SpO2 दर्ज करें। मुख्य समस्या (उदा. बुखार, सूखी खांसी, सीने में दर्द) सेलेक्ट या टाइप करें।
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                    <p className="font-bold text-slate-900">2. बीमारी की जांच (Doctor&apos;s Diagnosis):</p>
                    <p className="text-slate-600 text-[11px]">
                      डायग्नोसिस दर्ज करें (उदा. Acute Viral Pharyngitis, Essential Hypertension, Type 2 Diabetes Mellitus)।
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                    <p className="font-bold text-slate-900">3. दवाइयां जोड़ना (Medicines &amp; Dosage):</p>
                    <p className="text-slate-600 text-[11px]">
                      दवा का नाम टाइप करते ही फार्मेसी स्टॉक से ऑटो-सुझाव आता है। खुराक (1-0-1), भोजन से पहले/बाद, और कितने दिनों तक खानी है (उदा. 5 दिन) सेट करें।
                    </p>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-3 space-y-1">
                    <p className="font-bold text-slate-900">4. आवश्यक जांच व फॉलो-अप (Lab &amp; Follow-up):</p>
                    <p className="text-slate-600 text-[11px]">
                      यदि कोई ब्लड टेस्ट (CBC, LFT, KFT, X-Ray) कराना है तो लिखें, तथा मरीज को कितने दिन बाद दोबारा दिखाना है (Follow-up Date) वह दर्ज करें।
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs">
                  <span className="font-bold text-blue-900">
                    &quot;Save &amp; Print Prescription&quot; दबाते ही डिजिटल A4 पर्ची तुरंत प्रिंट हो जाती है।
                  </span>
                  <span className="font-mono text-blue-700 font-bold bg-white px-2.5 py-1 rounded border border-blue-300">
                    Shortcut: Ctrl + P
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* -----------------------------------------------------------------------
            CHAPTER 6: KEYBOARD SHORTCUTS, FAQ & HELP
        ------------------------------------------------------------------------ */}
        {(activeTab === 'all' || activeTab === 'faq') && (
          <section id="chapter-6" className="space-y-4 page-break-before">
            <div className="bg-amber-900 text-white p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-lg bg-amber-700 flex items-center justify-center font-bold text-sm">
                  6
                </span>
                <div>
                  <h2 className="text-lg font-black tracking-tight">
                    अध्याय 6: मुख्य की-बोर्ड शॉर्टकट एवं अक्सर पूछे जाने वाले सवाल (FAQ &amp; Shortcuts)
                  </h2>
                  <p className="text-xs text-amber-200">
                    दैनिक कामकाज में समय बचाने वाले शॉर्टकट और तकनीकी समस्याओं का त्वरित समाधान
                  </p>
                </div>
              </div>
              <span className="hidden sm:inline px-3 py-1 bg-amber-800 text-amber-200 text-xs font-bold rounded-full">
                Quick Help
              </span>
            </div>

            <div className="bg-white rounded-xl border border-slate-300 p-5 shadow-sm space-y-5">
              {/* Keyboard Shortcuts */}
              <div className="space-y-2 border-b border-slate-200 pb-4 avoid-break">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Laptop size={16} className="text-amber-600" />
                  <span>फार्मेसी व सिस्टम के मुख्य की-बोर्ड शॉर्टकट (Marg Speed Keys):</span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between">
                    <span className="font-bold text-slate-700">F2</span>
                    <span className="text-slate-500">Add Item</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between">
                    <span className="font-bold text-slate-700">F8</span>
                    <span className="text-slate-500">Sale Bill</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between">
                    <span className="font-bold text-slate-700">F9</span>
                    <span className="text-slate-500">Purchase</span>
                  </div>
                  <div className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between">
                    <span className="font-bold text-slate-700">Ctrl + P</span>
                    <span className="text-slate-500">Print Bill</span>
                  </div>
                </div>
              </div>

              {/* FAQs */}
              <div className="space-y-3 text-xs text-slate-700 avoid-break">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <HelpCircle size={16} className="text-sky-600" />
                  <span>महत्वपूर्ण सवाल व समाधान (Troubleshooting Guide):</span>
                </h3>

                <div className="space-y-2">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">
                      प्र. यदि किसी स्टाफ को अपनी आईडी या पासवर्ड याद न रहे, तो क्या करें?
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      <strong>उत्तर:</strong> एडमिन पैनल में लॉगिन करें, <strong>&quot;Staff &amp; Login IDs&quot;</strong> टैब खोलें। संबंधित स्टाफ के नाम के आगे <strong>&quot;Edit / Reset Password&quot;</strong> पर क्लिक करके 10 सेकंड में नया पासवर्ड सेट कर दें।
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">
                      प्र. क्या कंप्यूटर खराब होने या इंटरनेट बंद होने पर क्लिनिकल डेटा सुरक्षित रहेगा?
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      <strong>उत्तर:</strong> हाँ। सारा डेटा रियल-टाइम गूगल क्लाउड फायरस्टोर में सुरक्षित रूप से एनक्रिप्ट होकर सेव होता है। आप किसी भी नए कंप्यूटर, लैपटॉप या मोबाइल पर तुरंत लॉगिन करके काम जारी रख सकते हैं।
                    </p>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                    <p className="font-bold text-slate-900">
                      प्र. क्या डॉक्टर अपने मोबाइल फोन से भी ओपीडी पर्ची बना सकते हैं?
                    </p>
                    <p className="text-slate-600 leading-relaxed">
                      <strong>उत्तर:</strong> हाँ। यह सॉफ्टवेयर पूरी तरह से मोबाइल और टैबलेट रिस्पॉन्सिव है। डॉक्टर अपने स्मार्टफोन से भी मरीज की पर्ची देख सकते हैं, फोटो खींचकर अपलोड कर सकते हैं और प्रिस्क्रिप्शन सेव कर सकते हैं।
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* -----------------------------------------------------------------------
            BOOK FOOTER & PRINT CERTIFICATION
        ------------------------------------------------------------------------ */}
        <div className="border-t-2 border-slate-300 pt-6 text-center text-xs text-slate-500 space-y-2 avoid-break">
          <div className="flex items-center justify-center gap-2 text-slate-700 font-bold">
            <Building2 size={16} className="text-emerald-700" />
            <span>संवेदना क्लीनिक एवं फार्मेसी प्रबंधन प्रणाली (Hospital Management System)</span>
          </div>
          <p className="text-[11px] text-slate-400">
            दस्तावेज़ कोड: SOP-HMS-2026-V4 &bull; केवल आंतरिक अधिकृत स्टाफ एवं एडमिन उपयोग हेतु &bull; कॉपीराइट &copy; 2026 सर्वाधिकार सुरक्षित
          </p>
          <div className="pt-2 print:hidden">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold inline-flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <Printer size={14} />
              <span>पूरी किताब को PDF में सेव करें (Print to PDF)</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};
