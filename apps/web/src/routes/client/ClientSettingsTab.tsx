import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Settings, Image, Check, AlertCircle, Loader2, Sun, Sunset, Moon, Clock } from 'lucide-react';

import { ChevronDown } from 'lucide-react';

function TimeInput24({
  value,
  onChange,
  align = 'left',
}: {
  value: string;
  onChange: (val: string) => void;
  align?: 'left' | 'right';
}) {
  const [val, setVal] = useState(value || '00:00');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

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
    <div className="relative" ref={containerRef}>
      <div className="relative flex items-center">
        <input
          type="text"
          inputMode="numeric"
          value={val}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder="00:00"
          maxLength={5}
          className="w-full bg-slate-900 border border-slate-700/80 hover:border-slate-600 focus:border-emerald-500 rounded-xl pl-2.5 pr-7 py-2 text-white font-mono text-center text-xs font-bold focus:outline-none focus:ring-1 focus:ring-emerald-500 transition shadow-inner"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-1.5 p-1 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 transition"
          title="Выбрать время"
        >
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-emerald-400' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div
          className={`absolute top-full mt-2 ${
            align === 'right' ? 'right-0' : 'left-0'
          } w-64 bg-slate-900/98 backdrop-blur-xl border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95 duration-150`}
        >
          {/* Quick presets */}
          <div className="mb-2.5">
            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1.5 tracking-wider">
              Быстрый выбор
            </span>
            <div className="grid grid-cols-4 gap-1">
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
          <div className="grid grid-cols-2 gap-2 text-center">
            {/* Hours column */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1 tracking-wider">
                Часы (00-23)
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
                Минуты
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
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClientSettingsTab() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [autoDeductLunch, setAutoDeductLunch] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [shifts, setShifts] = useState({
    morning: { start: '07:00', end: '16:00' },
    evening: { start: '16:00', end: '00:00' },
    night: { start: '22:00', end: '06:00' },
  });

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['client-settings'],
    queryFn: () => apiRequest<{ settings: any }>('/api/client/settings'),
  });

  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      setName(s.name || '');
      setAutoDeductLunch(!!s.autoDeductLunch);
      setLogoUrl(s.logoUrl || '');
      if (s.defaultShifts) {
        setShifts(s.defaultShifts);
      }
    }
  }, [settingsData]);

  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/client/settings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-settings'] });
      setMessage({ type: 'success', text: 'Настройки успешно сохранены' });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.message || 'Ошибка сохранения' });
    },
  });

  const saveLogoMutation = useMutation({
    mutationFn: (url: string) =>
      apiRequest('/api/client/settings/logo', {
        method: 'POST',
        body: JSON.stringify({ logoUrl: url }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-settings'] });
      setMessage({ type: 'success', text: 'Логотип обновлён' });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    saveMutation.mutate({
      name,
      autoDeductLunch,
      defaultShifts: shifts,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-emerald-400" />
          Настройки компании
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Дефолтные смены, автоматический вычет обеда и брендирование отчетов
        </p>
      </div>

      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2.5 animate-in fade-in ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
          }`}
        >
          {message.type === 'success' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Название организации
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Shifts */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Границы смен по умолчанию (формат 24ч, ЧЧ:ММ)</span>
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                24-Hour Format
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1. Morning Shift */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl flex flex-col justify-between transition shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                      <Sun className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white">Утренняя смена</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    ДЕНЬ
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                      Начало
                    </label>
                    <TimeInput24
                      value={shifts.morning.start}
                      onChange={(val) =>
                        setShifts({
                          ...shifts,
                          morning: { ...shifts.morning, start: val },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                      Окончание
                    </label>
                    <TimeInput24
                      value={shifts.morning.end}
                      align="right"
                      onChange={(val) =>
                        setShifts({
                          ...shifts,
                          morning: { ...shifts.morning, end: val },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* 2. Evening Shift */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl flex flex-col justify-between transition shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
                      <Sunset className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white">Вечерняя смена</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    ВЕЧЕР
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                      Начало
                    </label>
                    <TimeInput24
                      value={shifts.evening.start}
                      onChange={(val) =>
                        setShifts({
                          ...shifts,
                          evening: { ...shifts.evening, start: val },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                      Окончание
                    </label>
                    <TimeInput24
                      value={shifts.evening.end}
                      align="right"
                      onChange={(val) =>
                        setShifts({
                          ...shifts,
                          evening: { ...shifts.evening, end: val },
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* 3. Night Window */}
              <div className="p-4 bg-slate-950/70 border border-slate-800 hover:border-slate-700/80 rounded-2xl flex flex-col justify-between transition shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                      <Moon className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-white">Ночное окно</span>
                  </div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    НОЧЬ
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                      Начало
                    </label>
                    <TimeInput24
                      value={shifts.night.start}
                      onChange={(val) =>
                        setShifts({
                          ...shifts,
                          night: { ...shifts.night, start: val },
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                      Окончание
                    </label>
                    <TimeInput24
                      value={shifts.night.end}
                      align="right"
                      onChange={(val) =>
                        setShifts({
                          ...shifts,
                          night: { ...shifts.night, end: val },
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Auto Lunch Deduction */}
          <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={autoDeductLunch}
                onChange={(e) => setAutoDeductLunch(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <span className="text-xs font-bold text-white block">
                  Автоматический вычет обеденного перерыва (0.5 ч)
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5 block leading-relaxed">
                  Если сотрудник отработал 6 и более часов за смену (≥ 6 ч) и между сменами не было перерыва от 30 минут, система автоматически вычитает 30 минут из общего табеля.
                </span>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
          >
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Сохранить настройки'}
          </button>
        </form>

        {/* Logo Upload Section */}
        <div className="pt-6 border-t border-slate-800 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-2">
              <Image className="w-4 h-4 text-emerald-400" />
              Брендинг: Логотип компании для PDF-отчетов
            </label>
            <p className="text-[11px] text-slate-400">
              Логотип будет автоматически выводиться в шапке табелей и счетов
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs font-mono"
            />
            <button
              onClick={() => saveLogoMutation.mutate(logoUrl)}
              disabled={saveLogoMutation.isPending}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition"
            >
              Сохранить URL
            </button>
          </div>

          {logoUrl && (
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-4">
              <span className="text-xs text-slate-400">Превью:</span>
              <img
                src={logoUrl}
                alt="Logo preview"
                className="max-h-12 max-w-xs object-contain rounded"
                onError={(e) => {
                  (e.target as any).style.display = 'none';
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
