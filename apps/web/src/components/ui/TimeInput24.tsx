import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';

export interface TimeInput24Props {
  value: string;
  onChange: (val: string) => void;
  align?: 'left' | 'right';
  className?: string;
  placeholder?: string;
}

export function TimeInput24({
  value,
  onChange,
  align = 'left',
  className = '',
  placeholder = '00:00',
}: TimeInput24Props) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const [val, setVal] = useState(value || '00:00');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVal(value || '00:00');
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const [currentH, currentM] = (val && val.includes(':') ? val : '00:00').split(':');

  const handleSelectHour = (newHour: string) => {
    const formatted = `${newHour.padStart(2, '0')}:${(currentM || '00').padStart(2, '0')}`;
    setVal(formatted);
    onChange(formatted);
  };

  const handleSelectMinute = (newMin: string) => {
    const formatted = `${(currentH || '00').padStart(2, '0')}:${newMin.padStart(2, '0')}`;
    setVal(formatted);
    onChange(formatted);
  };

  const handleQuickPreset = (preset: string) => {
    setVal(preset);
    onChange(preset);
    setIsOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let text = e.target.value.replace(/[^0-9:]/g, '');
    if (text.length === 2 && !text.includes(':') && !val.endsWith(':')) {
      text = text + ':';
    } else if (text.length > 5) {
      text = text.slice(0, 5);
    }
    setVal(text);

    // If matches complete HH:MM format
    const match = text.match(/^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/);
    if (match && match[1] && match[2]) {
      const h = match[1].padStart(2, '0');
      const m = match[2];
      onChange(`${h}:${m}`);
    }
  };

  const handleBlur = () => {
    let text = val.trim();
    if (!text) {
      setVal(value || '00:00');
      return;
    }
    const digits = text.replace(/[^0-9]/g, '');
    let h = 0;
    let m = 0;
    if (text.includes(':')) {
      const parts = text.split(':');
      h = parseInt(parts[0] || '0', 10);
      m = parseInt(parts[1] || '0', 10);
    } else if (digits.length <= 2) {
      h = parseInt(digits, 10);
      m = 0;
    } else if (digits.length >= 3) {
      h = parseInt(digits.slice(0, 2), 10);
      m = parseInt(digits.slice(2, 4), 10);
    }

    if (isNaN(h) || h < 0) h = 0;
    if (h > 23) h = 23;
    if (isNaN(m) || m < 0) m = 0;
    if (m > 59) m = 59;

    const formatted = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    setVal(formatted);
    onChange(formatted);
  };

  const hoursList = Array.from({ length: 24 }).map((_, i) => String(i).padStart(2, '0'));
  const minutesList = ['00', '15', '30', '45'];
  const presets = ['07:00', '08:00', '15:30', '16:00', '20:00', '22:00', '00:00', '06:00'];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative flex items-center">
        <input
          dir="ltr"
          type="text"
          inputMode="numeric"
          value={val}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={5}
          className="w-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 focus:border-emerald-500 rounded-xl pl-2.5 pr-7 py-2 text-white font-mono text-center text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-1.5 p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 transition"
          title={t('admin.selectTime')}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-emerald-400' : ''
            }`}
          />
        </button>
      </div>

      {isOpen && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`absolute top-full mt-2 ${
            align === 'right' ? (isRtl ? 'left-0' : 'right-0') : (isRtl ? 'right-0' : 'left-0')
          } w-60 max-w-[calc(100vw-2rem)] bg-slate-900/98 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Quick presets */}
          <div className="mb-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 tracking-wider">
              {t('admin.quickSelect')}
            </span>
            <div dir="ltr" className="grid grid-cols-4 gap-1">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleQuickPreset(p)}
                  className={`py-1 px-1 rounded-lg font-mono text-[11px] font-bold transition text-center ${
                    val === p
                      ? 'bg-emerald-500 text-slate-950 shadow-md'
                      : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800 my-2" />

          {/* Hours and Minutes 2-column picker */}
          <div dir="ltr" className="grid grid-cols-2 gap-2 text-center">
            {/* Hours column */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-wider">
                {t('admin.pickerHours')} (00-23)
              </span>
              <div className="h-36 overflow-y-auto pr-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
                {hoursList.map((h) => {
                  const isSelected = currentH === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleSelectHour(h)}
                      className={`w-full py-1 rounded-lg font-mono text-xs font-bold transition ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                          : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Minutes column */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-wider">
                {t('admin.pickerMinutes')}
              </span>
              <div className="space-y-1.5 pt-0.5">
                {minutesList.map((m) => {
                  const isSelected = currentM === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleSelectMinute(m)}
                      className={`w-full py-2 rounded-lg font-mono text-xs font-bold transition ${
                        isSelected
                          ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                          : 'bg-slate-800/60 text-slate-300 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      :{m}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-2.5 pt-2 flex items-center justify-between">
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              {val}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg transition"
            >
              {t('admin.done')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
