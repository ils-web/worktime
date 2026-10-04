import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { ReportRow } from './csvReportService';

/**
 * Ensures text only contains characters supported by standard PDF fonts (WinAnsi).
 * Transliterates Cyrillic and replaces non-encodable characters to prevent WinAnsi encode crashes.
 */
export function toPdfSafe(text: string): string {
  if (!text) return '';
  const ruMap: Record<string, string> = {
    'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'G', 'Д': 'D', 'Е': 'E', 'Ё': 'E', 'Ж': 'Zh',
    'З': 'Z', 'И': 'I', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O',
    'П': 'P', 'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts',
    'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch', 'Ъ': '', 'Ы': 'Y', 'Ь': '', 'Э': 'E', 'Ю': 'Yu', 'Я': 'Ya',
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'e', 'ж': 'zh',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
    'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts',
    'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
  };

  return text
    .split('')
    .map((c) => {
      if (ruMap[c] !== undefined) return ruMap[c];
      const code = c.charCodeAt(0);
      // WinAnsi supported range: 32 - 255
      if (code >= 32 && code <= 255) return c;
      return '?';
    })
    .join('');
}

export async function generatePdfReport(
  rows: ReportRow[],
  clientName: string,
  periodTitle: string,
  _logoUrl?: string | null
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait
  const { width, height } = page.getSize();

  let y = height - 50;

  // Header Banner
  page.drawRectangle({
    x: 40,
    y: y - 10,
    width: width - 80,
    height: 40,
    color: rgb(0.06, 0.09, 0.16),
  });

  page.drawText('TimeTracker SaaS', {
    x: 55,
    y: y + 8,
    size: 16,
    font: fontBold,
    color: rgb(0.13, 0.77, 0.37), // emerald
  });

  page.drawText(`Company: ${toPdfSafe(clientName)}`, {
    x: 250,
    y: y + 10,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`Period: ${toPdfSafe(periodTitle)}`, {
    x: 250,
    y: y - 2,
    size: 9,
    font,
    color: rgb(0.8, 0.8, 0.8),
  });

  y -= 45;

  // Summary statistics
  const totalNet = rows.reduce((acc, r) => acc + r.netHours, 0);
  const totalNight = rows.reduce((acc, r) => acc + r.nightHours, 0);
  const totalSat = rows.reduce((acc, r) => acc + r.saturdayHours, 0);
  const totalOt = rows.reduce((acc, r) => acc + r.overtimeHours, 0);

  page.drawText(
    `Total Net Hours: ${totalNet.toFixed(1)}h | Night: ${totalNight.toFixed(1)}h | Sat: ${totalSat.toFixed(1)}h | Overtime: ${totalOt.toFixed(1)}h`,
    {
      x: 40,
      y,
      size: 9,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.2),
    }
  );

  y -= 20;

  // Table header
  page.drawRectangle({
    x: 40,
    y: y - 5,
    width: width - 80,
    height: 18,
    color: rgb(0.92, 0.94, 0.96),
  });

  const columns = [
    { title: 'Date', x: 45 },
    { title: 'Employee', x: 105 },
    { title: 'In', x: 220 },
    { title: 'Out', x: 260 },
    { title: 'Net (h)', x: 300 },
    { title: 'Night', x: 345 },
    { title: 'Sat', x: 385 },
    { title: 'OT', x: 420 },
    { title: 'Notes', x: 450 },
  ];

  for (const col of columns) {
    page.drawText(col.title, {
      x: col.x,
      y,
      size: 8,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  y -= 15;

  // Rows
  for (const r of rows) {
    if (y < 45) {
      page = pdfDoc.addPage([595.28, 841.89]);
      y = height - 50;
    }

    page.drawText(toPdfSafe(r.date), { x: 45, y, size: 7.5, font });
    page.drawText(toPdfSafe(r.name).slice(0, 20), { x: 105, y, size: 7.5, font });
    page.drawText(toPdfSafe(r.firstIn), { x: 220, y, size: 7.5, font });
    page.drawText(toPdfSafe(r.lastOut), { x: 260, y, size: 7.5, font });
    page.drawText(r.netHours.toFixed(2), { x: 300, y, size: 7.5, font: fontBold });
    page.drawText(r.nightHours.toFixed(2), { x: 345, y, size: 7.5, font });
    page.drawText(r.saturdayHours.toFixed(2), { x: 385, y, size: 7.5, font });
    page.drawText(r.overtimeHours.toFixed(2), { x: 420, y, size: 7.5, font });
    page.drawText(toPdfSafe(r.notes).slice(0, 22), { x: 450, y, size: 7, font });

    y -= 14;
  }

  return await pdfDoc.save();
}
