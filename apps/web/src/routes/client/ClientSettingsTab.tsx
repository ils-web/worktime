import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Settings, Image, Check, AlertCircle, Loader2 } from 'lucide-react';

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
    <div className="max-w-2xl space-y-6">
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
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Границы смен по умолчанию (HH:mm)
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-xs font-semibold text-emerald-400 block mb-2">Утренняя смена</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input
                    type="time"
                    value={shifts.morning.start}
                    onChange={(e) =>
                      setShifts({
                        ...shifts,
                        morning: { ...shifts.morning, start: e.target.value },
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs"
                  />
                  <span>—</span>
                  <input
                    type="time"
                    value={shifts.morning.end}
                    onChange={(e) =>
                      setShifts({
                        ...shifts,
                        morning: { ...shifts.morning, end: e.target.value },
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-xs font-semibold text-blue-400 block mb-2">Вечерняя смена</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input
                    type="time"
                    value={shifts.evening.start}
                    onChange={(e) =>
                      setShifts({
                        ...shifts,
                        evening: { ...shifts.evening, start: e.target.value },
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs"
                  />
                  <span>—</span>
                  <input
                    type="time"
                    value={shifts.evening.end}
                    onChange={(e) =>
                      setShifts({
                        ...shifts,
                        evening: { ...shifts.evening, end: e.target.value },
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl">
                <span className="text-xs font-semibold text-purple-400 block mb-2">Ночное окно</span>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input
                    type="time"
                    value={shifts.night.start}
                    onChange={(e) =>
                      setShifts({
                        ...shifts,
                        night: { ...shifts.night, start: e.target.value },
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs"
                  />
                  <span>—</span>
                  <input
                    type="time"
                    value={shifts.night.end}
                    onChange={(e) =>
                      setShifts({
                        ...shifts,
                        night: { ...shifts.night, end: e.target.value },
                      })
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-white text-xs"
                  />
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
                  Если сотрудник отработал $\ge 6$ часов за день и между сменами не было перерыва от 30 минут, система автоматически вычитает 30 минут из общего табеля.
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
