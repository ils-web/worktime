import { PDFDocument, rgb, PDFFont, PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { ReportRow } from './csvReportService';
import { getArialRegularBytes, getArialBoldBytes } from './fontAssets';

/**
 * Normalizes text for PDF rendering with Arial Unicode font.
 * Fontkit handles OpenType glyph layout and bidirectional Hebrew script natively.
 * Text is preserved in its natural logical order so Hebrew words are read naturally RTL
 * and numbers/dates remain strictly LTR.
 */
export function formatBidiText(text: string | null | undefined): string {
  if (!text) return '';
  return String(text).trim();
}

/**
 * Backwards-compatible alias for formatBidiText
 */
export function toPdfSafe(text: string): string {
  return formatBidiText(text);
}

interface ColumnDef {
  key: keyof ReportRow | 'index';
  title: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
}

interface LocaleStrings {
  systemTitle: string;
  reportTitle: string;
  companyLabel: string;
  periodLabel: string;
  generatedLabel: string;
  summaryGross: string;
  summaryLunch: string;
  summaryNet: string;
  summaryNight: string;
  summarySat: string;
  summaryOvertime: string;
  page: string;
  of: string;
  noData: string;
  hoursUnit: string;
  isRtl: boolean;
  columns: ColumnDef[];
}

const LOCALES: Record<string, LocaleStrings> = {
  he: {
    systemTitle: 'TimeTracker SaaS',
    reportTitle: 'דוח נוכחות ושעות עבודה',
    companyLabel: 'חברה:',
    periodLabel: 'תקופה:',
    generatedLabel: 'הופק בתאריך:',
    summaryGross: 'סה"כ ברוטו',
    summaryLunch: 'ניכוי הפסקה',
    summaryNet: 'סה"כ נטו',
    summaryNight: 'שעות לילה',
    summarySat: 'שעות שבת',
    summaryOvertime: 'שעות נוספות',
    page: 'עמוד',
    of: 'מתוך',
    noData: 'אין נתונים לתקופה שנבחרה',
    hoursUnit: 'שעות',
    isRtl: true,
    columns: [
      { key: 'date', title: 'תאריך', width: 68, align: 'center' },
      { key: 'name', title: 'שם עובד', width: 130, align: 'right' },
      { key: 'firstIn', title: 'כניסה', width: 44, align: 'center' },
      { key: 'lastOut', title: 'יציאה', width: 44, align: 'center' },
      { key: 'grossHours', title: 'ברוטו', width: 48, align: 'center' },
      { key: 'lunchDeducted', title: 'הפסקה', width: 48, align: 'center' },
      { key: 'netHours', title: 'נטו', width: 48, align: 'center', bold: true },
      { key: 'nightHours', title: 'לילה', width: 44, align: 'center' },
      { key: 'saturdayHours', title: 'שבת', width: 44, align: 'center' },
      { key: 'overtimeHours', title: 'נוספות', width: 48, align: 'center' },
      { key: 'notes', title: 'הערות', width: 200, align: 'right' },
    ],
  },
  ru: {
    systemTitle: 'TimeTracker SaaS',
    reportTitle: 'Табель учёта рабочего времени',
    companyLabel: 'Компания:',
    periodLabel: 'Период:',
    generatedLabel: 'Сформирован:',
    summaryGross: 'Всего брутто',
    summaryLunch: 'Вычет обеда',
    summaryNet: 'Итого нетто',
    summaryNight: 'Ночные',
    summarySat: 'Суббота',
    summaryOvertime: 'Сверхурочные',
    page: 'Стр.',
    of: 'из',
    noData: 'Нет записей за выбранный период',
    hoursUnit: 'ч',
    isRtl: false,
    columns: [
      { key: 'date', title: 'Дата', width: 68, align: 'center' },
      { key: 'name', title: 'Сотрудник', width: 130, align: 'left' },
      { key: 'firstIn', title: 'Вход', width: 44, align: 'center' },
      { key: 'lastOut', title: 'Выход', width: 44, align: 'center' },
      { key: 'grossHours', title: 'Брутто', width: 48, align: 'center' },
      { key: 'lunchDeducted', title: 'Обед', width: 48, align: 'center' },
      { key: 'netHours', title: 'Нетто', width: 48, align: 'center', bold: true },
      { key: 'nightHours', title: 'Ночные', width: 44, align: 'center' },
      { key: 'saturdayHours', title: 'Суббота', width: 44, align: 'center' },
      { key: 'overtimeHours', title: 'Овертайм', width: 48, align: 'center' },
      { key: 'notes', title: 'Заметки', width: 200, align: 'left' },
    ],
  },
  en: {
    systemTitle: 'TimeTracker SaaS',
    reportTitle: 'Timesheet & Attendance Report',
    companyLabel: 'Company:',
    periodLabel: 'Period:',
    generatedLabel: 'Generated:',
    summaryGross: 'Gross Total',
    summaryLunch: 'Lunch Deduct',
    summaryNet: 'Net Total',
    summaryNight: 'Night',
    summarySat: 'Saturday',
    summaryOvertime: 'Overtime',
    page: 'Page',
    of: 'of',
    noData: 'No records found for the selected period',
    hoursUnit: 'h',
    isRtl: false,
    columns: [
      { key: 'date', title: 'Date', width: 68, align: 'center' },
      { key: 'name', title: 'Employee', width: 130, align: 'left' },
      { key: 'firstIn', title: 'In', width: 44, align: 'center' },
      { key: 'lastOut', title: 'Out', width: 44, align: 'center' },
      { key: 'grossHours', title: 'Gross', width: 48, align: 'center' },
      { key: 'lunchDeducted', title: 'Lunch', width: 48, align: 'center' },
      { key: 'netHours', title: 'Net', width: 48, align: 'center', bold: true },
      { key: 'nightHours', title: 'Night', width: 44, align: 'center' },
      { key: 'saturdayHours', title: 'Sat', width: 44, align: 'center' },
      { key: 'overtimeHours', title: 'OT', width: 48, align: 'center' },
      { key: 'notes', title: 'Notes', width: 200, align: 'left' },
    ],
  },
};

function truncateToWidth(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string {
  if (!text) return '';
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  if (textWidth <= maxWidth) return text;

  let current = text;
  while (current.length > 2) {
    current = current.slice(0, -1);
    const candidate = current + '…';
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      return candidate;
    }
  }
  return current;
}

export async function generatePdfReport(
  rows: ReportRow[],
  clientName: string,
  periodTitle: string,
  _logoUrl?: string | null,
  lang: string = 'he'
): Promise<Uint8Array> {
  const normLang = lang?.toLowerCase().startsWith('he')
    ? 'he'
    : lang?.toLowerCase().startsWith('ru')
    ? 'ru'
    : lang?.toLowerCase().startsWith('ar')
    ? 'he' // Use Hebrew RTL layout for Israel Arabic/Hebrew conventions
    : 'en';

  const t = LOCALES[normLang] || LOCALES['he']!;
  const isRtl = t.isRtl;

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const font = await pdfDoc.embedFont(getArialRegularBytes());
  const fontBold = await pdfDoc.embedFont(getArialBoldBytes());

  // A4 Landscape format
  const pageWidth = 841.89;
  const pageHeight = 595.28;
  const startX = 35;
  const totalTableWidth = t.columns.reduce((sum, col) => sum + col.width, 0); // ~772

  // Summary statistics
  const totalGross = rows.reduce((acc, r) => acc + (r.grossHours || 0), 0);
  const totalLunch = rows.reduce((acc, r) => acc + (r.lunchDeducted || 0), 0);
  const totalNet = rows.reduce((acc, r) => acc + (r.netHours || 0), 0);
  const totalNight = rows.reduce((acc, r) => acc + (r.nightHours || 0), 0);
  const totalSat = rows.reduce((acc, r) => acc + (r.saturdayHours || 0), 0);
  const totalOt = rows.reduce((acc, r) => acc + (r.overtimeHours || 0), 0);

  // Compute calculated X coordinates for each column based on RTL / LTR
  interface RenderCol {
    def: ColumnDef;
    x: number;
    width: number;
  }

  const renderCols: RenderCol[] = [];
  if (isRtl) {
    let currentRight = startX + totalTableWidth;
    for (const col of t.columns) {
      const colX = currentRight - col.width;
      renderCols.push({ def: col, x: colX, width: col.width });
      currentRight -= col.width;
    }
  } else {
    let currentLeft = startX;
    for (const col of t.columns) {
      renderCols.push({ def: col, x: currentLeft, width: col.width });
      currentLeft += col.width;
    }
  }

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentPageIndex = 1;
  const pages: PDFPage[] = [page];

  let y = pageHeight - 45;

  // 1. Header Banner
  page.drawRectangle({
    x: startX,
    y: y - 8,
    width: totalTableWidth,
    height: 48,
    color: rgb(0.06, 0.09, 0.16),
  });

  // Logo / System title on left
  page.drawText(t.systemTitle, {
    x: startX + 16,
    y: y + 16,
    size: 15,
    font: fontBold,
    color: rgb(0.13, 0.77, 0.37), // emerald
  });

  page.drawText(t.reportTitle, {
    x: startX + 16,
    y: y + 2,
    size: 9.5,
    font,
    color: rgb(0.7, 0.75, 0.85),
  });

  // Company and Period info on right
  const rightEdge = startX + totalTableWidth - 16;
  const safeClientName = clientName?.trim() || '';
  const safePeriodTitle = periodTitle?.trim() || '';

  if (isRtl) {
    // In RTL: Label on the right, value to the left of the label
    const compLabelW = fontBold.widthOfTextAtSize(t.companyLabel, 10.5);
    const compValW = fontBold.widthOfTextAtSize(safeClientName, 10.5);
    page.drawText(t.companyLabel, {
      x: rightEdge - compLabelW,
      y: y + 16,
      size: 10.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    page.drawText(safeClientName, {
      x: rightEdge - compLabelW - 6 - compValW,
      y: y + 16,
      size: 10.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    const periodLabelW = font.widthOfTextAtSize(t.periodLabel, 9);
    const periodValW = font.widthOfTextAtSize(safePeriodTitle, 9);
    page.drawText(t.periodLabel, {
      x: rightEdge - periodLabelW,
      y: y + 2,
      size: 9,
      font,
      color: rgb(0.75, 0.8, 0.9),
    });
    page.drawText(safePeriodTitle, {
      x: rightEdge - periodLabelW - 6 - periodValW,
      y: y + 2,
      size: 9,
      font,
      color: rgb(0.75, 0.8, 0.9),
    });
  } else {
    // In LTR: Label on the left, value on the right
    const compStr = `${t.companyLabel} ${safeClientName}`;
    const compW = fontBold.widthOfTextAtSize(compStr, 10.5);
    page.drawText(compStr, {
      x: rightEdge - compW,
      y: y + 16,
      size: 10.5,
      font: fontBold,
      color: rgb(1, 1, 1),
    });

    const periodStr = `${t.periodLabel} ${safePeriodTitle}`;
    const periodW = font.widthOfTextAtSize(periodStr, 9);
    page.drawText(periodStr, {
      x: rightEdge - periodW,
      y: y + 2,
      size: 9,
      font,
      color: rgb(0.75, 0.8, 0.9),
    });
  }

  y -= 48;

  // 2. Summary KPI Metric Boxes (6 key metrics including Gross, Lunch, Net)
  const summaryBoxes = [
    {
      label: t.summaryGross,
      value: totalGross.toFixed(1),
      bg: rgb(0.95, 0.96, 0.98),
      textCol: rgb(0.2, 0.25, 0.35),
    },
    {
      label: t.summaryLunch,
      value: `-${totalLunch.toFixed(1)}`,
      bg: rgb(0.99, 0.95, 0.95),
      textCol: rgb(0.85, 0.25, 0.25),
    },
    {
      label: t.summaryNet,
      value: totalNet.toFixed(1),
      bg: rgb(0.93, 0.98, 0.95),
      textCol: rgb(0.06, 0.55, 0.28),
      isKey: true,
    },
    {
      label: t.summaryNight,
      value: totalNight.toFixed(1),
      bg: rgb(0.95, 0.96, 0.98),
      textCol: rgb(0.3, 0.35, 0.45),
    },
    {
      label: t.summarySat,
      value: totalSat.toFixed(1),
      bg: rgb(0.95, 0.96, 0.98),
      textCol: rgb(0.3, 0.35, 0.45),
    },
    {
      label: t.summaryOvertime,
      value: totalOt.toFixed(1),
      bg: rgb(0.99, 0.97, 0.93),
      textCol: rgb(0.8, 0.5, 0.1),
    },
  ];

  const boxGap = 8;
  const boxWidth = (totalTableWidth - (summaryBoxes.length - 1) * boxGap) / summaryBoxes.length;
  const boxHeight = 32;

  for (let bi = 0; bi < summaryBoxes.length; bi++) {
    const box = summaryBoxes[bi]!;
    const bx = isRtl
      ? startX + totalTableWidth - (bi + 1) * boxWidth - bi * boxGap
      : startX + bi * (boxWidth + boxGap);

    // Box background
    page.drawRectangle({
      x: bx,
      y: y - boxHeight + 8,
      width: boxWidth,
      height: boxHeight,
      color: box.bg,
      borderColor: box.isKey ? rgb(0.2, 0.7, 0.4) : rgb(0.88, 0.9, 0.94),
      borderWidth: box.isKey ? 1.2 : 0.6,
    });

    const lblW = font.widthOfTextAtSize(box.label, 7.5);
    const valW = fontBold.widthOfTextAtSize(box.value, 10.5);

    page.drawText(box.label, {
      x: bx + (boxWidth - lblW) / 2,
      y: y + 10,
      size: 7.5,
      font,
      color: rgb(0.45, 0.5, 0.6),
    });

    page.drawText(box.value, {
      x: bx + (boxWidth - valW) / 2,
      y: y - 2,
      size: 10.5,
      font: fontBold,
      color: box.textCol,
    });
  }

  y -= boxHeight + 14;

  // Helper to draw Table Header Row
  const drawTableHeader = (targetPage: PDFPage, currentY: number) => {
    targetPage.drawRectangle({
      x: startX,
      y: currentY - 5,
      width: totalTableWidth,
      height: 20,
      color: rgb(0.12, 0.16, 0.24), // dark sleek header
    });

    for (const rCol of renderCols) {
      const titleStr = rCol.def.title;
      const titleW = fontBold.widthOfTextAtSize(titleStr, 8);
      let textX: number;
      if (rCol.def.align === 'center') {
        textX = rCol.x + (rCol.width - titleW) / 2;
      } else if (rCol.def.align === 'right' || isRtl) {
        textX = rCol.x + rCol.width - 6 - titleW;
      } else {
        textX = rCol.x + 6;
      }

      targetPage.drawText(titleStr, {
        x: textX,
        y: currentY + 1,
        size: 8,
        font: fontBold,
        color: rgb(0.95, 0.97, 1.0),
      });
    }
  };

  // Draw first table header
  drawTableHeader(page, y);
  y -= 18;

  // If no rows
  if (rows.length === 0) {
    const noDataStr = t.noData;
    const ndW = font.widthOfTextAtSize(noDataStr, 10);
    page.drawText(noDataStr, {
      x: startX + (totalTableWidth - ndW) / 2,
      y: y - 25,
      size: 10,
      font,
      color: rgb(0.5, 0.55, 0.65),
    });
  }

  const rowHeight = 16.5;

  // 3. Render Table Rows
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;

    // Pagination check: bottom margin is 35pt
    if (y < 42) {
      page = pdfDoc.addPage([pageWidth, pageHeight]);
      currentPageIndex++;
      pages.push(page);
      y = pageHeight - 45;
      drawTableHeader(page, y);
      y -= 18;
    }

    const isEven = i % 2 === 0;

    // Row background (alternating zebra stripes)
    page.drawRectangle({
      x: startX,
      y: y - 4,
      width: totalTableWidth,
      height: rowHeight,
      color: isEven ? rgb(0.98, 0.99, 1.0) : rgb(1, 1, 1),
      borderColor: rgb(0.9, 0.92, 0.95),
      borderWidth: 0.4,
    });

    // Draw row cells
    for (const rCol of renderCols) {
      let rawVal = '';
      let isBold = false;
      let cellColor = rgb(0.15, 0.18, 0.25);

      switch (rCol.def.key) {
        case 'date':
          rawVal = r.date;
          break;
        case 'name':
          rawVal = r.name;
          break;
        case 'firstIn':
          rawVal = r.firstIn || '—';
          break;
        case 'lastOut':
          rawVal = r.lastOut || '—';
          break;
        case 'grossHours':
          rawVal = r.grossHours > 0 ? r.grossHours.toFixed(2) : '0.00';
          break;
        case 'lunchDeducted':
          rawVal = r.lunchDeducted > 0 ? r.lunchDeducted.toFixed(2) : '0.00';
          if (r.lunchDeducted > 0) cellColor = rgb(0.7, 0.2, 0.2); // subtle reddish for lunch deduction
          break;
        case 'netHours':
          rawVal = r.netHours > 0 ? r.netHours.toFixed(2) : '0.00';
          isBold = true;
          cellColor = rgb(0.06, 0.55, 0.28); // emerald bold for Net
          break;
        case 'nightHours':
          rawVal = r.nightHours > 0 ? r.nightHours.toFixed(2) : '0.00';
          if (r.nightHours > 0) cellColor = rgb(0.2, 0.35, 0.65);
          break;
        case 'saturdayHours':
          rawVal = r.saturdayHours > 0 ? r.saturdayHours.toFixed(2) : '0.00';
          if (r.saturdayHours > 0) cellColor = rgb(0.55, 0.2, 0.65);
          break;
        case 'overtimeHours':
          rawVal = r.overtimeHours > 0 ? r.overtimeHours.toFixed(2) : '0.00';
          if (r.overtimeHours > 0) cellColor = rgb(0.75, 0.45, 0.05);
          break;
        case 'notes':
          rawVal = r.notes || '';
          cellColor = rgb(0.35, 0.4, 0.48);
          break;
        default:
          rawVal = '';
      }

      const activeFont = isBold ? fontBold : font;
      const fontSize = 7.5;
      const maxW = rCol.width - 8;
      const cellText = truncateToWidth(rawVal, maxW, activeFont, fontSize);
      const textW = activeFont.widthOfTextAtSize(cellText, fontSize);

      let textX: number;
      if (rCol.def.align === 'center') {
        textX = rCol.x + (rCol.width - textW) / 2;
      } else if (rCol.def.align === 'right' || isRtl) {
        textX = rCol.x + rCol.width - 5 - textW;
      } else {
        textX = rCol.x + 5;
      }

      page.drawText(cellText, {
        x: textX,
        y: y + 1.5,
        size: fontSize,
        font: activeFont,
        color: cellColor,
      });
    }

    y -= rowHeight;
  }

  // 4. Page Footers (Page X of Y)
  const totalPages = pages.length;
  for (let pIdx = 0; pIdx < totalPages; pIdx++) {
    const curP = pages[pIdx]!;
    const footerText = `${t.page} ${pIdx + 1} ${t.of} ${totalPages}`;
    const fW = font.widthOfTextAtSize(footerText, 7.5);

    curP.drawText(footerText, {
      x: startX + (totalTableWidth - fW) / 2,
      y: 18,
      size: 7.5,
      font,
      color: rgb(0.55, 0.6, 0.7),
    });

    const sysW = font.widthOfTextAtSize(t.systemTitle, 7.5);
    curP.drawText(t.systemTitle, {
      x: isRtl ? startX + 16 : startX + totalTableWidth - sysW - 16,
      y: 18,
      size: 7.5,
      font,
      color: rgb(0.65, 0.7, 0.78),
    });
  }

  return await pdfDoc.save();
}
