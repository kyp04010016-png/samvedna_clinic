import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  CalendarPlus,
  MapPin,
  MessageCircle,
  Phone,
  RotateCcw,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { PublicMedicineSummary } from './MedicineAvailabilitySearch';
import { DoctorRecord } from '../pages/public/Home';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

interface AiClinicChatProps {
  clinicName: string;
  medicalName: string;
  clinicPhone: string;
  medicalPhone?: string;
  clinicAddress: string;
  clinicTimings: string;
  googleMapUrl?: string;
  clinicInfo?: string;
  inventory: PublicMedicineSummary[];
  doctors: DoctorRecord[];
  externalPrompt?: string | null;
  onClearExternalPrompt?: () => void;
}

/**
 * Extracts visible text from the live website DOM so the AI Assistant
 * can read all sections, headings, doctor cards, services, and announcements on the page.
 */
function extractLiveWebsiteText(): string {
  if (typeof document === 'undefined') return '';
  try {
    const rawText = document.body?.innerText || '';
    return rawText
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 5000);
  } catch {
    return '';
  }
}

/**
 * Renders formatted markdown (**bold** and line breaks) cleanly without raw asterisks.
 */
function renderFormattedMessage(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, lineIdx) => {
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return (
      <React.Fragment key={lineIdx}>
        {parts.map((part, partIdx) => {
          if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
            return (
              <strong key={partIdx} className="font-extrabold text-slate-950">
                {part.slice(2, -2)}
              </strong>
            );
          }
          return <span key={partIdx}>{part}</span>;
        })}
        {lineIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

export const AiClinicChat: React.FC<AiClinicChatProps> = ({
  clinicName,
  medicalName,
  clinicPhone,
  medicalPhone,
  clinicAddress,
  clinicTimings,
  googleMapUrl,
  clinicInfo,
  inventory,
  doctors,
  externalPrompt,
  onClearExternalPrompt,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const cleanMedName = medicalName
    .replace(/\s*medical\s*store\s*/gi, '')
    .replace(/\s*pharmacy\s*/gi, '')
    .trim() || 'Dudrucs';

  const getWelcomeMessage = (): ChatMessage => ({
    id: 'welcome_1',
    role: 'assistant',
    text: `Namaste! 🙏 Main **${clinicName} & ${cleanMedName} Medical Store** ka Smart AI Assistant hoon.\n\nMaine poori website, live doctor schedule aur pharmacy stock padh liya hai. Aap mujhse Hindi, Hinglish ya English me pooch sakte hain:\n• 💊 **Live Medicine Stock & Rate** (jaise *"Dolo 650 hai kya?"*)\n• 👨‍⚕️ **Specialist Doctors, OPD Timings & Fees**\n• 📅 **Mobile OTP se Instant Appointment Booking**\n• 📍 **Clinic Address, Google Map & WhatsApp Order**\n\nBataiye, aaj main aapki kya madad kar sakta hoon? 😊`,
    timestamp: new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    }),
  });

  const [messages, setMessages] = useState<ChatMessage[]>([getWelcomeMessage()]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const buildClientSmartReply = (userQuestion: string): string => {
    const q = userQuestion.toLowerCase().trim();

    // 1. Check specific medicine in live inventory
    const matched = inventory.filter((m) => {
      const mName = m.name.toLowerCase();
      const firstWord = mName.split(/[\s\-()]+/)[0];
      return (
        q.includes(mName) ||
        (firstWord.length >= 3 && q.includes(firstWord)) ||
        q.includes((m.brand || '').toLowerCase()) ||
        (m.genericName &&
          m.genericName
            .toLowerCase()
            .split(/[+\s,]+/)
            .some((p) => p.length > 3 && q.includes(p)))
      );
    });

    if (matched.length > 0) {
      const medLines = matched
        .map(
          (m) =>
            `• **${m.name}** (${m.genericName || m.brand}) — ${
              m.totalStock > 0
                ? `✅ **In Stock (${m.totalStock} ${m.unit}s)**`
                : '❌ Out of Stock'
            }\n  💰 **Rate: ₹${m.sellPrice}** (MRP ₹${m.mrp}, Batch: ${m.batchNo})`
        )
        .join('\n\n');
      return `Ji bilkul! **${cleanMedName} Medical Store** ke live stock ke anusar:\n\n${medLines}\n\n📲 Aap niche **WhatsApp Order** button daba kar bhi yeh dawa mangwa sakte hain!`;
    }

    // 2. Doctor / Appointment / Fee query
    if (
      /\b(doctor|dr|appointment|book|opd|fee|fees|slot|timing|specialist|bukhar|fever|dard|pain|cold|khansi)\b/i.test(
        q
      )
    ) {
      const docLines = doctors
        .map(
          (d) =>
            `• **${d.name}** (*${d.specialization}*, ${d.qualification})\n  💰 Fee: **₹${d.consultationFee ?? 300}** | 🗓️ ${d.availableDays.join(', ')}\n  ⏰ Slots: ${d.availableSlots.slice(0, 4).join(', ')}`
        )
        .join('\n\n');
      return `👨‍⚕️ **${clinicName} Specialist Doctors & OPD Timings:**\n\n${docLines}\n\n📅 **Clinic Timings:** ${clinicTimings}\nAap niche **"Book Appointment"** button par click karke 10-digit Mobile OTP se turant apna OPD Token book kar sakte hain!`;
    }

    // 3. Location / Map / Address / Contact
    if (/\b(address|location|map|kaha|kahan|phone|number|contact|call)\b/i.test(q)) {
      return `📍 **${clinicName} & ${cleanMedName} Medical Store Address:**\n\n• **Location:** ${clinicAddress}\n• **Timings:** ${clinicTimings}\n• **Clinic Helpline:** ${clinicPhone}\n• **Pharmacy WhatsApp:** ${medicalPhone || clinicPhone}\n\nNiche **"Google Maps"** button par click karke seedhe clinic ka rasta dekhein! 😊`;
    }

    return `Namaste! 🙏 **${clinicName} & ${cleanMedName} Medical Store** me aapka swagat hai.\n\n• **Specialist Doctors:** ${doctors.map((d) => d.name).join(', ')}\n• **Live Pharmacy Stock:** ${inventory.length}+ genuine FIFO batch medicines available\n• **Address:** ${clinicAddress}\n• **Helpline:** ${clinicPhone}\n\nAap mujhse kisi bhi dawa ka rate, doctor ki fees, ya appointment ke baare me pooch sakte hain! 😊`;
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const liveWebsiteContent = extractLiveWebsiteText();

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-8).map((m) => ({
            role: m.role,
            text: m.text,
          })),
          inventory: inventory.map((m) => ({
            name: m.name,
            genericName: m.genericName,
            brand: m.brand,
            unit: m.unit,
            scheduleType: m.scheduleType,
            sellPrice: m.sellPrice,
            mrp: m.mrp,
            totalStock: m.totalStock,
            batchNo: m.batchNo,
            expiryDate: m.expiryDate,
          })),
          doctors: doctors.map((d) => ({
            name: d.name,
            specialization: d.specialization,
            qualification: d.qualification,
            availableDays: d.availableDays,
            availableSlots: d.availableSlots,
            consultationFee: d.consultationFee,
            experience: d.experience,
            languages: d.languages,
            bio: d.bio,
          })),
          clinicName,
          medicalName: cleanMedName,
          clinicPhone,
          medicalPhone: medicalPhone || clinicPhone,
          clinicAddress,
          clinicTimings,
          googleMapUrl: googleMapUrl || '',
          clinicInfo: clinicInfo || '',
          websiteContent: liveWebsiteContent,
        }),
      });

      const data = await response.json();
      const replyText = data?.reply || buildClientSmartReply(trimmed);

      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } catch {
      const fallbackText = buildClientSmartReply(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          role: 'assistant',
          text: fallbackText,
          timestamp: new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (externalPrompt) {
      setIsOpen(true);
      sendMessage(externalPrompt);
      if (onClearExternalPrompt) {
        onClearExternalPrompt();
      }
    }
  }, [externalPrompt]);

  const quickQuestions = [
    'Namaste! Clinic ke baare me batao',
    'Dolo 650 aur Pan-D stock me hai?',
    'Aaj kaun se Doctor available hain?',
    'Appointment OTP se kaise book karein?',
    'Clinic ka Address & Google Map',
  ];

  const whatsappNumber = (medicalPhone || clinicPhone).replace(/[^0-9]/g, '');

  return (
    <>
      {/* FLOATING AI CHAT LAUNCHER BUTTON */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        {!isOpen && (
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="group flex items-center gap-3 px-5 py-3.5 rounded-full bg-gradient-to-r from-[#0284C7] via-[#0E6482] to-teal-700 text-white font-extrabold text-sm shadow-2xl shadow-sky-900/35 hover:scale-105 transition-all border-2 border-white cursor-pointer"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400" />
            </span>
            <Sparkles size={18} className="text-amber-300" />
            <span>AI Clinic &amp; Pharmacy Sahayak</span>
          </button>
        )}
      </div>

      {/* AI CHAT DRAWER / MODAL */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100vw-1.5rem)] sm:w-[430px] max-h-[85vh] bg-white rounded-3xl border-2 border-[#0284C7] shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#0c4a6e] via-[#0284C7] to-teal-700 text-white px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
                <Bot size={22} className="text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-extrabold tracking-tight">
                    {clinicName} AI Sahayak
                  </h3>
                  <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase bg-amber-400 text-slate-950 rounded">
                    LIVE WEBSITE AI
                  </span>
                </div>
                <p className="text-[11px] text-sky-100">
                  Reads Website, {cleanMedName} Stock &amp; Doctor Timings
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMessages([getWelcomeMessage()])}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title="Reset / New Conversation"
              >
                <RotateCcw size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                aria-label="Close AI Chat"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Prompt Bar */}
          <div className="px-3.5 py-2.5 bg-sky-50/80 border-b border-sky-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {quickQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                className="shrink-0 text-[11px] font-bold px-3 py-1.5 rounded-full bg-white hover:bg-[#0284C7] hover:text-white text-[#0c4a6e] border border-sky-200 transition-colors cursor-pointer shadow-2xs"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Messages List */}
          <div className="flex-1 p-4 space-y-3.5 overflow-y-auto bg-slate-50/70 min-h-[300px] max-h-[390px]">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex items-start gap-2.5 ${
                  m.role === 'user' ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    m.role === 'user'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-[#0284C7] text-white'
                  }`}
                >
                  {m.role === 'user' ? <User size={14} /> : <Bot size={15} />}
                </div>
                <div
                  className={`max-w-[84%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-2xs ${
                    m.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-xs'
                  }`}
                >
                  <div>
                    {m.role === 'assistant'
                      ? renderFormattedMessage(m.text)
                      : m.text}
                  </div>
                  <div
                    className={`text-[9px] mt-1.5 text-right ${
                      m.role === 'user' ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-xs text-[#0284C7] font-bold px-2 py-1 bg-sky-50 border border-sky-200 rounded-xl w-fit">
                <div className="w-2 h-2 rounded-full bg-[#0284C7] animate-ping" />
                Website, Doctor Schedule &amp; {cleanMedName} Stock padh raha hoon...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Instant Action Strip (Book Appointment, WhatsApp, Google Maps, Call) */}
          <div className="px-3.5 py-2 bg-slate-100 border-t border-slate-200 flex items-center justify-between gap-1.5 text-[11px] font-bold overflow-x-auto no-scrollbar">
            <Link
              to="/book"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#0284C7] text-white hover:bg-[#0369A1] shrink-0"
            >
              <CalendarPlus size={12} />
              Book Appointment
            </Link>
            <a
              href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
                `Namaste ${clinicName} & ${cleanMedName} Medical Store, mujhe medicine / appointment ki jankari chahiye.`
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
            >
              <MessageCircle size={12} />
              WhatsApp Order
            </a>
            {googleMapUrl && (
              <a
                href={googleMapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shrink-0"
              >
                <MapPin size={12} className="text-[#0284C7]" />
                Google Map
              </a>
            )}
            <a
              href={`tel:${clinicPhone}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 shrink-0"
            >
              <Phone size={12} className="text-emerald-600" />
              Call
            </a>
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
            className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hindi ya English me poochiye (Medicine, Doctor, Timing)..."
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-100 focus:bg-white border border-slate-200 focus:border-[#0284C7] text-xs text-slate-900 outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="p-2.5 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] disabled:opacity-50 text-white transition-colors cursor-pointer"
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
