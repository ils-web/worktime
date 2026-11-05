import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../lib/api';
import type { PayrollSystemId, PayrollCodesConfig } from '@timetracker/shared';
import {
  Download,
  CheckCircle2,
  Settings2,
  Key,
  Copy,
  RefreshCw,
  Send,
  FileSpreadsheet,
  Code2,
  Building,
  Sparkles,
  Calendar,
} from 'lucide-react';

interface EmployeePayrollPreview {
  employeeId: string;
  employeeNumber: string;
  employeeName: string;
  nationalId: string;
  workDays: number;
  totalStandard100Hours: number;
  totalOvertime125Hours: number;
  totalOvertime150Hours: number;
  totalShabbat150Hours: number;
  totalNightHours: number;
  totalBreakDeductedHours: number;
  totalNetHours: number;
  totalExpenses: number;
}

interface SystemCardMeta {
  id: PayrollSystemId;
  nameHe: string;
  nameRu: string;
  nameEn: string;
  subTitleHe: string;
  subTitleRu: string;
  subTitleEn: string;
  formatLabel: string;
  accentColor: string;
  badgeBg: string;
  badgeText: string;
  renderLogo: () => JSX.Element;
}

export const PAYROLL_SYSTEM_CARDS: SystemCardMeta[] = [
  {
    id: 'michpal',
    nameHe: 'מיכפל (Michpal)',
    nameRu: 'Михпаль (מיכפל)',
    nameEn: 'Michpal Payroll',
    subTitleHe: 'קובץ ממשק שכר תקני למיכפל שכר ופנסיה',
    subTitleRu: 'Стандартный файл импорта зарплаты в מיכפל',
    subTitleEn: 'Standard Michpal payroll batch import file',
    formatLabel: 'CSV • סמלי שכר מותאמים',
    accentColor: 'border-sky-500/40 hover:border-sky-400',
    badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    badgeText: 'הנפוץ בישראל',
    renderLogo: () => (
      <div className="w-14 h-12 rounded-xl bg-white flex flex-col items-center justify-center px-1.5 shadow-sm border border-slate-200">
        <div className="text-[13px] font-black tracking-tight text-sky-900 leading-none">מיכפל</div>
        <div className="h-1 w-8 rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 mt-1" />
      </div>
    ),
  },
  {
    id: 'shiklolit',
    nameHe: 'שיקלולית (ט.מ.ל)',
    nameRu: 'Шиклолит / Т.М.Л (שיקלולית)',
    nameEn: 'Shiklolit (T.M.L)',
    subTitleHe: 'ממשק קליטת שעות ונוכחות לתוכנת שיקלולית',
    subTitleRu: 'Импорт часов и надбавок для бухгалтерии שיקלולית',
    subTitleEn: 'Attendance & overtime interface for Shiklolit TML',
    formatLabel: 'CSV • ט.מ.ל שיקלולית',
    accentColor: 'border-blue-500/40 hover:border-blue-400',
    badgeBg: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    badgeText: 'רואי חשבון',
    renderLogo: () => (
      <div className="w-14 h-12 rounded-xl bg-white flex flex-col items-center justify-center px-1.5 shadow-sm border border-slate-200">
        <div className="text-[11px] font-black text-blue-700 border border-blue-600 rounded px-1 leading-tight">
          ט.מ.ל
        </div>
        <div className="text-[9px] font-bold text-slate-700 mt-0.5 leading-none">שיקלולית</div>
      </div>
    ),
  },
  {
    id: 'priority',
    nameHe: 'Priority (פריוריטי ERP)',
    nameRu: 'Priority ERP (פריוריטי)',
    nameEn: 'Priority ERP',
    subTitleHe: 'ממשק דיווח שעות ופרויקטים למערכת Priority',
    subTitleRu: 'Выгрузка табеля и проектов в систему Priority ERP',
    subTitleEn: 'Timesheet & cost-center import for Priority ERP',
    formatLabel: 'CSV / REST API',
    accentColor: 'border-indigo-500/40 hover:border-indigo-400',
    badgeBg: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    badgeText: 'ERP ארגוני',
    renderLogo: () => (
      <div className="w-14 h-12 rounded-xl bg-white flex items-center justify-center px-1.5 shadow-sm border border-slate-200">
        <div className="flex items-center gap-0.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-indigo-600 inline-block" />
          <span className="text-[11px] font-extrabold text-slate-900 tracking-tight">Priority</span>
        </div>
      </div>
    ),
  },
  {
    id: 'rivhit',
    nameHe: 'ריווחית (Rivhit)',
    nameRu: 'Ривхит (ריווחית)',
    nameEn: 'Rivhit Accounting',
    subTitleHe: 'ייצוא ריכוז שעות והוצאות להנהלת חשבונות ריווחית',
    subTitleRu: 'Экспорт часов и расходов для бухгалтерии ריווחית',
    subTitleEn: 'Hours & expenses export for Rivhit accounting',
    formatLabel: 'CSV / API Token',
    accentColor: 'border-amber-500/40 hover:border-amber-400',
    badgeBg: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    badgeText: 'הנה״ח ושכר',
    renderLogo: () => (
      <div className="w-14 h-12 rounded-xl bg-white flex items-center justify-center px-1.5 shadow-sm border border-slate-200">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-black text-slate-900">ריווחית</span>
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" />
        </div>
      </div>
    ),
  },
  {
    id: 'hilan',
    nameHe: 'חילן (Hilan)',
    nameRu: 'Хилан (חילן)',
    nameEn: 'Hilan Payroll',
    subTitleHe: 'קובץ קליטת נוכחות ושעות נוספות למערכת חילן',
    subTitleRu: 'Табель посещаемости и сверхурочных для חילן',
    subTitleEn: 'Attendance & overtime batch interface for Hilan',
    formatLabel: 'CSV • מפעל + ת.ז',
    accentColor: 'border-emerald-500/40 hover:border-emerald-400',
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    badgeText: 'חברות וארגונים',
    renderLogo: () => (
      <div className="w-14 h-12 rounded-xl bg-white flex flex-col items-center justify-center px-1.5 shadow-sm border border-slate-200">
        <div className="text-[12px] font-black text-emerald-800 leading-none">חילן</div>
        <div className="text-[8px] font-bold text-slate-500 tracking-wider uppercase mt-0.5">
          HILAN
        </div>
      </div>
    ),
  },
  {
    id: 'hargal',
    nameHe: 'הר-גל (Har-Gal)',
    nameRu: 'Хар-Галь (הר-גל)',
    nameEn: 'Har-Gal Payroll',
    subTitleHe: 'קובץ ממשק שכר מובנה לתוכנת הר-גל שכר',
    subTitleRu: 'Готовый файл импорта для зарплатной системы הר-גל',
    subTitleEn: 'Structured payroll import file for Har-Gal',
    formatLabel: 'CSV • הר-גל שכר',
    accentColor: 'border-orange-500/40 hover:border-orange-400',
    badgeBg: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    badgeText: 'שכר ומשאבי אנוש',
    renderLogo: () => (
      <div className="w-14 h-12 rounded-xl bg-white flex items-center justify-center gap-1 px-1.5 shadow-sm border border-slate-200">
        <div className="text-[11px] font-black text-slate-800">הר-גל</div>
        <span className="w-3 h-3 rounded-full border-2 border-orange-500 inline-block" />
      </div>
    ),
  },
  {
    id: 'okez',
    nameHe: 'עוקץ (Okez)',
    nameRu: 'Окец (עוקץ מערכות)',
    nameEn: 'Okez Systems',
    subTitleHe: 'ממשק ייבוא שעות עבודה ותוספות לתוכנת עוקץ שכר',
    subTitleRu: 'Импорт рабочих часов и тарифов 125%/150% в עוקץ',
    subTitleEn: 'Work hours & overtime import for Okez Payroll',
    formatLabel: 'CSV • עוקץ שכר',
    accentColor: 'border-rose-500/40 hover:border-rose-400',
    badgeBg: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    badgeText: 'עוקץ מערכות',
    renderLogo: () => (
      <div className="w-14 h-12 rounded-xl bg-white flex flex-col items-center justify-center px-1.5 shadow-sm border border-slate-200">
        <div className="text-[12px] font-black text-rose-700 leading-none">עוקץ</div>
        <div className="h-1 w-6 rounded-full bg-rose-600 mt-1" />
      </div>
    ),
  },
  {
    id: 'excel',
    nameHe: 'Excel (דוח שכר מרוכז)',
    nameRu: 'Excel (Сводная ведомость)',
    nameEn: 'Excel Master Payroll',
    subTitleHe: 'טבלת אקסל מלאה בעברית עם חלוקת 100%, 125%, 150%, שבת והוצאות',
    subTitleRu: 'Полная сводная таблица Excel на иврите (100%, 125%, 150%, Шаббат, расходы)',
    subTitleEn: 'Full Hebrew Excel table with 100%, 125%, 150%, Shabbat & expenses',
    formatLabel: 'Excel UTF-8 BOM',
    accentColor: 'border-emerald-500/40 hover:border-emerald-400',
    badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    badgeText: 'אוניברסלי',
    renderLogo: () => (
      <div className="w-14 h-12 rounded-xl bg-white flex flex-col items-center justify-center px-1.5 shadow-sm border border-slate-200">
        <div className="w-6 h-6 rounded-md bg-emerald-700 text-white font-black text-xs flex items-center justify-center">
          X
        </div>
        <div className="text-[9px] font-bold text-emerald-800 mt-0.5 leading-none">Excel</div>
      </div>
    ),
  },
  {
    id: 'api',
    nameHe: 'API (חיבור ישיר למערכות)',
    nameRu: 'REST API (Прямая синхронизация)',
    nameEn: 'REST API & Webhooks',
    subTitleHe: 'חיבור JSON ישיר ל-ERP, 1C, Make, Zapier ומערכות שכר בארגון',
    subTitleRu: 'Прямой JSON-интерфейс для ERP, 1С, Make, Zapier и внешних систем',
    subTitleEn: 'Direct JSON endpoint for ERP, 1C, Make, Zapier & custom payroll',
    formatLabel: 'JSON • REST API v1',
    accentColor: 'border-cyan-500/40 hover:border-cyan-400',
    badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    badgeText: 'אוטומציה מלאה',
    renderLogo: () => (
      <div className="w-14 h-12 rounded-xl bg-white flex flex-col items-center justify-center px-1.5 shadow-sm border border-slate-200">
        <div className="w-6 h-6 rounded-full bg-sky-600 text-white font-mono text-[10px] font-black flex items-center justify-center">
          {'</>'}
        </div>
        <div className="text-[9px] font-black text-slate-800 mt-0.5 leading-none">API</div>
      </div>
    ),
  },
];

export function ClientIntegrationsTab() {
  const { i18n } = useTranslation();
  const isHe = i18n.language === 'he';
  const isEn = i18n.language === 'en';

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [month, setMonth] = useState(defaultMonth);
  const [activeSystem, setActiveSystem] = useState<PayrollSystemId>('michpal');
  const [config, setConfig] = useState<PayrollCodesConfig>({
    companyCode: '001',
    codeRegular100: '101',
    codeOvertime125: '125',
    codeOvertime150: '150',
    codeShabbat150: '160',
    codeNight: '170',
    codeWorkDays: '100',
    codeExpenses: '200',
    accountantEmail: '',
    accountantPhone: '',
    rivhitApiToken: '',
  });
  const [employees, setEmployees] = useState<EmployeePayrollPreview[]>([]);
  const [totals, setTotals] = useState({
    employeesCount: 0,
    totalWorkDays: 0,
    totalStandard100Hours: 0,
    totalOvertime125Hours: 0,
    totalOvertime150Hours: 0,
    totalShabbat150Hours: 0,
    totalNightHours: 0,
    totalNetHours: 0,
    totalExpenses: 0,
  });
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [downloading, setDownloading] = useState<PayrollSystemId | null>(null);
  const [showAdvancedCodes, setShowAdvancedCodes] = useState(false);
  const [copiedApiUrl, setCopiedApiUrl] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadPreview = async (selectedMonth = month) => {
    setLoading(true);
    try {
      const res = await api.get(`/api/client/integrations/preview?month=${selectedMonth}`);
      if (res?.ok) {
        if (res.activeSystem) {
          setActiveSystem(res.activeSystem);
        }
        if (res.config) {
          setConfig(res.config);
        }
        setEmployees(res.employees || []);
        if (res.totals) {
          setTotals(res.totals);
        }
      }
    } catch (err) {
      console.error('Failed to load payroll integration preview', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPreview(month);
  }, [month]);

  const handleSaveConfig = async (
    nextSystem: PayrollSystemId = activeSystem,
    nextConfig: PayrollCodesConfig = config,
    regenerateApiKey = false
  ) => {
    setSavingConfig(true);
    try {
      const res = await api.post('/api/client/integrations/config', {
        activeSystem: nextSystem,
        config: nextConfig,
        regenerateApiKey,
      });
      if (res?.ok) {
        setActiveSystem(res.activeSystem);
        setConfig(res.config);
        setStatusMessage(
          isHe
            ? 'ההגדרות נשמרו בהצלחה!'
            : isEn
              ? 'Integration settings saved!'
              : 'Настройки интеграции сохранены!'
        );
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err) {
      console.error('Failed to save integration config', err);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleSelectSystem = async (sysId: PayrollSystemId) => {
    setActiveSystem(sysId);
    await handleSaveConfig(sysId, config, false);
  };

  const handleDownloadSystemFile = async (sysId: PayrollSystemId) => {
    setDownloading(sysId);
    try {
      const response = await fetch(
        `/api/client/integrations/export?month=${encodeURIComponent(month)}&system=${encodeURIComponent(sysId)}`,
        { credentials: 'include' }
      );
      if (!response.ok) {
        throw new Error('Export failed');
      }
      const contentDisposition = response.headers.get('content-disposition') || '';
      const fileNameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
      const ext = sysId === 'api' ? 'json' : 'csv';
      const filename = fileNameMatch?.[1] || `${sysId}_payroll_${month}.${ext}`;

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download payroll export', err);
    } finally {
      setDownloading(null);
    }
  };

  const selectedMeta: SystemCardMeta =
    PAYROLL_SYSTEM_CARDS.find((c) => c.id === activeSystem) ?? PAYROLL_SYSTEM_CARDS[0]!;

  const publicApiUrl = `${window.location.origin}/api/public/v1/payroll?apiKey=${config.apiKey || 'YOUR_KEY'}&month=${month}&system=${activeSystem}`;

  const handleCopyApiUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicApiUrl);
      setCopiedApiUrl(true);
      setTimeout(() => setCopiedApiUrl(false), 2500);
    } catch {
      // ignore
    }
  };

  const handleSendWhatsAppToAccountant = () => {
    const sysName = isHe ? selectedMeta.nameHe : isEn ? selectedMeta.nameEn : selectedMeta.nameRu;
    const text = isHe
      ? `שלום, מצורף סיכום שעות שכר לחודש ${month} (ממשק ${sysName}):\nסה"כ עובדים: ${totals.employeesCount}\nימי עבודה: ${totals.totalWorkDays}\nשעות 100%: ${totals.totalStandard100Hours}\nשעות 125%: ${totals.totalOvertime125Hours}\nשעות 150%: ${totals.totalOvertime150Hours}\nשעות שבת (150%): ${totals.totalShabbat150Hours}\nסה"כ שעות נטו: ${totals.totalNetHours}\nהוצאות: ₪${totals.totalExpenses}\n\nקישור ישיר להורדת קובץ הממשק לתוכנת השכר (${sysName}):\n${publicApiUrl}&download=1`
      : `Здравствуйте! Сводка зарплаты за ${month} (формат ${sysName}):\nРаботников: ${totals.employeesCount}\nРабочих дней: ${totals.totalWorkDays}\nЧасы 100%: ${totals.totalStandard100Hours}\nСверхурочные 125%: ${totals.totalOvertime125Hours}\nСверхурочные 150%: ${totals.totalOvertime150Hours}\nШаббат 150%: ${totals.totalShabbat150Hours}\nВсего нетто часов: ${totals.totalNetHours}\nРасходы: ₪${totals.totalExpenses}\n\nПрямая ссылка для загрузки файла в программу зарплаты (${sysName}):\n${publicApiUrl}&download=1`;

    const cleanPhone = (config.accountantPhone || '').replace(/[^\d+]/g, '');
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-emerald-500/25 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/50 p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {isHe
                  ? 'מתממשקת לתוכנת השכר ולכל מערכת בקליק אחד!'
                  : isEn
                    ? '1-Click Integration with Every Israeli Payroll & ERP System!'
                    : 'Интеграция с программами зарплаты и бухгалтерией в 1 клик!'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {isHe
                ? 'ממשקי שכר, הנהלת חשבונות ו-API'
                : isEn
                  ? 'Payroll, Accounting & ERP Integrations'
                  : 'Подключение к бухгалтерии, программам расчёта зарплаты и API'}
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              {isHe
                ? 'בחרו את תוכנת השכר של רואה החשבון או הארגון שלכם (מיכפל, שיקלולית ט.מ.ל, Priority, ריווחית, חילן, הר-גל, עוקץ, Excel או API) והורידו קובץ קליטה תקני בקליק אחד — כולל חלוקה אוטומטית ל-100%, 125%, 150%, שבת, לילה והוצאות.'
                : isEn
                  ? 'Select your accountant’s payroll software (Michpal, Shiklolit TML, Priority, Rivhit, Hilan, Har-Gal, Okez, Excel, or API) and export a ready-to-import payroll file in 1 click.'
                  : 'Выберите программу вашего бухгалтера или роэ-хешбона (מיכפל, שיקלולית ט.מ.ל, Priority, ריווחית, חילן, הר-גל, עוקץ, Excel или API) и скачайте готовый файл импорта в 1 клик — со всеми кодами начислений (100%, 125%, 150%, Шаббат, ночные и расходы).'}
            </p>
          </div>

          {/* Month Selector & Primary Export Action */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-slate-950/70 p-4 rounded-2xl border border-slate-800">
            <div className="flex flex-col">
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-emerald-400" />
                {isHe ? 'חודש שכר' : isEn ? 'Payroll Month' : 'Расчётный месяц'}
              </label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm font-bold text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <button
              type="button"
              onClick={() => handleDownloadSystemFile(activeSystem)}
              disabled={downloading !== null}
              className="px-5 py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                {downloading === activeSystem
                  ? isHe
                    ? 'מייצר קובץ...'
                    : 'Генерация...'
                  : isHe
                    ? `הורד קובץ ל-${selectedMeta.nameHe}`
                    : isEn
                      ? `Export for ${selectedMeta.nameEn}`
                      : `Скачать для ${selectedMeta.nameRu}`}
              </span>
            </button>

            <button
              type="button"
              onClick={handleSendWhatsAppToAccountant}
              className="px-4 py-3.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer"
              title={
                isHe
                  ? 'שלח קישור וסיכום שכר לרואה החשבון ב-WhatsApp'
                  : 'Отправить сводку и прямую ссылку на файл бухгалтеру в WhatsApp'
              }
            >
              <Send className="w-4 h-4" />
              <span>
                {isHe ? 'שלח לרו״ח ב-WhatsApp' : isEn ? 'Send to Accountant' : 'Отправить бухгалтеру'}
              </span>
            </button>
          </div>
        </div>

        {statusMessage && (
          <div className="mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>{statusMessage}</span>
          </div>
        )}
      </div>

      {/* 9 Systems Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-400">
            {isHe
              ? 'בחרו מערכת שכר או ERP (9 ממשקים נתמכים)'
              : isEn
                ? 'Select Payroll / ERP System (9 Native Connectors)'
                : 'Выберите систему расчёта зарплаты или бухгалтерию (9 встроенных интеграций)'}
          </h2>
          <button
            type="button"
            onClick={() => setShowAdvancedCodes((v) => !v)}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 transition cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>
              {isHe
                ? 'הגדרות סמלי שכר ומספר מפעל'
                : isEn
                  ? 'Configure Salary Codes & Company ID'
                  : 'Настроить коды начислений (סמלי שכר) и № компании'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PAYROLL_SYSTEM_CARDS.map((card) => {
            const isSelected = activeSystem === card.id;
            const title = isHe ? card.nameHe : isEn ? card.nameEn : card.nameRu;
            const sub = isHe ? card.subTitleHe : isEn ? card.subTitleEn : card.subTitleRu;

            return (
              <div
                key={card.id}
                onClick={() => handleSelectSystem(card.id)}
                className={`group relative rounded-2xl p-5 transition cursor-pointer border flex flex-col justify-between ${
                  isSelected
                    ? 'bg-slate-900/95 border-emerald-500 ring-2 ring-emerald-500/25 shadow-lg shadow-emerald-950/50'
                    : `bg-slate-900/60 hover:bg-slate-900 border-slate-800 ${card.accentColor}`
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5">
                      {card.renderLogo()}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-white text-base">{title}</h3>
                          {isSelected && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-slate-950">
                              <CheckCircle2 className="w-3 h-3" />
                              {isHe ? 'פעיל' : isEn ? 'ACTIVE' : 'ВЫБРАНО'}
                            </span>
                          )}
                        </div>
                        <span
                          className={`inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${card.badgeBg}`}
                        >
                          {card.badgeText} • {card.formatLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-400 leading-relaxed">{sub}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 font-medium">
                    {isSelected
                      ? isHe
                        ? 'מערכת ברירת מחדל של החברה'
                        : isEn
                          ? 'Default company integration'
                          : 'Активная система компании'
                      : isHe
                        ? 'לחץ לבחירה כברירת מחדל'
                        : isEn
                          ? 'Click to set as default'
                          : 'Нажмите, чтобы сделать основной'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadSystemFile(card.id);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-emerald-500 hover:text-slate-950 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isHe ? 'הורד קובץ' : isEn ? 'Download' : 'Скачать'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Collapsible Salary Codes & Accountant Settings */}
      {showAdvancedCodes && (
        <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <Building className="w-5 h-5 text-emerald-400" />
              <div>
                <h3 className="font-bold text-white text-base">
                  {isHe
                    ? 'הגדרות סמלי שכר ומספר מפעל (למיכפל, שיקלולית, חילן, הר-גל, עוקץ)'
                    : isEn
                      ? 'Salary Component Codes & Company Parameters'
                      : 'Настройка кодов начислений (סמלי שכר) и параметров бухгалтерии'}
                </h3>
                <p className="text-xs text-slate-400">
                  {isHe
                    ? 'התאימו את מספרי הסמלים להגדרות רואה החשבון שלכם (ברירות המחדל מתאימות לרוב משרדי רו״ח בישראל).'
                    : 'Коды по умолчанию подходят для 95% бухгалтерских бюро в Израиле. При необходимости укажите коды вашего роэ-хешбона.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'מספר מפעל / חברה' : '№ компании (מפעל)'}
              </label>
              <input
                type="text"
                value={config.companyCode}
                onChange={(e) => setConfig({ ...config, companyCode: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'סמל ימי עבודה' : 'Код дней (ימים)'}
              </label>
              <input
                type="text"
                value={config.codeWorkDays}
                onChange={(e) => setConfig({ ...config, codeWorkDays: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'סמל שעות 100%' : 'Код часов 100%'}
              </label>
              <input
                type="text"
                value={config.codeRegular100}
                onChange={(e) => setConfig({ ...config, codeRegular100: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'סמל שעות 125%' : 'Код часов 125%'}
              </label>
              <input
                type="text"
                value={config.codeOvertime125}
                onChange={(e) => setConfig({ ...config, codeOvertime125: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'סמל שעות 150%' : 'Код часов 150%'}
              </label>
              <input
                type="text"
                value={config.codeOvertime150}
                onChange={(e) => setConfig({ ...config, codeOvertime150: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'סמל שעות שבת' : 'Код Шаббат 150%'}
              </label>
              <input
                type="text"
                value={config.codeShabbat150}
                onChange={(e) => setConfig({ ...config, codeShabbat150: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'סמל שעות לילה' : 'Код ночных'}
              </label>
              <input
                type="text"
                value={config.codeNight}
                onChange={(e) => setConfig({ ...config, codeNight: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'סמל החזר הוצאות' : 'Код расходов (₪)'}
              </label>
              <input
                type="text"
                value={config.codeExpenses}
                onChange={(e) => setConfig({ ...config, codeExpenses: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'טלפון WhatsApp של רואה החשבון' : 'Телефон бухгалтера (для отправки в WhatsApp)'}
              </label>
              <input
                type="text"
                placeholder="972501234567"
                value={config.accountantPhone || ''}
                onChange={(e) => setConfig({ ...config, accountantPhone: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'אימייל רואה החשבון' : 'Email бухгалтера'}
              </label>
              <input
                type="email"
                placeholder="cpa@office.co.il"
                value={config.accountantEmail || ''}
                onChange={(e) => setConfig({ ...config, accountantEmail: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                {isHe ? 'טוקן API לריווחית / Priority (אופציונלי)' : 'API Token для Rivhit / Priority (опционально)'}
              </label>
              <input
                type="text"
                placeholder="API_TOKEN..."
                value={config.rivhitApiToken || ''}
                onChange={(e) => setConfig({ ...config, rivhitApiToken: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => handleSaveConfig(activeSystem, config, false)}
              disabled={savingConfig}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition cursor-pointer"
            >
              {savingConfig
                ? isHe
                  ? 'שומר...'
                  : 'Сохранение...'
                : isHe
                  ? 'שמור הגדרות סמלי שכר'
                  : 'Сохранить настройки кодов'}
            </button>
          </div>
        </div>
      )}

      {/* Direct API & ERP Endpoint Box */}
      <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs uppercase tracking-wider">
            <Code2 className="w-4 h-4" />
            <span>
              {isHe
                ? 'חיבור API ישיר (Priority / Rivhit / 1C / Make / PowerBI)'
                : 'Прямой URL синхронизации по API (Priority / Rivhit / 1C / Make / Excel Web Query)'}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            {isHe
              ? 'קישור מאובטח למשיכת נתוני שכר בזמן אמת בפורמט JSON או כקובץ CSV ישירות לתוך תוכנת השכר:'
              : 'По этой ссылке внешняя бухгалтерская программа или ERP может автоматически забирать данные за любой месяц:'}
          </p>
          <div className="mt-2 font-mono text-xs text-emerald-300 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 break-all">
            {publicApiUrl}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyApiUrl}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 border border-slate-700 transition cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {copiedApiUrl
                ? isHe
                  ? 'הועתק!'
                  : 'Скопировано!'
                : isHe
                  ? 'העתק כתובת API'
                  : 'Скопировать API URL'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSaveConfig(activeSystem, config, true)}
            className="px-3 py-2 rounded-xl bg-slate-800/70 hover:bg-slate-800 text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-800 transition cursor-pointer"
            title={isHe ? 'החלף מפתח API' : 'Перевыпустить API-ключ'}
          >
            <Key className="w-3.5 h-3.5" />
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Live Monthly Payroll Preview Table */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="font-bold text-white text-sm sm:text-base">
                {isHe
                  ? `תצוגה מקדימה של קובץ השכר לחודש ${month} (${selectedMeta.nameHe})`
                  : isEn
                    ? `Live Payroll Preview for ${month} (${selectedMeta.nameEn})`
                    : `Предпросмотр расчётной ведомости за ${month} (${selectedMeta.nameRu})`}
              </h3>
              <p className="text-xs text-slate-400">
                {isHe
                  ? 'כל השעות מחושבות לפי חוק שעות עבודה ומנוחה בישראל (100%, 125% שעתיים ראשונות, 150%, שבת וניכוי הפסקה).'
                  : 'Все часы рассчитаны по израильскому трудовому праву (100%, первые 2ч сверхурочных 125%, далее 150%, Шаббат 150% и авто-вычет перерыва).'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 font-bold">
              {isHe ? 'עובדים:' : 'Работников:'} {totals.employeesCount}
            </span>
            <span className="px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-bold">
              {isHe ? 'סה״כ שעות נטו:' : 'Всего часов нетто:'} {totals.totalNetHours}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase">
                <th className="py-3 px-4 font-bold">{isHe ? 'מס׳ עובד' : 'Код (מס׳ עובד)'}</th>
                <th className="py-3 px-4 font-bold">{isHe ? 'שם העובד' : 'Имя работника'}</th>
                <th className="py-3 px-4 font-bold">{isHe ? 'ימי עבודה' : 'Дни (100)'}</th>
                <th className="py-3 px-4 font-bold text-emerald-400">
                  {isHe ? 'רגילות 100%' : 'Часы 100%'}
                </th>
                <th className="py-3 px-4 font-bold text-amber-400">
                  {isHe ? 'נוספות 125%' : 'Сверхур. 125%'}
                </th>
                <th className="py-3 px-4 font-bold text-orange-400">
                  {isHe ? 'נוספות 150%' : 'Сверхур. 150%'}
                </th>
                <th className="py-3 px-4 font-bold text-purple-400">
                  {isHe ? 'שבת 150%' : 'Шаббат 150%'}
                </th>
                <th className="py-3 px-4 font-bold text-cyan-400">
                  {isHe ? 'שעות לילה' : 'Ночные'}
                </th>
                <th className="py-3 px-4 font-bold text-white">
                  {isHe ? 'סה״כ שעות נטו' : 'Итого Нетто'}
                </th>
                <th className="py-3 px-4 font-bold text-emerald-300">
                  {isHe ? 'הוצאות (₪)' : 'Расходы (₪)'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    {isHe ? 'טוען נתוני שכר...' : 'Загрузка данных зарплаты...'}
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    {isHe
                      ? 'אין עובדים פעילים בחודש זה'
                      : 'Нет данных по работникам за выбранный месяц'}
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.employeeId} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-4 font-mono font-bold text-slate-300">
                      #{emp.employeeNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-white">{emp.employeeName}</td>
                    <td className="py-3 px-4 font-semibold text-slate-300">{emp.workDays}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      {emp.totalStandard100Hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-amber-400">
                      {emp.totalOvertime125Hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-orange-400">
                      {emp.totalOvertime150Hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-purple-400">
                      {emp.totalShabbat150Hours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono text-cyan-400">
                      {emp.totalNightHours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono font-black text-white">
                      {emp.totalNetHours.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-300">
                      ₪{emp.totalExpenses.toFixed(2)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {employees.length > 0 && (
              <tfoot>
                <tr className="bg-slate-950/90 border-t-2 border-slate-700 font-black text-white">
                  <td className="py-3.5 px-4" colSpan={2}>
                    {isHe ? 'סה״כ לחודש' : 'ИТОГО ЗА МЕСЯЦ'}
                  </td>
                  <td className="py-3.5 px-4">{totals.totalWorkDays}</td>
                  <td className="py-3.5 px-4 font-mono text-emerald-400">
                    {totals.totalStandard100Hours.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-amber-400">
                    {totals.totalOvertime125Hours.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-orange-400">
                    {totals.totalOvertime150Hours.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-purple-400">
                    {totals.totalShabbat150Hours.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-cyan-400">
                    {totals.totalNightHours.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-white">
                    {totals.totalNetHours.toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-emerald-300">
                    ₪{totals.totalExpenses.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
export default ClientIntegrationsTab;
