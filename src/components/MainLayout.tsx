import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Search,
  ShoppingBag,
  RefreshCw,
  Landmark,
  Mail,
  Eye,
  Gauge,
  Image as ImageIcon,
  Menu,
  X,
  Boxes,
  FileBarChart,
  Receipt,
  Settings,
  Users,
  CalendarCheck,
  DatabaseBackup,
  LogOut,
  ShieldCheck,
  Stethoscope,
  Ticket,
  LayoutDashboard,
  MessageSquareHeart,
  Activity,
  Clock,
  CheckCircle2,
  CalendarClock,
  UserPlus,
  Pill,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth, StaffRole } from '../context/AuthContext';
import { format } from 'date-fns';

interface MainLayoutProps {
  children: React.ReactNode;
}

interface DropdownItem {
  label: string;
  shortcut?: string;
  to: string;
  dividerAbove?: boolean;
  bold?: boolean;
  badge?: string;
  hasArrow?: boolean;
  isHeader?: boolean;
  subItems?: DropdownItem[];
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { userProfile, role, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [now, setNow] = useState(new Date());
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openSubMenu, setOpenSubMenu] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [drugHelplineSearch, setDrugHelplineSearch] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [clinicName, setClinicName] = useState('SANDANA CLINIC + DUDRUCS');
  const [gstNo, setGstNo] = useState('33AABCS1429B1Z5');

  const [recentReports, setRecentReports] = useState<
    { label: string; to: string }[]
  >([
    { label: "Operator's", to: '/pharmacy/erp?view=operators' },
    { label: 'Receipt', to: '/pharmacy/invoices' },
    { label: 'Change User', to: '/login/pharmacy' },
    { label: 'Wholesale : Bill', to: '/pharmacy/sale' },
    { label: 'Cash & Bank Book', to: '/pharmacy/erp?view=cashbook' },
  ]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'clinic'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.logoUrl !== undefined) setLogoUrl(String(data.logoUrl || ''));
          if (data.clinicName || data.name) {
            setClinicName(
              `${data.clinicName || data.name} + ${data.medicalName || 'DUDRUCS'}`
            );
          }
          if (data.gstNo) setGstNo(String(data.gstNo));
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  // Determine which dedicated department layout & menu to show
  const activePortal: StaffRole = location.pathname.startsWith('/doctor')
    ? 'doctor'
    : location.pathname.startsWith('/reception')
    ? 'reception'
    : location.pathname.startsWith('/admin')
    ? role === 'reception' && location.pathname === '/admin/appointments'
      ? 'reception'
      : 'admin'
    : 'pharmacy';

  const trackAndNavigate = (label: string, to: string) => {
    setOpenMenu(null);
    setOpenSubMenu(null);
    setMobileDrawerOpen(false);
    setRecentReports((prev) => {
      const filtered = prev.filter((r) => r.label !== label);
      return [{ label, to }, ...filtered].slice(0, 5);
    });
    navigate(to);
  };

  // Global Marg ERP Keyboard Shortcuts & Esc Back Navigation in Pharmacy Portal
  useEffect(() => {
    if (activePortal !== 'pharmacy') return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Escape key: close open dropdown menu, or if not handled by a modal, return to Marg Desktop
      if (e.key === 'Escape') {
        if (openMenu) {
          e.preventDefault();
          setOpenMenu(null);
          setOpenSubMenu(null);
          return;
        }
        // Check if a modal overlay is currently open in the DOM
        const hasOpenModal = document.querySelector('.fixed.inset-0');
        if (hasOpenModal || e.defaultPrevented) {
          return;
        }
        const isDesktop =
          location.pathname === '/pharmacy/erp' &&
          (location.search === '?view=desktop' || location.search === '');
        if (!isDesktop) {
          e.preventDefault();
          navigate('/pharmacy/erp?view=desktop');
        }
        return;
      }

      // 2. Alt + Key Shortcuts (authentic Marg ERP hotkeys)
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'n') {
          e.preventDefault();
          trackAndNavigate('Sale Bill', '/pharmacy/sale?mode=SALE');
        } else if (key === 'p') {
          e.preventDefault();
          trackAndNavigate('Purchase Bill', '/pharmacy/sale?mode=PURC');
        } else if (key === 'c') {
          e.preventDefault();
          trackAndNavigate('Purchase Challan', '/pharmacy/sale?mode=PC');
        } else if (key === 'r') {
          e.preventDefault();
          trackAndNavigate('Sale Return', '/pharmacy/sale?mode=SR');
        } else if (key === 'm') {
          e.preventDefault();
          trackAndNavigate('Modify Bill', '/pharmacy/invoices');
        } else if (key === 'v') {
          e.preventDefault();
          trackAndNavigate('Voucher Entry', '/pharmacy/erp?view=voucher_receipt');
        } else if (key === 'i') {
          e.preventDefault();
          trackAndNavigate('Item Master', '/pharmacy/erp?view=item_master');
        } else if (key === 'l') {
          e.preventDefault();
          trackAndNavigate('All Ledgers', '/pharmacy/erp?view=ledger_master');
        } else if (key === 'o') {
          e.preventDefault();
          trackAndNavigate('Outstandings', '/pharmacy/erp?view=outstanding');
        } else if (key === 's') {
          e.preventDefault();
          trackAndNavigate('Current Stock', '/pharmacy/report?filter=all');
        }
      }

      // 3. Ctrl + Key Shortcuts
      if (e.ctrlKey && !e.altKey && !e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'i') {
          e.preventDefault();
          trackAndNavigate('Item List', '/pharmacy/erp?view=item_master');
        } else if (key === 'l') {
          e.preventDefault();
          trackAndNavigate('Party List', '/pharmacy/erp?view=ledger_master');
        } else if (e.key === 'F3') {
          e.preventDefault();
          trackAndNavigate('Modify Bill', '/pharmacy/invoices');
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [activePortal, openMenu, location.pathname, location.search, navigate]);

  const handleLogout = async (targetPortal: StaffRole = activePortal) => {
    setOpenMenu(null);
    setMobileDrawerOpen(false);
    await logout();
    navigate(`/login/${targetPortal}`);
  };

  const handleDrugSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(
      `/pharmacy/erp?view=drug_search&q=${encodeURIComponent(
        drugHelplineSearch.trim()
      )}`
    );
  };

  // ============================================================================
  // 1. DEDICATED ADMIN PORTAL MENU & LAYOUT (/admin/*)
  // ============================================================================
  if (activePortal === 'admin') {
    const adminMenuItems = [
      {
        label: 'System Overview',
        sub: 'Live Sales, Profit & Staff',
        to: '/admin',
        icon: LayoutDashboard,
      },
      {
        label: 'Appointments Control',
        sub: 'Confirm, Complete, Cancel',
        to: '/admin/appointments',
        icon: CalendarCheck,
      },
      {
        label: 'Staff & Login IDs',
        sub: 'Add, Block or Delete ID',
        to: '/admin/staff',
        icon: Users,
      },
      {
        label: 'Staff-Wise Sales',
        sub: 'Filter Bills by Operator',
        to: '/admin/staff-reports',
        icon: FileBarChart,
      },
      {
        label: 'Doctor Management',
        sub: 'Add/Edit Doctors & Slots',
        to: '/admin/doctors',
        icon: Stethoscope,
      },
      {
        label: 'Logo, GST & UPI',
        sub: 'Upload Brand Logo & Slider',
        to: '/admin/settings',
        icon: Settings,
      },
      {
        label: 'Financial Reports',
        sub: 'Revenue & Margin Analytics',
        to: '/admin/reports',
        icon: Receipt,
      },
      {
        label: 'Patient Feedback',
        sub: 'Approve/Delete Reviews',
        to: '/admin/feedback',
        icon: MessageSquareHeart,
      },
      {
        label: 'Security Audit Log',
        sub: 'Operator Login Trail',
        to: '/admin/activity',
        icon: Activity,
      },
      {
        label: 'MySQL & SQL Database',
        sub: 'Live SQL Tables, .SQL Dump & Backup',
        to: '/admin/backup',
        icon: DatabaseBackup,
      },
      {
        label: '📖 संचालन गाइड व PDF बुक',
        sub: 'Hospital Manual & Print PDF',
        to: '/admin/manual',
        icon: BookOpen,
      },
    ];

    return (
      <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900 font-sans">
        {/* Dedicated Admin Top Header Bar */}
        <header className="no-print sticky top-0 z-50 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white border-b border-slate-800 shadow-lg">
          <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Clinic Logo"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-xl object-contain bg-white border-2 border-emerald-400 p-0.5 shrink-0 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <ShieldCheck size={20} />
                </div>
              )}
              <div className="truncate">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    CHIEF ADMIN CONTROL PANEL
                  </span>
                </div>
                <p className="text-sm sm:text-base font-extrabold truncate mt-0.5">
                  {clinicName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/pharmacy"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#000080] hover:bg-blue-900 text-white border border-blue-400/40 rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <Pill size={13} />
                <span>Open Pharmacy ERP</span>
              </Link>
              <Link
                to="/"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition-colors"
              >
                <ExternalLink size={13} />
                <span>Website</span>
              </Link>
              <button
                type="button"
                onClick={() => handleLogout('admin')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <LogOut size={13} />
                <span>Logout</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen((p) => !p)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-extrabold shadow-sm"
              >
                {mobileDrawerOpen ? <X size={16} /> : <Menu size={16} />}
                <span>Admin Menu</span>
              </button>
            </div>
          </div>

          {/* Mobile Quick Strip & Full Admin Menu Drawer */}
          <div className="lg:hidden bg-slate-900/95 border-t border-slate-800 px-3 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {adminMenuItems.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      navigate(item.to);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-xs'
                        : 'bg-white/10 text-slate-200 hover:bg-white/20'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {mobileDrawerOpen && (
              <div className="mt-2 pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 text-xs animate-fade-in-up">
                {adminMenuItems.map((item) => {
                  const Icon = item.icon;
                  const active = location.pathname === item.to;
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        navigate(item.to);
                      }}
                      className={`p-2.5 rounded-xl text-left flex items-center gap-2 font-bold ${
                        active
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white/10 text-slate-100 hover:bg-white/20'
                      }`}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleLogout('admin')}
                  className="col-span-2 p-2.5 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center gap-2"
                >
                  <LogOut size={15} />
                  <span>Logout Admin Panel</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Dedicated Admin Sidebar + Workspace */}
        <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
          <aside className="no-print hidden lg:flex w-68 bg-slate-900 text-white border-r border-slate-800 shrink-0 flex-col justify-between p-4">
            <div className="space-y-1.5">
              <p className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400">
                Dedicated Admin Menu
              </p>
              {adminMenuItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all ${
                      active
                        ? 'bg-emerald-600 text-white font-extrabold shadow-md shadow-emerald-950/50'
                        : 'text-slate-300 hover:bg-white/10 hover:text-white font-semibold'
                    }`}
                  >
                    <Icon size={17} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs leading-tight truncate">
                        {item.label}
                      </p>
                      <p className="text-[10px] opacity-75 truncate">
                        {item.sub}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2">
              <div className="px-3 py-2 rounded-xl bg-slate-800/80 text-xs">
                <p className="text-[10px] font-mono text-emerald-400 uppercase">
                  Logged In Administrator
                </p>
                <p className="font-bold text-white truncate">
                  {userProfile?.name || 'Chief Administrator'}
                </p>
                <p className="text-[11px] font-mono text-slate-400">
                  ID: {userProfile?.uid || 'admin'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleLogout('admin')}
                className="w-full py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut size={14} />
                <span>Logout Admin</span>
              </button>
            </div>
          </aside>

          <main className="flex-1 min-w-0 p-3 sm:p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. DEDICATED DOCTOR OPD PORTAL MENU & LAYOUT (/doctor/*)
  // ============================================================================
  if (activePortal === 'doctor') {
    const doctorMenuItems = [
      {
        label: "Today's OPD Queue",
        sub: 'Waiting & Active Tokens',
        to: '/doctor?tab=today',
        icon: Stethoscope,
      },
      {
        label: 'Upcoming Bookings',
        sub: 'Future Scheduled Slots',
        to: '/doctor?tab=upcoming',
        icon: CalendarClock,
      },
      {
        label: 'Completed Consultations',
        sub: 'Treated Patients Log',
        to: '/doctor?tab=completed',
        icon: CheckCircle2,
      },
      {
        label: 'All My Patients',
        sub: 'Complete Patient History',
        to: '/doctor?tab=all',
        icon: Users,
      },
    ];

    const currentFullUrl = location.pathname + (location.search || '?tab=today');

    return (
      <div className="min-h-screen flex flex-col bg-emerald-50/50 text-slate-900 font-sans">
        {/* Dedicated Doctor OPD Top Header */}
        <header className="no-print sticky top-0 z-50 bg-gradient-to-r from-green-800 via-emerald-700 to-green-800 text-white border-b border-green-900 shadow-lg">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Clinic Logo"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-xl object-contain bg-white border-2 border-green-300 p-0.5 shrink-0 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0">
                  <Stethoscope size={20} />
                </div>
              )}
              <div className="truncate">
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-white/15 text-green-100">
                  DOCTOR OPD CONSULTATION CHAMBER
                </span>
                <p className="text-sm sm:text-base font-extrabold truncate mt-0.5">
                  {userProfile?.name || 'Specialist Doctor'} · {clinicName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-colors"
              >
                <ExternalLink size={13} />
                <span>Clinic Website</span>
              </Link>
              <button
                type="button"
                onClick={() => handleLogout('doctor')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <LogOut size={13} />
                <span>Doctor Logout</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen((p) => !p)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 bg-white text-green-900 rounded-xl text-xs font-extrabold shadow-sm"
              >
                {mobileDrawerOpen ? <X size={16} /> : <Menu size={16} />}
                <span>Doctor Menu</span>
              </button>
            </div>
          </div>

          {/* Mobile Doctor Menu Bar & Drawer */}
          <div className="lg:hidden bg-green-900/95 border-t border-green-800 px-3 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {doctorMenuItems.map((item) => {
                const active = currentFullUrl === item.to;
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      navigate(item.to);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-white text-green-900 font-extrabold shadow-xs'
                        : 'bg-white/10 text-green-100 hover:bg-white/20'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {mobileDrawerOpen && (
              <div className="mt-2 pt-2 border-t border-green-800 grid grid-cols-2 gap-2 text-xs animate-fade-in-up">
                {doctorMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        navigate(item.to);
                      }}
                      className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-left font-bold flex items-center gap-2"
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleLogout('doctor')}
                  className="col-span-2 p-2.5 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center gap-2"
                >
                  <LogOut size={15} />
                  <span>Logout Doctor Chamber</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Dedicated Doctor Sidebar + Workspace */}
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          <aside className="no-print hidden lg:flex w-64 bg-white border-r border-emerald-200 shrink-0 flex-col justify-between p-4 shadow-xs">
            <div className="space-y-1.5">
              <p className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-green-700">
                Dedicated Doctor Menu
              </p>
              {doctorMenuItems.map((item) => {
                const Icon = item.icon;
                const active = currentFullUrl === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all ${
                      active
                        ? 'bg-green-600 text-white font-extrabold shadow-md'
                        : 'text-slate-700 hover:bg-emerald-50 font-semibold'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs leading-tight truncate">
                        {item.label}
                      </p>
                      <p className="text-[10px] opacity-75 truncate">
                        {item.sub}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="pt-4 border-t border-emerald-100 space-y-2">
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs">
                <p className="text-[10px] font-mono text-green-700 font-bold uppercase">
                  Active OPD Chamber
                </p>
                <p className="font-bold text-slate-900 truncate mt-0.5">
                  {userProfile?.name || 'Clinic Physician'}
                </p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5 flex items-center gap-1">
                  <Clock size={11} />
                  {format(now, 'dd MMM yyyy · HH:mm')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleLogout('doctor')}
                className="w-full py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut size={14} />
                <span>Logout Doctor</span>
              </button>
            </div>
          </aside>

          <main className="flex-1 min-w-0 p-3 sm:p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 3. DEDICATED RECEPTION & TOKEN DESK MENU & LAYOUT (/reception/*)
  // ============================================================================
  if (activePortal === 'reception') {
    const receptionMenuItems = [
      {
        label: 'Walk-In Token & Reg.',
        sub: 'Issue Instant OPD Token',
        to: '/reception',
        icon: UserPlus,
      },
      {
        label: 'Manage All Appointments',
        sub: 'Confirm, Complete or Cancel',
        to: '/admin/appointments',
        icon: CalendarCheck,
      },
      {
        label: 'Online Mobile OTP Booking',
        sub: 'Public Patient Token Page',
        to: '/book',
        icon: Ticket,
      },
      {
        label: 'Patient Feedback Form',
        sub: 'Collect Patient Rating',
        to: '/feedback',
        icon: MessageSquareHeart,
      },
    ];

    return (
      <div className="min-h-screen flex flex-col bg-teal-50/40 text-slate-900 font-sans">
        {/* Dedicated Reception Top Header */}
        <header className="no-print sticky top-0 z-50 bg-gradient-to-r from-teal-900 via-teal-800 to-emerald-900 text-white border-b border-teal-950 shadow-lg">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Clinic Logo"
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-xl object-contain bg-white border-2 border-teal-300 p-0.5 shrink-0 shadow-sm"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0">
                  <Ticket size={20} />
                </div>
              )}
              <div className="truncate">
                <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-white/15 text-teal-100">
                  RECEPTION &amp; OUTPATIENT TOKEN DESK
                </span>
                <p className="text-sm sm:text-base font-extrabold truncate mt-0.5">
                  {clinicName} · Front Desk
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/"
                className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-xl text-xs font-bold transition-colors"
              >
                <ExternalLink size={13} />
                <span>Clinic Website</span>
              </Link>
              <button
                type="button"
                onClick={() => handleLogout('reception')}
                className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
              >
                <LogOut size={13} />
                <span>Reception Logout</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen((p) => !p)}
                className="lg:hidden inline-flex items-center gap-1.5 px-3 py-2 bg-white text-teal-950 rounded-xl text-xs font-extrabold shadow-sm"
              >
                {mobileDrawerOpen ? <X size={16} /> : <Menu size={16} />}
                <span>Reception Menu</span>
              </button>
            </div>
          </div>

          {/* Mobile Reception Strip & Drawer */}
          <div className="lg:hidden bg-teal-950/95 border-t border-teal-800 px-3 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {receptionMenuItems.map((item) => {
                const active = location.pathname === item.to;
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => {
                      setMobileDrawerOpen(false);
                      navigate(item.to);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                      active
                        ? 'bg-teal-300 text-teal-950 font-extrabold shadow-xs'
                        : 'bg-white/10 text-teal-100 hover:bg-white/20'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>

            {mobileDrawerOpen && (
              <div className="mt-2 pt-2 border-t border-teal-800 grid grid-cols-2 gap-2 text-xs animate-fade-in-up">
                {receptionMenuItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.to}
                      type="button"
                      onClick={() => {
                        setMobileDrawerOpen(false);
                        navigate(item.to);
                      }}
                      className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-left font-bold flex items-center gap-2"
                    >
                      <Icon size={15} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => handleLogout('reception')}
                  className="col-span-2 p-2.5 rounded-xl bg-red-600 text-white font-bold flex items-center justify-center gap-2"
                >
                  <LogOut size={15} />
                  <span>Logout Reception Desk</span>
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Dedicated Reception Sidebar + Workspace */}
        <div className="flex-1 flex max-w-7xl w-full mx-auto">
          <aside className="no-print hidden lg:flex w-64 bg-white border-r border-teal-200 shrink-0 flex-col justify-between p-4 shadow-xs">
            <div className="space-y-1.5">
              <p className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-teal-800">
                Dedicated Reception Menu
              </p>
              {receptionMenuItems.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all ${
                      active
                        ? 'bg-teal-700 text-white font-extrabold shadow-md'
                        : 'text-slate-700 hover:bg-teal-50 font-semibold'
                    }`}
                  >
                    <Icon size={18} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs leading-tight truncate">
                        {item.label}
                      </p>
                      <p className="text-[10px] opacity-75 truncate">
                        {item.sub}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>

            <div className="pt-4 border-t border-teal-100 space-y-2">
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-xs">
                <p className="text-[10px] font-mono text-teal-800 font-bold uppercase">
                  Reception Operator
                </p>
                <p className="font-bold text-slate-900 truncate mt-0.5">
                  {userProfile?.name || 'Reception Desk'}
                </p>
                <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                  {format(now, 'dd MMM yyyy · HH:mm')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleLogout('reception')}
                className="w-full py-2.5 px-3 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold flex items-center justify-center gap-2 transition-colors"
              >
                <LogOut size={14} />
                <span>Logout Reception</span>
              </button>
            </div>
          </aside>

          <main className="flex-1 min-w-0 p-3 sm:p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 4. DEDICATED PHARMACY PORTAL MENU & LAYOUT (/pharmacy/* — MARG ERP 9+)
  // ============================================================================
  const topMenuDefinitions: {
    name: string;
    items: DropdownItem[];
  }[] = [
    {
      name: 'Masters',
      items: [
        {
          label: 'Ledger Master',
          hasArrow: true,
          to: '/pharmacy/erp?view=ledger_master',
          subItems: [
            { label: 'New Ledger', shortcut: 'F2', to: '/pharmacy/erp?view=new_ledger' },
            { label: 'Modify Ledger', shortcut: 'F3', to: '/pharmacy/erp?view=ledger_master' },
            { label: 'Delete Ledger', to: '/pharmacy/erp?view=ledger_master' },
            { label: 'List of Accounts', dividerAbove: true, to: '/pharmacy/erp?view=ledger_list' },
          ],
        },
        {
          label: 'Account Groups',
          hasArrow: true,
          to: '/pharmacy/erp?view=group_masters',
        },
        {
          label: 'Master',
          hasArrow: true,
          to: '/pharmacy/erp?view=item_master',
          subItems: [
            { label: 'Item Master', shortcut: 'Ctrl+I', to: '/pharmacy/erp?view=item_master' },
            { label: 'New Item Creation (F2)', to: '/pharmacy/erp?view=new_item' },
            { label: 'Company Master (Manufacturer)', to: '/pharmacy/erp?view=company_masters' },
            { label: 'Group Master', to: '/pharmacy/erp?view=group_masters' },
            { label: 'Category Master', to: '/pharmacy/erp?view=category_masters' },
            { label: 'Batch & Opening Stock', dividerAbove: true, shortcut: 'Alt+B', to: '/pharmacy/masters?tab=batch' },
          ],
        },
        {
          label: "Prescription/Rate's",
          hasArrow: true,
          to: '/pharmacy/erp?view=price_list',
          subItems: [
            { label: 'General Price List (All Items)', to: '/pharmacy/erp?view=price_list' },
            { label: "Today's Currency Rates", to: '/pharmacy/erp?view=currency_rates' },
            { label: 'Doctor Prescriptions (OPD Rx)', dividerAbove: true, to: '/pharmacy/prescriptions' },
          ],
        },
        {
          label: 'Refresh Balances',
          hasArrow: true,
          to: '/pharmacy/erp?view=ledger_list',
        },
        {
          label: 'Ease of GST',
          hasArrow: true,
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'Opening Balances',
          hasArrow: true,
          to: '/pharmacy/masters?tab=batch',
        },
        {
          label: 'Master Statistics',
          to: '/pharmacy/erp?view=item_master',
        },
        {
          label: 'General Reminders',
          hasArrow: true,
          to: '/pharmacy/erp?view=utilities',
        },
        {
          label: 'Shortage Report',
          hasArrow: true,
          to: '/pharmacy/report?filter=low',
        },
        {
          label: 'Supplier vs Compnay',
          hasArrow: true,
          to: '/pharmacy/erp?view=company_masters',
        },
        {
          label: 'Temporary Limits',
          hasArrow: true,
          to: '/pharmacy/erp?view=ledger_master',
        },
        {
          label: 'eBusiness Setup',
          dividerAbove: true,
          bold: true,
          to: '/pharmacy/erp?view=company_creation',
        },
        {
          label: 'Cloud Backup',
          to: '/pharmacy/erp?view=cloud_backup',
        },
        {
          label: 'Survey & Offers',
          dividerAbove: true,
          bold: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=price_list',
        },
        {
          label: 'Passwords & Powers',
          dividerAbove: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=operator_powers',
        },
        {
          label: 'Change ERP Edition',
          hasArrow: true,
          to: '/pharmacy/erp?view=company_gateway',
        },
        {
          label: 'MARG Licencing',
          hasArrow: true,
          to: '/pharmacy/erp?view=company_creation',
        },
        {
          label: 'MARG Setups',
          hasArrow: true,
          to: '/pharmacy/erp?view=control_room',
        },
      ],
    },
    {
      name: 'Transactions',
      items: [
        {
          label: 'Sale',
          hasArrow: true,
          to: '/pharmacy/sale?mode=SALE',
          subItems: [
            { label: 'Bill', shortcut: 'ALT+N', to: '/pharmacy/sale?mode=SALE' },
            { label: 'Challan', to: '/pharmacy/sale?mode=SC' },
            { label: 'Counter Sale', to: '/pharmacy/sale?mode=SALE' },
            { label: 'Modify Bill', dividerAbove: true, shortcut: 'ALT+M', to: '/pharmacy/invoices' },
            { label: 'Modify Challan', to: '/pharmacy/sale?mode=SC' },
            { label: 'Pending Challans', to: '/pharmacy/sale?mode=SC' },
            { label: 'Party Transaction', to: '/pharmacy/erp?view=customer_ledger' },
            { label: 'Cancel', dividerAbove: true, to: '/pharmacy/invoices' },
            { label: 'Active LIVE Counter', bold: true, to: '/pharmacy/sale?mode=SALE' },
            { label: 'Pending Prescription', dividerAbove: true, shortcut: 'ALT+F1', to: '/pharmacy/prescriptions' },
          ],
        },
        {
          label: 'Purchase',
          hasArrow: true,
          to: '/pharmacy/sale?mode=PURC',
          subItems: [
            { label: 'Bill', shortcut: 'ALT+P', to: '/pharmacy/sale?mode=PURC' },
            { label: 'Challan', shortcut: 'ALT+C', to: '/pharmacy/sale?mode=PC' },
            { label: 'Return Without Bill', to: '/pharmacy/sale?mode=PR' },
            { label: 'Return Fixed', to: '/pharmacy/sale?mode=PR' },
            { label: 'Modify Bill', dividerAbove: true, shortcut: 'ALT+M', to: '/pharmacy/erp?view=purchase_bill' },
            { label: 'Modify Challan', to: '/pharmacy/erp?view=purchase_challan' },
            { label: 'Pending Orders', to: '/pharmacy/erp?view=purchase_order' },
            { label: 'Party Transaction', to: '/pharmacy/erp?view=supplier_ledger' },
            { label: 'Cancel', dividerAbove: true, to: '/pharmacy/erp?view=purchase_challan' },
            { label: 'Hold Challan', to: '/pharmacy/sale?mode=PC' },
            { label: 'Import Purchase Excel (.XLSX)', dividerAbove: true, bold: true, to: '/pharmacy/sale?mode=PURC&import=excel' },
          ],
        },
        {
          label: 'Sale Return',
          hasArrow: true,
          to: '/pharmacy/sale?mode=SR',
          subItems: [
            { label: 'Credit Note (Sale Return)', shortcut: 'ALT+R', to: '/pharmacy/sale?mode=SR' },
            { label: 'Expiry / Breakage Return', to: '/pharmacy/sale?mode=BE' },
            { label: 'Modify Return', dividerAbove: true, to: '/pharmacy/erp?view=sales_return' },
          ],
        },
        {
          label: 'Purchase Return',
          hasArrow: true,
          to: '/pharmacy/sale?mode=PR',
          subItems: [
            { label: 'Debit Note (Purchase Return)', to: '/pharmacy/sale?mode=PR' },
            { label: 'Return Without Bill', to: '/pharmacy/sale?mode=PR' },
            { label: 'Modify Debit Note', dividerAbove: true, to: '/pharmacy/erp?view=purchase_return' },
          ],
        },
        {
          label: 'Brk/Exp Receive',
          hasArrow: true,
          to: '/pharmacy/sale?mode=BE',
        },
        {
          label: 'Brk/Exp Issue',
          hasArrow: true,
          to: '/pharmacy/sale?mode=PR',
        },
        {
          label: 'GST Inward (Expenses)',
          dividerAbove: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=gstr2',
        },
        {
          label: 'GST Outward (Services)',
          hasArrow: true,
          to: '/pharmacy/erp?view=gstr1',
        },
        {
          label: 'Stock Issue',
          dividerAbove: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=stock_transfer',
        },
        {
          label: 'Stock Receive',
          hasArrow: true,
          to: '/pharmacy/erp?view=stock_transfer',
        },
        {
          label: 'Sales Order',
          hasArrow: true,
          to: '/pharmacy/erp?view=sales_order',
        },
        {
          label: 'Purchase Order',
          hasArrow: true,
          to: '/pharmacy/erp?view=purchase_order',
        },
        {
          label: 'ERP to ERP Order',
          badge: 'NEW',
          bold: true,
          to: '/pharmacy/erp?view=purchase_order',
        },
        {
          label: 'Delivery Management',
          dividerAbove: true,
          bold: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=dispatch',
        },
        {
          label: 'Transaction Import',
          hasArrow: true,
          to: '/pharmacy/erp?view=purchase_challan',
        },
        {
          label: 'Manual Upload on Server',
          dividerAbove: true,
          bold: true,
          to: '/pharmacy/erp?view=cloud_backup',
        },
      ],
    },
    {
      name: 'Accounts',
      items: [
        {
          label: 'Voucher Entry',
          shortcut: 'ALT+V',
          hasArrow: true,
          to: '/pharmacy/erp?view=voucher_payment',
          subItems: [
            { label: 'Receipt Voucher', to: '/pharmacy/erp?view=voucher_receipt' },
            { label: 'Payment Voucher', to: '/pharmacy/erp?view=voucher_payment' },
            { label: 'Contra Entry', to: '/pharmacy/erp?view=cashbook' },
            { label: 'Journal Entry', to: '/pharmacy/erp?view=ledger_statement' },
          ],
        },
        {
          label: 'Single Entry',
          dividerAbove: true,
          shortcut: 'ALT+I',
          hasArrow: true,
          to: '/pharmacy/erp?view=voucher_receipt',
        },
        {
          label: 'Cheques/Cash',
          shortcut: 'ALT+U',
          to: '/pharmacy/erp?view=cheque_management',
        },
        {
          label: 'P.D.Cheques/Cash',
          shortcut: 'ALT+Q',
          to: '/pharmacy/erp?view=pdc_cheques',
        },
        {
          label: 'Bill Taging',
          dividerAbove: true,
          bold: true,
          to: '/pharmacy/erp?view=bill_tagging',
        },
        {
          label: 'Bill Signed/Undelivered',
          to: '/pharmacy/erp?view=dispatch',
        },
        {
          label: 'P.D.Cheques Payment',
          dividerAbove: true,
          to: '/pharmacy/erp?view=pd_payment',
        },
        {
          label: 'Cheque Dishonored',
          hasArrow: true,
          to: '/pharmacy/erp?view=cheque_dishonoured',
        },
        {
          label: 'Bank-Pay-In-Slip',
          hasArrow: true,
          to: '/pharmacy/erp?view=payin_slips',
        },
        {
          label: 'Shift in Shortage',
          hasArrow: true,
          to: '/pharmacy/report?filter=low',
        },
        {
          label: 'Frequent Vouchers',
          hasArrow: true,
          to: '/pharmacy/erp?view=voucher_payment',
        },
      ],
    },
    {
      name: 'Digital',
      items: [
        {
          label: 'Connected Banking',
          bold: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=connected_banking',
        },
        {
          label: 'Marg Wallet',
          dividerAbove: true,
          bold: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=connected_banking',
        },
        {
          label: 'ECOD Secure',
          to: '/pharmacy/erp?view=dispatch',
        },
        {
          label: 'Margmart.com',
          to: '/pharmacy/erp?view=purchase_order',
        },
        {
          label: 'Payroll - MargHR',
          to: '/pharmacy/erp?view=operators',
        },
        {
          label: 'MargPay',
          hasArrow: true,
          to: '/pharmacy/erp?view=connected_banking',
        },
        {
          label: 'Degital Delivery',
          to: '/pharmacy/erp?view=dispatch',
        },
        {
          label: 'Find Customer Info',
          to: '/pharmacy/erp?view=customer_ledger',
        },
        {
          label: 'Healthcare QRCode',
          dividerAbove: true,
          badge: 'NEW',
          bold: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=connected_banking',
        },
        {
          label: 'ABHA - Ayushman Bharat',
          bold: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=rio_opd',
        },
        {
          label: 'Digital Services',
          dividerAbove: true,
          bold: true,
          to: '/pharmacy/erp?view=connected_banking',
        },
        {
          label: 'Bank Reconciliation',
          to: '/pharmacy/erp?view=bank_reconciliation',
        },
        {
          label: 'Online Bank Statement',
          to: '/pharmacy/erp?view=cashbook',
        },
        {
          label: 'Registration',
          hasArrow: true,
          to: '/pharmacy/erp?view=company_creation',
        },
        {
          label: "Video's",
          hasArrow: true,
          to: '/admin/manual',
        },
      ],
    },
    {
      name: 'Books',
      items: [
        { label: 'Cash & Bank Book', to: '/pharmacy/erp?view=cashbook' },
        {
          label: 'All Ledgers',
          shortcut: 'ALT+L',
          to: '/pharmacy/erp?view=ledger_master',
        },
        {
          label: 'Entry Books',
          hasArrow: true,
          to: '/pharmacy/invoices',
        },
        {
          label: 'Debtors Ledgers',
          to: '/pharmacy/erp?view=customer_ledger',
        },
        {
          label: 'Creditors Ledgers',
          to: '/pharmacy/erp?view=supplier_ledger',
        },
        {
          label: 'Purchase Register',
          dividerAbove: true,
          to: '/pharmacy/erp?view=purchase_register',
        },
        {
          label: 'Sale Register',
          to: '/pharmacy/invoices',
        },
        {
          label: 'Duties & Taxes',
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'Analytical Summaries',
          bold: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=daily_mis',
        },
        {
          label: 'Outstandings',
          dividerAbove: true,
          shortcut: 'ALT+O',
          hasArrow: true,
          to: '/pharmacy/erp?view=outstanding',
        },
        {
          label: 'Collection Reports',
          hasArrow: true,
          to: '/pharmacy/erp?view=cashbook',
        },
        {
          label: 'Interest Reports',
          hasArrow: true,
          to: '/pharmacy/erp?view=trial_balance',
        },
        {
          label: 'Depreciation',
          to: '/pharmacy/erp?view=depreciation',
        },
        {
          label: 'T-Format Printing',
          dividerAbove: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=trial_balance',
        },
        {
          label: 'Multi Printing',
          hasArrow: true,
          to: '/pharmacy/invoices',
        },
        {
          label: 'Bank Reconciliation',
          to: '/pharmacy/erp?view=bank_reconciliation',
        },
        {
          label: 'Cheque Management',
          dividerAbove: true,
          to: '/pharmacy/erp?view=cheque_management',
        },
        {
          label: 'Claims & Incentives',
          hasArrow: true,
          to: '/pharmacy/erp?view=gross_profit',
        },
        {
          label: 'Budget Analysis',
          hasArrow: true,
          to: '/pharmacy/erp?view=profit_loss',
        },
        {
          label: 'Target Analysis',
          to: '/pharmacy/erp?view=daily_mis',
        },
        {
          label: 'General Reminders',
          dividerAbove: true,
          to: '/pharmacy/erp?view=utilities',
        },
      ],
    },
    {
      name: 'Final Reports',
      items: [
        { label: 'Trial Balance', to: '/pharmacy/erp?view=trial_balance' },
        { label: 'Profit & Loss', to: '/pharmacy/erp?view=profit_loss' },
        { label: 'Balance Sheet', to: '/pharmacy/erp?view=balance_sheet' },
        { label: 'Group Summary', to: '/pharmacy/erp?view=ledger_list' },
        { label: 'Financial Analysis', to: '/pharmacy/erp?view=daily_mis' },
        { label: 'Ratio Analysis', to: '/pharmacy/erp?view=gross_profit' },
        {
          label: 'Cash & Fund Flow',
          hasArrow: true,
          to: '/pharmacy/erp?view=cashbook',
        },
        {
          label: 'Goods Account',
          dividerAbove: true,
          to: '/pharmacy/erp?view=stock_valuation',
        },
        {
          label: 'Comparisons',
          to: '/pharmacy/erp?view=stock_sales_analysis',
        },
        {
          label: 'Ledger Analysis',
          to: '/pharmacy/erp?view=ledger_statement',
        },
        {
          label: 'IT-ST-Auditor Reports',
          hasArrow: true,
          to: '/pharmacy/erp?view=gst_summary',
        },
      ],
    },
    {
      name: 'Gst',
      items: [
        {
          label: 'GST Version 29-Jun-2026',
          isHeader: true,
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'Generate eInvoice',
          dividerAbove: true,
          to: '/pharmacy/erp?view=eway_bill',
        },
        {
          label: 'GSTR 1 (Outward Supply)',
          to: '/pharmacy/erp?view=gstr1',
        },
        {
          label: 'GSTR 2 (Inward Supply)',
          to: '/pharmacy/erp?view=gstr2',
        },
        {
          label: 'GSTR 2A-2B Reconciliation',
          to: '/pharmacy/erp?view=gstr2',
        },
        {
          label: 'Internal Audit',
          hasArrow: true,
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'GSTR 3B',
          dividerAbove: true,
          to: '/pharmacy/erp?view=gstr3b',
        },
        {
          label: 'GSTR 3B Offset Report',
          to: '/pharmacy/erp?view=gstr3b',
        },
        {
          label: 'GSTR 9',
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'GST Tax Rates',
          to: '/pharmacy/erp?view=price_list',
        },
        {
          label: 'Export Invoice Print',
          to: '/pharmacy/invoices',
        },
        {
          label: 'Tax Clubbing',
          dividerAbove: true,
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'Misc. GST Reports',
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'Bulk-HSN Verification',
          to: '/pharmacy/erp?view=item_master',
        },
        {
          label: 'GST Return Video',
          to: '/admin/manual',
        },
        {
          label: 'GSTR Settings',
          dividerAbove: true,
          to: '/pharmacy/erp?view=control_room',
        },
        {
          label: 'Auditors Detail',
          to: '/pharmacy/erp?view=company_creation',
        },
        {
          label: 'Update GST Patch',
          to: '/pharmacy/erp?view=utilities',
        },
        {
          label: 'Misc. GST Returns',
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'GST Register & Returns',
          bold: true,
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'GST RCM Statement',
          dividerAbove: true,
          to: '/pharmacy/erp?view=gstr2',
        },
        {
          label: 'GST Advance Statement',
          to: '/pharmacy/erp?view=gstr1',
        },
        {
          label: 'GST Payment Statement',
          to: '/pharmacy/erp?view=voucher_payment',
        },
        {
          label: 'Tax Registers & Summaries',
          dividerAbove: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'TDS/TCS Reports',
          hasArrow: true,
          to: '/pharmacy/erp?view=gst_summary',
        },
        {
          label: 'Forms Iss./Receivable',
          to: '/pharmacy/erp?view=outstanding',
        },
      ],
    },
    {
      name: 'e-Way',
      items: [
        {
          label: 'Generate Individual',
          to: '/pharmacy/erp?view=eway_bill',
        },
        {
          label: 'Generate Consolidated',
          to: '/pharmacy/erp?view=eway_bill',
        },
        {
          label: 'Update Vehicle',
          dividerAbove: true,
          to: '/pharmacy/erp?view=dispatch',
        },
        {
          label: 'Update Transporter ID',
          to: '/pharmacy/erp?view=dispatch',
        },
        {
          label: 'Re-generate Consolidated',
          to: '/pharmacy/erp?view=eway_bill',
        },
        {
          label: 'Get EWAY Bill Details',
          to: '/pharmacy/erp?view=eway_bill',
        },
        {
          label: 'Get Consolidated EWAY Details',
          to: '/pharmacy/erp?view=eway_bill',
        },
        {
          label: 'Cancel EWAY Bill',
          to: '/pharmacy/erp?view=eway_bill',
        },
        {
          label: 'Reject EWAY Bill',
          to: '/pharmacy/erp?view=eway_bill',
        },
        {
          label: 'Closure of Eway Bill',
          to: '/pharmacy/erp?view=eway_bill',
        },
        {
          label: 'Login Details',
          dividerAbove: true,
          to: '/pharmacy/erp?view=company_creation',
        },
      ],
    },
    {
      name: 'Stocks',
      items: [
        {
          label: 'Current Stock',
          to: '/pharmacy/report?filter=all',
        },
        {
          label: 'Stock Analysis',
          bold: true,
          to: '/pharmacy/erp?view=stock_sales_analysis',
        },
        {
          label: 'Filtered Stock',
          dividerAbove: true,
          to: '/pharmacy/report?filter=all',
        },
        {
          label: 'Batch Stock',
          to: '/pharmacy/masters?tab=batch',
        },
        {
          label: 'Dump Stock',
          to: '/pharmacy/erp?view=dump_stock',
        },
        {
          label: 'Hold/Ban Stock',
          to: '/pharmacy/report?filter=expired',
        },
        {
          label: 'Stock Valuation',
          to: '/pharmacy/erp?view=stock_valuation',
        },
        {
          label: 'Minimum Level Stock',
          dividerAbove: true,
          to: '/pharmacy/report?filter=low',
        },
        {
          label: 'Maximum Level Stock',
          to: '/pharmacy/report?filter=all',
        },
        {
          label: 'Expiry Stock',
          to: '/pharmacy/report?filter=expired',
        },
        {
          label: 'Near Expiry Stock',
          to: '/pharmacy/report?filter=expiry',
        },
        {
          label: 'Stock Life Statement',
          to: '/pharmacy/erp?view=stock_valuation',
        },
        {
          label: 'Batch Purchase Type',
          to: '/pharmacy/erp?view=purchase_challan',
        },
        {
          label: 'Department Reports',
          dividerAbove: true,
          bold: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=stock_transfer',
        },
        {
          label: 'Merge Reports',
          to: '/pharmacy/erp?view=stock_sales_analysis',
        },
      ],
    },
    {
      name: 'Daily Reports',
      items: [
        {
          label: 'Daily Working',
          hasArrow: true,
          to: '/pharmacy/erp?view=daily_mis',
        },
        {
          label: 'Fast Reports',
          hasArrow: true,
          to: '/pharmacy/erp?view=gross_profit',
        },
        {
          label: 'Business Analysis',
          dividerAbove: true,
          bold: true,
          to: '/pharmacy/erp?view=daily_mis',
        },
        {
          label: 'Order CRM',
          bold: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=rio_opd',
        },
        {
          label: 'Business on Google MAP',
          hasArrow: true,
          to: '/pharmacy/erp?view=dispatch',
        },
        {
          label: 'Sale Report',
          dividerAbove: true,
          hasArrow: true,
          to: '/pharmacy/invoices',
        },
        {
          label: 'Purchase Report',
          hasArrow: true,
          to: '/pharmacy/erp?view=purchase_register',
        },
        {
          label: 'Inventory Reports',
          hasArrow: true,
          to: '/pharmacy/report?filter=all',
        },
        {
          label: 'ABC Analysis',
          to: '/pharmacy/erp?view=stock_sales_analysis',
        },
        {
          label: 'All Accounting Records',
          to: '/pharmacy/erp?view=cashbook',
        },
        {
          label: 'Purchase Planning',
          to: '/pharmacy/report?filter=low',
        },
        {
          label: 'SQL Query Executor',
          dividerAbove: true,
          to: '/pharmacy/erp?view=cloud_backup',
        },
      ],
    },
    {
      name: 'Reports',
      items: [
        {
          label: 'Sale Analysis',
          hasArrow: true,
          to: '/pharmacy/erp?view=gross_profit',
        },
        {
          label: 'Purchase Analysis',
          hasArrow: true,
          to: '/pharmacy/erp?view=purchase_register',
        },
        {
          label: 'Inventory Report',
          hasArrow: true,
          to: '/pharmacy/erp?view=stock_valuation',
        },
        {
          label: 'Management Report',
          dividerAbove: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=daily_mis',
        },
        {
          label: 'Operator Working',
          hasArrow: true,
          to: '/pharmacy/erp?view=operators',
        },
        {
          label: 'Accounts Reports',
          dividerAbove: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=trial_balance',
        },
        {
          label: 'Letters & Reminders',
          hasArrow: true,
          to: '/pharmacy/erp?view=outstanding',
        },
        {
          label: 'Other Reports',
          hasArrow: true,
          to: '/pharmacy/erp?view=stock_sales_analysis',
        },
        {
          label: 'Electronic Data Exchange',
          dividerAbove: true,
          hasArrow: true,
          to: '/pharmacy/erp?view=cloud_backup',
        },
      ],
    },
    {
      name: 'Hot Keys',
      items: [
        {
          label: 'Change Company',
          shortcut: 'F1',
          to: '/pharmacy/erp?view=company_creation',
        },
        {
          label: 'Change Financial Year',
          to: '/pharmacy/erp?view=company_creation',
        },
        {
          label: 'Change User',
          shortcut: 'CTRL+U',
          to: '/pharmacy/erp?view=operator_powers',
        },
        {
          label: 'Counter Challan',
          dividerAbove: true,
          shortcut: 'ALT+INS',
          to: '/pharmacy/erp?view=delivery_challan',
        },
        {
          label: 'Data Entry',
          shortcut: 'CTRL+F7',
          to: '/pharmacy/sale',
        },
        {
          label: 'Modify Bill',
          shortcut: 'CTRL+F3',
          to: '/pharmacy/invoices',
        },
        {
          label: 'Bill-Adjustments',
          shortcut: 'CTRL+F9',
          to: '/pharmacy/erp?view=outstanding',
        },
        {
          label: 'Item List',
          shortcut: 'CTRL+I',
          to: '/pharmacy/erp?view=item_master',
        },
        {
          label: 'Party List',
          shortcut: 'CTRL+L',
          to: '/pharmacy/erp?view=ledger_master',
        },
        {
          label: 'Callender',
          dividerAbove: true,
          shortcut: 'SHIFT+F12',
          to: '/pharmacy/erp?view=hot_keys',
        },
        {
          label: 'Calculator',
          shortcut: 'F12',
          to: '/pharmacy/erp?view=hot_keys',
        },
        {
          label: 'Personal Directory',
          shortcut: 'CTRL+F1',
          to: '/pharmacy/erp?view=customer_ledger',
        },
        {
          label: 'Printer Setup',
          shortcut: 'CTRL+F11',
          to: '/pharmacy/erp?view=control_room',
        },
        {
          label: 'Switch Over',
          shortcut: 'CTRL+J',
          to: '/pharmacy/erp?view=desktop',
        },
        {
          label: 'Standard Narration',
          shortcut: 'CTRL+F12',
          to: '/pharmacy/erp?view=voucher_payment',
        },
        {
          label: 'User Note Pad',
          to: '/pharmacy/erp?view=hot_keys',
        },
        {
          label: 'View File',
          to: '/pharmacy/invoices',
        },
        {
          label: 'Upload Fonts',
          dividerAbove: true,
          to: '/pharmacy/erp?view=control_room',
        },
        {
          label: 'Flush Memory',
          shortcut: 'CTRL+S',
          to: '/pharmacy/erp?view=cloud_backup',
        },
        {
          label: 'Quit',
          shortcut: 'CTRL+Q',
          to: '/pharmacy/erp?view=company_gateway',
        },
      ],
    },
    {
      name: 'Links',
      items: [
        { label: 'Marg ERP 9+ Home Desktop', to: '/pharmacy/erp?view=desktop' },
        {
          label: 'Company Gateway (F2 / Esc)',
          to: '/pharmacy/erp?view=company_gateway',
        },
        { label: 'Doctor Prescriptions (OPD Rx)', to: '/pharmacy/prescriptions' },
        { label: 'Admin Control Panel', to: '/admin' },
        { label: 'Exit / Logout', dividerAbove: true, to: '/login' },
      ],
    },
  ];

  const rightStackButtons: {
    label: string;
    to: string;
    isPrimarySale?: boolean;
  }[] = [
    { label: 'Sale', to: '/pharmacy/sale?mode=SALE', isPrimarySale: true },
    { label: 'Purc.Challan', to: '/pharmacy/sale?mode=PC' },
    { label: 'S/R Expiry', to: '/pharmacy/sale?mode=SR' },
    { label: 'P/R Expiry', to: '/pharmacy/sale?mode=PR' },
    { label: 'Receipt', to: '/pharmacy/erp?view=voucher_receipt' },
    { label: 'Payment', to: '/pharmacy/erp?view=voucher_payment' },
    { label: 'Cash & Bank Book', to: '/pharmacy/erp?view=cashbook' },
    { label: 'Ledger A/c', to: '/pharmacy/erp?view=ledger_statement' },
    { label: 'Outstanding', to: '/pharmacy/erp?view=outstanding' },
    { label: 'Stock Status', to: '/pharmacy/report?filter=all' },
    {
      label: 'Stock & Sales Analysis',
      to: '/pharmacy/erp?view=stock_sales_analysis',
    },
    { label: 'Re-Order', to: '/pharmacy/report?filter=low' },
    { label: 'Sales Book', to: '/pharmacy/invoices' },
    { label: 'Dispatch Summary', to: '/pharmacy/erp?view=dispatch' },
    { label: 'Bill Taging', to: '/pharmacy/erp?view=bill_tagging' },
    { label: 'Daily Analysis (MIS)', to: '/pharmacy/erp?view=daily_mis' },
    { label: 'Todays Gross Profit', to: '/pharmacy/erp?view=gross_profit' },
    { label: 'Exit', to: '/pharmacy/erp?view=company_gateway' },
  ];

  // Check if user is inside the full-screen Entry Window (/pharmacy/sale) vs Desktop
  const isFullWidthEntryScreen = location.pathname === '/pharmacy/sale';

  return (
    <div
      className="min-h-screen flex flex-col bg-[#edeae0] text-slate-900 select-none sm:select-auto font-sans"
      onClick={() => setOpenMenu(null)}
    >
      {/* 1. AUTHENTIC MARG ERP 9+ STEEL-BLUE WINDOW TITLE BAR + DYNAMIC LOGO */}
      <div className="no-print bg-gradient-to-r from-[#b4cde6] via-[#c7dcf0] to-[#b4cde6] border-b border-[#8ba8c7] px-2.5 py-1.5 flex items-center justify-between gap-2 text-[11px] font-semibold text-slate-900 shadow-2xs">
        <div className="flex items-center gap-2 truncate">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Logo"
              referrerPolicy="no-referrer"
              className="w-5 h-5 rounded-xs object-contain bg-white border border-slate-400 shrink-0"
            />
          ) : (
            <span className="inline-flex items-center justify-center w-5 h-5 bg-red-600 text-white font-bold text-[10px] rounded-xs shrink-0 shadow-2xs">
              M
            </span>
          )}
          <span className="truncate font-mono font-bold">
            MARG ERP 9+ | {clinicName.toUpperCase()} | {format(now, 'dd-MM-yyyy')} |
            PHARMACY-{(userProfile?.name || 'CA-99').toUpperCase()}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            to="/pharmacy/erp?view=desktop"
            className="hidden sm:inline-block px-2 py-0.5 bg-[#e1e1e1] hover:bg-white border border-slate-500 text-[10px] font-bold text-slate-900"
          >
            Marg Home
          </Link>
          <Link
            to="/"
            className="px-2 py-0.5 bg-green-700 hover:bg-green-800 text-white text-[10px] font-bold rounded-xs"
          >
            Website
          </Link>
          <button
            type="button"
            onClick={() => handleLogout('pharmacy')}
            className="hidden sm:inline-block px-2 py-0.5 bg-red-700 hover:bg-red-800 text-white text-[10px] font-bold rounded-xs"
          >
            Logout
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMobileDrawerOpen((prev) => !prev);
            }}
            className="lg:hidden inline-flex items-center gap-1 px-2 py-0.5 bg-[#000080] text-white text-[10px] font-bold rounded-xs"
          >
            {mobileDrawerOpen ? <X size={13} /> : <Menu size={13} />}
            <span>Pharmacy Menu</span>
          </button>
        </div>
      </div>

      {/* MOBILE PHARMACY QUICK BAR & DEDICATED PHARMACY DRAWER */}
      <div
        className="no-print lg:hidden bg-[#000080] text-white px-2.5 py-2 border-b border-blue-900 shadow-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => trackAndNavigate('Sale', '/pharmacy/sale')}
            className="px-2.5 py-1.5 bg-amber-400 text-slate-950 rounded-lg text-[11px] font-extrabold whitespace-nowrap shrink-0 shadow-xs"
          >
            + Sale Bill
          </button>
          <button
            type="button"
            onClick={() =>
              trackAndNavigate('Masters', '/pharmacy/masters?tab=medicine')
            }
            className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0"
          >
            Medicines &amp; Batches
          </button>
          <button
            type="button"
            onClick={() =>
              trackAndNavigate('Stock', '/pharmacy/report?filter=all')
            }
            className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0"
          >
            Stock &amp; Expiry
          </button>
          <button
            type="button"
            onClick={() => trackAndNavigate('Invoices', '/pharmacy/invoices')}
            className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0"
          >
            Receipts &amp; Bills
          </button>
          <button
            type="button"
            onClick={() =>
              trackAndNavigate('Profit', '/pharmacy/erp?view=gross_profit')
            }
            className="px-2.5 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0"
          >
            Gross Profit
          </button>
        </div>

        {mobileDrawerOpen && (
          <div className="mt-2 pt-2 border-t border-blue-800 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs animate-fade-in-up">
            <button
              type="button"
              onClick={() => trackAndNavigate('Sale Billing', '/pharmacy/sale')}
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-left font-bold flex items-center gap-2"
            >
              <ShoppingBag size={14} className="text-amber-300 shrink-0" />
              <span>Sale Billing (A4)</span>
            </button>
            <button
              type="button"
              onClick={() =>
                trackAndNavigate(
                  'Medicine Master',
                  '/pharmacy/masters?tab=medicine'
                )
              }
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-left font-bold flex items-center gap-2"
            >
              <Boxes size={14} className="text-green-300 shrink-0" />
              <span>Medicine Master</span>
            </button>
            <button
              type="button"
              onClick={() =>
                trackAndNavigate('Batch Entry', '/pharmacy/masters?tab=batch')
              }
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-left font-bold flex items-center gap-2"
            >
              <Boxes size={14} className="text-amber-300 shrink-0" />
              <span>Add / Delete Batch</span>
            </button>
            <button
              type="button"
              onClick={() =>
                trackAndNavigate('Stock Status', '/pharmacy/report?filter=all')
              }
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-left font-bold flex items-center gap-2"
            >
              <FileBarChart size={14} className="text-blue-200 shrink-0" />
              <span>Stock &amp; Expiry</span>
            </button>
            <button
              type="button"
              onClick={() => trackAndNavigate('Invoices', '/pharmacy/invoices')}
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-left font-bold flex items-center gap-2"
            >
              <Receipt size={14} className="text-green-300 shrink-0" />
              <span>Invoices &amp; Delete</span>
            </button>
            <button
              type="button"
              onClick={() =>
                trackAndNavigate(
                  'Gross Profit',
                  '/pharmacy/erp?view=gross_profit'
                )
              }
              className="p-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-left font-bold flex items-center gap-2"
            >
              <Gauge size={14} className="text-amber-300 shrink-0" />
              <span>Today&apos;s Profit</span>
            </button>
            <button
              type="button"
              onClick={() => trackAndNavigate('Exit', '/login/pharmacy')}
              className="p-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-left font-bold flex items-center gap-2 col-span-2 sm:col-span-3 justify-center"
            >
              <LogOut size={14} />
              <span>Logout Pharmacy ERP</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. CLASSIC WHITE TOP MENU BAR (Masters | Transactions | Accounts | Digital | Books | ...) */}
      <nav
        className="no-print bg-white border-b border-slate-400 px-2 py-0.5 flex items-center flex-wrap gap-0.5 text-xs relative z-50 shadow-2xs"
        onClick={(e) => e.stopPropagation()}
      >
        {topMenuDefinitions.map((menu) => {
          const isOpen = openMenu === menu.name;
          return (
            <div key={menu.name} className="relative">
              <button
                type="button"
                onClick={() => {
                  setOpenMenu(isOpen ? null : menu.name);
                  setOpenSubMenu(null);
                }}
                onMouseEnter={() => {
                  if (openMenu) {
                    setOpenMenu(menu.name);
                    setOpenSubMenu(null);
                  }
                }}
                className={`px-2.5 py-1 text-xs font-medium transition-colors border ${
                  isOpen
                    ? 'bg-[#cce8ff] border-[#99d1ff] text-slate-950 font-semibold'
                    : 'border-transparent text-slate-900 hover:bg-[#e5f3ff] hover:border-[#cce8ff]'
                }`}
              >
                {menu.name}
              </button>

              {isOpen && (
                <div className="absolute left-0 top-full mt-0 w-64 bg-[#f2f2f2] border border-[#a0a0a0] shadow-xl py-1 z-50 select-none">
                  {menu.items.map((item) => {
                    const hasSub = Array.isArray(item.subItems) && item.subItems.length > 0;
                    const isSubOpen = openSubMenu === item.label;
                    return (
                      <div
                        key={item.label}
                        className="relative"
                        onMouseEnter={() => setOpenSubMenu(hasSub ? item.label : null)}
                      >
                        {item.dividerAbove && (
                          <div className="border-t border-[#d0d0d0] my-1 mx-1" />
                        )}
                        {item.isHeader ? (
                          <div className="px-4 py-1 text-xs text-slate-500 font-medium">
                            {item.label}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              if (hasSub && !isSubOpen) {
                                setOpenSubMenu(item.label);
                              } else {
                                setOpenSubMenu(null);
                                trackAndNavigate(item.label, item.to);
                              }
                            }}
                            className={`w-full px-3 py-1 text-left text-xs text-slate-900 hover:bg-[#0078d7] hover:text-white flex items-center justify-between transition-none group ${
                              isSubOpen ? 'bg-[#0078d7] text-white' : ''
                            } ${item.bold ? 'font-bold' : 'font-normal'}`}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              {item.badge && (
                                <span className="px-1 py-0 bg-amber-300 text-amber-950 font-black text-[9px] rounded-xs leading-tight shrink-0">
                                  {item.badge}
                                </span>
                              )}
                              <span className="truncate">{item.label}</span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0 ml-2">
                              {item.shortcut && (
                                <span
                                  className={`font-sans text-[11px] ${
                                    isSubOpen
                                      ? 'text-white'
                                      : 'text-slate-700 group-hover:text-white'
                                  }`}
                                >
                                  {item.shortcut}
                                </span>
                              )}
                              {(item.hasArrow || hasSub) && (
                                <span className="text-[10px] leading-none">▸</span>
                              )}
                            </span>
                          </button>
                        )}

                        {/* Cascading Right Submenu (like Sale > Bill ALT+N or Purchase > Wholesale : Bill ALT+P) */}
                        {hasSub && isSubOpen && (
                          <div className="absolute left-full top-0 ml-0 w-60 bg-[#f2f2f2] border border-[#a0a0a0] shadow-2xl py-1 z-50">
                            {item.subItems!.map((sub) => (
                              <React.Fragment key={sub.label}>
                                {sub.dividerAbove && (
                                  <div className="border-t border-[#d0d0d0] my-1 mx-1" />
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenSubMenu(null);
                                    trackAndNavigate(sub.label, sub.to);
                                  }}
                                  className={`w-full px-3.5 py-1 text-left text-xs text-slate-900 hover:bg-[#0078d7] hover:text-white flex items-center justify-between group ${
                                    sub.bold ? 'font-bold' : 'font-normal'
                                  }`}
                                >
                                  <span className="truncate">{sub.label}</span>
                                  <span className="flex items-center gap-2 shrink-0 ml-2">
                                    {sub.shortcut && (
                                      <span className="font-sans text-[11px] text-slate-700 group-hover:text-white">
                                        {sub.shortcut}
                                      </span>
                                    )}
                                    {sub.hasArrow && (
                                      <span className="text-[10px] leading-none">▸</span>
                                    )}
                                  </span>
                                </button>
                              </React.Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => handleLogout('pharmacy')}
          className="px-2.5 py-1 text-xs font-medium text-slate-900 hover:bg-red-100 hover:text-red-800 rounded-xs"
        >
          Exit
        </button>

        {/* Esc Back to Marg Desktop Button */}
        {!(location.pathname === '/pharmacy/erp' && location.search === '?view=desktop') && (
          <button
            type="button"
            onClick={() => navigate('/pharmacy/erp?view=desktop')}
            className="ml-auto px-2.5 py-0.5 bg-amber-100 hover:bg-amber-200 text-slate-900 border border-amber-400 text-[11px] font-bold rounded-xs cursor-pointer flex items-center gap-1"
            title="Press Esc key to return to Marg Desktop"
          >
            <span>[Esc] Back to Desktop</span>
          </button>
        )}
      </nav>

      {/* 3. MAIN MARG ERP BODY (Full-width when in Entry Screen like image_3ede2b19.png, or 3-column Desktop) */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-[calc(100vh-145px)]">
        {/* LEFT COLUMN (#edeae0 beige panel shown on Marg Desktop) */}
        {!isFullWidthEntryScreen && (
          <aside className="no-print w-full lg:w-52 bg-[#edeae0] border-b lg:border-b-0 lg:border-r border-slate-400 shrink-0 flex flex-col justify-between p-2">
            <div className="space-y-4">
              {/* Most viewed reports */}
              <div>
                <p className="text-xs font-bold text-blue-800 mb-1">
                  Most viewed reports
                </p>
                <ul className="space-y-0.5 pl-2 text-xs text-slate-900">
                  {[
                    { label: "Operator's", to: '/pharmacy/erp?view=operators' },
                    { label: 'Change User', to: '/login/pharmacy' },
                    { label: 'Cash & Bank Book', to: '/pharmacy/erp?view=cashbook' },
                    { label: 'Receipt', to: '/pharmacy/invoices' },
                    { label: 'Wholesale : Bill', to: '/pharmacy/sale?mode=PURC' },
                  ].map((r) => (
                    <li key={r.label}>
                      <button
                        type="button"
                        onClick={() => trackAndNavigate(r.label, r.to)}
                        className="w-full text-left py-0.5 px-1.5 rounded-xs hover:bg-[#000080] hover:text-white transition-colors font-medium"
                      >
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Recently viewed reports */}
              <div>
                <p className="text-xs font-bold text-blue-800 mb-1">
                  Recently viewed reports
                </p>
                <ul className="space-y-0.5 pl-2 text-xs text-slate-900">
                  {recentReports.map((r, i) => (
                    <li key={`${r.label}-${i}`}>
                      <button
                        type="button"
                        onClick={() => trackAndNavigate(r.label, r.to)}
                        className="w-full text-left py-0.5 px-1.5 rounded-xs hover:bg-[#000080] hover:text-white transition-colors font-medium"
                      >
                        {r.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom 4 Raised Buttons + Pharmanxt Drug Helpline Search */}
            <div className="mt-4 space-y-1">
              <button
                type="button"
                onClick={() =>
                  trackAndNavigate('Digital Entry', '/pharmacy/sale?mode=PURC&import=excel')
                }
                className="w-full flex items-center justify-between px-2 py-1.5 bg-[#e6e3d8] hover:bg-white border-t border-l border-white border-r border-b border-slate-500 text-xs font-bold text-slate-900 shadow-2xs transition-colors"
              >
                <span className="flex items-center gap-1.5">
                  <ShoppingBag size={13} className="text-blue-700" />
                  Digital Entry
                </span>
                <span className="text-[10px] font-extrabold text-orange-600">
                  NEW
                </span>
              </button>

              <button
                type="button"
                onClick={() =>
                  trackAndNavigate('Rio Services', '/pharmacy/erp?view=rio_opd')
                }
                className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-[#e6e3d8] hover:bg-white border-t border-l border-white border-r border-b border-slate-500 text-xs font-bold text-slate-900 shadow-2xs transition-colors"
              >
                <RefreshCw size={13} className="text-green-700" />
                <span>Rio Services</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  trackAndNavigate(
                    'Connected Banking',
                    '/pharmacy/erp?view=connected_banking'
                  )
                }
                className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-[#e6e3d8] hover:bg-white border-t border-l border-white border-r border-b border-slate-500 text-xs font-bold text-slate-900 shadow-2xs transition-colors"
              >
                <Landmark size={13} className="text-blue-700" />
                <span>Connected Banking</span>
              </button>

              <button
                type="button"
                onClick={() =>
                  trackAndNavigate('Digital Delivery', '/pharmacy/erp?view=dispatch')
                }
                className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-[#e6e3d8] hover:bg-white border-t border-l border-white border-r border-b border-slate-500 text-xs font-bold text-slate-900 shadow-2xs transition-colors"
              >
                <Mail size={13} className="text-blue-700" />
                <span>Digital Delivery</span>
              </button>

              <form
                onSubmit={handleDrugSearchSubmit}
                className="relative pt-0.5"
              >
                <input
                  type="text"
                  value={drugHelplineSearch}
                  onChange={(e) => setDrugHelplineSearch(e.target.value)}
                  placeholder="Pharmanxt Free Drug Helpline"
                  className="w-full bg-white border border-slate-500 pl-2 pr-6 py-1 text-[11px] font-semibold text-slate-900 focus:outline-none"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-blue-700"
                  title="Search Drug"
                >
                  <Search size={13} />
                </button>
              </form>
            </div>
          </aside>
        )}

        {/* CENTER WORKSPACE AREA */}
        <main
          className={`flex-1 min-w-0 flex flex-col justify-between bg-[#e0e0e0] ${
            isFullWidthEntryScreen ? 'p-0' : 'p-2 sm:p-3'
          } overflow-y-auto`}
        >
          {/* Center Top Action Strip (Hidden in Full-Width Entry Screen so Entry Window sits flush like image_3ede2b19.png) */}
          {!isFullWidthEntryScreen && (
            <div className="no-print flex flex-wrap items-center justify-center gap-1.5 pb-2 border-b border-slate-300">
              <button
                type="button"
                onClick={() =>
                  trackAndNavigate('Ask Me!!', '/pharmacy/erp?view=ask_me')
                }
                className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-b from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white text-xs font-bold border border-red-900 rounded-xs shadow-2xs transition-transform hover:-translate-y-0.5"
              >
                <Eye size={13} />
                Ask Me!!
              </button>

              <button
                type="button"
                onClick={() =>
                  trackAndNavigate('MARG CARE', '/pharmacy/erp?view=hot_keys')
                }
                className="px-2.5 py-1 bg-[#e4e4e4] hover:bg-white text-slate-900 text-[11px] font-bold border-t border-l border-white border-r border-b border-slate-500 transition-colors"
              >
                MARG CARE
              </button>

              <button
                type="button"
                onClick={() =>
                  trackAndNavigate('GST SUMMARY', '/pharmacy/erp?view=gst_summary')
                }
                className="px-2.5 py-1 bg-[#e4e4e4] hover:bg-white text-slate-900 text-[11px] font-bold border-t border-l border-white border-r border-b border-slate-500 transition-colors"
              >
                GST SUMMARY
              </button>

              <button
                type="button"
                onClick={() =>
                  trackAndNavigate(
                    'REMOTE SUPPORT',
                    '/pharmacy/erp?view=cloud_backup'
                  )
                }
                className="px-2.5 py-1 bg-[#e4e4e4] hover:bg-white text-slate-900 text-[11px] font-bold border-t border-l border-white border-r border-b border-slate-500 transition-colors"
              >
                REMOTE SUPPORT
              </button>

              <button
                type="button"
                onClick={() =>
                  trackAndNavigate('Dashboard', '/pharmacy/erp?view=daily_mis')
                }
                className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-b from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 text-white text-xs font-bold border border-red-900 rounded-xs shadow-2xs transition-transform hover:-translate-y-0.5"
              >
                <Gauge size={13} />
                Dashboard
              </button>

              <button
                type="button"
                onClick={() =>
                  trackAndNavigate('SEARCH MENU', '/pharmacy/erp?view=search_menu')
                }
                className="px-2.5 py-1 bg-[#e4e4e4] hover:bg-white text-slate-900 text-[11px] font-bold border-t border-l border-white border-r border-b border-slate-500 transition-colors"
              >
                SEARCH MENU
              </button>
            </div>
          )}

          {/* Center Dynamic Workspace */}
          <div className={isFullWidthEntryScreen ? 'flex-1' : 'flex-1 py-2'}>
            {children}
          </div>

          {/* Center Bottom Action Strip */}
          {!isFullWidthEntryScreen && (
            <div className="no-print flex flex-wrap items-center justify-center gap-1.5 pt-2 border-t border-slate-300">
              {[
                { label: 'ORDER CRM', to: '/pharmacy/erp?view=order_crm' },
                { label: 'E-RETAIL', to: '/pharmacy/erp?view=eretail' },
                { label: 'ANALYSIS', to: '/pharmacy/erp?view=analysis' },
                { label: 'GOOGLE MAP', to: '/' },
                {
                  label: 'LIVE CREDIT LIMIT',
                  to: '/pharmacy/erp?view=outstanding',
                },
                { label: 'AUDIT TRAIL', to: '/pharmacy/erp?view=audit_trail' },
                { label: 'CLOUD BACKUP', to: '/pharmacy/erp?view=cloud_backup' },
              ].map((b) => (
                <button
                  key={b.label}
                  type="button"
                  onClick={() => trackAndNavigate(b.label, b.to)}
                  className="px-3 py-1 bg-[#e6e6e6] hover:bg-white text-slate-900 text-[11px] font-semibold border border-slate-400 shadow-2xs transition-colors"
                >
                  {b.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  trackAndNavigate('Marg Desktop', '/pharmacy/erp?view=desktop')
                }
                className="p-1 bg-blue-100 hover:bg-blue-200 text-blue-800 border border-blue-400"
                title="Show Marg ERP 9+ Desktop Logo"
              >
                <ImageIcon size={14} />
              </button>
            </div>
          )}
        </main>

        {/* RIGHT COLUMN (THE 18 CLASSIC MARG 3D BUTTONS SHOWN ON DESKTOP) */}
        {!isFullWidthEntryScreen && (
          <aside className="no-print w-full lg:w-52 bg-[#edeae0] border-t lg:border-t-0 lg:border-l border-slate-400 shrink-0 p-1.5 flex flex-col justify-between">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1">
              {rightStackButtons.map((btn) => {
                const isCurrent =
                  location.pathname + location.search === btn.to ||
                  (btn.isPrimarySale && location.pathname === '/pharmacy/sale');
                return (
                  <button
                    key={btn.label}
                    type="button"
                    onClick={() => trackAndNavigate(btn.label, btn.to)}
                    className={`w-full py-1.5 px-2 text-center text-xs font-semibold transition-all ${
                      btn.isPrimarySale || isCurrent
                        ? 'bg-[#dfe8f6] text-slate-950 font-bold border-2 border-[#0055ea] outline-1 outline-dotted outline-slate-800 -outline-offset-4 shadow-2xs'
                        : 'bg-[#e4e4e4] hover:bg-white text-slate-900 border-t border-l border-white border-r border-b border-slate-500'
                    }`}
                  >
                    {btn.label}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => handleLogout('pharmacy')}
                className="w-full py-1.5 px-2 text-center text-xs font-semibold bg-[#e4e4e4] hover:bg-red-100 hover:text-red-800 text-slate-900 border-t border-l border-white border-r border-b border-slate-500"
              >
                Exit
              </button>
            </div>
          </aside>
        )}
      </div>

      {/* 4. BOTTOM COMPANY DETAILS & LIVE TICKING CLOCK PANEL (#edeae0) */}
      <div className="no-print bg-[#edeae0] border-t-2 border-slate-400 px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-900">
        <div className="flex items-center gap-3">
          {logoUrl && (
            <img
              src={logoUrl}
              alt="Clinic Logo"
              referrerPolicy="no-referrer"
              className="w-11 h-11 rounded-lg object-contain bg-white border border-slate-400 p-1 shrink-0"
            />
          )}
          <div className="space-y-0.5 leading-tight">
            <p className="text-sm font-extrabold tracking-wide uppercase">
              {clinicName} - MARGERP
            </p>
            <p className="text-[11px] font-medium uppercase">
              ANNA NAGAR HEALTHCARE DEPOT
            </p>
            <p className="text-[11px] font-medium uppercase">
              42, MG HEALTHCARE ROAD, CHENNAI - 600040
            </p>
            <p className="text-[11px] font-mono font-semibold">
              GSTIN:{gstNo} &nbsp; Apr., 2026 - Mar., 2027
            </p>
          </div>
        </div>

        <div className="font-mono text-xs sm:text-sm space-y-0.5 sm:min-w-[230px]">
          <div className="flex items-center justify-between">
            <span className="font-bold">Date :</span>
            <span className="font-bold">{format(now, 'dd MMM.,yyyy')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold">Day &nbsp;:</span>
            <span className="font-bold">{format(now, 'EEEE')}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold">Time :</span>
            <span className="px-2 py-0.5 bg-[#d6d3c9] border border-slate-500 font-extrabold tracking-wider text-xs">
              {format(now, 'HH:mm:ss')}
            </span>
          </div>
        </div>
      </div>

      {/* 5. BOTTOM-MOST DARK TEAL HOT-KEY BAR (#4a766e) */}
      <div className="no-print bg-[#4a766e] text-white px-3 py-1 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-3 font-medium tracking-wide">
          <button
            type="button"
            onClick={() => navigate('/pharmacy/masters?tab=medicine')}
            className="hover:underline"
          >
            Ctr+I-Item
          </button>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/masters?tab=ledger')}
            className="hover:underline"
          >
            +L-Party
          </button>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/masters?tab=batch')}
            className="hover:underline"
          >
            Alt+P-Batch
          </button>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/report?filter=all')}
            className="hover:underline"
          >
            +F1-Directory
          </button>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/sale')}
            className="hover:underline"
          >
            Alt+N-Sale Bill
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="hover:underline"
          >
            +F11-Printer
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/pharmacy/erp?view=hot_keys')}
            className="px-2.5 py-0.5 bg-[#f2b6c1] hover:bg-pink-300 text-slate-900 font-bold text-[11px] border border-slate-700"
          >
            Manual
          </button>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/erp?view=gross_profit')}
            className="px-2.5 py-0.5 bg-[#f2b6c1] hover:bg-pink-300 text-slate-900 font-bold text-[11px] border border-slate-700"
          >
            Profit Tool
          </button>
        </div>
      </div>
    </div>
  );
};
