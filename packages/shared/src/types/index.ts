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

export interface ClientShiftsConfig {
  morning: ShiftTimeWindow;
  evening: ShiftTimeWindow;
  night: ShiftTimeWindow;
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

export interface WorkerSessionState {
  empId: string;
  name: string;
  isMobile: boolean;
  strictGps: boolean;
  autoCloseShift?: boolean;
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
