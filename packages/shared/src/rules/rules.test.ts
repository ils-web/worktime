import { describe, it, expect } from 'vitest';
import { calculateHaversineDistance, checkGeofence } from './geo';
import {
  calculateSessionHours,
  calculateDailyHours,
  isMinuteInNightWindow,
  jerusalemDateTimeToDate,
  formatIsoToDisplayDate,
  parseDisplayToIsoDate,
  addDays,
} from './time';
import { calculateClientBilling } from './billing';

describe('Geo Rules', () => {
  it('calculates distance between known points correctly', () => {
    // Distance between Tel Aviv (32.0853, 34.7818) and Jerusalem (31.7683, 35.2137) ~ 54km
    const dist = calculateHaversineDistance(32.0853, 34.7818, 31.7683, 35.2137);
    expect(dist).toBeGreaterThan(50000);
    expect(dist).toBeLessThan(60000);
  });

  it('determines inside and outside geofence', () => {
    const fence = { lat: 32.0853, lng: 34.7818, radius: 100 };
    // Exact same point
    const inside = checkGeofence(32.0853, 34.7818, fence.lat, fence.lng, fence.radius);
    expect(inside.isInside).toBe(true);
    expect(inside.distanceMeters).toBe(0);

    // Far point
    const outside = checkGeofence(32.0953, 34.7818, fence.lat, fence.lng, fence.radius);
    expect(outside.isInside).toBe(false);
    expect(outside.distanceMeters).toBeGreaterThan(100);
  });
});

describe('Time and Night Hours Rules', () => {
  it('detects night minutes in overnight window (22:00 - 06:00)', () => {
    const nightStart = 22 * 60; // 1320
    const nightEnd = 6 * 60;    // 360

    expect(isMinuteInNightWindow(23 * 60, nightStart, nightEnd)).toBe(true);
    expect(isMinuteInNightWindow(1 * 60, nightStart, nightEnd)).toBe(true);
    expect(isMinuteInNightWindow(12 * 60, nightStart, nightEnd)).toBe(false);
    expect(isMinuteInNightWindow(6 * 60, nightStart, nightEnd)).toBe(false); // [start, end)
  });

  it('calculates session hours and night hours across midnight', () => {
    // 2026-10-04 is Sunday. Let's create an overnight shift: 2026-10-04 20:00 to 2026-10-05 04:00 (Jerusalem time)
    // In UTC, Jerusalem (summer time UTC+3):
    // 20:00 local = 17:00 UTC
    // 04:00 local = 01:00 UTC next day
    const clockIn = new Date('2026-10-04T17:00:00Z');
    const clockOut = new Date('2026-10-05T01:00:00Z');

    const result = calculateSessionHours({ clockIn, clockOut }, '22:00', '06:00');
    // Total hours: 8
    expect(result.totalHours).toBe(8);
    // Night window 22:00 to 04:00 = 6 hours
    expect(result.nightHours).toBe(6);
  });

  it('calculates daily overtime (> 9h)', () => {
    // 10 hour day shift
    const clockIn = new Date('2026-10-04T05:00:00Z'); // 08:00 local
    const clockOut = new Date('2026-10-04T15:00:00Z'); // 18:00 local (10h)

    const daily = calculateDailyHours([{ clockIn, clockOut }], false);
    expect(daily.grossHours).toBe(10);
    expect(daily.netHours).toBe(10);
    expect(daily.overtimeHours).toBe(1);
    expect(daily.regularHours).toBe(9);
  });

  it('applies auto lunch deduction when gross >= 6 and no 30m break', () => {
    const clockIn = new Date('2026-10-04T05:00:00Z'); // 08:00 local
    const clockOut = new Date('2026-10-04T12:00:00Z'); // 15:00 local (7h)

    const daily = calculateDailyHours([{ clockIn, clockOut }], true);
    expect(daily.grossHours).toBe(7);
    expect(daily.lunchDeductedHours).toBe(0.5);
    expect(daily.netHours).toBe(6.5);
  });

  it('does NOT deduct lunch if there is a break >= 30 mins', () => {
    // Session 1: 08:00 to 12:00 (4h)
    const session1 = {
      clockIn: new Date('2026-10-04T05:00:00Z'),
      clockOut: new Date('2026-10-04T09:00:00Z'),
    };
    // Break from 12:00 to 13:00 (60 mins gap >= 30)
    // Session 2: 13:00 to 16:00 (3h)
    const session2 = {
      clockIn: new Date('2026-10-04T10:00:00Z'),
      clockOut: new Date('2026-10-04T13:00:00Z'),
    };

    const daily = calculateDailyHours([session1, session2], true);
    expect(daily.grossHours).toBe(7);
    expect(daily.lunchDeductedHours).toBe(0);
    expect(daily.netHours).toBe(7);
  });
});

describe('Billing Rules', () => {
  it('calculates per_user billing accurately', () => {
    const period = {
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-09-30T23:59:59Z'),
    };
    const employees = [
      { empId: 'e1', createdAt: new Date('2026-08-01T00:00:00Z') }, // Active full 30 days
      { empId: 'e2', createdAt: new Date('2026-09-15T00:00:00Z') }, // Active 16 days
    ];

    const billing = calculateClientBilling({
      tariffMode: 'PER_USER',
      employees,
      period,
      pricePerUser: 10,
      totalHours: 0,
      pricePerHour: 0,
    });

    expect(billing.totalWorkerDays).toBe(30 + 16);
    expect(billing.totalAmount).toBe(46 * 10);
  });

  it('calculates per_hour billing accurately', () => {
    const period = {
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-09-30T23:59:59Z'),
    };

    const billing = calculateClientBilling({
      tariffMode: 'PER_HOUR',
      employees: [],
      period,
      pricePerUser: 0,
      totalHours: 154.5,
      pricePerHour: 2.5,
    });

    expect(billing.totalHours).toBe(154.5);
    expect(billing.totalAmount).toBe(154.5 * 2.5);
  });

  it('converts Jerusalem date and time accurately without timezone drift', () => {
    // 2026-10-01 08:00 IDT (summer time is UTC+3)
    const d1 = jerusalemDateTimeToDate('2026-10-01', '08:00');
    expect(d1.toISOString()).toBe('2026-10-01T05:00:00.000Z');

    // 2026-10-01 22:00 IDT (night shift start)
    const d2 = jerusalemDateTimeToDate('2026-10-01', '22:00');
    expect(d2.toISOString()).toBe('2026-10-01T19:00:00.000Z');

    // Next day morning 06:00
    const d3 = jerusalemDateTimeToDate('2026-10-02', '06:00');
    expect(d3.toISOString()).toBe('2026-10-02T03:00:00.000Z');

    // Winter time test: 2026-01-15 08:00 IST (UTC+2)
    const dWinter = jerusalemDateTimeToDate('2026-01-15', '08:00');
    expect(dWinter.toISOString()).toBe('2026-01-15T06:00:00.000Z');
  });

  it('formats dates in DD/MM/YYYY and parses them back', () => {
    expect(formatIsoToDisplayDate('2026-10-01')).toBe('01/10/2026');
    expect(formatIsoToDisplayDate('2026-05-19')).toBe('19/05/2026');
    expect(parseDisplayToIsoDate('01/10/2026')).toBe('2026-10-01');
    expect(parseDisplayToIsoDate('19.05.2026')).toBe('2026-05-19');
    expect(addDays('2026-10-01', 1)).toBe('2026-10-02');
  });
});
