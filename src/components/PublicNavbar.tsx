import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  Stethoscope,
  CalendarPlus,
  ShieldCheck,
  MessageSquareHeart,
  Pill,
  UserCheck,
  Menu,
  X,
  Ticket,
  Home as HomeIcon,
  Lock,
  Clock,
  Phone,
  Navigation,
  ClipboardList,
} from 'lucide-react';
import { db } from '../firebase';
import { useAuth, getRoleHomeRoute } from '../context/AuthContext';
import { useLiveDate } from '../utils/liveDateEngine';
import { BookOpdModal, openBookOpdModal } from './BookOpdModal';

/**
 * Official-style SVG logos for Social Media links on the website
 */
export const FacebookLogoSvg: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
  </svg>
);

export const InstagramLogoSvg: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
  </svg>
);

export const WhatsAppLogoSvg: React.FC<{ className?: string }> = ({
  className = 'w-4 h-4',
}) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path d="M12.031 2c-5.506 0-9.989 4.478-9.99 9.984a9.964 9.964 0 001.333 4.993L2 22l5.233-1.237a9.994 9.994 0 004.779 1.217h.004c5.505 0 9.988-4.478 9.989-9.984 0-2.669-1.037-5.176-2.922-7.062A9.935 9.935 0 0012.031 2zm5.829 14.12c-.246.693-1.432 1.327-1.99 1.411-.513.077-1.163.11-1.879-.117-.434-.138-.99-.322-1.701-.629-2.991-1.291-4.946-4.303-5.095-4.502-.149-.199-1.217-1.618-1.217-3.086 0-1.468.769-2.189 1.042-2.488.273-.299.596-.373.794-.373.199 0 .397.002.571.01.183.009.428-.07.67.512.248.597.844 2.065.918 2.214.075.149.124.323.025.522-.099.199-.149.323-.298.497-.149.174-.313.388-.447.522-.149.149-.304.311-.131.609.174.298.772 1.273 1.658 2.063 1.139 1.015 2.099 1.33 2.397 1.479.298.149.472.124.646-.075.174-.199.745-.87.943-1.169.199-.298.397-.248.67-.149.273.099 1.738.82 2.036.969.298.149.497.224.571.348.075.125.075.721-.171 1.414z" />
  </svg>
);

export const PublicNavbar: React.FC = () => {
  const { firebaseUser, userProfile, role } = useAuth();
  const location = useLocation();
  const isLoggedIn = Boolean(firebaseUser || userProfile);
  const { displayDate, displayTime } = useLiveDate();

  const [logoUrl, setLogoUrl] = useState('');
  const [clinicName, setClinicName] = useState('Sandana Clinic');
  const [medicalName, setMedicalName] = useState('Dudrucs');
  const [clinicTimings, setClinicTimings] = useState(
    'Mon - Sat: 09:00 AM - 09:00 PM'
  );
  const [clinicPhone, setClinicPhone] = useState('+91 98400 11223');
  const [medicalPhone, setMedicalPhone] = useState('919840011224');
  const [clinicAddress, setClinicAddress] = useState(
    '42, MG Healthcare Road, Anna Nagar, Chennai'
  );
  const [googleMapUrl, setGoogleMapUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<{
    fb: string;
    insta: string;
    whatsapp: string;
  }>({
    fb: 'https://facebook.com',
    insta: 'https://instagram.com',
    whatsapp: '919840011224',
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubClinic = onSnapshot(
      doc(db, 'settings', 'clinic'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.logoUrl !== undefined) setLogoUrl(String(data.logoUrl || ''));
          if (data.clinicName) setClinicName(String(data.clinicName));
          if (data.medicalName) setMedicalName(String(data.medicalName));
          if (data.clinicTimings) setClinicTimings(String(data.clinicTimings));
          if (data.clinicPhone) setClinicPhone(String(data.clinicPhone));
          if (data.medicalPhone) setMedicalPhone(String(data.medicalPhone));
          if (data.clinicAddress) setClinicAddress(String(data.clinicAddress));
          if (data.googleMapUrl) setGoogleMapUrl(String(data.googleMapUrl));
        }
      },
      () => {}
    );

    const unsubSite = onSnapshot(
      doc(db, 'settings', 'site'),
      (snap) => {
        if (snap.exists()) {
          const s = snap.data();
          if (s.logoUrl) {
            setLogoUrl((prev) => prev || String(s.logoUrl));
          }
          if (s.socialLinks) {
            setSocialLinks({
              fb: String(s.socialLinks.fb || 'https://facebook.com'),
              insta: String(s.socialLinks.insta || 'https://instagram.com'),
              whatsapp: String(
                s.socialLinks.whatsapp || '919840011224'
              ),
            });
          }
        }
      },
      () => {}
    );

    return () => {
      unsubClinic();
      unsubSite();
    };
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const cleanMedicalBase =
    medicalName.replace(/\s*(medical\s*store|pharmacy)\s*$/i, '').trim() ||
    'Dudrucs';

  const activeMapHref =
    googleMapUrl.trim() ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${clinicName} ${clinicAddress}`
    )}`;

  const fbHref = socialLinks.fb.trim() || 'https://facebook.com';
  const instaHref = socialLinks.insta.trim() || 'https://instagram.com';
  const rawWa = socialLinks.whatsapp.trim() || medicalPhone;
  const whatsappHref = rawWa.startsWith('http')
    ? rawWa
    : `https://wa.me/${rawWa.replace(/[^0-9]/g, '')}`;

  return (
    <>
      <header className="no-print sticky top-0 z-40 bg-gradient-to-r from-[#0F2942] via-[#133B5C] to-[#0D4C5C] text-white shadow-lg border-b border-teal-400/30">
        {/* ROW 1: TOP STRIP — Live Date/Time + Helpline + Social Media Logos */}
        <div className="bg-[#091C2E]/95 border-b border-white/10 text-[11px] text-teal-100/90">
          <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2">
            {/* Left: Live Ticking Date/Time & Timings */}
            <div className="flex items-center gap-2.5 sm:gap-4 font-mono text-[10px] sm:text-xs">
              <span className="text-white font-bold flex items-center gap-1.5">
                <Clock size={12} className="text-teal-300 shrink-0" />
                <span>{displayDate}</span>
                <span className="text-teal-300 font-extrabold ml-0.5">
                  {displayTime}
                </span>
              </span>
              <span className="hidden lg:inline text-white/25">|</span>
              <span className="hidden lg:inline text-teal-200/90 font-sans font-medium text-[11px]">
                {clinicTimings}
              </span>
            </div>

            {/* Right: Helpline Phone + Clickable Social Media Logos */}
            <div className="flex items-center gap-2.5 sm:gap-3 ml-auto">
              <a
                href={`tel:${clinicPhone.replace(/[^0-9+]/g, '')}`}
                className="inline-flex items-center gap-1.5 font-mono font-bold text-amber-300 hover:text-amber-200 text-[11px] sm:text-xs transition-colors"
                title="Call Clinic Helpline"
              >
                <Phone size={12} className="shrink-0" />
                <span className="hidden sm:inline text-white/80 font-sans font-medium text-[11px]">
                  Helpline:
                </span>
                <span>{clinicPhone}</span>
              </a>

              <span className="text-white/25">|</span>

              {/* Social Media Logo Icons (Click to open Social Media) */}
              <div className="flex items-center gap-1.5">
                <a
                  href={fbHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Visit our Facebook Page"
                  aria-label="Facebook"
                  className="w-6 h-6 rounded-full bg-[#1877F2] hover:bg-[#1464cf] text-white flex items-center justify-center transition-transform hover:scale-110 shadow-2xs"
                >
                  <FacebookLogoSvg className="w-3.5 h-3.5" />
                </a>
                <a
                  href={instaHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Visit our Instagram Profile"
                  aria-label="Instagram"
                  className="w-6 h-6 rounded-full bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 text-white flex items-center justify-center transition-transform hover:scale-110 shadow-2xs"
                >
                  <InstagramLogoSvg className="w-3.5 h-3.5" />
                </a>
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Chat on WhatsApp"
                  aria-label="WhatsApp"
                  className="w-6 h-6 rounded-full bg-[#25D366] hover:bg-[#1ebe57] text-white flex items-center justify-center transition-transform hover:scale-110 shadow-2xs"
                >
                  <WhatsAppLogoSvg className="w-3.5 h-3.5" />
                </a>
                <a
                  href={activeMapHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open Clinic Location on Google Maps"
                  aria-label="Google Maps"
                  className="w-6 h-6 rounded-full bg-teal-500 hover:bg-teal-400 text-slate-950 flex items-center justify-center transition-transform hover:scale-110 shadow-2xs"
                >
                  <Navigation size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ROW 2: MAIN BRANDING & PRIMARY ACTIONS (Full Clinic Name Clearly Visible — Never Truncated) */}
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
          {/* Left: Full Visible Clinic & Pharmacy Brand Title */}
          <Link
            to="/"
            className="flex items-center gap-2.5 sm:gap-3.5 group min-w-0 flex-1"
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={clinicName}
                referrerPolicy="no-referrer"
                className="w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-2xl object-contain bg-white border-2 border-teal-300 p-1 shadow-md group-hover:scale-105 transition-transform shrink-0"
              />
            ) : (
              <div className="w-11 h-11 sm:w-13 sm:h-13 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-slate-950 flex items-center justify-center shadow-md group-hover:scale-105 transition-transform shrink-0">
                <Stethoscope
                  size={24}
                  strokeWidth={2.4}
                  className="sm:w-7 sm:h-7"
                />
              </div>
            )}

            <div className="leading-snug min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-base sm:text-xl md:text-2xl lg:text-[26px] font-black tracking-tight text-white">
                  {clinicName}
                </span>
                <span className="text-sm sm:text-lg md:text-xl font-extrabold text-teal-300">
                  &amp; {cleanMedicalBase} Pharmacy
                </span>
              </div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-sky-200/95 mt-0.5">
                Specialist Outpatient Clinic &middot; Marg ERP Medical Store
              </p>
            </div>
          </Link>

          {/* Right: Book OPD Popup Trigger + Portal Login + Mobile Menu Toggle */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <button
              type="button"
              onClick={() => openBookOpdModal()}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 text-xs sm:text-sm font-black uppercase tracking-wider shadow-md transition-all hover:-translate-y-0.5 cursor-pointer whitespace-nowrap"
            >
              <CalendarPlus size={16} className="shrink-0" />
              <span>Book OPD</span>
            </button>

            {isLoggedIn && role ? (
              <Link
                to={getRoleHomeRoute(role)}
                className="inline-flex items-center gap-2 bg-[#2B59C3] hover:bg-blue-600 text-white pl-2 pr-3.5 sm:pr-4 py-1.5 rounded-full border border-blue-300/40 shadow-md transition-all whitespace-nowrap"
              >
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-teal-400 text-slate-950 flex items-center justify-center font-bold shrink-0">
                  <ShieldCheck size={15} />
                </span>
                <span className="text-xs font-extrabold tracking-wide">
                  {role.toUpperCase()} Portal
                </span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-white hover:bg-teal-50 text-[#0F2942] pl-1.5 sm:pl-2 pr-3.5 sm:pr-5 py-1.5 rounded-full shadow-md transition-all group border border-teal-200 whitespace-nowrap"
              >
                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#0F2942] text-teal-300 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <Lock size={14} />
                </span>
                <span className="text-xs sm:text-sm font-black tracking-wide">
                  Portal Login
                </span>
              </Link>
            )}

            {/* Mobile/Tablet Hamburger Menu Button */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="lg:hidden p-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* ROW 3: DESKTOP NAVIGATION BAR (Spacious dedicated row so neither Brand nor Nav ever clips) */}
        <div className="hidden lg:block bg-[#0B2239]/90 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center justify-between gap-4">
            <nav className="flex items-center gap-1.5 text-xs font-extrabold">
              <Link
                to="/"
                className={`px-4 py-1.5 rounded-full transition-all whitespace-nowrap ${
                  location.pathname === '/'
                    ? 'bg-teal-400 text-slate-950 shadow-2xs'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Home
              </Link>
              <a
                href="/#about-care"
                className="px-4 py-1.5 rounded-full text-white hover:bg-white/10 transition-all whitespace-nowrap"
              >
                About Clinic
              </a>
              <a
                href="/#medicine-search"
                className="px-4 py-1.5 rounded-full text-teal-200 hover:bg-white/10 hover:text-white transition-all whitespace-nowrap"
              >
                Medicine Stock
              </a>
              <a
                href="/#doctors"
                className="px-4 py-1.5 rounded-full text-white hover:bg-white/10 transition-all whitespace-nowrap"
              >
                Specialist Doctors
              </a>
              <a
                href="/#location"
                className="px-4 py-1.5 rounded-full text-white hover:bg-white/10 transition-all whitespace-nowrap"
              >
                Google Maps
              </a>
              <Link
                to="/patient-prescriptions"
                className={`px-4 py-1.5 rounded-full transition-all inline-flex items-center gap-1.5 whitespace-nowrap ${
                  location.pathname === '/patient-prescriptions'
                    ? 'bg-amber-400 text-slate-950 shadow-2xs'
                    : 'text-amber-300 hover:bg-white/10'
                }`}
              >
                <ClipboardList size={13} className="shrink-0" />
                <span>Doctor Parchi / Rx</span>
              </Link>
              <Link
                to="/feedback"
                className={`px-4 py-1.5 rounded-full transition-all whitespace-nowrap ${
                  location.pathname === '/feedback'
                    ? 'bg-teal-400 text-slate-950 shadow-2xs'
                    : 'text-white hover:bg-white/10'
                }`}
              >
                Patient Reviews
              </Link>
            </nav>

            <div className="flex items-center gap-3 text-[11px] text-teal-200 font-semibold">
              <button
                type="button"
                onClick={() => openBookOpdModal()}
                className="text-teal-300 hover:text-white underline underline-offset-4 font-bold cursor-pointer whitespace-nowrap"
              >
                + Instant OPD Token Form
              </button>
            </div>
          </div>
        </div>

        {/* Mobile & Tablet Clean Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-[#0F2942] border-t border-white/15 shadow-2xl px-4 pt-3 pb-5 space-y-4 animate-fade-in-up">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-bold">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
              >
                <HomeIcon size={15} className="text-teal-300 shrink-0" />
                <span>Home Page</span>
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  openBookOpdModal();
                }}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-teal-400 text-slate-950 font-extrabold cursor-pointer text-left"
              >
                <CalendarPlus size={15} className="shrink-0" />
                <span>Book OPD Form</span>
              </button>
              <Link
                to="/patient-prescriptions"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-500/20 text-amber-200 border border-amber-400/40 font-bold"
              >
                <ClipboardList size={15} className="text-amber-300 shrink-0" />
                <span>Doctor Parchi / Rx</span>
              </Link>
              <a
                href="/#medicine-search"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
              >
                <Pill size={15} className="text-teal-300 shrink-0" />
                <span>Medicine Stock</span>
              </a>
              <a
                href="/#doctors"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
              >
                <Stethoscope size={15} className="text-teal-300 shrink-0" />
                <span>Doctors</span>
              </a>
              <a
                href="/#location"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
              >
                <Navigation size={15} className="text-teal-300 shrink-0" />
                <span>Google Maps</span>
              </a>
              <Link
                to="/feedback"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-2 p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/10"
              >
                <MessageSquareHeart
                  size={15}
                  className="text-teal-300 shrink-0"
                />
                <span>Reviews</span>
              </Link>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-teal-200">
                Department Portals
              </p>
              {isLoggedIn && role ? (
                <Link
                  to={getRoleHomeRoute(role)}
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full py-2.5 px-4 bg-teal-400 text-slate-950 text-xs font-extrabold rounded-xl flex items-center justify-center gap-2 shadow-sm"
                >
                  <ShieldCheck size={15} />
                  <span>Open {role.toUpperCase()} Dashboard</span>
                </Link>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Link
                    to="/login/pharmacy"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 border border-white/15"
                  >
                    <Pill size={15} className="text-amber-300 shrink-0" />
                    <span>Pharmacy</span>
                  </Link>
                  <Link
                    to="/login/admin"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 border border-white/15"
                  >
                    <ShieldCheck size={15} className="text-teal-300 shrink-0" />
                    <span>Admin</span>
                  </Link>
                  <Link
                    to="/login/doctor"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 border border-white/15"
                  >
                    <UserCheck
                      size={15}
                      className="text-emerald-300 shrink-0"
                    />
                    <span>Doctor</span>
                  </Link>
                  <Link
                    to="/login/reception"
                    onClick={() => setMobileMenuOpen(false)}
                    className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-2 border border-white/15"
                  >
                    <Ticket size={15} className="text-sky-300 shrink-0" />
                    <span>Reception</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Global Book OPD Popup Modal */}
      <BookOpdModal clinicName={clinicName} />
    </>
  );
};
