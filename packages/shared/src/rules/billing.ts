import { TariffMode } from '../types';

export interface EmployeeBillingData {
  empId: string;
  createdAt: Date;
}

export interface BillingPeriod {
  startDate: Date; // e.g. 2026-09-01T00:00:00Z
  endDate: Date;   // e.g. 2026-09-30T23:59:59Z
}

/**
 * Calculates total worker-days for an employee within a billing period.
 * Counted from max(periodStart, employee.createdAt) through periodEnd (inclusive).
 */
export function calculateWorkerDays(
  employee: EmployeeBillingData,
  period: BillingPeriod
): number {
  const empCreatedMs = employee.createdAt.getTime();
  const periodStartMs = period.startDate.getTime();
  const periodEndMs = period.endDate.getTime();

  // If employee was created after the billing period ended, 0 days
  if (empCreatedMs > periodEndMs) {
    return 0;
  }

  // Active start is the later of periodStart or employee.createdAt
  const effectiveStartMs = Math.max(periodStartMs, empCreatedMs);

  // Calculate day difference (inclusive)
  const msInDay = 86400000;
  const startDayFloor = Math.floor(effectiveStartMs / msInDay);
  const endDayFloor = Math.floor(periodEndMs / msInDay);

  const days = Math.max(0, endDayFloor - startDayFloor + 1);
  return days;
}

/**
 * Calculates billing total for a client based on tariffMode.
 */
export function calculateClientBilling(params: {
  tariffMode: TariffMode;
  employees: EmployeeBillingData[];
  period: BillingPeriod;
  pricePerUser: number;
  totalHours: number;
  pricePerHour: number;
}): {
  tariffMode: TariffMode;
  totalWorkerDays: number;
  totalHours: number;
  totalAmount: number;
} {
  const {
    tariffMode,
    employees,
    period,
    pricePerUser,
    totalHours,
    pricePerHour,
  } = params;

  if (tariffMode === 'PER_USER') {
    let totalWorkerDays = 0;
    for (const emp of employees) {
      totalWorkerDays += calculateWorkerDays(emp, period);
    }
    const totalAmount = Math.round(totalWorkerDays * pricePerUser * 100) / 100;
    return {
      tariffMode,
      totalWorkerDays,
      totalHours: 0,
      totalAmount,
    };
  } else {
    // PER_HOUR
    const roundedHours = Math.round(totalHours * 100) / 100;
    const totalAmount = Math.round(roundedHours * pricePerHour * 100) / 100;
    return {
      tariffMode,
      totalWorkerDays: 0,
      totalHours: roundedHours,
      totalAmount,
    };
  }
}
