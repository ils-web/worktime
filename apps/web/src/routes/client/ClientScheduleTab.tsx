import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';
import {
  Calendar,
  Save,
  Check,
  Loader2,
  Printer,
  Copy,
  ChevronLeft,
  ChevronRight,
  Send,
  RotateCcw,
} from 'lucide-react';

interface ShiftMeta {
  key: string;
  label: string;
  emoji: string;
  hours: string;
  badgeClass: string;
  isOff: boolean;
  isDouble: boolean;
}

export function ClientScheduleTab() {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const [scheduleMatrix, setScheduleMatrix] = useState<Record<string, string>>({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [weekOffset, setWeekOffset] = useState<number>(0);
  const [copiedEmpId, setCopiedEmpId] = useState<number | null>(null);

  // Print Modals
  const [printingEmployee, setPrintingEmployee] = useState<any | null>(null);
  const [isPrintTeamOpen, setIsPrintTeamOpen] = useState(false);

  // Queries
  const { data: empData, isLoading: isEmpLoading } = useQuery({
    queryKey: ['client-employees'],
    queryFn: () => apiRequest<{ employees: any[] }>('/api/client/employees'),
  });

  const { data: schedData, isLoading: isSchedLoading } = useQuery({
    queryKey: ['client-schedule'],
    queryFn: () => apiRequest<{ schedules: any[] }>('/api/client/schedule'),
  });

  const { data: settingsData } = useQuery({
    queryKey: ['client-settings'],
    queryFn: () =>
      apiRequest<{
        name: string;
        logoUrl: string | null;
        defaultShifts: {
          morning: { start: string; end: string };
          evening: { start: string; end: string };
          night: { start: string; end: string };
        };
      }>('/api/client/settings'),
  });

  const shiftsConfig = useMemo(() => {
    return (
      settingsData?.defaultShifts || {
        morning: { start: '08:00', end: '17:00' },
        evening: { start: '15:00', end: '23:00' },
        night: { start: '22:00', end: '06:00' },
      }
    );
  }, [settingsData]);

  const companyName = settingsData?.name || 'Company';

  // Calculate Sunday of the selected week
  const weekSunday = useMemo(() => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday
    const sun = new Date(now);
    sun.setDate(now.getDate() - day + weekOffset * 7);
    sun.setHours(0, 0, 0, 0);
    return sun;
  }, [weekOffset]);

  const daysOfWeek = useMemo(() => {
    return [
      { day: 0, label: t('admin.daySun') },
      { day: 1, label: t('admin.dayMon') },
      { day: 2, label: t('admin.dayTue') },
      { day: 3, label: t('admin.dayWed') },
      { day: 4, label: t('admin.dayThu') },
      { day: 5, label: t('admin.dayFri') },
      { day: 6, label: t('admin.daySat') },
    ].map((d) => {
      const dayDate = new Date(weekSunday);
      dayDate.setDate(weekSunday.getDate() + d.day);
      const dd = String(dayDate.getDate()).padStart(2, '0');
      const mm = String(dayDate.getMonth() + 1).padStart(2, '0');
      const yyyy = dayDate.getFullYear();
      return {
        ...d,
        dateFormatted: `${dd}.${mm}`,
        fullDateFormatted: `${dd}/${mm}/${yyyy}`,
        rawDate: dayDate,
      };
    });
  }, [weekSunday, t]);

  const weekRangeTitle = useMemo(() => {
    const firstDay = daysOfWeek[0]!.dateFormatted;
    const lastDay = `${daysOfWeek[6]!.dateFormatted}.${daysOfWeek[6]!.rawDate.getFullYear()}`;
    return `${firstDay} — ${lastDay}`;
  }, [daysOfWeek]);

  useEffect(() => {
    if (schedData?.schedules) {
      const map: Record<string, string> = {};
      for (const s of schedData.schedules) {
        map[`${s.employeeId}_${s.dayOfWeek}`] = s.shiftType;
      }
      setScheduleMatrix(map);
    }
  }, [schedData]);

  // Helper: Shift Details
  const getShiftDetails = (shiftKey: string): ShiftMeta => {
    const morningHours = `${shiftsConfig.morning.start}—${shiftsConfig.morning.end}`;
    const eveningHours = `${shiftsConfig.evening.start}—${shiftsConfig.evening.end}`;
    const nightHours = `${shiftsConfig.night.start}—${shiftsConfig.night.end}`;

    switch (shiftKey) {
      case 'evening':
        return {
          key: 'evening',
          label: t('admin.shiftEvening'),
          emoji: '🌆',
          hours: eveningHours,
          badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
          isOff: false,
          isDouble: false,
        };
      case 'night':
        return {
          key: 'night',
          label: t('admin.shiftNight'),
          emoji: '🌙',
          hours: nightHours,
          badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
          isOff: false,
          isDouble: false,
        };
      case 'morning_evening':
        return {
          key: 'morning_evening',
          label: t('admin.shiftMorningEvening'),
          emoji: '🌅+🌆',
          hours: `${shiftsConfig.morning.start}–${shiftsConfig.morning.end} + ${shiftsConfig.evening.start}–${shiftsConfig.evening.end}`,
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold',
          isOff: false,
          isDouble: true,
        };
      case 'morning_night':
        return {
          key: 'morning_night',
          label: t('admin.shiftMorningNight'),
          emoji: '🌅+🌙',
          hours: `${shiftsConfig.morning.start}–${shiftsConfig.morning.end} + ${shiftsConfig.night.start}–${shiftsConfig.night.end}`,
          badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 font-bold',
          isOff: false,
          isDouble: true,
        };
      case 'evening_night':
        return {
          key: 'evening_night',
          label: t('admin.shiftEveningNight'),
          emoji: '🌆+🌙',
          hours: `${shiftsConfig.evening.start}–${shiftsConfig.evening.end} + ${shiftsConfig.night.start}–${shiftsConfig.night.end}`,
          badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/40 font-bold',
          isOff: false,
          isDouble: true,
        };
      case 'double':
        return {
          key: 'double',
          label: t('admin.shiftDouble'),
          emoji: '⚡',
          hours: `${shiftsConfig.morning.start}–${shiftsConfig.evening.end}`,
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold',
          isOff: false,
          isDouble: true,
        };
      case 'off':
        return {
          key: 'off',
          label: t('admin.shiftOff'),
          emoji: '⛔',
          hours: '—',
          badgeClass: 'bg-slate-950 text-slate-500 border-slate-800',
          isOff: true,
          isDouble: false,
        };
      case 'morning':
      default:
        return {
          key: 'morning',
          label: t('admin.shiftMorning'),
          emoji: '🌅',
          hours: morningHours,
          badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
          isOff: false,
          isDouble: false,
        };
    }
  };

  // Generate formatted text for messenger
  const generateMessengerText = (emp: any): string => {
    const isHe = i18n.language === 'he';
    const dayNames = isHe
      ? ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
      : ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

    let text = '';
    if (isHe) {
      text += `📅 סידור עבודה שבועי עבור: ${emp.name} (ת.ז: ${emp.empId})\n`;
      if (companyName) text += `🏢 חברה: ${companyName}\n`;
      text += `🗓 שבוע: ${weekRangeTitle}\n\n`;
    } else {
      text += `📅 Расписание на неделю: ${emp.name} (ID: ${emp.empId})\n`;
      if (companyName) text += `🏢 Организация: ${companyName}\n`;
      text += `🗓 Неделя: ${weekRangeTitle}\n\n`;
    }

    for (let i = 0; i < 7; i++) {
      const dInfo = daysOfWeek[i]!;
      const shiftKey = scheduleMatrix[`${emp.id}_${i}`] || 'morning';
      const shift = getShiftDetails(shiftKey);

      if (shift.isOff) {
        text += `• ${dayNames[i]} (${dInfo.dateFormatted}): ${shift.emoji} ${shift.label}\n`;
      } else {
        text += `• ${dayNames[i]} (${dInfo.dateFormatted}): ${shift.emoji} ${shift.label} (${shift.hours})\n`;
      }
    }

    text += isHe ? `\nשבוע עבודה מוצלח! ✨` : `\nХорошей рабочей недели! ✨`;
    return text;
  };

  const handleCopy = (emp: any) => {
    const text = generateMessengerText(emp);
    navigator.clipboard.writeText(text);
    setCopiedEmpId(emp.id);
    setTimeout(() => setCopiedEmpId(null), 3000);
  };

  const handleWhatsApp = (emp: any) => {
    const text = generateMessengerText(emp);
    const phone = emp.phone ? emp.phone.replace(/[^0-9]/g, '') : '';
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  // Save Schedule Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises: Promise<any>[] = [];
      for (const [key, shiftType] of Object.entries(scheduleMatrix)) {
        const [empIdStr, dayOfWeekStr] = key.split('_');
        const employeeId = parseInt(empIdStr || '0', 10);
        const dayOfWeek = parseInt(dayOfWeekStr || '0', 10);
        if (employeeId) {
          promises.push(
            apiRequest('/api/client/schedule', {
              method: 'POST',
              body: JSON.stringify({ employeeId, dayOfWeek, shiftType }),
            })
          );
        }
      }
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-schedule'] });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    },
  });

  const employees = empData?.employees || [];
  const isLoading = isEmpLoading || isSchedLoading;

  const handleShiftChange = (employeeId: number, dayOfWeek: number, shiftType: string) => {
    setScheduleMatrix((prev) => ({
      ...prev,
      [`${employeeId}_${dayOfWeek}`]: shiftType,
    }));
  };

  const triggerPrint = (areaId: string, docTitle: string) => {
    const container = document.getElementById(areaId);
    if (!container) {
      window.print();
      return;
    }

    const isRtl = i18n.language === 'he' || i18n.language === 'ar';
    const iframe = document.createElement('iframe');
    iframe.setAttribute('style', 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;');
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.print();
      return;
    }

    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="${i18n.language}" dir="${isRtl ? 'rtl' : 'ltr'}">
  <head>
    <meta charset="utf-8" />
    <title>${docTitle}</title>
    <style>
      @page {
        size: A4 portrait;
        margin: 10mm 12mm;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      html, body {
        background: #ffffff !important;
        background-color: #ffffff !important;
        color: #0f172a !important;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      .print-page {
        background: #ffffff !important;
        color: #0f172a !important;
        padding: 0;
        width: 100%;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
        margin-top: 10px;
        page-break-inside: auto;
      }
      tr {
        page-break-inside: avoid;
        page-break-after: auto;
      }
      th, td {
        border: 1px solid #cbd5e1;
        padding: 6px 8px;
        color: #0f172a;
      }
      th {
        background-color: #f1f5f9 !important;
        color: #334155 !important;
        font-weight: 700;
      }
      .text-center { text-align: center; }
      .text-start { text-align: start; }
      .text-right { text-align: right; }
      .font-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
      .font-bold { font-weight: 700; }
      .font-semibold { font-weight: 600; }
      .font-medium { font-weight: 500; }
      .text-xl { font-size: 18px; font-weight: bold; }
      .text-base { font-size: 13px; font-weight: 600; }
      .text-sm { font-size: 12px; }
      .text-xs { font-size: 11px; }
      .text-\\[10px\\] { font-size: 10px; }
      .text-\\[11px\\] { font-size: 11px; }
      .text-slate-950 { color: #020617; }
      .text-slate-900 { color: #0f172a; }
      .text-slate-800 { color: #1e293b; }
      .text-slate-700 { color: #334155; }
      .text-slate-600 { color: #475569; }
      .text-slate-500 { color: #64748b; }
      .text-slate-400 { color: #94a3b8; }
      .text-slate-300 { color: #cbd5e1; }
      .text-emerald-700 { color: #047857; font-weight: 600; }
      .bg-white { background-color: #ffffff !important; }
      .bg-slate-50 { background-color: #f8fafc !important; }
      .bg-slate-50\\/60 { background-color: #f8fafc !important; }
      .bg-slate-100 { background-color: #f1f5f9 !important; }
      .border { border: 1px solid #e2e8f0; }
      .border-b { border-bottom: 1px solid #e2e8f0; }
      .border-t { border-top: 1px solid #e2e8f0; }
      .border-r { border-right: 1px solid #cbd5e1; }
      .border-slate-200 { border-color: #e2e8f0; }
      .border-slate-300 { border-color: #cbd5e1; }
      .rounded-xl, .rounded-lg, .rounded { border-radius: 4px; }
      .p-2 { padding: 6px 8px; }
      .p-3 { padding: 8px 12px; }
      .p-6 { padding: 0 !important; }
      .pb-3 { padding-bottom: 10px; }
      .pt-4 { padding-top: 14px; }
      .mt-0\\.5 { margin-top: 2px; }
      .mr-1 { margin-right: 4px; }
      .flex { display: flex; }
      .justify-between { justify-content: space-between; }
      .items-center { align-items: center; }
      .items-start { align-items: flex-start; }
      .inline-block { display: inline-block; }
      .block { display: block; }
      .whitespace-nowrap { white-space: nowrap; }
      .space-y-4 > * + * { margin-top: 12px; }
      .w-full { width: 100%; }
      .w-24 { width: 80px; }
      .w-48 { width: 140px; }
      .w-28 { width: 90px; }
      .shadow-sm, .shadow-md, .shadow-lg, .shadow-2xl { box-shadow: none !important; }
    </style>
  </head>
  <body>
    <div class="print-page">
      ${container.innerHTML}
    </div>
  </body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } finally {
        setTimeout(() => {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1500);
      }
    }, 250);
  };

  return (
    <div className="space-y-6">
      {/* Print CSS Stylesheet */}
      <style>{`
        @media print {
          @page {
            size: auto;
            margin: 10mm;
          }

          /* Force complete white page background */
          html,
          body {
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 100% !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          #root {
            background: transparent !important;
            background-color: transparent !important;
            height: auto !important;
            overflow: visible !important;
          }

          /* Reset modal wrappers and fixed overlays so they don't produce dark backdrops */
          .fixed,
          [role="dialog"] {
            position: static !important;
            background: transparent !important;
            background-color: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            max-height: none !important;
            overflow: visible !important;
          }

          /* Hide all default page content */
          body * {
            visibility: hidden !important;
          }

          /* Make only the schedule print area and its children visible */
          #printable-employee-schedule-area,
          #printable-employee-schedule-area *,
          #printable-team-schedule-area,
          #printable-team-schedule-area *,
          #printable-schedule-area,
          #printable-schedule-area * {
            visibility: visible !important;
          }

          #printable-employee-schedule-area,
          #printable-team-schedule-area,
          #printable-schedule-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            z-index: 99999 !important;
          }

          /* Prevent unwanted table row breaks */
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }

          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            {t('admin.scheduleTitle')}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {t('admin.scheduleSubtitle')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Week Selector */}
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs shadow-sm">
            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev - 1)}
              title={t('admin.weekPrev')}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
            </button>

            <span className="px-2 py-0.5 font-bold font-mono text-emerald-400 text-xs whitespace-nowrap">
              {weekRangeTitle}
            </span>

            <button
              type="button"
              onClick={() => setWeekOffset((prev) => prev + 1)}
              title={t('admin.weekNext')}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </button>

            {weekOffset !== 0 && (
              <button
                type="button"
                onClick={() => setWeekOffset(0)}
                title={t('admin.weekCurrent')}
                className="px-2 py-0.5 rounded-lg text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 transition flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>{t('admin.weekCurrent')}</span>
              </button>
            )}
          </div>

          {/* Print Team Matrix */}
          <button
            type="button"
            onClick={() => setIsPrintTeamOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-slate-700/80 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>{t('admin.printTeamSchedule')}</span>
          </button>

          {/* Save Button */}
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-2 transition shadow-lg shadow-emerald-950"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : savedSuccess ? (
              <Check className="w-4 h-4 text-emerald-200" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {savedSuccess ? t('admin.scheduleSaved') : t('admin.saveSchedule')}
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
        </div>
      ) : employees.length === 0 ? (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl text-slate-500">
          {t('admin.addEmployeesFirst')}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/70 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="p-3.5 sticky left-0 bg-slate-950 z-10 min-w-[170px]">
                    {t('admin.thEmployee')}
                  </th>
                  {daysOfWeek.map((d) => (
                    <th key={d.day} className="p-3.5 text-center min-w-[140px]">
                      <div>{d.label}</div>
                      <div className="text-[10px] font-mono font-normal text-emerald-400/80 mt-0.5">
                        {d.dateFormatted}
                      </div>
                    </th>
                  ))}
                  <th className="p-3.5 text-center sticky right-0 bg-slate-950 z-10 min-w-[130px]">
                    {t('admin.thActions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/40 transition">
                    <td className="p-3.5 font-semibold text-white sticky left-0 bg-slate-900 z-10 whitespace-nowrap">
                      {emp.name}
                      <span className="block text-[11px] font-mono text-slate-400">{emp.empId}</span>
                    </td>
                    {daysOfWeek.map((d) => {
                      const val = scheduleMatrix[`${emp.id}_${d.day}`] || 'morning';
                      const details = getShiftDetails(val);
                      return (
                        <td key={d.day} className="p-2.5 text-center">
                          <select
                            value={val}
                            onChange={(e) => handleShiftChange(emp.id, d.day, e.target.value)}
                            className={`w-full px-2 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${details.badgeClass}`}
                          >
                            <option value="morning" className="bg-slate-900 text-white">
                              🌅 {t('admin.shiftMorning')}
                            </option>
                            <option value="evening" className="bg-slate-900 text-white">
                              🌆 {t('admin.shiftEvening')}
                            </option>
                            <option value="night" className="bg-slate-900 text-white">
                              🌙 {t('admin.shiftNight')}
                            </option>
                            <option value="morning_evening" className="bg-slate-900 text-amber-300 font-bold">
                              🌅+🌆 {t('admin.shiftMorningEvening')}
                            </option>
                            <option value="morning_night" className="bg-slate-900 text-indigo-300 font-bold">
                              🌅+🌙 {t('admin.shiftMorningNight')}
                            </option>
                            <option value="evening_night" className="bg-slate-900 text-violet-300 font-bold">
                              🌆+🌙 {t('admin.shiftEveningNight')}
                            </option>
                            <option value="double" className="bg-slate-900 text-rose-300 font-bold">
                              ⚡ {t('admin.shiftDouble')}
                            </option>
                            <option value="off" className="bg-slate-900 text-slate-400">
                              ⛔ {t('admin.shiftOff')}
                            </option>
                          </select>
                        </td>
                      );
                    })}
                    <td className="p-3 text-center sticky right-0 bg-slate-900 z-10 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Copy for Messenger */}
                        <button
                          type="button"
                          onClick={() => handleCopy(emp)}
                          title={t('admin.copyScheduleMessenger')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition relative"
                        >
                          {copiedEmpId === emp.id ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-400" />
                          )}
                        </button>

                        {/* WhatsApp Direct */}
                        <button
                          type="button"
                          onClick={() => handleWhatsApp(emp)}
                          title={t('admin.openInWhatsApp')}
                          className="p-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 text-emerald-400 border border-emerald-500/30 transition"
                        >
                          <Send className="w-4 h-4" />
                        </button>

                        {/* Print Individual */}
                        <button
                          type="button"
                          onClick={() => setPrintingEmployee(emp)}
                          title={t('admin.printEmployeeSchedule')}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                        >
                          <Printer className="w-4 h-4 text-sky-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Copy Alert Toast */}
      {copiedEmpId !== null && (
        <div className="fixed bottom-6 right-6 z-50 bg-emerald-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 text-xs font-semibold">
          <Check className="w-4 h-4" />
          <span>{t('admin.scheduleCopied')}</span>
        </div>
      )}

      {/* MODAL 1: Individual Employee Weekly Schedule Print Preview */}
      {printingEmployee && (
        <Modal
          isOpen={Boolean(printingEmployee)}
          onClose={() => setPrintingEmployee(null)}
          title={`${t('admin.weeklyScheduleTitle')} — ${printingEmployee.name}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4">
            {/* Printable Container */}
            <div
              id="printable-employee-schedule-area"
              className="bg-white text-slate-900 p-6 rounded-xl border border-slate-200 shadow-sm space-y-4"
              dir={i18n.language === 'he' || i18n.language === 'ar' ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h1 className="text-xl font-bold text-slate-950">
                    {companyName}
                  </h1>
                  <h2 className="text-base font-semibold text-emerald-700 mt-0.5">
                    {t('admin.weeklyScheduleTitle')}
                  </h2>
                </div>
                <div className="text-right rtl:text-left text-xs font-mono text-slate-600">
                  <div>
                    <strong>{t('admin.weekPeriod')}:</strong> <span dir="ltr" className="inline-block">{weekRangeTitle}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    {new Date().toLocaleDateString(i18n.language)}
                  </div>
                </div>
              </div>

              {/* Employee Info Banner */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-500 font-semibold">{t('admin.thEmployee')}: </span>
                  <strong className="text-slate-900 text-sm">{printingEmployee.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">ID: </span>
                  <span className="font-mono font-bold text-slate-800">{printingEmployee.empId}</span>
                </div>
              </div>

              {/* Schedule Table */}
              <table className="w-full text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 text-center w-24">
                      {i18n.language === 'he' ? 'יום' : 'День'}
                    </th>
                    <th className="p-2 border-r border-slate-300 text-center w-24">
                      {i18n.language === 'he' ? 'תאריך' : 'Дата'}
                    </th>
                    <th className="p-2 border-r border-slate-300 text-start">
                      {i18n.language === 'he' ? 'משמרת' : 'Смена'}
                    </th>
                    <th className="p-2 border-r border-slate-300 text-center w-48">
                      {i18n.language === 'he' ? 'שעות עבודה' : 'Часы'}
                    </th>
                    <th className="p-2 text-center w-28">
                      {i18n.language === 'he' ? 'חתימה / הערות' : 'Подпись'}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {daysOfWeek.map((d) => {
                    const shiftKey = scheduleMatrix[`${printingEmployee.id}_${d.day}`] || 'morning';
                    const shift = getShiftDetails(shiftKey);
                    return (
                      <tr key={d.day} className={shift.isOff ? 'bg-slate-50/60' : ''}>
                        <td className="p-2 border-r border-slate-300 text-center font-semibold">
                          {d.label}
                        </td>
                        <td className="p-2 border-r border-slate-300 text-center font-mono text-slate-600">
                          {d.fullDateFormatted}
                        </td>
                        <td className="p-2 border-r border-slate-300 font-medium">
                          <span className="mr-1">{shift.emoji}</span>
                          <span>{shift.label}</span>
                        </td>
                        <td className="p-2 border-r border-slate-300 text-center font-mono font-semibold text-slate-800">
                          <span dir="ltr" className="inline-block">{shift.hours}</span>
                        </td>
                        <td className="p-2 text-center text-slate-300 border-b">
                          ________________
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Signature Footer */}
              <div className="pt-4 flex justify-between items-center text-xs text-slate-600 border-t border-slate-200">
                <div>
                  <span>{i18n.language === 'he' ? 'חתימת מנהל:' : 'Подпись руководителя:'} ____________________</span>
                </div>
                <div>
                  <span>{i18n.language === 'he' ? 'חתימת עובד:' : 'Подпись сотрудника:'} ____________________</span>
                </div>
              </div>
            </div>

            {/* Modal Actions (No-Print) */}
            <div className="flex flex-wrap justify-between items-center gap-2 pt-2 border-t border-slate-800 no-print">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopy(printingEmployee)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('admin.copyScheduleMessenger')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleWhatsApp(printingEmployee)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 text-emerald-400 text-xs font-semibold border border-emerald-500/30 flex items-center gap-1.5 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>WhatsApp</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintingEmployee(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs"
                >
                  {t('admin.closeModal')}
                </button>
                <button
                  type="button"
                  onClick={() => triggerPrint('printable-employee-schedule-area', `${t('admin.weeklyScheduleTitle')} — ${printingEmployee?.name || ''}`)}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t('admin.printSchedule')}</span>
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* MODAL 2: Team Matrix Weekly Print Preview */}
      {isPrintTeamOpen && (
        <Modal
          isOpen={isPrintTeamOpen}
          onClose={() => setIsPrintTeamOpen(false)}
          title={`${t('admin.printTeamSchedule')} (${weekRangeTitle})`}
          maxWidth="max-w-4xl"
        >
          <div className="space-y-4">
            <div
              id="printable-team-schedule-area"
              className="bg-white text-slate-900 p-6 rounded-xl border border-slate-200 shadow-sm space-y-4"
              dir={i18n.language === 'he' || i18n.language === 'ar' ? 'rtl' : 'ltr'}
            >
              <div className="flex justify-between items-start border-b border-slate-200 pb-3">
                <div>
                  <h1 className="text-xl font-bold text-slate-950">{companyName}</h1>
                  <h2 className="text-sm font-semibold text-emerald-700 mt-0.5">
                    {t('admin.scheduleTitle')} — <span dir="ltr" className="inline-block">{weekRangeTitle}</span>
                  </h2>
                </div>
                <div className="text-right rtl:text-left text-xs font-mono text-slate-500">
                  {new Date().toLocaleDateString(i18n.language)}
                </div>
              </div>

              <table className="w-full text-xs border border-slate-300 border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-300">
                    <th className="p-2 border-r border-slate-300 text-start">
                      {t('admin.thEmployee')}
                    </th>
                    {daysOfWeek.map((d) => (
                      <th key={d.day} className="p-2 border-r border-slate-300 text-center">
                        <div>{d.label}</div>
                        <div className="text-[10px] font-mono text-slate-500">{d.dateFormatted}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {employees.map((emp) => (
                    <tr key={emp.id}>
                      <td className="p-2 border-r border-slate-300 font-semibold text-slate-900 whitespace-nowrap">
                        {emp.name}
                        <span className="block text-[10px] font-mono text-slate-500">{emp.empId}</span>
                      </td>
                      {daysOfWeek.map((d) => {
                        const shiftKey = scheduleMatrix[`${emp.id}_${d.day}`] || 'morning';
                        const shift = getShiftDetails(shiftKey);
                        return (
                          <td
                            key={d.day}
                            className={`p-1.5 border-r border-slate-300 text-center ${
                              shift.isOff ? 'bg-slate-50 text-slate-400' : ''
                            }`}
                          >
                            <div className="font-semibold">{shift.emoji} {shift.label}</div>
                            {!shift.isOff && (
                              <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                                <span dir="ltr" className="inline-block">{shift.hours}</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-4 flex justify-between items-center text-xs text-slate-600 border-t border-slate-200">
                <span>{i18n.language === 'he' ? 'חתימת מנהל:' : 'Подпись руководителя:'} ____________________</span>
                <span>{companyName} &copy; {new Date().getFullYear()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800 no-print">
              <button
                type="button"
                onClick={() => setIsPrintTeamOpen(false)}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs"
              >
                {t('admin.closeModal')}
              </button>
              <button
                type="button"
                onClick={() => triggerPrint('printable-team-schedule-area', `${t('admin.printTeamSchedule')} (${weekRangeTitle})`)}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950 transition"
              >
                <Printer className="w-4 h-4" />
                <span>{t('admin.printSchedule')}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
