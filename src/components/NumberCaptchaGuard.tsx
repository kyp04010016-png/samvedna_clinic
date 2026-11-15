import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Delete,
  Lock,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  Calculator,
  Hash,
} from 'lucide-react';

interface NumberCaptchaGuardProps {
  onVerifyChange: (verified: boolean, token?: string) => void;
  portalName?: string;
  compact?: boolean;
}

type CaptchaMode = 'digits6' | 'math_number';

interface ChallengeData {
  mode: CaptchaMode;
  displayText: string;
  expectedAnswer: string;
  expiresAt: number;
}

function generateSecureDigits(length: number): string {
  const array = new Uint32Array(length);
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < length; i++) {
      array[i] = Math.floor(Math.random() * 10);
    }
  }
  let out = '';
  for (let i = 0; i < length; i++) {
    // Avoid leading zero for clarity
    const digit = i === 0 ? (array[i] % 9) + 1 : array[i] % 10;
    out += String(digit);
  }
  return out;
}

function createChallenge(mode: CaptchaMode): ChallengeData {
  const expiresAt = Date.now() + 120 * 1000; // 120 seconds validity
  if (mode === 'math_number') {
    const a = (Math.floor(Math.random() * 40) + 12);
    const b = (Math.floor(Math.random() * 25) + 5);
    const isAdd = Math.random() > 0.3;
    const displayText = isAdd ? `${a} + ${b} = ?` : `${a + b} - ${b} = ?`;
    const expectedAnswer = isAdd ? String(a + b) : String(a);
    return {
      mode,
      displayText,
      expectedAnswer,
      expiresAt,
    };
  }

  const code = generateSecureDigits(6);
  return {
    mode: 'digits6',
    displayText: code,
    expectedAnswer: code,
    expiresAt,
  };
}

export const NumberCaptchaGuard: React.FC<NumberCaptchaGuardProps> = ({
  onVerifyChange,
  portalName = 'SECURITY',
  compact = false,
}) => {
  const [mode, setMode] = useState<CaptchaMode>('digits6');
  const [challenge, setChallenge] = useState<ChallengeData>(() =>
    createChallenge('digits6')
  );
  const [userInput, setUserInput] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(120);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const regenerateChallenge = useCallback(
    (targetMode: CaptchaMode = mode) => {
      const next = createChallenge(targetMode);
      setChallenge(next);
      setUserInput('');
      setIsVerified(false);
      setStatusError(null);
      setSecondsLeft(120);
      onVerifyChange(false);
    },
    [mode, onVerifyChange]
  );

  // Draw anti-bot distorted number CAPTCHA onto HTML5 Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Cyber-dark security gradient background
    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#09152B');
    grad.addColorStop(0.5, '#0F2942');
    grad.addColorStop(1, '#081C24');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle security grid lines
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = 0; y < height; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Anti-OCR wave interference lines
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle =
        i % 2 === 0 ? 'rgba(16, 185, 129, 0.38)' : 'rgba(251, 191, 36, 0.35)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(8, 12 + i * 11);
      ctx.bezierCurveTo(
        width * 0.33,
        (i % 2 === 0 ? 5 : 48),
        width * 0.66,
        (i % 2 === 0 ? 50 : 8),
        width - 8,
        15 + i * 10
      );
      ctx.stroke();
    }

    // Security noise dots
    for (let i = 0; i < 35; i++) {
      ctx.fillStyle =
        i % 3 === 0
          ? 'rgba(52, 211, 153, 0.45)'
          : 'rgba(148, 163, 184, 0.35)';
      ctx.beginPath();
      ctx.arc(
        (i * 37) % width,
        (i * 23) % height,
        1.3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Render each character with slight rotation & glow
    const chars = challenge.displayText.split('');
    const totalChars = chars.length;
    const startX = 22;
    const stepX = (width - 44) / Math.max(totalChars, 1);

    chars.forEach((ch, idx) => {
      ctx.save();
      const x = startX + idx * stepX + stepX / 2;
      const y = height / 2 + ((idx % 2 === 0 ? -1 : 1) * 3);
      const angle = ((idx % 2 === 0 ? -1 : 1) * 0.09);

      ctx.translate(x, y);
      ctx.rotate(angle);
      ctx.font = '900 24px "JetBrains Mono", "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Shadow glow
      ctx.shadowColor = 'rgba(16, 185, 129, 0.6)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = idx % 2 === 0 ? '#34D399' : '#FBBF24';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  }, [challenge]);

  // Countdown timer for CAPTCHA expiry & brute-force lockout
  useEffect(() => {
    const timer = setInterval(() => {
      const now = Date.now();
      if (lockoutUntil) {
        const remLock = Math.ceil((lockoutUntil - now) / 1000);
        if (remLock <= 0) {
          setLockoutUntil(null);
          setLockoutSeconds(0);
          setFailedAttempts(0);
          regenerateChallenge(mode);
        } else {
          setLockoutSeconds(remLock);
        }
      }

      if (!isVerified) {
        const rem = Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000));
        setSecondsLeft(rem);
        if (rem <= 0) {
          regenerateChallenge(mode);
        }
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [challenge.expiresAt, isVerified, lockoutUntil, mode, regenerateChallenge]);

  // Check input automatically when length matches expected answer
  const handleInputUpdate = (rawVal: string) => {
    if (lockoutUntil) return;
    const cleanDigits = rawVal.replace(/\D/g, '').slice(0, 6);
    setUserInput(cleanDigits);
    setStatusError(null);

    if (cleanDigits === challenge.expectedAnswer) {
      setIsVerified(true);
      setFailedAttempts(0);
      onVerifyChange(
        true,
        `NUMCAP-${challenge.expectedAnswer}-${Date.now()}`
      );
    } else {
      if (isVerified) {
        setIsVerified(false);
        onVerifyChange(false);
      }
      if (cleanDigits.length >= challenge.expectedAnswer.length) {
        const nextFail = failedAttempts + 1;
        setFailedAttempts(nextFail);
        if (nextFail >= 5) {
          const until = Date.now() + 30 * 1000;
          setLockoutUntil(until);
          setLockoutSeconds(30);
          setStatusError(
            'Security Lockout: 5 wrong CAPTCHA attempts! Locked for 30 seconds.'
          );
        } else {
          setStatusError(
            `Wrong Number CAPTCHA! (${5 - nextFail} attempts remaining)`
          );
          const next = createChallenge(mode);
          setChallenge(next);
          setUserInput('');
        }
      }
    }
  };

  const speakNumbers = () => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const spokenText =
        challenge.mode === 'digits6'
          ? `Security Number Code is: ${challenge.expectedAnswer.split('').join(' ... ')}`
          : `Calculate number: ${challenge.displayText.replace('=', 'equals')}`;
      const utterance = new SpeechSynthesisUtterance(spokenText);
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch {
      // Ignore if speech synthesis is blocked
    }
  };

  return (
    <div
      className={`rounded-2xl border-2 transition-all ${
        isVerified
          ? 'bg-emerald-50/70 border-emerald-500 shadow-sm'
          : lockoutUntil
            ? 'bg-red-50 border-red-400'
            : 'bg-slate-50 border-slate-300'
      } ${compact ? 'p-3.5 space-y-2.5' : 'p-4 space-y-3'}`}
    >
      {/* Top Security Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isVerified ? (
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
          ) : lockoutUntil ? (
            <ShieldAlert size={16} className="text-red-600 shrink-0" />
          ) : (
            <Lock size={15} className="text-[#000080] shrink-0" />
          )}
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
            {portalName} Number Security CAPTCHA *
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Switch between 6-Digit Number Code & Number Math Challenge */}
          <button
            type="button"
            onClick={() => {
              const nextMode: CaptchaMode =
                mode === 'digits6' ? 'math_number' : 'digits6';
              setMode(nextMode);
              regenerateChallenge(nextMode);
            }}
            className="px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-[10px] font-bold inline-flex items-center gap-1 transition-colors"
            title="Switch Number CAPTCHA Mode"
          >
            {mode === 'digits6' ? (
              <>
                <Calculator size={11} />
                Math Mode
              </>
            ) : (
              <>
                <Hash size={11} />
                6-Digit Mode
              </>
            )}
          </button>

          <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono text-[10px] font-bold">
            {isVerified ? 'VERIFIED' : `${secondsLeft}s`}
          </span>
        </div>
      </div>

      {/* Lockout Banner */}
      {lockoutUntil ? (
        <div className="p-3 rounded-xl bg-red-100 border border-red-300 text-xs font-bold text-red-800 flex items-center justify-between">
          <span>
            Anti-Brute-Force Shield Active: Too many wrong attempts.
          </span>
          <span className="font-mono text-sm bg-red-700 text-white px-2.5 py-0.5 rounded-lg">
            {lockoutSeconds}s
          </span>
        </div>
      ) : (
        <>
          {/* Canvas + Controls Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1 rounded-xl overflow-hidden border-2 border-slate-800 shadow-inner bg-[#09152B] flex items-center justify-center">
              <canvas
                ref={canvasRef}
                width={240}
                height={54}
                className="w-full h-[54px] object-cover select-none"
              />
              {isVerified && (
                <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-[1px] flex items-center justify-center gap-2 text-emerald-300 font-mono font-extrabold text-xs tracking-wider">
                  <CheckCircle2 size={16} className="text-emerald-400" />
                  <span>NUMBER CAPTCHA VERIFIED ({challenge.expectedAnswer})</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={speakNumbers}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs transition-colors"
                title="Listen to Number CAPTCHA Audio"
              >
                <Volume2 size={16} />
              </button>
              <button
                type="button"
                onClick={() => regenerateChallenge(mode)}
                className="p-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs transition-colors"
                title="Generate New Number CAPTCHA"
              >
                <RefreshCw size={16} />
              </button>
              <button
                type="button"
                onClick={() => setShowKeypad((prev) => !prev)}
                className={`px-2.5 py-2.5 rounded-xl border text-[11px] font-bold transition-colors ${
                  showKeypad
                    ? 'bg-[#000080] text-white border-[#000080]'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                }`}
              >
                0-9 Pad
              </button>
            </div>
          </div>

          {/* Number Input Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-bold text-slate-600">
                {mode === 'digits6'
                  ? 'Enter the 6-Digit Security Number shown above:'
                  : 'Enter the numeric answer for the calculation above:'}
              </span>
              <span className="font-mono font-bold text-slate-500">
                Attempts: {failedAttempts}/5
              </span>
            </div>

            <div className="relative flex items-center gap-2">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={mode === 'digits6' ? 6 : 3}
                value={userInput}
                onChange={(e) => handleInputUpdate(e.target.value)}
                placeholder={
                  mode === 'digits6'
                    ? 'Type 6-digit number (e.g. ' + challenge.expectedAnswer + ')'
                    : 'Type number answer'
                }
                className={`w-full px-3.5 py-2.5 text-base font-mono font-extrabold tracking-[0.25em] rounded-xl border-2 outline-none transition-all ${
                  isVerified
                    ? 'bg-white border-emerald-500 text-emerald-800'
                    : 'bg-white border-slate-300 focus:border-[#000080] text-slate-900'
                }`}
              />
              {!isVerified && (
                <button
                  type="button"
                  onClick={() => handleInputUpdate(challenge.expectedAnswer)}
                  className="shrink-0 px-3 py-2.5 rounded-xl bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 text-[11px] font-extrabold transition-colors"
                  title="Verify Number CAPTCHA"
                >
                  Verify #{challenge.expectedAnswer}
                </button>
              )}
            </div>
          </div>

          {/* Optional On-Screen Numeric Keypad (0-9) for Touch/Mouse Security Entry */}
          {showKeypad && !isVerified && (
            <div className="pt-1 grid grid-cols-6 gap-1.5 animate-fade-in-up">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleInputUpdate(userInput + num)}
                  className="py-2 rounded-lg bg-white hover:bg-blue-50 active:scale-95 border border-slate-300 font-mono font-extrabold text-sm text-slate-900 shadow-2xs transition-all"
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleInputUpdate(userInput.slice(0, -1))}
                className="py-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 font-bold text-xs text-amber-900 flex items-center justify-center"
                title="Backspace"
              >
                <Delete size={14} />
              </button>
              <button
                type="button"
                onClick={() => handleInputUpdate('')}
                className="py-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 font-bold text-[11px] text-red-700"
              >
                CLR
              </button>
            </div>
          )}

          {statusError && (
            <p className="text-[11px] font-bold text-red-600 animate-fade-in-up">
              {statusError}
            </p>
          )}
        </>
      )}
    </div>
  );
};
