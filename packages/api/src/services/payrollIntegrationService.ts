import { PayrollCodesConfig, PayrollSystemId } from '@timetracker/shared';
import { ReportRow } from './csvReportService';

export interface EmployeePayrollSummary {
  empId: string;
  name: string;
  workDays: number;
  regular100Hours: number;
  overtime125Hours: number;
  overtime150Hours: number;
  shabbatHours: number;
  nightHours: number;
  lunchDeductedHours: number;
  totalGrossHours: number;
  totalNetHours: number;
  expensesIls: number;
}

export const DEFAULT_PAYROLL_CODES: PayrollCodesConfig = {
  companyCode: '001',
  codeWorkDays: '100',
  codeRegular100: '101',
  codeOvertime125: '125',
  codeOvertime150: '150',
  codeShabbat150: '160',
  codeNight: '170',
  codeExpenses: '200',
};

function escapeCsvCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  const safeStr = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safeStr.replace(/"/g, '""')}"`;
}

export function aggregateMonthlyPayroll(
  rows: ReportRow[],
  expensesByEmpId: Map<string, number> = new Map(),
  allEmployees: Array<{ empId: string; name: string }> = []
): EmployeePayrollSummary[] {
  const map = new Map<
    string,
    {
      empId: string;
      name: string;
      dates: Set<string>;
      regular100Hours: number;
      overtime125Hours: number;
      overtime150Hours: number;
      shabbatHours: number;
      nightHours: number;
      lunchDeductedHours: number;
      totalGrossHours: number;
      totalNetHours: number;
    }
  >();

  for (const emp of allEmployees) {
    map.set(emp.empId, {
      empId: emp.empId,
      name: emp.name,
      dates: new Set(),
      regular100Hours: 0,
      overtime125Hours: 0,
      overtime150Hours: 0,
      shabbatHours: 0,
      nightHours: 0,
      lunchDeductedHours: 0,
      totalGrossHours: 0,
      totalNetHours: 0,
    });
  }

  for (const r of rows) {
    let entry = map.get(r.empId);
    if (!entry) {
      entry = {
        empId: r.empId,
        name: r.name,
        dates: new Set(),
        regular100Hours: 0,
        overtime125Hours: 0,
        overtime150Hours: 0,
        shabbatHours: 0,
        nightHours: 0,
        lunchDeductedHours: 0,
        totalGrossHours: 0,
        totalNetHours: 0,
      };
      map.set(r.empId, entry);
    }

    if (r.netHours > 0 || r.grossHours > 0) {
      entry.dates.add(r.date);
    }

    const ot125 = r.overtime125Hours ?? Math.min(2, r.overtimeHours);
    const ot150 = r.overtime150Hours ?? Math.max(0, r.overtimeHours - ot125);
    const shabbat = r.saturdayHours || 0;
    // Regular 100% hours = Net hours minus Overtime (125% + 150%) and minus Shabbat hours (if not already in overtime)
    const regular100 = Math.max(0, Number((r.netHours - r.overtimeHours - shabbat).toFixed(2)));

    entry.regular100Hours += regular100;
    entry.overtime125Hours += ot125;
    entry.overtime150Hours += ot150;
    entry.shabbatHours += shabbat;
    entry.nightHours += r.nightHours || 0;
    entry.lunchDeductedHours += r.lunchDeducted || 0;
    entry.totalGrossHours += r.grossHours || 0;
    entry.totalNetHours += r.netHours || 0;
  }

  const summaries: EmployeePayrollSummary[] = [];
  for (const entry of map.values()) {
    const expensesIls = Number((expensesByEmpId.get(entry.empId) || 0).toFixed(2));
    // Include employee if they have worked hours or expenses
    if (entry.totalNetHours > 0 || entry.totalGrossHours > 0 || expensesIls > 0) {
      summaries.push({
        empId: entry.empId,
        name: entry.name,
        workDays: entry.dates.size,
        regular100Hours: Number(entry.regular100Hours.toFixed(2)),
        overtime125Hours: Number(entry.overtime125Hours.toFixed(2)),
        overtime150Hours: Number(entry.overtime150Hours.toFixed(2)),
        shabbatHours: Number(entry.shabbatHours.toFixed(2)),
        nightHours: Number(entry.nightHours.toFixed(2)),
        lunchDeductedHours: Number(entry.lunchDeductedHours.toFixed(2)),
        totalGrossHours: Number(entry.totalGrossHours.toFixed(2)),
        totalNetHours: Number(entry.totalNetHours.toFixed(2)),
        expensesIls,
      });
    }
  }

  return summaries.sort((a, b) => a.empId.localeCompare(b.empId));
}

export function generatePayrollExportFile(params: {
  system: PayrollSystemId;
  periodMonth: string; // YYYY-MM
  clientName: string;
  summaries: EmployeePayrollSummary[];
  dailyRows: ReportRow[];
  codes?: Partial<PayrollCodesConfig>;
}): { content: string; filename: string; contentType: string } {
  const { system, periodMonth, clientName, summaries, dailyRows } = params;
  const codes: PayrollCodesConfig = {
    ...DEFAULT_PAYROLL_CODES,
    ...(params.codes || {}),
  };

  const BOM = '\uFEFF';
  const safeClient = clientName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Company';
  const [yearStr, monthStr] = periodMonth.split('-');
  const displayPeriod = `${monthStr}/${yearStr}`;

  if (system === 'api') {
    const payload = {
      system: 'TickWork Payroll & ERP API v2',
      companyName: clientName,
      companyCode: codes.companyCode,
      periodMonth,
      generatedAt: new Date().toISOString(),
      salaryCodes: codes,
      employeeSummaries: summaries,
      dailyAttendance: dailyRows,
    };
    return {
      content: JSON.stringify(payload, null, 2),
      filename: `TickWork_API_${safeClient}_${periodMonth}.json`,
      contentType: 'application/json; charset=utf-8',
    };
  }

  const lines: string[] = [];

  switch (system) {
    case 'michpal': {
      // מיכפל (Michpal) — קובץ ממשק שכר לקליטת שעות ורכיבים
      lines.push(
        [
          escapeCsvCell('ממשק שכר מיכפל (Michpal)'),
          escapeCsvCell(clientName),
          escapeCsvCell(`מפעל: ${codes.companyCode}`),
          escapeCsvCell(`תקופה: ${displayPeriod}`),
        ].join(',')
      );
      lines.push('');
      lines.push(
        [
          'מספר מפעל',
          'תקופת שכר',
          'מספר עובד',
          'שם עובד',
          `ימי עבודה (${codes.codeWorkDays})`,
          `שעות רגילות 100% (${codes.codeRegular100})`,
          `שעות נוספות 125% (${codes.codeOvertime125})`,
          `שעות נוספות 150% (${codes.codeOvertime150})`,
          `שעות שבת 150% (${codes.codeShabbat150})`,
          `שעות לילה (${codes.codeNight})`,
          `החזר הוצאות/נסיעות (${codes.codeExpenses})`,
          'סה"כ שעות נטו',
        ]
          .map(escapeCsvCell)
          .join(',')
      );

      for (const s of summaries) {
        lines.push(
          [
            codes.companyCode,
            displayPeriod,
            s.empId,
            s.name,
            s.workDays,
            s.regular100Hours.toFixed(2),
            s.overtime125Hours.toFixed(2),
            s.overtime150Hours.toFixed(2),
            s.shabbatHours.toFixed(2),
            s.nightHours.toFixed(2),
            s.expensesIls.toFixed(2),
            s.totalNetHours.toFixed(2),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      // Also include standard Michpal batch code lines (רשומות קליטה לפי סמל שכר)
      lines.push('');
      lines.push([escapeCsvCell('--- רשומות קליטה למיכפל לפי סמל שכר (Batch Import) ---')].join(','));
      lines.push(
        ['מספר מפעל', 'מספר עובד', 'שם עובד', 'חודש', 'שנה', 'סמל שכר', 'תיאור רכיב', 'כמות / שעות / סכום']
          .map(escapeCsvCell)
          .join(',')
      );
      for (const s of summaries) {
        const items: Array<[string, string, number]> = [
          [codes.codeWorkDays, 'ימי עבודה', s.workDays],
          [codes.codeRegular100, 'שעות רגילות 100%', s.regular100Hours],
          [codes.codeOvertime125, 'שעות נוספות 125%', s.overtime125Hours],
          [codes.codeOvertime150, 'שעות נוספות 150%', s.overtime150Hours],
          [codes.codeShabbat150, 'שעות שבת 150%', s.shabbatHours],
          [codes.codeNight, 'שעות לילה', s.nightHours],
          [codes.codeExpenses, 'החזר הוצאות', s.expensesIls],
        ];
        for (const [code, label, val] of items) {
          if (val > 0) {
            lines.push(
              [codes.companyCode, s.empId, s.name, monthStr, yearStr, code, label, val.toFixed(2)]
                .map(escapeCsvCell)
                .join(',')
            );
          }
        }
      }

      return {
        content: BOM + lines.join('\r\n'),
        filename: `Michpal_${safeClient}_${periodMonth}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    case 'shiklolit': {
      // שיקלולית / ט.מ.ל (Shiklolit TML)
      lines.push(
        [
          escapeCsvCell('ממשק שכר שיקלולית - ט.מ.ל (Shiklolit TML)'),
          escapeCsvCell(clientName),
          escapeCsvCell(`קוד חברה: ${codes.companyCode}`),
          escapeCsvCell(`חודש: ${displayPeriod}`),
        ].join(',')
      );
      lines.push('');
      lines.push(
        [
          'קוד חברה',
          'חודש ושנה',
          'קוד עובד',
          'שם עובד',
          `סמל ${codes.codeWorkDays} (ימים)`,
          `סמל ${codes.codeRegular100} (רגילות 100%)`,
          `סמל ${codes.codeOvertime125} (נוספות 125%)`,
          `סמל ${codes.codeOvertime150} (נוספות 150%)`,
          `סמל ${codes.codeShabbat150} (שבת 150%)`,
          `סמל ${codes.codeNight} (לילה)`,
          `סמל ${codes.codeExpenses} (הוצאות ש"ח)`,
          'סה"כ שעות לתשלום',
        ]
          .map(escapeCsvCell)
          .join(',')
      );

      for (const s of summaries) {
        lines.push(
          [
            codes.companyCode,
            displayPeriod,
            s.empId,
            s.name,
            s.workDays,
            s.regular100Hours.toFixed(2),
            s.overtime125Hours.toFixed(2),
            s.overtime150Hours.toFixed(2),
            s.shabbatHours.toFixed(2),
            s.nightHours.toFixed(2),
            s.expensesIls.toFixed(2),
            s.totalNetHours.toFixed(2),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      return {
        content: BOM + lines.join('\r\n'),
        filename: `Shiklolit_TML_${safeClient}_${periodMonth}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    case 'hargal': {
      // הר-גל (Har-Gal Payroll)
      lines.push(
        [
          escapeCsvCell('ממשק קליטת נוכחות - הר-גל (Har-Gal)'),
          escapeCsvCell(clientName),
          escapeCsvCell(`מפעל: ${codes.companyCode}`),
          escapeCsvCell(`תקופה: ${displayPeriod}`),
        ].join(',')
      );
      lines.push('');
      lines.push(
        [
          'מספר מפעל',
          'תקופה',
          'מספר עובד',
          'שם עובד',
          'ימי עבודה',
          'שעות תקן 100%',
          'שעות נוספות 125%',
          'שעות נוספות 150%',
          'שעות שבת/חג 150%',
          'שעות לילה',
          'ניכוי הפסקה',
          'החזר הוצאות (ש"ח)',
          'סה"כ שעות נטו',
        ]
          .map(escapeCsvCell)
          .join(',')
      );

      for (const s of summaries) {
        lines.push(
          [
            codes.companyCode,
            displayPeriod,
            s.empId,
            s.name,
            s.workDays,
            s.regular100Hours.toFixed(2),
            s.overtime125Hours.toFixed(2),
            s.overtime150Hours.toFixed(2),
            s.shabbatHours.toFixed(2),
            s.nightHours.toFixed(2),
            s.lunchDeductedHours.toFixed(2),
            s.expensesIls.toFixed(2),
            s.totalNetHours.toFixed(2),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      return {
        content: BOM + lines.join('\r\n'),
        filename: `HarGal_${safeClient}_${periodMonth}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    case 'okez': {
      // עוקץ מערכות (Okez Payroll)
      lines.push(
        [
          escapeCsvCell('ממשק שכר - עוקץ מערכות (Okez)'),
          escapeCsvCell(clientName),
          escapeCsvCell(`קוד מעסיק: ${codes.companyCode}`),
          escapeCsvCell(`חודש: ${displayPeriod}`),
        ].join(',')
      );
      lines.push('');
      lines.push(
        [
          'קוד מעסיק',
          'חודש שכר',
          'מספר עובד',
          'שם מלא',
          'ימי נוכחות',
          'שעות רגילות 100%',
          'שעות נוספות 125%',
          'שעות נוספות 150%',
          'שעות שבת 150%',
          'שעות לילה',
          'הוצאות ונסיעות',
          'סה"כ שעות נטו',
        ]
          .map(escapeCsvCell)
          .join(',')
      );

      for (const s of summaries) {
        lines.push(
          [
            codes.companyCode,
            displayPeriod,
            s.empId,
            s.name,
            s.workDays,
            s.regular100Hours.toFixed(2),
            s.overtime125Hours.toFixed(2),
            s.overtime150Hours.toFixed(2),
            s.shabbatHours.toFixed(2),
            s.nightHours.toFixed(2),
            s.expensesIls.toFixed(2),
            s.totalNetHours.toFixed(2),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      return {
        content: BOM + lines.join('\r\n'),
        filename: `Okez_${safeClient}_${periodMonth}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    case 'hilan': {
      // חילן (Hilan Value / Enterprise Payroll)
      lines.push(
        [
          escapeCsvCell('ממשק שעות נוכחות - חילן (Hilan)'),
          escapeCsvCell(clientName),
          escapeCsvCell(`ארגון: ${codes.companyCode}`),
          escapeCsvCell(`תקופה: ${displayPeriod}`),
        ].join(',')
      );
      lines.push('');
      lines.push(
        [
          'קוד ארגון',
          'תקופת שכר',
          'מספר עובד',
          'שם עובד',
          `ימי עבודה (${codes.codeWorkDays})`,
          `שעות תקן 100% (${codes.codeRegular100})`,
          `שעות נוספות 125% (${codes.codeOvertime125})`,
          `שעות נוספות 150% (${codes.codeOvertime150})`,
          `שעות מנוחה/שבת (${codes.codeShabbat150})`,
          `שעות לילה (${codes.codeNight})`,
          `החזר הוצאות (${codes.codeExpenses})`,
          'סה"כ שעות נטו',
        ]
          .map(escapeCsvCell)
          .join(',')
      );

      for (const s of summaries) {
        lines.push(
          [
            codes.companyCode,
            displayPeriod,
            s.empId,
            s.name,
            s.workDays,
            s.regular100Hours.toFixed(2),
            s.overtime125Hours.toFixed(2),
            s.overtime150Hours.toFixed(2),
            s.shabbatHours.toFixed(2),
            s.nightHours.toFixed(2),
            s.expensesIls.toFixed(2),
            s.totalNetHours.toFixed(2),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      return {
        content: BOM + lines.join('\r\n'),
        filename: `Hilan_${safeClient}_${periodMonth}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    case 'priority': {
      // Priority ERP (פריוריטי — ממשק העמסת שעות נוכחות)
      lines.push(
        [
          'COMPANY_CODE',
          'COMPANY_NAME',
          'PAY_PERIOD',
          'EMP_ID',
          'EMP_NAME',
          'WORK_DAYS',
          'REG_100_HRS',
          'OT_125_HRS',
          'OT_150_HRS',
          'SHABBAT_150_HRS',
          'NIGHT_HRS',
          'BREAK_DEDUCT_HRS',
          'EXPENSES_ILS',
          'TOTAL_NET_HRS',
        ]
          .map(escapeCsvCell)
          .join(',')
      );

      for (const s of summaries) {
        lines.push(
          [
            codes.companyCode,
            clientName,
            periodMonth,
            s.empId,
            s.name,
            s.workDays,
            s.regular100Hours.toFixed(2),
            s.overtime125Hours.toFixed(2),
            s.overtime150Hours.toFixed(2),
            s.shabbatHours.toFixed(2),
            s.nightHours.toFixed(2),
            s.lunchDeductedHours.toFixed(2),
            s.expensesIls.toFixed(2),
            s.totalNetHours.toFixed(2),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      return {
        content: BOM + lines.join('\r\n'),
        filename: `Priority_ERP_${safeClient}_${periodMonth}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    case 'rivhit': {
      // ריווחית (Rivhit Accounting & Payroll Summary)
      lines.push(
        [
          escapeCsvCell('דוח ריכוז שעות והוצאות - ריווחית (Rivhit)'),
          escapeCsvCell(clientName),
          escapeCsvCell(`מספר חברה/עוסק: ${codes.companyCode}`),
          escapeCsvCell(`תקופה: ${displayPeriod}`),
        ].join(',')
      );
      lines.push('');
      lines.push(
        [
          'קוד חברה',
          'תקופה',
          'קוד עובד',
          'שם עובד',
          'ימי עבודה',
          'שעות רגילות (100%)',
          'שעות נוספות (125%)',
          'שעות נוספות (150%)',
          'שעות שבת (150%)',
          'החזר הוצאות מוכרות (ש"ח)',
          'סה"כ שעות נטו',
        ]
          .map(escapeCsvCell)
          .join(',')
      );

      for (const s of summaries) {
        lines.push(
          [
            codes.companyCode,
            displayPeriod,
            s.empId,
            s.name,
            s.workDays,
            s.regular100Hours.toFixed(2),
            s.overtime125Hours.toFixed(2),
            s.overtime150Hours.toFixed(2),
            s.shabbatHours.toFixed(2),
            s.expensesIls.toFixed(2),
            s.totalNetHours.toFixed(2),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      return {
        content: BOM + lines.join('\r\n'),
        filename: `Rivhit_${safeClient}_${periodMonth}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }

    case 'excel':
    default: {
      // Universal Excel Monthly Payroll Summary + Daily Breakdown
      lines.push(
        [
          escapeCsvCell('דוח שכר מרוכז להנהלת חשבונות (Excel Payroll Master)'),
          escapeCsvCell(clientName),
          escapeCsvCell(`תקופה: ${displayPeriod}`),
        ].join(',')
      );
      lines.push('');
      lines.push(
        [
          'קוד עובד',
          'שם עובד',
          'ימי עבודה',
          'שעות ברוטו',
          'ניכוי הפסקה',
          'שעות נטו',
          'שעות רגילות 100%',
          'שעות נוספות 125%',
          'שעות נוספות 150%',
          'שעות שבת 150%',
          'שעות לילה',
          'החזר הוצאות (ש"ח)',
        ]
          .map(escapeCsvCell)
          .join(',')
      );

      for (const s of summaries) {
        lines.push(
          [
            s.empId,
            s.name,
            s.workDays,
            s.totalGrossHours.toFixed(2),
            s.lunchDeductedHours.toFixed(2),
            s.totalNetHours.toFixed(2),
            s.regular100Hours.toFixed(2),
            s.overtime125Hours.toFixed(2),
            s.overtime150Hours.toFixed(2),
            s.shabbatHours.toFixed(2),
            s.nightHours.toFixed(2),
            s.expensesIls.toFixed(2),
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }

      return {
        content: BOM + lines.join('\r\n'),
        filename: `Excel_Payroll_${safeClient}_${periodMonth}.csv`,
        contentType: 'text/csv; charset=utf-8',
      };
    }
  }
}
