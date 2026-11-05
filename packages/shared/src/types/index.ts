export type Role = 'owner' | 'client' | 'foreman' | 'worker';

export type TariffMode = 'PER_USER' | 'PER_HOUR';

export type LogAction = 
  | 'CLOCK_IN' 
  | 'CLOCK_OUT' 
  | 'AUTO_PAUSE' 
  | 'AUTO_RESUME' 
  | 'AUTO_EXIT';

export type ShiftType = 
  | 'morning' 
  | 'evening' 
  | 'night' 
  | 'morning_evening' 
  | 'morning_night' 
  | 'evening_night' 
  | 'double' 
  | 'off';

export interface ShiftTimeWindow {
  start: string; // HH:mm format, e.g. "07:00"
  end: string;   // HH:mm format, e.g. "16:00"
}

export type PayrollSystemId =
  | 'michpal'
  | 'shiklolit'
  | 'hargal'
  | 'okez'
  | 'hilan'
  | 'priority'
  | 'rivhit'
  | 'excel'
  | 'api';

export interface PayrollCodesConfig {
  companyCode: string;     // מספר מפעל / תיק ניכויים (e.g. "001")
  codeRegular100: string;  // סמל שכר שעות רגילות 100% (default "101")
  codeOvertime125: string; // סמל שכר שעות 125% (default "125")
  codeOvertime150: string; // סמל שכר שעות 150% (default "150")
  codeShabbat150: string;  // סמל שכר שעות שבת (default "160")
  codeNight: string;       // סמל שכר שעות לילה (default "170")
  codeWorkDays: string;    // סמל שכר ימי עבודה (default "100")
  codeExpenses: string;    // סמל שכר החזר הוצאות / נסיעות (default "200")
  accountantEmail?: string;
  accountantPhone?: string;
  apiKey?: string;
  webhookUrl?: string;
  rivhitApiToken?: string;
}

export interface ClientShiftsConfig {
  morning: ShiftTimeWindow;
  evening: ShiftTimeWindow;
  night: ShiftTimeWindow;
  shabbatEnter?: string; // Friday Shabbat start time in HH:mm, e.g. "16:00"
  overtimeThreshold?: number; // Daily net hours threshold before overtime, e.g. 9 or 8.6
  activePayrollSystem?: PayrollSystemId;
  payrollConfig?: PayrollCodesConfig;
}

export interface GeofenceConfig {
  lat: number;
  lng: number;
  radius: number; // in meters
  address?: string;
}

export interface AuthUserSession {
  id: string;
  role: Role;
  name: string;
  clientId?: string;
}

export interface GlobalMonthlyStatus {
  isGlobal: boolean;
  contractMonthlyHours: number;
  workedHours: number;
  diffHours: number; // workedHours - contractMonthlyHours
  remainingHours: number; // max(0, contractMonthlyHours - workedHours)
  overtimeMonthlyHours: number; // max(0, workedHours - contractMonthlyHours)
  progressPercent: number;
  periodMonth: string; // YYYY-MM
  totalWorkingDaysInMonth: number;
  remainingWorkingDays: number;
  isAlertWindow: boolean; // true when remainingWorkingDays <= 3
  status: 'underworked' | 'overworked' | 'completed' | 'in_progress';
  shouldAlert: boolean;
}

export interface WorkerSessionState {
  empId: string;
  name: string;
  position?: string | null;
  isMobile: boolean;
  strictGps: boolean;
  autoCloseShift?: boolean;
  isGlobal?: boolean;
  contractMonthlyHours?: number | null;
  globalMonthlyStatus?: GlobalMonthlyStatus | null;
  geofence: GeofenceConfig | null;
  currentShift: ShiftType | null;
  activeSession: {
    clockInTime: string;
    action: LogAction;
  } | null;
}

export interface DailyReportSummary {
  date: string; // YYYY-MM-DD
  empId: string;
  employeeName: string;
  firstIn: string | null;
  lastOut: string | null;
  totalHours: number;
  regularHours: number;
  nightHours: number;
  saturdayHours: number;
  overtimeHours: number;
  lunchDeductedHours: number;
  sessionsCount: number;
  notes?: string;
}

export interface ClientMonthlyBillingSummary {
  clientId: string;
  clientName: string;
  tariffMode: TariffMode;
  periodMonth: string; // YYYY-MM
  totalWorkerDays: number;
  pricePerUser: number;
  totalHours: number;
  pricePerHour: number;
  totalCost: number;
}

export const DEFAULT_COMPANY_POSITIONS: string[] = [
  'Рабочий / פועל כללי',
  'Специалист / איש מקצוע',
  'Бригадир / ראש צוות',
  'Электрик / חשמלאי',
  'Сантехник / אינסטלטור',
  'Маляр-штукатур / צבעי וטייח',
  'Сварщик / רתך',
  'Уборщик / עובד ניקיון',
  'Охранник / שומר',
  'Водитель / נהג',
  'Уход / Медперсонал / מטפל/ת',
  'Администратор / פקיד/ה',
];

export function normalizePositionsList(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [...DEFAULT_COMPANY_POSITIONS];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        result.push(trimmed);
      }
    }
  }
  return result;
}
