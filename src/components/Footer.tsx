import React from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin,
  Phone,
  Clock,
  Stethoscope,
  CalendarPlus,
  Navigation,
} from 'lucide-react';
import {
  FacebookLogoSvg,
  InstagramLogoSvg,
  WhatsAppLogoSvg,
} from './PublicNavbar';
import { openBookOpdModal } from './BookOpdModal';

export interface SocialLinksConfig {
  fb?: string;
  insta?: string;
  whatsapp?: string;
  googleMapUrl?: string;
}

interface FooterProps {
  clinicName?: string;
  medicalName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicTimings?: string;
  medicalPhone?: string;
  clinicInfo?: string;
  googleMapUrl?: string;
  socialLinks?: SocialLinksConfig;
}

export const Footer: React.FC<FooterProps> = ({
  clinicName = 'Sandana Clinic',
  medicalName = 'Dudrucs',
  clinicAddress = '42, MG Healthcare Road, Anna Nagar, Chennai - 600040',
  clinicPhone = '+91 98400 11223',
  clinicTimings = 'Mon - Sat: 09:00 AM - 09:00 PM | Sun: 10:00 AM - 02:00 PM',
  medicalPhone = '919840011224',
  clinicInfo = 'Sandana Clinic & Dudrucs Pharmacy provides trusted outpatient consultations, specialist care, and 100% genuine batch-tracked medicines.',
  googleMapUrl,
  socialLinks,
}) => {
  const fbUrl = socialLinks?.fb?.trim() || 'https://facebook.com';
  const instaUrl = socialLinks?.insta?.trim() || 'https://instagram.com';
  const rawWhatsapp = socialLinks?.whatsapp?.trim() || medicalPhone;
  const whatsappHref = rawWhatsapp.startsWith('http')
    ? rawWhatsapp
    : `https://wa.me/${rawWhatsapp.replace(/[^0-9]/g, '')}`;
  const effectiveMapUrl =
    googleMapUrl?.trim() ||
    socialLinks?.googleMapUrl?.trim() ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${clinicName} ${clinicAddress}`
    )}`;

  return (
    <footer className="no-print bg-[#152C69] text-blue-100 border-t-4 border-[#74A3F7] mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Col 1: Brand & Admin-Controlled Clinic Info + Social Media Logos */}
        <div className="md:col-span-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2B59C3] border border-[#74A3F7]/40 text-white flex items-center justify-center shadow-sm shrink-0">
              <Stethoscope size={19} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">
                {clinicName} &amp; {medicalName} Pharmacy
              </h3>
              <p className="text-xs text-[#74A3F7] font-semibold">
                Outpatient Clinic &amp; Marg ERP Medical Store
              </p>
            </div>
          </div>

          <p className="text-xs text-blue-200/85 leading-relaxed max-w-md">
            {clinicInfo}
          </p>

          {/* Clickable Social Media Logos */}
          <div className="pt-1 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-blue-200">
              Connect With Us on Social Media:
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={fbUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Facebook Page"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#1877F2] hover:bg-[#1464cf] text-white text-xs font-bold transition-transform hover:-translate-y-0.5 shadow-xs"
              >
                <FacebookLogoSvg className="w-4 h-4 shrink-0" />
                <span>Facebook</span>
              </a>
              <a
                href={instaUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Instagram Profile"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 hover:opacity-95 text-white text-xs font-bold transition-transform hover:-translate-y-0.5 shadow-xs"
              >
                <InstagramLogoSvg className="w-4 h-4 shrink-0" />
                <span>Instagram</span>
              </a>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                title="Chat on WhatsApp"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#25D366] hover:bg-[#1ebe57] text-white text-xs font-bold transition-transform hover:-translate-y-0.5 shadow-xs"
              >
                <WhatsAppLogoSvg className="w-4 h-4 shrink-0" />
                <span>WhatsApp</span>
              </a>
              <a
                href={effectiveMapUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open Google Maps Location"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#2B59C3] hover:bg-[#3B6EE3] text-white text-xs font-bold transition-transform hover:-translate-y-0.5 shadow-xs"
              >
                <Navigation size={14} className="shrink-0" />
                <span>Google Maps</span>
              </a>
            </div>
          </div>
        </div>

        {/* Col 2: Contact & Timings */}
        <div className="md:col-span-4 space-y-3 text-xs">
          <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
            Clinic Location &amp; Hours
          </h4>
          <a
            href={effectiveMapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-start gap-2.5 text-blue-100 hover:text-[#74A3F7] transition-colors group"
          >
            <MapPin size={15} className="text-[#74A3F7] shrink-0 mt-0.5" />
            <div>
              <span>{clinicAddress}</span>
              <span className="block text-[11px] font-bold text-[#74A3F7] group-hover:underline mt-0.5">
                Get Directions on Google Maps →
              </span>
            </div>
          </a>
          <div className="flex items-center gap-2.5 text-blue-100">
            <Phone size={15} className="text-[#74A3F7] shrink-0" />
            <span className="font-mono font-bold">{clinicPhone}</span>
          </div>
          <div className="flex items-start gap-2.5 text-blue-100">
            <Clock size={15} className="text-[#74A3F7] shrink-0 mt-0.5" />
            <span>{clinicTimings}</span>
          </div>
        </div>

        {/* Col 3: Quick Links (MySQL Database Download Removed) */}
        <div className="md:col-span-3 space-y-3 text-xs">
          <h4 className="text-sm font-extrabold text-white uppercase tracking-wider">
            Patient &amp; Staff Portal
          </h4>
          <ul className="space-y-2.5">
            <li>
              <button
                type="button"
                onClick={() => openBookOpdModal()}
                className="inline-flex items-center gap-1.5 text-[#74A3F7] hover:text-white font-bold cursor-pointer text-left"
              >
                <CalendarPlus size={13} />
                <span>+ Book OPD Appointment (Popup Form)</span>
              </button>
            </li>
            <li>
              <Link
                to="/patient-prescriptions"
                className="text-blue-200 hover:text-white transition-colors"
              >
                + Check Doctor Parchi / Prescription
              </Link>
            </li>
            <li>
              <Link
                to="/feedback"
                className="text-blue-200 hover:text-white transition-colors"
              >
                + Submit Patient Feedback &amp; Rating
              </Link>
            </li>
            <li>
              <Link
                to="/login"
                className="text-blue-200 hover:text-white transition-colors"
              >
                + Staff &amp; Doctor Login
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10 py-4 text-center text-[11px] text-blue-300/80 px-4">
        © {new Date().getFullYear()} {clinicName} &amp; {medicalName} Medical Store. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
