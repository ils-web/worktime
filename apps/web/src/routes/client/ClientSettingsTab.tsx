import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Badge } from '../../components/ui/Badge';
import {
  Settings,
  Image,
  Check,
  AlertCircle,
  Loader2,
  Sun,
  Sunset,
  Moon,
  Clock,
  Building2,
  Receipt,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Mail,
  Phone,
  MapPin,
  Save,
} from 'lucide-react';
import { TimeInput24 } from '../../components/ui/TimeInput24';

export function ClientSettingsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeSubTab, setActiveSubTab] = useState<'general' | 'billing'>('general');

  // General Settings
  const [name, setName] = useState('');
  const [autoDeductLunch, setAutoDeductLunch] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [shifts, setShifts] = useState({
    morning: { start: '07:00', end: '16:00' },
    evening: { start: '16:00', end: '00:00' },
    night: { start: '22:00', end: '06:00' },
  });

  // Israeli Tax & Billing Details
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [billingPhone, setBillingPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Queries
  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['client-settings'],
    queryFn: () => apiRequest<{ settings: any }>('/api/client/settings'),
  });

  const { data: invoicesData, isLoading: isInvoicesLoading } = useQuery({
    queryKey: ['client-invoices'],
    queryFn: () =>
      apiRequest<{ invoices: any[]; vatRate: number; provider: string }>('/api/client/invoices'),
    enabled: activeSubTab === 'billing',
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
      setLegalName(s.legalName || '');
      setTaxId(s.taxId || '');
      setBillingEmail(s.billingEmail || '');
      setBillingPhone(s.billingPhone || '');
      setBillingAddress(s.billingAddress || '');
    }
  }, [settingsData]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest('/api/client/settings', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-settings'] });
      setMessage({ type: 'success', text: t('admin.settingsSavedSuccess') });
      setTimeout(() => setMessage(null), 3000);
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.message || t('admin.settingsSaveError') });
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
      setMessage({ type: 'success', text: t('admin.logoUpdated') });
      setTimeout(() => setMessage(null), 3000);
    },
  });

  const payInvoiceMutation = useMutation({
    mutationFn: (invoiceId: string) =>
      apiRequest<{ success: boolean; paymentUrl: string }>(`/api/client/invoices/${invoiceId}/pay`, {
        method: 'POST',
      }),
    onSuccess: (data) => {
      if (data?.paymentUrl) {
        window.location.href = data.paymentUrl;
      }
    },
    onError: (err: any) => {
      setMessage({ type: 'error', text: err.message || 'Ошибка инициализации оплаты' });
    },
  });

  const handleGeneralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    saveMutation.mutate({
      name,
      autoDeductLunch,
      defaultShifts: shifts,
    });
  };

  const handleBillingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    saveMutation.mutate({
      legalName,
      taxId,
      billingEmail,
      billingPhone,
      billingAddress,
    });
  };

  if (isSettingsLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
      </div>
    );
  }

  const vatRate = invoicesData?.vatRate ?? 17.0;
  const invoicesList = invoicesData?.invoices || [];

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header with Sub-tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" />
            {t('admin.companySettings')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('admin.settingsSubtitle')}
          </p>
        </div>

        {/* Sub-tab Switcher */}
        <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveSubTab('general')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'general'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>{t('admin.generalTab')}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('billing')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition ${
              activeSubTab === 'billing'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>{t('admin.billingTab')}</span>
          </button>
        </div>
      </div>

      {/* Global Success / Error Message */}
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

      {/* SUB-TAB 1: GENERAL SETTINGS */}
      {activeSubTab === 'general' && (
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6">
          <form onSubmit={handleGeneralSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {t('admin.orgName')}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Shifts Boundaries */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('admin.defaultShiftsTitle')}</span>
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
                      <span className="text-xs font-bold text-white">{t('admin.morningShift')}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {t('admin.badgeDay')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                        {t('admin.shiftStart')}
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
                        {t('admin.shiftEnd')}
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
                      <span className="text-xs font-bold text-white">{t('admin.eveningShift')}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                      {t('admin.badgeEvening')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                        {t('admin.shiftStart')}
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
                        {t('admin.shiftEnd')}
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
                      <span className="text-xs font-bold text-white">{t('admin.nightWindow')}</span>
                    </div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                      {t('admin.badgeNight')}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                        {t('admin.shiftStart')}
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
                        {t('admin.shiftEnd')}
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
                    {t('admin.autoLunchDeduction')}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-0.5 block leading-relaxed">
                    {t('admin.lunchDeductionDesc')}
                  </span>
                </div>
              </label>
            </div>

            <button
              type="submit"
              disabled={saveMutation.isPending}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('admin.saveSettings')}
            </button>
          </form>

          {/* Logo Upload Section */}
          <div className="pt-6 border-t border-slate-800 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-2">
                <Image className="w-4 h-4 text-emerald-400" />
                {t('admin.brandingLogo')}
              </label>
              <p className="text-[11px] text-slate-400">
                {t('admin.logoDesc')}
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
                type="button"
                onClick={() => saveLogoMutation.mutate(logoUrl)}
                disabled={saveLogoMutation.isPending}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition"
              >
                {t('admin.saveLogoUrl')}
              </button>
            </div>

            {logoUrl && (
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center gap-4">
                <span className="text-xs text-slate-400">{t('admin.preview')}</span>
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
      )}

      {/* SUB-TAB 2: TAX DETAILS & INVOICES */}
      {activeSubTab === 'billing' && (
        <div className="space-y-6">
          {/* Card 1: Israeli Business Tax Details Form */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
            <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-emerald-400" />
                  {t('admin.billingSectionTitle')}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t('admin.billingSectionSubtitle')}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-bold flex items-center gap-1.5 shrink-0">
                <ShieldCheck className="w-3.5 h-3.5" />
                חשבונית ירוקה / Morning
              </span>
            </div>

            <form onSubmit={handleBillingSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Legal Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    {t('admin.legalName')}
                  </label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder={t('admin.legalNamePlaceholder')}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Israeli Tax ID (ח.פ / עוסק מורשה) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                    <span>{t('admin.taxId')}</span>
                    <span className="text-[10px] text-slate-400 font-mono">9 ספרות</span>
                  </label>
                  <input
                    type="text"
                    maxLength={9}
                    value={taxId}
                    onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('admin.taxIdPlaceholder')}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Billing Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    {t('admin.billingEmail')}
                  </label>
                  <input
                    type="email"
                    value={billingEmail}
                    onChange={(e) => setBillingEmail(e.target.value)}
                    placeholder="accounting@company.co.il"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Billing Phone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {t('admin.billingPhone')}
                  </label>
                  <input
                    type="tel"
                    value={billingPhone}
                    onChange={(e) => setBillingPhone(e.target.value)}
                    placeholder="050-0000000"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Billing Address */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {t('admin.billingAddress')}
                </label>
                <input
                  type="text"
                  value={billingAddress}
                  onChange={(e) => setBillingAddress(e.target.value)}
                  placeholder="רחוב, מספר בית, עיר, מיקוד"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-sm transition flex items-center gap-2 shadow-lg shadow-emerald-950"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{t('admin.saveSettings')}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Card 2: Invoices History & Online Payment */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  {t('admin.invoicesHistoryTitle')}
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  {t('admin.invoicesHistorySubtitle')}
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">מע״מ כחוק: {vatRate}%</span>
            </div>

            {isInvoicesLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
              </div>
            ) : invoicesList.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-xl">
                {t('admin.noInvoicesYet')}
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/70 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <th className="p-3.5">חודש / תקופה</th>
                      <th className="p-3.5">סכום לפני מע״מ</th>
                      <th className="p-3.5">סה״כ לתשלום</th>
                      <th className="p-3.5">סטטוס</th>
                      <th className="p-3.5">מסמך דיגיטלי</th>
                      <th className="p-3.5 text-right">פעולה</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-950/30">
                    {invoicesList.map((inv: any) => {
                      const totalWithVat = Math.round(inv.amount * (1 + vatRate / 100) * 100) / 100;
                      return (
                        <tr key={inv.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3.5 font-mono text-xs text-white font-semibold">
                            {inv.periodMonth}
                          </td>
                          <td className="p-3.5 text-slate-300 font-medium">
                            ₪{inv.amount.toLocaleString()}
                          </td>
                          <td className="p-3.5 font-bold text-white">
                            ₪{totalWithVat.toLocaleString()}
                            <span className="text-[10px] text-slate-400 font-normal mr-1 block">
                              (כולל מע״מ)
                            </span>
                          </td>
                          <td className="p-3.5">
                            {inv.status === 'paid' ? (
                              <Badge variant="emerald" dot>
                                {t('admin.invoiceStatusPaid')}
                              </Badge>
                            ) : (
                              <Badge variant="amber">
                                {t('admin.invoiceStatusPending')}
                              </Badge>
                            )}
                          </td>
                          <td className="p-3.5">
                            {inv.receiptUrl ? (
                              <a
                                href={inv.receiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold border border-emerald-500/30 transition"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>חשבונית #{inv.receiptNumber || 'PDF'}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>
                          <td className="p-3.5 text-right">
                            {inv.status !== 'paid' ? (
                              <button
                                type="button"
                                onClick={() => payInvoiceMutation.mutate(inv.id)}
                                disabled={payInvoiceMutation.isPending}
                                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 ml-auto shadow-md shadow-emerald-950"
                              >
                                {payInvoiceMutation.isPending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CreditCard className="w-3.5 h-3.5" />
                                )}
                                <span>{t('admin.payOnline')}</span>
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-400 font-semibold flex items-center justify-end gap-1">
                                <Check className="w-3.5 h-3.5" />
                                שולם כחוק
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
