export const JERUSALEM_TIMEZONE = 'Asia/Jerusalem';

const JERUSALEM_DTF = new Intl.DateTimeFormat('en-US', {
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
  const parts = JERUSALEM_DTF.formatToParts(date);
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
  saturdayMinutes: number;
  isSaturday: boolean;
  dateStr: string; // Clock-in calendar date in Jerusalem timezone
}

/**
 * Calculates hours breakdown for a single WorkSession (clockIn to clockOut).
 * Night hours are evaluated minute-by-minute in Asia/Jerusalem.
 * Saturday hours include full Saturday sessions AND Friday minutes at or after shabbatEnterHHmm (default "16:00").
 */
export function calculateSessionHours(
  session: WorkSession,
  nightStartHHmm = '22:00',
  nightEndHHmm = '06:00',
  shabbatEnterHHmm = '16:00'
): SessionHoursBreakdown {
  const inMs = session.clockIn.getTime();
  const outMs = session.clockOut.getTime();

  if (outMs <= inMs) {
    const parts = getJerusalemParts(session.clockIn);
    return {
      durationMinutes: 0,
      totalHours: 0,
      nightHours: 0,
      saturdayMinutes: 0,
      isSaturday: parts.dayOfWeek === 6,
      dateStr: parts.dateStr,
    };
  }

  const durationMs = outMs - inMs;
  const durationMinutes = Math.floor(durationMs / 60000);
  const totalHours = Math.round((durationMinutes / 60) * 100) / 100;

  const inParts = getJerusalemParts(session.clockIn);
  const outParts = getJerusalemParts(session.clockOut);
  const touchesSaturday = inParts.dayOfWeek === 6 || outParts.dayOfWeek === 6;

  const nightStartMin = parseTimeToMinutes(nightStartHHmm);
  const nightEndMin = parseTimeToMinutes(nightEndHHmm);
  const shabbatEnterMin = shabbatEnterHHmm ? parseTimeToMinutes(shabbatEnterHHmm) : 16 * 60;

  // Minute-by-minute check for night hours and Friday Shabbat entrance in Asia/Jerusalem
  let nightMinutesCount = 0;
  let shabbatMinutesCount = 0;
  // Step by 1 minute (60,000 ms) from clockIn to clockOut
  for (let t = inMs; t < outMs; t += 60000) {
    const curParts = getJerusalemParts(new Date(t));
    const curMinuteOfDay = curParts.hour * 60 + curParts.minute;
    if (isMinuteInNightWindow(curMinuteOfDay, nightStartMin, nightEndMin)) {
      nightMinutesCount++;
    }
    if (
      curParts.dayOfWeek === 6 ||
      (curParts.dayOfWeek === 5 && curMinuteOfDay >= shabbatEnterMin)
    ) {
      shabbatMinutesCount++;
    }
  }

  const nightHours = Math.round((nightMinutesCount / 60) * 100) / 100;
  const saturdayMinutes = touchesSaturday ? durationMinutes : shabbatMinutesCount;
  const isSaturday = saturdayMinutes > 0;

  return {
    durationMinutes,
    totalHours,
    nightHours,
    saturdayMinutes,
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
  overtime125Hours: number;
  overtime150Hours: number;
  regularHours: number;
}

/**
 * Calculates daily totals for a group of sessions belonging to the same calendar day.
 * Applies:
 * 1. Auto lunch deduction (if enabled, gross >= 6, and no gap >= 30 mins)
 * 2. Saturday / Shabbat hours (Saturday sessions + Friday hours after shabbatEnterHHmm)
 * 3. Overtime hours (net hours > overtimeThresholdHours, split into first 2h @ 125% and remaining @ 150%)
 */
export function calculateDailyHours(
  sessions: WorkSession[],
  autoDeductLunch = false,
  nightStartHHmm = '22:00',
  nightEndHHmm = '06:00',
  shabbatEnterHHmm = '16:00',
  overtimeThresholdHours = 9
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
      overtime125Hours: 0,
      overtime150Hours: 0,
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
    const breakdown = calculateSessionHours(cur, nightStartHHmm, nightEndHHmm, shabbatEnterHHmm);
    totalDurationMinutes += breakdown.durationMinutes;
    totalNightHours += breakdown.nightHours;

    if (breakdown.saturdayMinutes > 0) {
      saturdayDurationMinutes += breakdown.saturdayMinutes;
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
  const rawSaturdayHours = Math.round((saturdayDurationMinutes / 60) * 100) / 100;
  const saturdayHours = Math.min(netHours, rawSaturdayHours);
  const nightHours = Math.min(netHours, Math.round(totalNightHours * 100) / 100);

  // Overtime rule: if netHours > threshold (default 9h), excess goes to overtime (first 2h @ 125%, rest @ 150%)
  const threshold = overtimeThresholdHours > 0 ? overtimeThresholdHours : 9;
  let overtimeHours = 0;
  if (netHours > threshold) {
    overtimeHours = Math.round((netHours - threshold) * 100) / 100;
  }

  const overtime125Hours = Math.round(Math.min(2, overtimeHours) * 100) / 100;
  const overtime150Hours = Math.max(0, Math.round((overtimeHours - overtime125Hours) * 100) / 100);

  const regularHours = Math.round((netHours - overtimeHours) * 100) / 100;

  return {
    dateStr,
    grossHours,
    lunchDeductedHours,
    netHours,
    nightHours,
    saturdayHours,
    overtimeHours,
    overtime125Hours,
    overtime150Hours,
    regularHours,
  };
}

export interface SessionCalculationResult extends DailyCalculationResult {
  sessionIndex: number; // 1 = Main shift (Смена 1), 2 = Repeat Call-out #2 (Вызов №2), etc.
  sessionsCount: number;
  totalSessionsInDay: number;
  isCallout: boolean;   // true when sessionIndex >= 2 (repeat call-out on the same day)
  firstIn: string;      // HH:mm in Asia/Jerusalem
  lastOut: string;      // HH:mm in Asia/Jerusalem
}

/**
 * Calculates per-session hours breakdown for all sessions belonging to the same calendar day.
 * - Session #1 (sessionIndex === 1) is the primary daily shift:
 *   regular hours up to overtimeThresholdHours (default 9h), then first 2h @ 125% and rest @ 150%.
 * - Session #2+ (sessionIndex >= 2) are repeat call-outs (Повторный вызов / קריאה חוזרת) on the same day:
 *   recorded as separate shift rows with their exact hours and flagged as a call-out (without forcing 125%/150% tariff).
 */
export function calculateDailySessionsBreakdown(
  sessions: WorkSession[],
  autoDeductLunch = false,
  nightStartHHmm = '22:00',
  nightEndHHmm = '06:00',
  shabbatEnterHHmm = '16:00',
  overtimeThresholdHours = 9
): SessionCalculationResult[] {
  if (sessions.length === 0) return [];

  const sorted = [...sessions].sort(
    (a, b) => a.clockIn.getTime() - b.clockIn.getTime()
  );

  const threshold = overtimeThresholdHours > 0 ? overtimeThresholdHours : 9;
  const dateStr = getJerusalemParts(sorted[0]!.clockIn).dateStr;

  return sorted.map((cur, idx) => {
    const breakdown = calculateSessionHours(cur, nightStartHHmm, nightEndHHmm, shabbatEnterHHmm);
    const grossHours = breakdown.totalHours;
    const lunchDeductedHours = autoDeductLunch && grossHours >= 6 ? 0.5 : 0;
    const netHours = Math.max(0, Math.round((grossHours - lunchDeductedHours) * 100) / 100);
    const rawSaturdayHours = Math.round((breakdown.saturdayMinutes / 60) * 100) / 100;
    const saturdayHours = Math.min(netHours, rawSaturdayHours);
    const nightHours = Math.min(netHours, Math.round(breakdown.nightHours * 100) / 100);

    const isCallout = idx >= 1;
    let overtimeHours = 0;
    let overtime125Hours = 0;
    let overtime150Hours = 0;
    let regularHours = netHours;

    if (!isCallout) {
      // Primary shift (#1)
      if (netHours > threshold) {
        overtimeHours = Math.round((netHours - threshold) * 100) / 100;
      }
      overtime125Hours = Math.round(Math.min(2, overtimeHours) * 100) / 100;
      overtime150Hours = Math.max(0, Math.round((overtimeHours - overtime125Hours) * 100) / 100);
      regularHours = Math.round((netHours - overtimeHours) * 100) / 100;
    }

    const inParts = getJerusalemParts(cur.clockIn);
    const outParts = getJerusalemParts(cur.clockOut);

    return {
      dateStr,
      sessionIndex: idx + 1,
      sessionsCount: sorted.length,
      totalSessionsInDay: sorted.length,
      isCallout,
      firstIn: inParts.timeStr,
      lastOut: outParts.timeStr,
      grossHours,
      lunchDeductedHours,
      netHours,
      nightHours,
      saturdayHours,
      overtimeHours,
      overtime125Hours,
      overtime150Hours,
      regularHours,
    };
  });
}

/**
 * Converts a calendar date ("YYYY-MM-DD") and time ("HH:mm") in Asia/Jerusalem
 * into an absolute UTC Date object, correctly resolving daylight saving time (IDT / IST).
 */
export function jerusalemDateTimeToDate(dateStr: string, timeStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hour, minute] = timeStr.split(':').map(Number);
  const utcGuess = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, (day ?? 1), hour ?? 0, minute ?? 0));
  const parts = JERUSALEM_DTF.formatToParts(utcGuess);
  const p: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'weekday') {
      p[part.type] = Number(part.value);
    }
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

/**
 * Calculates the exact scheduled shift end Date given a clock-in Date and shift end time string ("HH:mm").
 * Correctly accounts for overnight shifts that span across midnight (e.g., 22:00 -> 06:00).
 */
export function getScheduledShiftEndTime(clockInDate: Date, shiftEndStr: string): Date {
  const inParts = getJerusalemParts(clockInDate);
  const inMinutes = inParts.hour * 60 + inParts.minute;
  const endMinutes = parseTimeToMinutes(shiftEndStr);

  const targetDateStr = endMinutes <= inMinutes ? addDays(inParts.dateStr, 1) : inParts.dateStr;
  return jerusalemDateTimeToDate(targetDateStr, shiftEndStr);
}

export interface EvaluateGlobalMonthlyParams {
  workedHours: number;
  contractMonthlyHours: number;
  periodMonth?: string; // YYYY-MM (defaults to current Jerusalem month)
  now?: Date;
  workingDaysOfWeek?: number[]; // Explicit working days override
  schedules?: Array<{ dayOfWeek: number; shiftType: string }> | null; // Employee schedule records from DB
}

/**
 * Resolves the active working days of the week (0 = Sunday .. 6 = Saturday) from an employee's
 * schedule rows. In the schedule matrix, days 0..4 (Sunday–Thursday in Israel) default to working
 * days unless explicitly marked 'off', while days 5..6 (Friday–Saturday) are weekend days unless
 * explicitly assigned a shift other than 'off'.
 */
export function resolveWorkingDaysFromSchedules(
  schedules?: Array<{ dayOfWeek: number; shiftType: string }> | null
): number[] {
  if (!schedules || schedules.length === 0) {
    return [0, 1, 2, 3, 4]; // Standard Israeli workweek: Sunday (0) - Thursday (4)
  }

  const byDay = new Map<number, string>();
  for (const s of schedules) {
    byDay.set(s.dayOfWeek, s.shiftType);
  }

  const workingDays: number[] = [];
  for (let d = 0; d <= 6; d++) {
    const shiftType = byDay.get(d);
    if (shiftType !== undefined) {
      if (shiftType !== 'off') {
        workingDays.push(d);
      }
    } else if (d >= 0 && d <= 4) {
      // Unmodified Sunday–Thursday cells in the schedule matrix are working days by default
      workingDays.push(d);
    }
  }

  return workingDays.length > 0 ? workingDays : [0, 1, 2, 3, 4];
}

export interface GlobalMonthlyEvaluation {
  isGlobal: boolean;
  contractMonthlyHours: number;
  workedHours: number;
  diffHours: number;
  remainingHours: number;
  overtimeMonthlyHours: number;
  progressPercent: number;
  periodMonth: string;
  totalWorkingDaysInMonth: number;
  remainingWorkingDays: number;
  isAlertWindow: boolean;
  status: 'underworked' | 'overworked' | 'completed' | 'in_progress';
  shouldAlert: boolean;
}

/**
 * Evaluates a Global Employee's monthly hours against their contract norm
 * and determines whether to trigger the "3 working days before month-end" alert
 * for underwork or overwork.
 */
export function evaluateGlobalMonthlyStatus(params: EvaluateGlobalMonthlyParams): GlobalMonthlyEvaluation {
  const nowDate = params.now ?? new Date();
  const nowParts = getJerusalemParts(nowDate);
  const currentMonthStr = nowParts.dateStr.slice(0, 7);
  const periodMonth = params.periodMonth && /^\d{4}-\d{2}$/.test(params.periodMonth)
    ? params.periodMonth
    : currentMonthStr;

  const resolvedDays =
    params.workingDaysOfWeek && params.workingDaysOfWeek.length > 0
      ? params.workingDaysOfWeek
      : resolveWorkingDaysFromSchedules(params.schedules);

  const workingDaysSet = new Set(resolvedDays);

  const [yStr, mStr] = periodMonth.split('-');
  const year = parseInt(yStr ?? String(nowParts.year), 10);
  const month = parseInt(mStr ?? String(nowParts.month), 10);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  let totalWorkingDaysInMonth = 0;
  let remainingWorkingDays = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d, 12, 0, 0)).getUTCDay();
    if (workingDaysSet.has(dow)) {
      totalWorkingDaysInMonth++;
      if (periodMonth === currentMonthStr && d >= nowParts.day) {
        remainingWorkingDays++;
      }
    }
  }

  if (periodMonth < currentMonthStr) {
    remainingWorkingDays = 0;
  } else if (periodMonth > currentMonthStr) {
    remainingWorkingDays = totalWorkingDaysInMonth;
  }

  const workedHours = Math.round((params.workedHours || 0) * 100) / 100;
  const contractMonthlyHours = Math.round((params.contractMonthlyHours || 0) * 100) / 100;
  const diffHours = Math.round((workedHours - contractMonthlyHours) * 100) / 100;
  const remainingHours = Math.max(0, Math.round((contractMonthlyHours - workedHours) * 100) / 100);
  const overtimeMonthlyHours = Math.max(0, Math.round((workedHours - contractMonthlyHours) * 100) / 100);
  const progressPercent = contractMonthlyHours > 0
    ? Math.round((workedHours / contractMonthlyHours) * 100)
    : 0;

  // Alert window is active during the last 3 working days of the month (remainingWorkingDays <= 3)
  const isAlertWindow = remainingWorkingDays <= 3;

  let status: 'underworked' | 'overworked' | 'completed' | 'in_progress';
  if (diffHours > 0) {
    status = 'overworked';
  } else if (diffHours === 0 && contractMonthlyHours > 0) {
    status = 'completed';
  } else if (isAlertWindow) {
    status = 'underworked';
  } else {
    status = 'in_progress';
  }

  const shouldAlert =
    contractMonthlyHours > 0 &&
    ((isAlertWindow && (status === 'underworked' || status === 'overworked')) || status === 'overworked');

  return {
    isGlobal: true,
    contractMonthlyHours,
    workedHours,
    diffHours,
    remainingHours,
    overtimeMonthlyHours,
    progressPercent,
    periodMonth,
    totalWorkingDaysInMonth,
    remainingWorkingDays,
    isAlertWindow,
    status,
    shouldAlert,
  };
}

/**
 * Checks whether a note string contains a system-generated GPS / geofence event note.
 */
export function isSystemGpsNote(noteText?: string | null): boolean {
  if (!noteText) return false;
  return (
    noteText.includes('строгий GPS') ||
    noteText.includes('strict GPS') ||
    noteText.includes('GPS קפדני') ||
    noteText.includes('GPS صارم') ||
    noteText.includes('Выход вне объекта') ||
    noteText.includes('Clock-out outside site') ||
    noteText.includes('יציאה מחוץ לאתר') ||
    noteText.includes('خروج خارج الموقع') ||
    noteText.includes('Выход без GPS') ||
    noteText.includes('Clock-out without GPS') ||
    noteText.includes('יציאה ללא GPS') ||
    noteText.includes('خروج بدون GPS') ||
    noteText.includes('Время на переезд между объектами') ||
    noteText.includes('Transit time between sites') ||
    noteText.includes('זמן נסיעה בין אתרים') ||
    noteText.includes('وقت التنقل بين المواقع') ||
    noteText.includes('Повторный вызов') ||
    noteText.includes('Repeat Call-out') ||
    noteText.includes('קריאה חוזרת') ||
    noteText.includes('استدعاء إضافي')
  );
}

/**
 * Translates system-generated notes (such as Strict GPS auto-exit, out-of-zone clock-out,
 * or clock-out without GPS) from the worker's PWA language into the report viewer's interface
 * language ('ru' | 'he' | 'en' | 'ar'). Preserves user-written custom notes untouched.
 */
export function localizeSystemNote(noteText?: string | null, lang: string = 'he'): string {
  if (!noteText) return '';
  const norm = (lang || 'he').toLowerCase();
  const targetLang: 'ru' | 'he' | 'ar' | 'en' = norm.startsWith('ru')
    ? 'ru'
    : norm.startsWith('he')
    ? 'he'
    : norm.startsWith('ar')
    ? 'ar'
    : 'en';

  const parts = noteText.split(' • ');
  const localizedParts = parts.map((rawPart) => {
    const part = rawPart.trim();
    if (!part) return part;

    // 1. Strict GPS exit note in any language:
    // RU: Покинул объект "Site" (строгий GPS, 4638м)
    // EN: Left work site "Site" (strict GPS, 4638m)
    // HE: עזב את האתר "Site" (GPS קפדני, 4638 מ')
    // AR: غادر الموقع "Site" (GPS صارم، 4638 م)
    const isStrictExit =
      part.includes('строгий GPS') ||
      part.includes('strict GPS') ||
      part.includes('GPS קפדני') ||
      part.includes('GPS صارم') ||
      part.startsWith('Покинул объект') ||
      part.startsWith('Left work site') ||
      part.startsWith('עזב את האתר') ||
      part.startsWith('غادر الموقع');

    if (isStrictExit) {
      const siteMatch = part.match(/"([^"]+)"/);
      const sitePart = siteMatch && siteMatch[1] ? ` "${siteMatch[1]}"` : '';
      const distMatch =
        part.match(/[,،]\s*(\d+)\s*(?:м|m|מ'|מ׳|م)?/i) ||
        part.match(/(\d+)\s*(?:м|m|מ'|מ׳|م)\s*\)/i);
      const dist = distMatch && distMatch[1] ? distMatch[1] : '0';

      if (targetLang === 'ru') return `Покинул объект${sitePart} (строгий GPS, ${dist}м)`;
      if (targetLang === 'he') return `עזב את האתר${sitePart} (GPS קפדני, ${dist} מ')`;
      if (targetLang === 'ar') return `غادر الموقع${sitePart} (GPS صارم، ${dist} م)`;
      return `Left work site${sitePart} (strict GPS, ${dist}m)`;
    }

    // 2. Manual Clock-Out outside site geofence:
    // RU: Выход вне объекта "Site" (123м)
    // EN: Clock-out outside site "Site" (123m)
    // HE: יציאה מחוץ לאתר "Site" (123 מ')
    // AR: خروج خارج الموقع "Site" (123 م)
    const isOutOfZoneExit =
      part.startsWith('Выход вне объекта') ||
      part.startsWith('Clock-out outside site') ||
      part.startsWith('יציאה מחוץ לאתר') ||
      part.startsWith('خروج خارج الموقع');

    if (isOutOfZoneExit) {
      const siteMatch = part.match(/"([^"]+)"/);
      const sitePart = siteMatch && siteMatch[1] ? ` "${siteMatch[1]}"` : '';
      const distMatch = part.match(/\((\d+)/) || part.match(/(\d+)\s*(?:м|m|מ'|מ׳|م)/i);
      const dist = distMatch && distMatch[1] ? distMatch[1] : '0';

      if (targetLang === 'ru') return `Выход вне объекта${sitePart} (${dist}м)`;
      if (targetLang === 'he') return `יציאה מחוץ לאתר${sitePart} (${dist} מ')`;
      if (targetLang === 'ar') return `خروج خارج الموقع${sitePart} (${dist} م)`;
      return `Clock-out outside site${sitePart} (${dist}m)`;
    }

    // 3. Clock-Out without GPS coordinates:
    const isNoGpsExit =
      part.startsWith('Выход без GPS') ||
      part.startsWith('Clock-out without GPS') ||
      part.startsWith('יציאה ללא GPS') ||
      part.startsWith('خروج بدون GPS');

    if (isNoGpsExit) {
      if (targetLang === 'ru') return 'Выход без GPS (геолокация отключена)';
      if (targetLang === 'he') return 'יציאה ללא GPS (מיקום כבוי)';
      if (targetLang === 'ar') return 'خروج بدون GPS (الموقع متوقف)';
      return 'Clock-out without GPS (location disabled)';
    }

    // 4. Multi-site transit time note:
    // RU: Время на переезд между объектами: 35 мин (из "Site A" в "Site B")
    // EN: Transit time between sites: 35 min (from "Site A" to "Site B")
    // HE: זמן נסיעה בין אתרים: 35 דק' (מ-"Site A" ל-"Site B")
    // AR: وقت التنقل بين المواقع: 35 د (من "Site A" إلى "Site B")
    const isTransitNote =
      part.startsWith('Время на переезд между объектами') ||
      part.startsWith('Transit time between sites') ||
      part.startsWith('זמן נסיעה בין אתרים') ||
      part.startsWith('وقت التنقل بين المواقع');

    if (isTransitNote) {
      const minsMatch = part.match(/:\s*(\d+)\s*/);
      const mins = minsMatch && minsMatch[1] ? minsMatch[1] : '0';
      const siteQuotes = Array.from(part.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
      const fromSite = siteQuotes[0] || '';
      const toSite = siteQuotes[1] || '';

      if (fromSite && toSite) {
        if (targetLang === 'ru') {
          return `Время на переезд между объектами: ${mins} мин (из "${fromSite}" в "${toSite}")`;
        }
        if (targetLang === 'he') {
          return `זמן נסיעה בין אתרים: ${mins} דק' (מ-"${fromSite}" ל-"${toSite}")`;
        }
        if (targetLang === 'ar') {
          return `وقت التنقل بين المواقع: ${mins} د (من "${fromSite}" إلى "${toSite}")`;
        }
        return `Transit time between sites: ${mins} min (from "${fromSite}" to "${toSite}")`;
      }

      if (targetLang === 'ru') return `Время на переезд между объектами: ${mins} мин`;
      if (targetLang === 'he') return `זמן נסיעה בין אתרים: ${mins} דק'`;
      if (targetLang === 'ar') return `وقت التنقل بين المواقع: ${mins} د`;
      return `Transit time between sites: ${mins} min`;
    }

    // 5. Repeat Call-out / Extra Shift on the same day:
    // RU: Повторный вызов (Смена #2)
    // HE: קריאה חוזרת (משמרת #2)
    // EN: Repeat Call-out (Shift #2)
    // AR: استدعاء إضافي (وردية #2)
    const isRepeatCallout =
      part.includes('Повторный вызов') ||
      part.includes('Repeat Call-out') ||
      part.includes('קריאה חוזרת') ||
      part.includes('استدعاء إضافي');

    if (isRepeatCallout) {
      const numMatch = part.match(/#(\d+)/);
      const shiftNum = numMatch && numMatch[1] ? numMatch[1] : '2';
      if (targetLang === 'ru') return `Повторный вызов (Смена #${shiftNum})`;
      if (targetLang === 'he') return `קריאה חוזרת (משמרת #${shiftNum})`;
      if (targetLang === 'ar') return `استدعاء إضافي (وردية #${shiftNum})`;
      return `Repeat Call-out (Shift #${shiftNum})`;
    }

    return part;
  });

  return localizedParts.join(' • ');
}


