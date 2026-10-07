import React, { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatIsoToDisplayDate, parseDisplayToIsoDate } from '@timetracker/shared';

export interface DatePickerProps {
  value: string; // YYYY-MM-DD
  onChange: (value: string) => void; // YYYY-MM-DD
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
  min?: string;
  max?: string;
}

export function DatePicker({
  value,
  onChange,
  label,
  placeholder = 'ДД/ММ/ГГГГ',
  required = false,
  disabled = false,
  className = '',
  compact = false,
  min,
  max,
}: DatePickerProps) {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial view year and month from value or today
  const getInitialView = (isoStr: string) => {
    if (isoStr && isoStr.length >= 10) {
      const [y, m] = isoStr.split('-').map(Number);
      if (y && m) return { year: y, month: m - 1 };
    }
    const today = new Date();
    return { year: today.getFullYear(), month: today.getMonth() };
  };

  const [viewDate, setViewDate] = useState(() => getInitialView(value));
  const [textInput, setTextInput] = useState(() => formatIsoToDisplayDate(value));

  // Sync textInput whenever external value changes
  useEffect(() => {
    setTextInput(formatIsoToDisplayDate(value));
    if (value && value.length >= 10) {
      const [y, m] = value.split('-').map(Number);
      if (y && m) setViewDate({ year: y, month: m - 1 });
    }
  }, [value]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate((prev) => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate((prev) => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
  };

  const handleSelectDate = (year: number, month: number, day: number) => {
    const mm = String(month + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const iso = `${year}-${mm}-${dd}`;
    onChange(iso);
    setTextInput(`${dd}/${mm}/${year}`);
    setIsOpen(false);
  };

  const handleSelectToday = (e: React.MouseEvent) => {
    e.stopPropagation();
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    handleSelectDate(y, m, d);
  };

  // Direct text edit
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextInput(raw);
    const parsed = parseDisplayToIsoDate(raw);
    if (parsed && parsed.length === 10 && !isNaN(new Date(parsed).getTime())) {
      onChange(parsed);
      const [y, m] = parsed.split('-').map(Number);
      if (y && m) setViewDate({ year: y, month: m - 1 });
    }
  };

  const handleBlur = () => {
    // If invalid text entered, reset to formatted current value
    const parsed = parseDisplayToIsoDate(textInput);
    if (!parsed || parsed.length !== 10 || isNaN(new Date(parsed).getTime())) {
      setTextInput(formatIsoToDisplayDate(value));
    }
  };

  // Calendar math
  const { year, month } = viewDate;
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Localized month header
  const monthName = new Intl.DateTimeFormat(i18n.language || 'ru', {
    month: 'long',
  }).format(new Date(year, month, 1));
  const monthTitle = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}`;

  // Weekday headers localized (starts Sunday or Monday depending on language)
  const isRtl = i18n.language === 'he' || i18n.language === 'ar';
  const weekdayNames = Array.from({ length: 7 }).map((_, i) => {
    // i=0 Sunday, i=1 Monday ...
    const d = new Date(2026, 9, 4 + i); // 2026-10-04 is Sunday
    return new Intl.DateTimeFormat(i18n.language || 'ru', { weekday: 'narrow' }).format(d);
  });

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-300 mb-1">
          {label}
          {required && <span className="text-rose-400 ml-0.5">*</span>}
        </label>
      )}

      <div
        className={`flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-xl transition focus-within:ring-1 focus-within:ring-emerald-500 focus-within:border-emerald-500 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-600'
        } ${compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm'}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <CalendarIcon
          className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-emerald-400 shrink-0 select-none`}
        />
        <input
          type="text"
          value={textInput}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onClick={(e) => e.stopPropagation()}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          className={`bg-transparent text-white font-mono placeholder:text-slate-500 focus:outline-none w-full ${
            compact ? 'text-xs w-24' : 'text-sm'
          }`}
        />
      </div>

      {isOpen && (
        <div
          className={`absolute mt-1.5 z-50 bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-3 w-64 select-none ${
            isRtl ? 'right-0' : 'left-0'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Month / Year & Navigation */}
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Предыдущий месяц"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-bold text-white capitalize">{monthTitle}</span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Следующий месяц"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1 text-[11px] font-bold text-slate-500">
            {weekdayNames.map((w, idx) => (
              <div key={idx} className="py-0.5">
                {w}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-xs">
            {/* Prev month days */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => {
              const d = daysInPrevMonth - firstDayOfMonth + i + 1;
              return (
                <div
                  key={`prev-${i}`}
                  className="py-1 text-center text-slate-600 cursor-not-allowed text-[11px]"
                >
                  {d}
                </div>
              );
            })}

            {/* Current month days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const d = i + 1;
              const mm = String(month + 1).padStart(2, '0');
              const dd = String(d).padStart(2, '0');
              const currentIso = `${year}-${mm}-${dd}`;
              const isSelected = value === currentIso;
              const isToday = todayIso === currentIso;
              const isOutOfRange =
                (min && currentIso < min) || (max && currentIso > max);

              return (
                <button
                  key={d}
                  type="button"
                  disabled={Boolean(isOutOfRange)}
                  onClick={() => handleSelectDate(year, month, d)}
                  className={`py-1 text-center font-mono rounded-lg transition text-xs ${
                    isSelected
                      ? 'bg-emerald-600 text-white font-bold shadow-md shadow-emerald-950'
                      : isToday
                      ? 'border border-emerald-500/60 text-emerald-400 font-bold hover:bg-slate-800'
                      : isOutOfRange
                      ? 'text-slate-700 cursor-not-allowed'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Footer Quick Action */}
          <div className="mt-2.5 pt-2 border-t border-slate-800 flex justify-between items-center text-[11px]">
            <button
              type="button"
              onClick={handleSelectToday}
              className="text-emerald-400 hover:text-emerald-300 font-semibold transition"
            >
              {t('admin.today')}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-200 transition"
            >
              {t('admin.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
