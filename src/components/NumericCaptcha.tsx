import React, { useEffect, useRef, useState, useCallback } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';

interface NumericCaptchaProps {
  code?: string;
  onCaptchaChange: (code: string) => void;
  inputVal: string;
  onInputChange: (val: string) => void;
  error?: string | null;
  className?: string;
  disabled?: boolean;
}

/**
 * 6-Digit Numeric CAPTCHA Generator & Canvas Renderer.
 * Generates a 6-digit security number once and keeps it locked
 * until the user explicitly clicks the Change Captcha (refresh) button.
 */
export const NumericCaptcha: React.FC<NumericCaptchaProps> = ({
  code,
  onCaptchaChange,
  inputVal,
  onInputChange,
  error,
  className = '',
  disabled = false,
}) => {
  const [internalCode, setInternalCode] = useState<string>(() =>
    Math.floor(100000 + Math.random() * 900000).toString()
  );
  const captchaCode = code && code.length === 6 ? code : internalCode;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const onCaptchaChangeRef = useRef(onCaptchaChange);
  const onInputChangeRef = useRef(onInputChange);

  useEffect(() => {
    onCaptchaChangeRef.current = onCaptchaChange;
    onInputChangeRef.current = onInputChange;
  }, [onCaptchaChange, onInputChange]);

  // Sync initial code with parent on mount if parent doesn't have one yet
  useEffect(() => {
    if (!code || code.length !== 6) {
      onCaptchaChangeRef.current(internalCode);
    }
  }, [code, internalCode]);

  // Only called when the user explicitly clicks the Refresh / Change Captcha button
  const generateNewCaptcha = useCallback(() => {
    const randomSixDigits = Math.floor(100000 + Math.random() * 900000).toString();
    setInternalCode(randomSixDigits);
    onCaptchaChangeRef.current(randomSixDigits);
    onInputChangeRef.current('');
  }, []);

  // Render canvas with security noise lines, colored background, and rotated digits
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !captchaCode) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // 1. Background gradient with soft security tint
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#E8F1F5');
    bgGrad.addColorStop(0.5, '#F0F7FA');
    bgGrad.addColorStop(1, '#D9E8F0');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Background security noise dots
    for (let i = 0; i < 45; i++) {
      ctx.fillStyle = `rgba(${Math.floor(Math.random() * 100 + 40)}, ${Math.floor(
        Math.random() * 100 + 40
      )}, ${Math.floor(Math.random() * 140 + 80)}, 0.25)`;
      ctx.beginPath();
      ctx.arc(
        Math.random() * width,
        Math.random() * height,
        Math.random() * 1.8 + 0.5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // 3. Security wavy crossing lines to prevent OCR scraping
    for (let l = 0; l < 3; l++) {
      ctx.strokeStyle = `rgba(${Math.floor(Math.random() * 90 + 30)}, ${Math.floor(
        Math.random() * 90 + 50
      )}, ${Math.floor(Math.random() * 140 + 100)}, 0.45)`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, Math.random() * height);
      ctx.bezierCurveTo(
        width * 0.3,
        Math.random() * height,
        width * 0.7,
        Math.random() * height,
        width,
        Math.random() * height
      );
      ctx.stroke();
    }

    // 4. Render each of the 6 digits with slight tilt and high contrast
    const digitColors = [
      '#133B5C',
      '#0D4C5C',
      '#1E3A8A',
      '#0F766E',
      '#1F2937',
      '#0284C7',
    ];

    const charSpacing = (width - 24) / 6;
    for (let i = 0; i < captchaCode.length; i++) {
      const char = captchaCode[i];
      const x = 16 + i * charSpacing;
      const y = height / 2 + 7;

      ctx.save();
      ctx.translate(x, y);

      // Random tilt between -18 and +18 degrees
      const angle = (Math.random() * 32 - 16) * (Math.PI / 180);
      ctx.rotate(angle);

      // Monospace bold security font
      ctx.font = 'bold 24px "JetBrains Mono", Consolas, "Courier New", monospace';
      ctx.fillStyle = digitColors[i % digitColors.length];
      ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
      ctx.shadowBlur = 1;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(char, -7, 0);
      ctx.restore();
    }
  }, [captchaCode]);

  const handleRefreshClick = () => {
    setIsRefreshing(true);
    generateNewCaptcha();
    setTimeout(() => setIsRefreshing(false), 350);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {/* Label and Refresh instruction */}
      <div className="flex items-center justify-between text-xs">
        <label
          htmlFor="captcha-input-field"
          className="font-bold text-slate-800 flex items-center gap-1.5"
        >
          <ShieldCheck size={14} className="text-[#467FA3]" />
          <span>Security CAPTCHA (सुरक्षा कोड)</span>
        </label>
        <span className="text-[11px] text-slate-500 font-medium">
          6-digit number required
        </span>
      </div>

      {/* Visual Captcha Box + Input Row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        {/* Anti-Bot Canvas Image Badge */}
        <div className="relative shrink-0 flex items-center bg-slate-100 rounded-2xl border border-slate-300/80 p-1 shadow-2xs overflow-hidden select-none">
          <canvas
            ref={canvasRef}
            width={160}
            height={44}
            className="rounded-xl block w-[160px] h-[44px]"
            title="6-digit verification code"
            aria-label="Security CAPTCHA image with 6 digits"
          />

          {/* Refresh Button */}
          <button
            type="button"
            onClick={handleRefreshClick}
            disabled={disabled}
            className="ml-1 p-2 rounded-xl bg-white hover:bg-slate-200 text-slate-600 hover:text-slate-900 border border-slate-200 transition-all cursor-pointer shadow-2xs group shrink-0"
            title="Change Captcha (नया कोड प्राप्त करें)"
            aria-label="Refresh Captcha Code"
          >
            <RefreshCw
              size={15}
              className={`text-[#467FA3] transition-transform ${
                isRefreshing ? 'animate-spin' : 'group-hover:rotate-90'
              }`}
            />
          </button>
        </div>

        {/* Captcha Input Box */}
        <div className="relative flex-1">
          <input
            id="captcha-input-field"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            disabled={disabled}
            value={inputVal}
            onChange={(e) => {
              const digitsOnly = e.target.value.replace(/\D/g, '').slice(0, 6);
              onInputChange(digitsOnly);
            }}
            placeholder="Enter 6-digit code"
            autoComplete="off"
            className={`w-full px-4 py-2.5 sm:py-3 text-sm font-mono font-bold tracking-[0.25em] text-center rounded-2xl border transition-all tabular-nums text-slate-900 placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans placeholder:font-normal focus:outline-none ${
              error
                ? 'border-red-400 bg-red-50/50 focus:border-red-500'
                : inputVal.length === 6 && inputVal === captchaCode
                ? 'border-emerald-500 bg-emerald-50/50 text-emerald-950 focus:border-emerald-600'
                : 'border-slate-200 bg-white focus:border-[#467FA3] focus:ring-1 focus:ring-[#467FA3]'
            }`}
          />
        </div>
      </div>

      {/* Helper text or Error */}
      {error ? (
        <p className="text-[11px] font-bold text-red-600 animate-shake">
          {error}
        </p>
      ) : inputVal.length === 6 && inputVal === captchaCode ? (
        <p className="text-[11px] font-bold text-emerald-700 flex items-center gap-1">
          ✓ Captcha verified (कैप्चा कोड सही है)
        </p>
      ) : (
        <p className="text-[10px] text-slate-400">
          चित्र में दिखाए गए 6 अंक दर्ज करें (लॉगिन या OTP के लिए अनिवार्य)
        </p>
      )}
    </div>
  );
};
