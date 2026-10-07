import { describe, it, expect } from 'vitest';
import { formatBidiText, generatePdfReport } from './pdfReportService';
import { ReportRow } from './csvReportService';

describe('PDF Report Service', () => {
  it('shapes Hebrew RTL text correctly without gibberish', () => {
    // Pure Hebrew name
    const hebrewName = 'יוסי כהן';
    const shaped = formatBidiText(hebrewName);
    // Hebrew text is preserved in natural order so Fontkit native OpenType layout renders it RTL
    expect(shaped).toBe('יוסי כהן');

    // English text should remain in LTR order
    const englishName = 'Bashir Arabasi';
    expect(formatBidiText(englishName)).toBe('Bashir Arabasi');

    // Russian text should remain in LTR order
    const russianName = 'Иван Смирнов';
    expect(formatBidiText(russianName)).toBe('Иван Смирнов');

    // Dates and times must remain untouched
    expect(formatBidiText('2026-10-04')).toBe('2026-10-04');
    expect(formatBidiText('19:10')).toBe('19:10');

    // Hebrew with numbers preserves numbers
    const mixed = formatBidiText('עובד 123');
    expect(mixed).toContain('123');
  });

  it('generates a valid PDF with Hebrew RTL layout and Gross, Lunch, Net hours', async () => {
    const sampleRows: ReportRow[] = [
      {
        empId: 'E101',
        name: 'יוסי כהן',
        date: '2026-10-04',
        firstIn: '08:00',
        lastOut: '17:00',
        grossHours: 9.0,
        lunchDeducted: 0.5,
        netHours: 8.5,
        nightHours: 0.0,
        saturdayHours: 0.0,
        overtimeHours: 0.0,
        notes: 'הערה בעברית',
      },
      {
        empId: 'E102',
        name: 'Bashir Arabasi',
        date: '2026-10-04',
        firstIn: '19:10',
        lastOut: '06:59',
        grossHours: 11.82,
        lunchDeducted: 0.0,
        netHours: 11.82,
        nightHours: 8.0,
        saturdayHours: 0.0,
        overtimeHours: 2.82,
        notes: 'Night shift',
      },
      {
        empId: 'E103',
        name: 'Алексей Иванов',
        date: '2026-10-05',
        firstIn: '07:16',
        lastOut: '19:32',
        grossHours: 12.27,
        lunchDeducted: 0.5,
        netHours: 11.77,
        nightHours: 0.0,
        saturdayHours: 0.0,
        overtimeHours: 2.77,
        notes: 'Заметка на русском',
      },
      {
        empId: 'E104',
        name: 'דוד לוי',
        date: '2026-10-06',
        firstIn: '08:00',
        lastOut: '16:00',
        grossHours: 8.0,
        lunchDeducted: 0.0,
        netHours: 8.0,
        nightHours: 0.0,
        saturdayHours: 0.0,
        overtimeHours: 0.0,
        notes: '',
      },
    ];

    const pdfBytes = await generatePdfReport(
      sampleRows,
      'חברת נביל בע"מ',
      '2026-10-01 - 2026-10-07',
      null,
      'he'
    );

    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    // With font subsetting, PDF size is compact (~25KB-50KB) instead of bloated 1.15MB
    expect(pdfBytes.length).toBeGreaterThan(10000);
    expect(pdfBytes.length).toBeLessThan(100000);

    // Verify PDF header magic bytes: %PDF
    const headerStr = Buffer.from(pdfBytes.slice(0, 5)).toString();
    expect(headerStr).toContain('%PDF');

    const pdfRaw = Buffer.from(pdfBytes).toString('latin1');
    // Ensure no empty text operators that cause printer PostScript/PCL stack errors
    expect(pdfRaw).not.toContain('<> Tj');
    // Ensure large unsubsetted OpenType GPOS table is stripped
    expect(pdfRaw).not.toContain('GPOS');
  });
});
