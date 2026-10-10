import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { PasswordInput } from '../../components/ui/PasswordInput';
import { Lock, CheckCircle, AlertCircle, Loader2, Building2, Receipt, Save, ShieldCheck } from 'lucide-react';

export function OwnerSettingsTab() {
  const queryClient = useQueryClient();

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Business & Billing Integration state
  const [businessForm, setBusinessForm] = useState({
    companyName: '',
    taxId: '',
    address: '',
    phone: '',
    email: '',
    vatRate: 17.0,
    invoiceProvider: 'morning',
    invoiceApiKey: '',
    invoiceApiSecret: '',
    invoiceSandbox: true,
  });
  const [businessMessage, setBusinessMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Load existing business settings
  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['owner-settings'],
    queryFn: () => apiRequest<{ settings: any }>('/api/owner/settings'),
  });

  useEffect(() => {
    if (settingsData?.settings) {
      const s = settingsData.settings;
      setBusinessForm({
        companyName: s.companyName || '',
        taxId: s.taxId || '',
        address: s.address || '',
        phone: s.phone || '',
        email: s.email || '',
        vatRate: typeof s.vatRate === 'number' ? s.vatRate : 17.0,
        invoiceProvider: s.invoiceProvider || 'morning',
        invoiceApiKey: s.invoiceApiKey || '',
        invoiceApiSecret: s.invoiceApiSecret || '',
        invoiceSandbox: s.invoiceSandbox !== undefined ? s.invoiceSandbox : true,
      });
    }
  }, [settingsData]);

  // Mutations
  const businessMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/owner/settings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['owner-settings'] });
      setBusinessMessage({ type: 'success', text: 'Реквизиты бизнеса и настройки счетов успешно сохранены' });
      setTimeout(() => setBusinessMessage(null), 4000);
    },
    onError: (err: any) => {
      setBusinessMessage({ type: 'error', text: err.message || 'Ошибка сохранения настроек бизнеса' });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: (pass: string) =>
      apiRequest('/api/owner/password', {
        method: 'POST',
        body: JSON.stringify({ newPassword: pass }),
      }),
    onSuccess: () => {
      setPasswordMessage({ type: 'success', text: 'Пароль владельца успешно изменен' });
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordMessage(null), 4000);
    },
    onError: (err: any) => {
      setPasswordMessage({ type: 'error', text: err.message || 'Ошибка смены пароля' });
    },
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);

    if (newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Пароль должен быть не менее 6 символов' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Пароли не совпадают' });
      return;
    }

    passwordMutation.mutate(newPassword);
  };

  const handleBusinessSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBusinessMessage(null);
    businessMutation.mutate(businessForm);
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* 1. SaaS Provider Business Details */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Реквизиты системы (Провайдер TimeTracker)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Юридические данные компании-владельца для автоматической выписки счетов (חשבונית מס קבלה)
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          {businessMessage && (
            <div
              className={`mb-6 p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                businessMessage.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              }`}
            >
              {businessMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{businessMessage.text}</span>
            </div>
          )}

          {isSettingsLoading ? (
            <div className="flex justify-center p-6">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : (
            <form onSubmit={handleBusinessSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Название компании (שם העסק / חברה) *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessForm.companyName}
                    onChange={(e) => setBusinessForm({ ...businessForm, companyName: e.target.value })}
                    placeholder="TimeTracker Solutions Ltd"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Номер бизнеса (ח.פ / עוסק מורשה) *
                  </label>
                  <input
                    type="text"
                    required
                    value={businessForm.taxId}
                    onChange={(e) => setBusinessForm({ ...businessForm, taxId: e.target.value })}
                    placeholder="516123456 (9 цифр)"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 text-start"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Официальный Email для счетов
                  </label>
                  <input
                    type="email"
                    value={businessForm.email}
                    onChange={(e) => setBusinessForm({ ...businessForm, email: e.target.value })}
                    placeholder="billing@timetracker.co.il"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 text-start"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Контактный телефон компании
                  </label>
                  <input
                    type="tel"
                    value={businessForm.phone}
                    onChange={(e) => setBusinessForm({ ...businessForm, phone: e.target.value })}
                    placeholder="+972-3-1234567"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 text-start"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Юридический адрес компании (כתובת מלאה)
                  </label>
                  <input
                    type="text"
                    value={businessForm.address}
                    onChange={(e) => setBusinessForm({ ...businessForm, address: e.target.value })}
                    placeholder="ул. Дизенгоф 50, Тель-Авив, 6433222"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Ставка מע״מ (НДС %)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={businessForm.vatRate}
                    onChange={(e) => setBusinessForm({ ...businessForm, vatRate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 text-start"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Invoicing API Integration Block */}
              <div className="pt-4 border-t border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Receipt className="w-4 h-4 text-emerald-400" />
                      Интеграция с системой электронных счетов в Израиле
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Провайдер электронных документов, сертифицированный налоговым управлением Израиля (רשות המסים)
                    </p>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    חשבונית מס קבלה
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Провайдер счетов
                    </label>
                    <select
                      value={businessForm.invoiceProvider}
                      onChange={(e) => setBusinessForm({ ...businessForm, invoiceProvider: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="morning">Morning (Green Invoice / חשבונית ירוקה)</option>
                      <option value="icount">iCount</option>
                      <option value="meshulam">Meshulam / Grow</option>
                      <option value="manual">Ручной режим (без API)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Режим подключения
                    </label>
                    <div className="flex items-center gap-4 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="radio"
                          name="invoiceSandbox"
                          checked={businessForm.invoiceSandbox}
                          onChange={() => setBusinessForm({ ...businessForm, invoiceSandbox: true })}
                          className="accent-emerald-500"
                        />
                        <span>Песочница (Sandbox)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                        <input
                          type="radio"
                          name="invoiceSandbox"
                          checked={!businessForm.invoiceSandbox}
                          onChange={() => setBusinessForm({ ...businessForm, invoiceSandbox: false })}
                          className="accent-emerald-500"
                        />
                        <span>Боевой (Production)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      API Key / Client ID
                    </label>
                    <input
                      type="text"
                      value={businessForm.invoiceApiKey}
                      onChange={(e) => setBusinessForm({ ...businessForm, invoiceApiKey: e.target.value })}
                      placeholder="Вставьте API Key из кабинета Morning"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 text-start"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      API Secret
                    </label>
                    <input
                      type="password"
                      value={businessForm.invoiceApiSecret}
                      onChange={(e) => setBusinessForm({ ...businessForm, invoiceApiSecret: e.target.value })}
                      placeholder="Вставьте API Secret из кабинета Morning"
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-500 text-start"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={businessMutation.isPending}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 mt-4 shadow-lg shadow-emerald-950"
              >
                {businessMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Сохранить реквизиты бизнеса</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 2. Security / Password Settings */}
      <div className="space-y-4 pt-4 border-t border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            Безопасность аккаунта
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Смена мастер-пароля владельца TimeTracker SaaS
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
          {passwordMessage && (
            <div
              className={`mb-6 p-3.5 rounded-xl text-xs flex items-center gap-2.5 ${
                passwordMessage.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border border-rose-500/30 text-rose-400'
              }`}
            >
              {passwordMessage.type === 'success' ? (
                <CheckCircle className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{passwordMessage.text}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Новый пароль
              </label>
              <PasswordInput
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                leftIcon={<Lock className="w-4 h-4" />}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Повторите пароль
              </label>
              <PasswordInput
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Повторите новый пароль"
                leftIcon={<Lock className="w-4 h-4" />}
              />
            </div>

            <button
              type="submit"
              disabled={passwordMutation.isPending}
              className="py-2.5 px-6 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 mt-2 border border-slate-700"
            >
              {passwordMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Сохранить новый пароль'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
