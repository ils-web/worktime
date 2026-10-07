export const JERUSALEM_TIMEZONE = 'Asia/Jerusalem';

export interface JerusalemDateTimeParts {
  year: number;
  month: number; // 1-12
  day: number;   // 1-31
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  hour: number;  // 0-23
  minute: number; // 0-59
  second: number; // 0-59
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
}

/**
 * Returns date and time breakdown in the Asia/Jerusalem timezone.
 */
export function getJerusalemParts(date: Date): JerusalemDateTimeParts {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: JERUSALEM_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  const parts = dtf.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = parseInt(partMap['year'] ?? '1970', 10);
  const month = parseInt(partMap['month'] ?? '1', 10);
  const day = parseInt(partMap['day'] ?? '1', 10);
  const hour = parseInt(partMap['hour'] ?? '0', 10);
  const minute = parseInt(partMap['minute'] ?? '0', 10);
  const second = parseInt(partMap['second'] ?? '0', 10);

  const weekdayStr = partMap['weekday'] ?? 'Sun';
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const dayOfWeek = weekdayMap[weekdayStr] ?? 0;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const min = String(minute).padStart(2, '0');

  return {
    year,
    month,
    day,
    dayOfWeek,
    hour,
    minute,
    second,
    dateStr: `${year}-${mm}-${dd}`,
    timeStr: `${hh}:${min}`,
  };
}

/**
 * Parses "HH:mm" into total minutes from start of day (0..1439).
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr ?? '0', 10);
  const m = parseInt(mStr ?? '0', 10);
  return h * 60 + m;
}

/**
 * Checks whether a given minuteOfDay (0..1439) falls into [nightStart, nightEnd).
 * Handles overnight shift windows that cross midnight (e.g. 22:00 -> 06:00).
 */
export function isMinuteInNightWindow(
  minuteOfDay: number,
  nightStartMinutes: number,
  nightEndMinutes: number
): boolean {
  if (nightStartMinutes <= nightEndMinutes) {
    return minuteOfDay >= nightStartMinutes && minuteOfDay < nightEndMinutes;
  } else {
    // Window crosses midnight: e.g. 22:00 (1320) to 06:00 (360)
    return minuteOfDay >= nightStartMinutes || minuteOfDay < nightEndMinutes;
  }
}

export interface WorkSession {
  clockIn: Date;
  clockOut: Date;
}

export interface SessionHoursBreakdown {
  durationMinutes: number;
  totalHours: number;
  nightHours: number;
  isSaturday: boolean;
  dateStr: string; // Clock-in calendar date in Jerusalem timezone
}

/**
 * Calculates hours breakdown for a single WorkSession (clockIn to clockOut).
 * Night hours are evaluated minute-by-minute in Asia/Jerusalem.
 * Saturday is detected if clockIn OR clockOut is Saturday (dayOfWeek === 6).
 */
export function calculateSessionHours(
  session: WorkSession,
  nightStartHHmm = '22:00',
  nightEndHHmm = '06:00'
): SessionHoursBreakdown {
  const inMs = session.clockIn.getTime();
  const outMs = session.clockOut.getTime();

  if (outMs <= inMs) {
    const parts = getJerusalemParts(session.clockIn);
    return {
      durationMinutes: 0,
      totalHours: 0,
      nightHours: 0,
      isSaturday: parts.dayOfWeek === 6,
      dateStr: parts.dateStr,
    };
  }

  const durationMs = outMs - inMs;
  const durationMinutes = Math.floor(durationMs / 60000);
  const totalHours = Math.round((durationMinutes / 60) * 100) / 100;

  const inParts = getJerusalemParts(session.clockIn);
  const outParts = getJerusalemParts(session.clockOut);
  const isSaturday = inParts.dayOfWeek === 6 || outParts.dayOfWeek === 6;

  const nightStartMin = parseTimeToMinutes(nightStartHHmm);
  const nightEndMin = parseTimeToMinutes(nightEndHHmm);

  // Minute-by-minute check for night hours in Asia/Jerusalem
  let nightMinutesCount = 0;
  // Step by 1 minute (60,000 ms) from clockIn to clockOut
  for (let t = inMs; t < outMs; t += 60000) {
    const curParts = getJerusalemParts(new Date(t));
    const curMinuteOfDay = curParts.hour * 60 + curParts.minute;
    if (isMinuteInNightWindow(curMinuteOfDay, nightStartMin, nightEndMin)) {
      nightMinutesCount++;
    }
  }

  const nightHours = Math.round((nightMinutesCount / 60) * 100) / 100;

  return {
    durationMinutes,
    totalHours,
    nightHours,
    isSaturday,
    dateStr: inParts.dateStr,
  };
}

export interface DailyCalculationResult {
  dateStr: string;
  grossHours: number;
  lunchDeductedHours: number;
  netHours: number;
  nightHours: number;
  saturdayHours: number;
  overtimeHours: number;
  regularHours: number;
}

/**
 * Calculates daily totals for a group of sessions belonging to the same calendar day.
 * Applies:
 * 1. Auto lunch deduction (if enabled, gross >= 6, and no gap >= 30 mins)
 * 2. Saturday hours (if any session touches Saturday, entire session hours go to Saturday)
 * 3. Overtime hours (net hours > 9)
 */
export function calculateDailyHours(
  sessions: WorkSession[],
  autoDeductLunch = false,
  nightStartHHmm = '22:00',
  nightEndHHmm = '06:00'
): DailyCalculationResult {
  if (sessions.length === 0) {
    return {
      dateStr: '',
      grossHours: 0,
      lunchDeductedHours: 0,
      netHours: 0,
      nightHours: 0,
      saturdayHours: 0,
      overtimeHours: 0,
      regularHours: 0,
    };
  }

  // Sort sessions chronologically
  const sorted = [...sessions].sort(
    (a, b) => a.clockIn.getTime() - b.clockIn.getTime()
  );

  let totalDurationMinutes = 0;
  let totalNightHours = 0;
  let saturdayDurationMinutes = 0;
  let hasGap30OrMore = false;
  const firstSessionParts = getJerusalemParts(sorted[0]!.clockIn);
  const dateStr = firstSessionParts.dateStr;

  for (let i = 0; i < sorted.length; i++) {
    const cur = sorted[i]!;
    const breakdown = calculateSessionHours(cur, nightStartHHmm, nightEndHHmm);
    totalDurationMinutes += breakdown.durationMinutes;
    totalNightHours += breakdown.nightHours;

    if (breakdown.isSaturday) {
      saturdayDurationMinutes += breakdown.durationMinutes;
    }

    // Check gap with previous session
    if (i > 0) {
      const prev = sorted[i - 1]!;
      const gapMinutes = Math.floor(
        (cur.clockIn.getTime() - prev.clockOut.getTime()) / 60000
      );
      if (gapMinutes >= 30) {
        hasGap30OrMore = true;
      }
    }
  }

  const grossHours = Math.round((totalDurationMinutes / 60) * 100) / 100;
  let lunchDeductedHours = 0;

  // Auto lunch deduction rule: grossHours >= 6 and NO gap >= 30 mins
  if (autoDeductLunch && grossHours >= 6 && !hasGap30OrMore) {
    lunchDeductedHours = 0.5;
  }

  const netHours = Math.max(0, Math.round((grossHours - lunchDeductedHours) * 100) / 100);
  const saturdayHours = Math.round((saturdayDurationMinutes / 60) * 100) / 100;

  // Overtime rule: if netHours > 9, excess goes to overtime
  let overtimeHours = 0;
  if (netHours > 9) {
    overtimeHours = Math.round((netHours - 9) * 100) / 100;
  }

  const regularHours = Math.round((netHours - overtimeHours) * 100) / 100;

  return {
    dateStr,
    grossHours,
    lunchDeductedHours,
    netHours,
    nightHours: Math.round(totalNightHours * 100) / 100,
    saturdayHours,
    overtimeHours,
    regularHours,
  };
}

/**
 * Converts a calendar date ("YYYY-MM-DD") and time ("HH:mm") in Asia/Jerusalem
 * into an absolute UTC Date object, correctly resolving daylight saving time (IDT / IST).
 */
export function jerusalemDateTimeToDate(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hour ?? 0, minute ?? 0));
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: JERUSALEM_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(utcGuess);
  const p: Record<string, number> = {};
  for (const part of parts) {
    p[part.type] = Number(part.value);
  }
  const guessJerusalemAsUtc = Date.UTC(p['year']!, p['month']! - 1, p['day']!, p['hour']!, p['minute']!);
  const offsetMs = guessJerusalemAsUtc - utcGuess.getTime();
  return new Date(utcGuess.getTime() - offsetMs);
}

/**
 * Parses client-provided ISO string or local datetime into a Date in Asia/Jerusalem.
 */
export function parseClientDateTime(input: string | Date): Date {
  if (input instanceof Date) return input;
  if (!input) return new Date();
  if (input.includes('Z') || /[+-]\d{2}:\d{2}$/.test(input)) {
    return new Date(input);
  }
  const [datePart, timePart] = input.split('T');
  if (datePart && timePart) {
    return jerusalemDateTimeToDate(datePart, timePart.slice(0, 5));
  }
  return new Date(input);
}

/**
 * Adds integer days to a YYYY-MM-DD date string.
 */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Formats YYYY-MM-DD (or ISO string) into DD/MM/YYYY.
 */
export function formatIsoToDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0]! : dateStr;
  const parts = clean.split('-');
  if (parts.length === 3 && parts[0]!.length === 4) {
    return `${parts[2]!.padStart(2, '0')}/${parts[1]!.padStart(2, '0')}/${parts[0]}`;
  }
  return dateStr;
}

/**
 * Parses DD/MM/YYYY or DD.MM.YYYY into YYYY-MM-DD.
 */
export function parseDisplayToIsoDate(displayStr?: string | null): string {
  if (!displayStr) return '';
  const trimmed = displayStr.trim();
  const sep = trimmed.includes('/') ? '/' : trimmed.includes('.') ? '.' : trimmed.includes('-') ? '-' : null;
  if (!sep) return trimmed;
  const parts = trimmed.split(sep);
  if (parts.length === 3) {
    if (parts[0]!.length === 4) {
      return `${parts[0]}-${parts[1]!.padStart(2, '0')}-${parts[2]!.padStart(2, '0')}`;
    }
    const d = parts[0]!.padStart(2, '0');
    const m = parts[1]!.padStart(2, '0');
    const y = parts[2]!.length === 2 ? `20${parts[2]}` : parts[2]!;
    return `${y}-${m}-${d}`;
  }
  return displayStr;
}

/**
 * Returns localized day of week name for a given ISO date string (YYYY-MM-DD).
 * For Hebrew ('he'): יום א', יום ב', יום ג', יום ד', יום ה', יום ו', שבת
 * For Russian ('ru'): Вс, Пн, Вт, Ср, Чт, Пт, Сб
 * For English ('en'): Sun, Mon, Tue, Wed, Thu, Fri, Sat
 */
export function getDayOfWeek(dateStr?: string | null, lang: string = 'he'): string {
  if (!dateStr) return '';
  const clean = dateStr.includes('T') ? dateStr.split('T')[0]! : dateStr;
  const parts = clean.split('-');
  if (parts.length !== 3) return '';
  const y = parseInt(parts[0]!, 10);
  const m = parseInt(parts[1]!, 10);
  const d = parseInt(parts[2]!, 10);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
  const dayIdx = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();

  const HE_DAYS = ["יום א'", "יום ב'", "יום ג'", "יום ד'", "יום ה'", "יום ו'", 'שבת'];
  const RU_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  const EN_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const norm = (lang || 'he').toLowerCase();
  if (norm.startsWith('he') || norm.startsWith('ar')) return HE_DAYS[dayIdx] || '';
  if (norm.startsWith('ru')) return RU_DAYS[dayIdx] || '';
  return EN_DAYS[dayIdx] || '';
}

