export interface ReportRow {
  empId: string;
  name: string;
  date: string;
  firstIn: string;
  lastOut: string;
  grossHours: number;
  lunchDeducted: number;
  netHours: number;
  nightHours: number;
  saturdayHours: number;
  overtimeHours: number;
  overtime125Hours?: number;
  overtime150Hours?: number;
  notes: string;
  isManual?: boolean;
  logIds?: number[];
  dayOfWeek?: string;
  shiftsSummary?: string;
  sessionsCount?: number;
}

import { formatIsoToDisplayDate, getDayOfWeek, localizeSystemNote } from '@timetracker/shared';

const CSV_TRANSLATIONS: Record<
  'he' | 'ru' | 'en' | 'ar',
  {
    reportTitle: string;
    totalLabel: string;
    headers: string[];
  }
> = {
  he: {
    reportTitle: 'דוח שעות נוכחות - חברה',
    totalLabel: 'סה"כ',
    headers: [
      'קוד עובד',
      'שם עובד',
      'תאריך',
      'יום בשבוע',
      'כניסה ראשונה',
      'יציאה אחרונה',
      'שעות ברוטו',
      'ניכוי הפסקה',
      'סה"כ שעות נטו',
      'שעות לילה',
      'שעות שבת',
      'שעות נוספות (סה"כ)',
      'שעות 125%',
      'שעות 150%',
      'הערות',
    ],
  },
  ru: {
    reportTitle: 'Отчет по часам компании',
    totalLabel: 'ИТОГО',
    headers: [
      'ID Сотрудника',
      'Имя',
      'Дата',
      'День недели',
      'Первый вход',
      'Последний выход',
      'Общие часы',
      'Обед (вычет)',
      'Итого часы',
      'Ночные часы',
      'Субботние часы',
      'Сверхурочные (всего)',
      'Сверхурочные 125%',
      'Сверхурочные 150%',
      'Заметки',
    ],
  },
  en: {
    reportTitle: 'Company Attendance Report',
    totalLabel: 'TOTAL',
    headers: [
      'Employee ID',
      'Employee Name',
      'Date',
      'Day of Week',
      'First In',
      'Last Out',
      'Gross Hours',
      'Break Deducted',
      'Net Hours',
      'Night Hours',
      'Saturday Hours',
      'Overtime (Total)',
      'Overtime 125%',
      'Overtime 150%',
      'Notes',
    ],
  },
  ar: {
    reportTitle: 'تقرير ساعات حضور الشركة',
    totalLabel: 'المجموع',
    headers: [
      'معرف الموظف',
      'اسم الموظف',
      'التاريخ',
      'يوم الأسبوع',
      'أول دخول',
      'آخر خروج',
      'إجمالي الساعات',
      'خصم الاستراحة',
      'صافي الساعات',
      'ساعات ليلية',
      'ساعات السبت',
      'ساعات إضافية',
      'إضافي 125%',
      'إضافي 150%',
      'ملاحظات',
    ],
  },
};

function escapeCsvCell(val: string): string {
  return `"${(val || '').replace(/"/g, '""')}"`;
}

/**
 * Generates localized CSV string for report rows with UTF-8 BOM for Excel compatibility.
 * Defaults to Hebrew ('he') for Israeli payroll/attendance standard.
 */
export function generateCsvReport(rows: ReportRow[], clientName: string, lang: string = 'he'): string {
  const BOM = '\uFEFF';
  const norm = (lang || 'he').toLowerCase();
  const targetLang: 'he' | 'ru' | 'en' | 'ar' = norm.startsWith('ru')
    ? 'ru'
    : norm.startsWith('en')
    ? 'en'
    : norm.startsWith('ar')
    ? 'ar'
    : 'he';

  const dict = CSV_TRANSLATIONS[targetLang];
  const header = dict.headers.map((h) => escapeCsvCell(h)).join(',');

  let totalGross = 0;
  let totalLunch = 0;
  let totalNet = 0;
  let totalNight = 0;
  let totalSat = 0;
  let totalOt = 0;
  let totalOt125 = 0;
  let totalOt150 = 0;

  const csvRows = rows.map((r) => {
    const displayDate = formatIsoToDisplayDate(r.date) + (r.isManual ? ' *' : '');
    const dayStr = getDayOfWeek(r.date, targetLang) || r.dayOfWeek || '';
    const noteStr = localizeSystemNote(r.notes || '', targetLang);
    const ot125 = r.overtime125Hours ?? Math.round(Math.min(2, r.overtimeHours || 0) * 100) / 100;
    const ot150 = r.overtime150Hours ?? Math.max(0, Math.round(((r.overtimeHours || 0) - ot125) * 100) / 100);

    totalGross += r.grossHours;
    totalLunch += r.lunchDeducted;
    totalNet += r.netHours;
    totalNight += r.nightHours;
    totalSat += r.saturdayHours;
    totalOt += r.overtimeHours;
    totalOt125 += ot125;
    totalOt150 += ot150;

    return [
      escapeCsvCell(r.empId),
      escapeCsvCell(r.name),
      escapeCsvCell(displayDate),
      escapeCsvCell(dayStr),
      escapeCsvCell(r.firstIn),
      escapeCsvCell(r.lastOut),
      r.grossHours.toFixed(2),
      r.lunchDeducted.toFixed(2),
      r.netHours.toFixed(2),
      r.nightHours.toFixed(2),
      r.saturdayHours.toFixed(2),
      r.overtimeHours.toFixed(2),
      ot125.toFixed(2),
      ot150.toFixed(2),
      escapeCsvCell(noteStr),
    ].join(',');
  });

  if (rows.length > 0) {
    const totalRow = [
      escapeCsvCell(dict.totalLabel),
      '""',
      '""',
      '""',
      '""',
      '""',
      totalGross.toFixed(2),
      totalLunch.toFixed(2),
      totalNet.toFixed(2),
      totalNight.toFixed(2),
      totalSat.toFixed(2),
      totalOt.toFixed(2),
      totalOt125.toFixed(2),
      totalOt150.toFixed(2),
      '""',
    ].join(',');
    csvRows.push(totalRow);
  }

  return (
    BOM +
    `${escapeCsvCell(`${dict.reportTitle}: ${clientName}`)}\n` +
    header +
    '\n' +
    csvRows.join('\n')
  );
}
