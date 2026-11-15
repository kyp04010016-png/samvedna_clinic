import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  CalendarCheck,
  Pill,
  Stethoscope,
  Building2,
  ShieldCheck,
  Database,
  Phone,
  MapPin,
  Star,
  LogIn,
  LogOut,
  Download,
  ChevronRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { useAuth, StaffRole, getRoleHomeRoute } from '../context/AuthContext';
import {
  useLiveDate,
  fetchDailyBackupStatus,
  triggerDailyBackupNow,
  DailyBackupStatus,
} from '../utils/liveDateEngine';

export const Navbar: React.FC = () => {
  const { firebaseUser, role, isTrueAdmin, logout, setPreviewRole } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { displayDate, displayTime, todayStr } = useLiveDate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dbModalOpen, setDbModalOpen] = useState(false);
  const [backupStatus, setBackupStatus] = useState<DailyBackupStatus | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState<string | null>(null);

  const loadBackupStatus = async () => {
    setBackupLoading(true);
    const data = await fetchDailyBackupStatus();
    setBackupStatus(data);
    setBackupLoading(false);
  };

  const handleOpenBackupModal = () => {
    setDbModalOpen(true);
    loadBackupStatus();
  };

  const handleRunBackupNow = async () => {
    setBackupLoading(true);
    setBackupMsg(null);
    const res = await triggerDailyBackupNow();
    if (res.success) {
      setBackupMsg(`✅ Daily backup for today (${todayStr}) successfully saved!`);
      loadBackupStatus();
    } else {
      setBackupMsg(`❌ ${res.message}`);
    }
    setBackupLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    setMobileMenuOpen(false);
    navigate('/login');
  };

  const handleRoleSwitch = (nextRole: StaffRole) => {
    setPreviewRole(nextRole);
    setMobileMenuOpen(false);
    navigate(getRoleHomeRoute(nextRole));
  };

  const getNavLinks = () => {
    if (!firebaseUser || !role) {
      return [
        { to: '/', label: 'Home' },
        { to: '/patient-prescriptions', label: '📄 Doctor Parchi & Rx' },
        { to: '/book', label: 'Book Appointment' },
        { to: '/#medicine-search', label: 'Check Medicines' },
        { to: '/#doctors', label: 'Doctors & OPD' },
        { to: '/#location', label: 'Location & Map' },
        { to: '/feedback', label: 'Feedback' },
      ];
    }

    if (role === 'admin') {
      return [
        { to: '/admin', label: 'Dashboard' },
        { to: '/admin/prescriptions', label: '📋 All Parchis & Rx' },
        { to: '/admin/doctors', label: 'Doctors' },
        { to: '/admin/staff', label: 'Staff' },
        { to: '/admin/reports', label: 'Reports' },
        { to: '/admin/backup', label: 'MySQL & Backup' },
        { to: '/admin/settings', label: 'Settings' },
        { to: '/', label: 'Public Site' },
      ];
    }

    if (role === 'doctor') {
      return [
        { to: '/doctor', label: 'Doctor EMR & Parchi' },
        { to: '/book', label: 'Book Patient' },
        { to: '/', label: 'Public Site' },
      ];
    }

    if (role === 'pharmacy') {
      return [
        { to: '/pharmacy', label: 'POS Billing' },
        { to: '/pharmacy/prescriptions', label: '📋 Doctor Parchis' },
        { to: '/pharmacy/stock', label: 'Medicine Stock' },
        { to: '/pharmacy/invoices', label: 'Past Invoices' },
        { to: '/', label: 'Public Site' },
      ];
    }

    if (role === 'reception') {
      return [
        { to: '/reception', label: 'Reception & Parchis' },
        { to: '/book', label: 'Book OPD' },
        { to: '/feedback', label: 'Feedback' },
        { to: '/', label: 'Public Site' },
      ];
    }

    return [{ to: '/', label: 'Home' }];
  };

  const navLinks = getNavLinks();

  const handleNavClick = (to: string) => {
    setMobileMenuOpen(false);
    if (to.startsWith('/#')) {
      const anchor = to.replace('/#', '');
      if (location.pathname !== '/') {
        navigate(`/${to}`);
      } else {
        const el = document.getElementById(anchor);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }
    }
  };

  return (
    <>
      <header className="no-print sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        {/* Top Emergency & SQL Quick Notice Bar (Visible on all devices: Mobile, Tablet & Desktop) */}
        <div className="bg-gradient-to-r from-[#0F2942] via-[#0D9488] to-[#1E40AF] text-white text-[11px] sm:text-xs py-1.5 px-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 font-mono">
            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto whitespace-nowrap scrollbar-none">
              <span className="inline-flex items-center gap-1 font-bold text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </span>
              <span className="text-white font-extrabold flex items-center gap-1">
                <span>{displayDate}</span>
                <span className="text-teal-300 font-bold ml-1">{displayTime}</span>
              </span>
              <span className="hidden sm:inline text-white/40">|</span>
              <span className="hidden md:flex items-center gap-1 font-sans text-teal-100 font-medium">
                Auto-Save &amp; Dual Sync: Active
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleOpenBackupModal}
                className="inline-flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white font-mono font-bold text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-md transition-all cursor-pointer"
                title="View Daily Backup Status and Download MySQL .sql"
              >
                <Database size={11} className="text-amber-300" />
                <span>Daily Backup &amp; SQL</span>
              </button>

              <a
                href="https://maps.google.com/?q=Anna+Nagar+Chennai"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1 text-[11px] text-sky-200 hover:text-white"
              >
                <span>Google Map</span>
                <ExternalLink size={10} />
              </a>
            </div>
          </div>
        </div>

        {/* Main Navbar */}
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-6 px-3 sm:px-6 py-2.5 sm:py-3.5">
          {/* Clinic Brand & Name (Prominent & Clear on Mobile, Tablet & Desktop) */}
          <Link
            to={firebaseUser && role ? getRoleHomeRoute(role) : '/'}
            className="flex items-center gap-2.5 shrink-0 group"
          >
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-[#0F2942] to-[#0D9488] text-white flex items-center justify-center font-black text-lg sm:text-xl shadow-xs group-hover:scale-105 transition-transform">
              +
            </div>
            <div className="leading-tight">
              <span className="text-base sm:text-xl font-black tracking-tight text-slate-900 group-hover:text-[#2B59C3] transition-colors block">
                Sandana Clinic
              </span>
              <span className="text-[11px] sm:text-xs font-extrabold text-[#0D9488] block">
                + Dudrucs Medical Store
              </span>
            </div>
          </Link>

          {/* Desktop & Wide Tablet Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1.5 xl:gap-3 text-xs sm:text-sm font-semibold text-slate-600">
            {navLinks.map((item) => {
              const isActive =
                item.to === '/'
                  ? location.pathname === '/' && !location.hash
                  : location.pathname === item.to;
              return item.to.startsWith('/#') ? (
                <button
                  key={item.to}
                  type="button"
                  onClick={() => handleNavClick(item.to)}
                  className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors whitespace-nowrap cursor-pointer"
                >
                  {item.label}
                </button>
              ) : (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 font-bold'
                      : 'hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Actions & Buttons */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Quick OPD Booking Pill Button for Fast Patient Access on ALL Screens */}
            <Link
              to="/book"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-extrabold text-white bg-[#2B59C3] hover:bg-[#1e46a8] rounded-xl shadow-xs transition-all active:scale-95"
            >
              <CalendarCheck size={14} />
              <span className="hidden xs:inline">Book</span> OPD
            </Link>

            {/* Admin Switch Role View (Fully Visible on All Screen Sizes) */}
            {firebaseUser && isTrueAdmin && (
              <select
                aria-label="Switch Role View"
                value={role || 'admin'}
                onChange={(e) => handleRoleSwitch(e.target.value as StaffRole)}
                className="text-[11px] sm:text-xs font-bold text-slate-800 bg-emerald-50 border border-emerald-300 rounded-xl px-2 py-1.5 sm:py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer"
              >
                <option value="admin">Admin</option>
                <option value="pharmacy">Pharmacy</option>
                <option value="reception">Reception</option>
                <option value="doctor">Doctor</option>
              </select>
            )}

            {/* Auth Button */}
            {firebaseUser ? (
              <button
                type="button"
                onClick={handleLogout}
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-200 rounded-xl hover:bg-slate-200 transition-colors whitespace-nowrap"
              >
                <LogOut size={13} />
                <span>Sign Out</span>
              </button>
            ) : (
              <Link
                to="/login"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 sm:py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition-colors whitespace-nowrap"
              >
                <LogIn size={13} />
                <span>Login</span>
              </Link>
            )}

            {/* Mobile & Tablet Full Menu Hamburger Toggle Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle Complete Menu"
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile & Tablet Expanded Drawer (Shows EVERY feature, portal, link and contact so nothing is hidden) */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 bg-white shadow-xl animate-fade-in-down">
            <div className="max-w-7xl mx-auto px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Public Navigation Section */}
              <div className="space-y-1">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-2">
                  Navigation &amp; Patient Services
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                  <Link
                    to="/"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 border border-slate-100"
                  >
                    <span className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-teal-50 text-[#0D9488] flex items-center justify-center font-bold">
                        +
                      </span>
                      Home Page
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </Link>

                  <Link
                    to="/book"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 text-xs font-extrabold text-[#1E40AF] border border-blue-200"
                  >
                    <span className="flex items-center gap-2">
                      <CalendarCheck size={16} className="text-[#2B59C3]" />
                      Book OPD (No OTP Token)
                    </span>
                    <span className="text-[10px] bg-[#2B59C3] text-white px-1.5 py-0.5 rounded font-mono">
                      Fast
                    </span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleNavClick('/#medicine-search')}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-teal-50 text-xs font-bold text-slate-800 border border-slate-100 text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Pill size={16} className="text-[#0D9488]" />
                      Check Medicine Stock (Marg ERP)
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick('/#doctors')}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 border border-slate-100 text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <Stethoscope size={16} className="text-[#2B59C3]" />
                      Specialist Doctors &amp; Timings
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleNavClick('/#location')}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 border border-slate-100 text-left cursor-pointer"
                  >
                    <span className="flex items-center gap-2">
                      <MapPin size={16} className="text-emerald-600" />
                      Google Maps &amp; Clinic Address
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </button>

                  <Link
                    to="/feedback"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 text-xs font-bold text-slate-800 border border-slate-100"
                  >
                    <span className="flex items-center gap-2">
                      <Star size={16} className="text-amber-500" />
                      Patient Reviews &amp; Feedback Form
                    </span>
                    <ChevronRight size={14} className="text-slate-400" />
                  </Link>
                </div>
              </div>

              {/* Department Portals (Reception, Pharmacy, Doctor, Admin) */}
              <div className="space-y-1 pt-2 border-t border-slate-100">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 px-2">
                  Clinical &amp; Staff Portals
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <Link
                    to="/reception"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center space-y-1 block"
                  >
                    <Building2 size={18} className="mx-auto text-emerald-700" />
                    <p className="text-[11px] font-bold text-slate-900 leading-tight">Reception</p>
                    <p className="text-[10px] text-slate-500">Queue Token</p>
                  </Link>

                  <Link
                    to="/pharmacy"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center space-y-1 block"
                  >
                    <Pill size={18} className="mx-auto text-teal-600" />
                    <p className="text-[11px] font-bold text-slate-900 leading-tight">Pharmacy</p>
                    <p className="text-[10px] text-slate-500">Marg POS Billing</p>
                  </Link>

                  <Link
                    to="/doctor"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center space-y-1 block"
                  >
                    <Stethoscope size={18} className="mx-auto text-blue-600" />
                    <p className="text-[11px] font-bold text-slate-900 leading-tight">Doctor</p>
                    <p className="text-[10px] text-slate-500">Chamber OPD</p>
                  </Link>

                  <Link
                    to="/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-center space-y-1 block"
                  >
                    <ShieldCheck size={18} className="mx-auto text-purple-600" />
                    <p className="text-[11px] font-bold text-slate-900 leading-tight">Admin</p>
                    <p className="text-[10px] text-slate-500">Control Panel</p>
                  </Link>
                </div>
              </div>

              {/* MySQL Database & Hosting Downloads */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-black text-amber-900">
                    <Database size={15} className="text-amber-700" />
                    MySQL Database &amp; Hosting Bundle
                  </span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                    Included
                  </span>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Export complete 1-click runnable <strong>database.sql</strong> and PHP connector for upload to any cPanel, domain, or hosting.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <a
                    href="/database.sql"
                    download="sandana_dudrucs_complete_mysql.sql"
                    className="inline-flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-xs"
                  >
                    <Download size={13} />
                    Download database.sql
                  </a>
                  <a
                    href="/mysql_api.php"
                    download="mysql_api.php"
                    className="inline-flex items-center gap-1.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold px-3 py-1.5 rounded-lg"
                  >
                    Download PHP API
                  </a>
                </div>
              </div>

              {/* Helpline & Quick Contact */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="text-xs text-slate-700 space-y-0.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <Phone size={13} className="text-emerald-700" />
                    Reception: +91 98400 11223
                  </p>
                  <p className="text-slate-500">Pharmacy WhatsApp: +91 98400 99887</p>
                </div>

                <div className="flex items-center gap-2">
                  {firebaseUser ? (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-red-700 bg-red-50 border border-red-200 rounded-xl"
                    >
                      <LogOut size={13} />
                      Sign Out
                    </button>
                  ) : (
                    <Link
                      to="/login"
                      onClick={() => setMobileMenuOpen(false)}
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 rounded-xl"
                    >
                      <LogIn size={13} />
                      Staff / Doctor Login
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Standalone MySQL Database Download & Hosting Modal */}
      {dbModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in"
        >
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border-2 border-emerald-500 animate-scale-in">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Database size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 leading-tight">
                    MySQL Database &amp; Hosting Files
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pre-configured 12 Relational Tables + Sample Doctors &amp; Stock
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDbModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Live Mode & Date Rollover Banner */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-black text-emerald-950">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Mode &amp; Dynamic Rollover
                </span>
                <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-200/70 px-2 py-0.5 rounded">
                  {displayTime}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800">
                Today&apos;s Active Date: <span className="font-mono text-emerald-800">{displayDate}</span>
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Raat 12:00 AM baje live date apne aap agle din par shift hoti hai, queue counters reset ho jate hain, aur daily backup automatically save ho jata hai.
              </p>
            </div>

            {/* Daily Backup Status & Quick Run */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900">
                  Daily Backup ({todayStr})
                </span>
                <button
                  type="button"
                  onClick={handleRunBackupNow}
                  disabled={backupLoading}
                  className="inline-flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={backupLoading ? 'animate-spin' : ''} />
                  <span>Run Daily Backup Now</span>
                </button>
              </div>

              {backupMsg && (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] font-bold">
                  {backupMsg}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <p className="text-slate-500">Auto-Backup Engine</p>
                  <p className="font-bold text-emerald-700 mt-0.5">Active &amp; Dual Sync</p>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <p className="text-slate-500">Next Auto-Run</p>
                  <p className="font-bold text-slate-800 mt-0.5">Tonight at 00:00:00</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a
                  href="/database.sql"
                  download={`sandana_dudrucs_daily_backup_${todayStr}.sql`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#2B59C3] hover:bg-[#1e46a8] text-white font-bold py-2 px-3 rounded-xl shadow-xs text-xs"
                >
                  <Download size={13} />
                  <span>Download .SQL Backup</span>
                </a>
                <a
                  href={`/api/backup/daily/download/${todayStr}/json`}
                  download={`sandana_dudrucs_daily_backup_${todayStr}.json`}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded-xl shadow-xs text-xs"
                >
                  <Download size={13} />
                  <span>Download .JSON Backup</span>
                </a>
              </div>

              <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-3 text-[11px] text-blue-900 mt-3">
                💡 <strong>Hosting Tip:</strong> Apne cPanel me MySQL database create karein, phpMyAdmin me <code>database.sql</code> import karein, aur website files public_html me upload karein.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setDbModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
