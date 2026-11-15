import React from 'react';
import SliderLib from 'react-slick';
import { Link } from 'react-router-dom';
import { CalendarPlus, ShieldCheck, Sparkles } from 'lucide-react';

// Handle ESM/CJS default export interoperability in Vite 8
const SlickSlider: any = (SliderLib as any).default || SliderLib;

export interface HeroSlideItem {
  url: string;
  title?: string;
  subtitle?: string;
}

interface SliderProps {
  images: string[];
  clinicName?: string;
  medicalName?: string;
}

const DEFAULT_CLINIC_SLIDES: HeroSlideItem[] = [
  {
    url: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=1400&q=80',
    title: 'Sandana Clinic — Compassionate Outpatient Care',
    subtitle:
      'Experienced specialists, digital OTP-verified appointment booking, and zero waiting room hassle.',
  },
  {
    url: 'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1400&q=80',
    title: 'Dudrucs Pharmacy — 100% Genuine Batch-Tracked Medicines',
    subtitle:
      'FIFO expiry verification, computerised GST billing, and instant UPI QR payments.',
  },
  {
    url: 'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1400&q=80',
    title: 'Modern Diagnostics & Family Healthcare Under One Roof',
    subtitle:
      'Book your consultation slot online in 30 seconds with instant Email OTP confirmation.',
  },
];

export const Slider: React.FC<SliderProps> = ({
  images,
  clinicName = 'Sandana Clinic',
  medicalName = 'Dudrucs',
}) => {
  const validCustomUrls = (images || []).filter(
    (img) => typeof img === 'string' && img.trim().length > 4
  );

  const slides: HeroSlideItem[] =
    validCustomUrls.length > 0
      ? validCustomUrls.map((url, idx) => ({
          url,
          title:
            idx === 0
              ? `${clinicName} & ${medicalName} Pharmacy`
              : idx === 1
                ? 'Trusted Specialists & Genuine Medicines'
                : `${clinicName} Healthcare Center`,
          subtitle:
            'Book your outpatient appointment online with instant 6-digit OTP verification.',
        }))
      : DEFAULT_CLINIC_SLIDES;

  const settings = {
    dots: true,
    infinite: slides.length > 1,
    speed: 700,
    slidesToShow: 1,
    slidesToScroll: 1,
    autoplay: slides.length > 1,
    autoplaySpeed: 4200,
    pauseOnHover: true,
    arrows: false,
  };

  return (
    <div className="relative rounded-2xl overflow-hidden shadow-lg border border-emerald-100 bg-slate-900">
      <SlickSlider {...settings}>
        {slides.map((slide, index) => (
          <div key={`${slide.url}-${index}`} className="relative h-[320px] sm:h-[400px] md:h-[440px]">
            <img
              src={slide.url}
              alt={slide.title || `${clinicName} slide ${index + 1}`}
              className="w-full h-full object-cover opacity-75 transition-transform duration-700 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/60 to-transparent flex items-center">
              <div className="max-w-2xl px-4 sm:px-8 md:px-12 space-y-2.5 sm:space-y-4 text-white animate-fade-in-up">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-md bg-emerald-600/90 text-white text-[10px] sm:text-xs font-bold tracking-wide uppercase">
                  <Sparkles size={12} className="shrink-0" />
                  <span className="truncate">{clinicName} + {medicalName}</span>
                </div>
                <h2 className="text-xl sm:text-3xl md:text-4xl font-extrabold tracking-tight leading-tight line-clamp-2">
                  {slide.title}
                </h2>
                <p className="text-xs sm:text-sm md:text-base text-slate-200 leading-relaxed max-w-xl line-clamp-2 sm:line-clamp-none">
                  {slide.subtitle}
                </p>
                <div className="pt-1 sm:pt-2 flex flex-wrap items-center gap-2 sm:gap-3">
                  <Link
                    to="/book"
                    className="inline-flex items-center gap-1.5 px-3.5 sm:px-5 py-2 sm:py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all shrink-0"
                  >
                    <CalendarPlus size={15} />
                    <span>Book Appointment</span>
                  </Link>
                  <a
                    href="#doctors"
                    className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 sm:py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-xs text-white text-xs sm:text-sm font-semibold rounded-xl border border-white/25 transition-colors shrink-0"
                  >
                    <ShieldCheck size={15} />
                    <span>Today&apos;s Doctors</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </SlickSlider>
    </div>
  );
};

export default Slider;
