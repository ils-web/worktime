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
  notes: string;
  isManual?: boolean;
  logIds?: number[];
}

import { formatIsoToDisplayDate } from '@timetracker/shared';

/**
 * Generates CSV string for report rows with UTF-8 BOM for Excel compatibility
 */
export function generateCsvReport(rows: ReportRow[], clientName: string): string {
  const BOM = '\uFEFF';
  const header = [
    'ID Сотрудника',
    'Имя',
    'Дата',
    'Первый вход',
    'Последний выход',
    'Общие часы',
    'Обед (вычет)',
    'Итого часы',
    'Ночные часы',
    'Субботние часы',
    'Сверхурочные',
    'Заметки',
  ].join(',');

  const csvRows = rows.map((r) => {
    const displayDate = formatIsoToDisplayDate(r.date) + (r.isManual ? ' *' : '');
    return [
      `"${r.empId}"`,
      `"${r.name.replace(/"/g, '""')}"`,
      `"${displayDate}"`,
      `"${r.firstIn}"`,
      `"${r.lastOut}"`,
      r.grossHours.toFixed(2),
      r.lunchDeducted.toFixed(2),
      r.netHours.toFixed(2),
      r.nightHours.toFixed(2),
      r.saturdayHours.toFixed(2),
      r.overtimeHours.toFixed(2),
      `"${(r.notes || '').replace(/"/g, '""')}"`,
    ].join(',');
  });

  return (
    BOM +
    `"Отчет по часам компании: ${clientName.replace(/"/g, '""')}"\n` +
    header +
    '\n' +
    csvRows.join('\n')
  );
}
