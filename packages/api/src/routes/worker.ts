import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@timetracker/db';
import {
  checkGeofence,
  calculateHaversineDistance,
  estimateNormativeTransitMinutes,
  calculateDailyHours,
  calculateDailySessionsBreakdown,
  getJerusalemParts,
  WorkSession,
  GeofenceConfig,
  ClientShiftsConfig,
  getDayOfWeek,
  getScheduledShiftEndTime,
  jerusalemDateTimeToDate,
  addDays,
  evaluateGlobalMonthlyStatus,
  GlobalMonthlyEvaluation,
} from '@timetracker/shared';
import { generatePdfReport } from '../services/pdfReportService';
import { generateCsvReport, ReportRow } from '../services/csvReportService';
import { encryptField } from '../utils/encryption';

interface TrackedSession extends WorkSession {
  isManual?: boolean;
}

export const workerRouter = Router();

function buildAllowedGeofences(employee: {
  sites?: Array<{
    site: {
      id?: string;
      name: string;
      address?: string | null;
      lat: number;
      lng: number;
      radius: number;
    };
  }>;
  geofence?: any;
}): Array<GeofenceConfig & { siteId?: string; siteName: string }> {
  const allowedGeofences: Array<GeofenceConfig & { siteId?: string; siteName: string }> = [];

  if (employee.sites && employee.sites.length > 0) {
    for (const es of employee.sites) {
      if (es.site.lat && es.site.lng && es.site.radius) {
        allowedGeofences.push({
          lat: es.site.lat,
          lng: es.site.lng,
          radius: es.site.radius,
          siteId: es.site.id,
          siteName: es.site.name,
          address: es.site.name + (es.site.address ? ` (${es.site.address})` : ''),
        });
      }
    }
  }

  if (allowedGeofences.length === 0 && employee.geofence) {
    const gf = employee.geofence as unknown as GeofenceConfig;
    if (gf.lat && gf.lng && gf.radius) {
      allowedGeofences.push({
        ...gf,
        siteName: gf.address || 'Объект',
      });
    }
  }

  return allowedGeofences;
}

function matchSiteByCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
  geofences: Array<GeofenceConfig & { siteId?: string; siteName: string }>
) {
  if (
    lat === undefined ||
    lat === null ||
    lng === undefined ||
    lng === null ||
    isNaN(Number(lat)) ||
    isNaN(Number(lng))
  ) {
    return {
      insideSite: null as (GeofenceConfig & { siteId?: string; siteName: string }) | null,
      closestSite: null as (GeofenceConfig & { siteId?: string; siteName: string }) | null,
      minDistance: Infinity,
    };
  }

  let insideSite: (GeofenceConfig & { siteId?: string; siteName: string }) | null = null;
  let closestSite: (GeofenceConfig & { siteId?: string; siteName: string }) | null = null;
  let minDistance = Infinity;

  for (const gf of geofences) {
    const { isInside, distanceMeters } = checkGeofence(Number(lat), Number(lng), gf.lat, gf.lng, gf.radius);
    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      closestSite = gf;
    }
    if (isInside && !insideSite) {
      insideSite = gf;
    }
  }

  return { insideSite, closestSite, minDistance };
}

/**
 * Helper to compute a worker's monthly sessions and daily breakdown in Asia/Jerusalem timezone.
 */
async function computeWorkerMonthData(
  empId: string,
  month: string,
  shiftsConfig: ClientShiftsConfig | undefined,
  autoDeductLunch: boolean
) {
  const [yearStr, mStr] = month.split('-');
  const year = parseInt(yearStr || '2026', 10);
  const m = parseInt(mStr || '10', 10);
  const daysInMonth = new Date(Date.UTC(year, m, 0)).getUTCDate();
  const monthStartStr = `${month}-01`;
  const monthEndStr = `${month}-${String(daysInMonth).padStart(2, '0')}`;

  const qStart = jerusalemDateTimeToDate(monthStartStr, '00:00');
  const qEnd = jerusalemDateTimeToDate(addDays(monthEndStr, 1), '23:59');

  const [logs, dailyNotes] = await Promise.all([
    prisma.timeLog.findMany({
      where: {
        empId,
        dateTime: { gte: qStart, lte: qEnd },
      },
      orderBy: { dateTime: 'asc' },
    }),
    prisma.dailyNote.findMany({
      where: {
        empId,
        date: { gte: monthStartStr, lte: monthEndStr },
      },
      orderBy: { id: 'asc' },
    }),
  ]);

  const notesByDateList: Record<string, Array<{ text: string; createdAtMs: number }>> = {};
  for (const n of dailyNotes) {
    const clean = (n.noteText || '').trim();
    if (!clean) continue;
    if (!notesByDateList[n.date]) notesByDateList[n.date] = [];
    notesByDateList[n.date]!.push({
      text: clean,
      createdAtMs: n.createdAt ? new Date(n.createdAt).getTime() : 0,
    });
  }

  const sessions: TrackedSession[] = [];
  let currentInLog: (typeof logs)[0] | null = null;
  for (const log of logs) {
    if (log.action === 'CLOCK_IN' || (log.action === 'AUTO_RESUME' && !currentInLog)) {
      if (!currentInLog || (log.isManual && !currentInLog.isManual)) {
        currentInLog = log;
      }
    } else if (log.action === 'CLOCK_OUT' || log.action === 'AUTO_EXIT') {
      if (currentInLog) {
        sessions.push({
          clockIn: currentInLog.dateTime,
          clockOut: log.dateTime,
          isManual: Boolean(currentInLog.isManual || log.isManual),
        });
        currentInLog = null;
      }
    }
  }

  const sessionsByDate: Record<string, TrackedSession[]> = {};
  for (const s of sessions) {
    const d = getJerusalemParts(s.clockIn).dateStr;
    if (!d.startsWith(month)) continue;
    if (!sessionsByDate[d]) sessionsByDate[d] = [];
    sessionsByDate[d].push(s);
  }

  const nightStart = shiftsConfig?.night?.start || '22:00';
  const nightEnd = shiftsConfig?.night?.end || '06:00';
  const shabbatEnter = shiftsConfig?.shabbatEnter || '16:00';
  const overtimeThreshold =
    Number(shiftsConfig?.overtimeThreshold) > 0 ? Number(shiftsConfig?.overtimeThreshold) : 9;

  let totalNet = 0;
  let totalNight = 0;
  let totalSat = 0;
  let totalOt = 0;
  let totalOt125 = 0;
  let totalOt150 = 0;
  const days: any[] = [];

  for (const [dateStr, daySessions] of Object.entries(sessionsByDate)) {
    const sessionCalcs = calculateDailySessionsBreakdown(
      daySessions,
      autoDeductLunch,
      nightStart,
      nightEnd,
      shabbatEnter,
      overtimeThreshold
    );

    const dateNotes = notesByDateList[dateStr] || [];
    const sessionNotesTexts: string[][] = daySessions.map(() => []);

    for (const noteItem of dateNotes) {
      let targetIdx = 0;
      if (daySessions.length > 1 && noteItem.createdAtMs > 0) {
        for (let k = daySessions.length - 1; k >= 0; k--) {
          if (noteItem.createdAtMs >= daySessions[k]!.clockIn.getTime() - 10 * 60000) {
            targetIdx = k;
            break;
          }
        }
      }
      if (!sessionNotesTexts[targetIdx]!.includes(noteItem.text)) {
        sessionNotesTexts[targetIdx]!.push(noteItem.text);
      }
    }

    for (let sIdx = 0; sIdx < daySessions.length; sIdx++) {
      const s = daySessions[sIdx]!;
      const sc = sessionCalcs[sIdx]!;

      totalNet += sc.netHours;
      totalNight += sc.nightHours;
      totalSat += sc.saturdayHours;
      totalOt += sc.overtimeHours;
      totalOt125 += sc.overtime125Hours;
      totalOt150 += sc.overtime150Hours;

      const rowNotesList = [...(sessionNotesTexts[sIdx] || [])];
      if (sc.isCallout) {
        const calloutTag = `Повторный вызов (Смена #${sc.sessionIndex})`;
        if (!rowNotesList.some((t) => t.includes('Повторный вызов'))) {
          rowNotesList.unshift(calloutTag);
        }
      }

      days.push({
        date: dateStr,
        dayOfWeek: getDayOfWeek(dateStr, 'he'),
        firstIn: getJerusalemParts(s.clockIn).timeStr,
        lastOut: getJerusalemParts(s.clockOut).timeStr,
        grossHours: sc.grossHours,
        lunchDeducted: sc.lunchDeductedHours,
        netHours: sc.netHours,
        nightHours: sc.nightHours,
        saturdayHours: sc.saturdayHours,
        overtimeHours: sc.overtimeHours,
        overtime125Hours: sc.overtime125Hours,
        overtime150Hours: sc.overtime150Hours,
        isManual: Boolean(s.isManual),
        notes: rowNotesList.join(' • '),
        sessionsCount: sc.sessionsCount,
        sessionIndex: sc.sessionIndex,
        isCallout: sc.isCallout,
      });
    }
  }

  return {
    totalNet: Math.round(totalNet * 100) / 100,
    totalNight: Math.round(totalNight * 100) / 100,
    totalSaturday: Math.round(totalSat * 100) / 100,
    totalOvertime: Math.round(totalOt * 100) / 100,
    totalOvertime125: Math.round(totalOt125 * 100) / 100,
    totalOvertime150: Math.round(totalOt150 * 100) / 100,
    days,
  };
}

/**
 * 1. Worker Profile
 */
workerRouter.get('/profile/:empId', async (req: Request, res: Response) => {
  try {
    const empId = req.params['empId'] as string;

    const employee = await prisma.employee.findUnique({
      where: { empId },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            isActive: true,
            defaultShifts: true,
            autoDeductLunch: true,
          },
        },
        schedules: true,
        sites: {
          include: { site: true },
        },
        logs: {
          take: 20,
          orderBy: { dateTime: 'desc' },
        },
      },
    });

    if (!employee || !employee.client.isActive) {
      res.status(404).json({ error: 'Сотрудник не найден или аккаунт компании отключен' });
      return;
    }

    let lastLog = employee.logs[0];
    let isOnShift = lastLog ? lastLog.action === 'CLOCK_IN' || lastLog.action === 'AUTO_RESUME' : false;
    let activeClockInTime: Date | null = lastLog?.dateTime ?? null;

    if (isOnShift) {
      for (const l of employee.logs) {
        if (l.action === 'CLOCK_IN') {
          activeClockInTime = l.dateTime;
        } else if (l.action === 'AUTO_RESUME' || l.action === 'AUTO_PAUSE') {
          continue;
        } else {
          break;
        }
      }
    }

    let autoClosedDueToShiftEnd = false;
    let scheduledEndTimeStr: string | null = null;
    let scheduledShiftType: string | null = null;

    // Shift overrides or client default shifts
    const effectiveShifts = (employee.shifts || employee.client.defaultShifts) as unknown as ClientShiftsConfig;

    if (employee.autoCloseShift && isOnShift && activeClockInTime) {
      const inParts = getJerusalemParts(activeClockInTime);
      const daySchedule = employee.schedules.find((s) => s.dayOfWeek === inParts.dayOfWeek);
      const rawShiftType = (daySchedule?.shiftType && daySchedule.shiftType !== 'off') ? daySchedule.shiftType : 'morning';
      let resolvedShiftType = rawShiftType;

      // When scheduled with two shifts in a day, determine which shift window applies from the clock-in time:
      const inMinutes = inParts.hour * 60 + inParts.minute;
      if (rawShiftType === 'morning_evening') {
        resolvedShiftType = inMinutes >= 14 * 60 ? 'evening' : 'morning';
      } else if (rawShiftType === 'morning_night') {
        resolvedShiftType = (inMinutes >= 20 * 60 || inMinutes < 5 * 60) ? 'night' : 'morning';
      } else if (rawShiftType === 'evening_night') {
        resolvedShiftType = (inMinutes >= 21 * 60 || inMinutes < 5 * 60) ? 'night' : 'evening';
      } else if (rawShiftType === 'double') {
        resolvedShiftType = 'evening';
      }

      scheduledShiftType = resolvedShiftType;
      const shiftWindow = effectiveShifts?.[resolvedShiftType as keyof ClientShiftsConfig] || { start: '08:00', end: '17:00' };
      const scheduledEndDate = getScheduledShiftEndTime(activeClockInTime, shiftWindow.end);
      scheduledEndTimeStr = scheduledEndDate.toISOString();

      const now = new Date();
      if (now.getTime() >= scheduledEndDate.getTime()) {
        const autoExit = await prisma.timeLog.create({
          data: {
            empId: employee.empId,
            employeeId: employee.id,
            clientId: employee.clientId,
            action: 'AUTO_EXIT',
            dateTime: scheduledEndDate,
            isManual: false,
          },
        });
        isOnShift = false;
        autoClosedDueToShiftEnd = true;
        lastLog = autoExit;
        activeClockInTime = autoExit.dateTime;
      }
    } else if (employee.autoCloseShift && !isOnShift && lastLog && lastLog.action === 'AUTO_EXIT') {
      const diffHours = (Date.now() - new Date(lastLog.dateTime).getTime()) / 3600000;
      if (diffHours < 24) {
        autoClosedDueToShiftEnd = true;
      }
    }

    let autoClosedDueToStrictGps = false;
    if ((employee.strictGps || employee.multiSiteTransit) && !isOnShift && lastLog && lastLog.action === 'AUTO_EXIT') {
      const diffHours = (Date.now() - new Date(lastLog.dateTime).getTime()) / 3600000;
      if (diffHours < 24) {
        const dParts = getJerusalemParts(lastLog.dateTime);
        const strictNote = await prisma.dailyNote.findFirst({
          where: {
            empId: employee.empId,
            date: dParts.dateStr,
            OR: [
              { noteText: { contains: 'строгий GPS' } },
              { noteText: { contains: 'strict GPS' } },
              { noteText: { contains: 'GPS קפדני' } },
              { noteText: { contains: 'GPS صارم' } },
            ],
          },
        });
        if (strictNote) {
          autoClosedDueToStrictGps = true;
        }
      }
    }

    let lastExitedSiteName: string | null = null;
    if (
      employee.multiSiteTransit &&
      !isOnShift &&
      lastLog &&
      (lastLog.action === 'AUTO_EXIT' || lastLog.action === 'CLOCK_OUT')
    ) {
      const todayDateStr = getJerusalemParts(new Date()).dateStr;
      const lastLogDateStr = getJerusalemParts(lastLog.dateTime).dateStr;
      const diffHours = (Date.now() - new Date(lastLog.dateTime).getTime()) / 3600000;
      if (lastLogDateStr === todayDateStr && diffHours <= 6) {
        const allowedGeofences = buildAllowedGeofences(employee);
        const prevActiveLog = employee.logs.find(
          (l, idx) => idx > 0 && (l.action === 'CLOCK_IN' || l.action === 'AUTO_RESUME')
        );
        const fromPrevCoords = matchSiteByCoords(prevActiveLog?.lat, prevActiveLog?.lng, allowedGeofences);
        const fromExitCoords = matchSiteByCoords(lastLog.lat, lastLog.lng, allowedGeofences);
        lastExitedSiteName =
          fromPrevCoords.insideSite?.siteName ||
          fromPrevCoords.closestSite?.siteName ||
          fromExitCoords.closestSite?.siteName ||
          null;
      }
    }

    let activeSiteName: string | null = null;
    if (isOnShift) {
      const allowedGeofences = buildAllowedGeofences(employee);
      const lastActiveLog = employee.logs.find(
        (l) => l.action === 'CLOCK_IN' || l.action === 'AUTO_RESUME'
      );
      if (lastActiveLog?.lat && lastActiveLog?.lng) {
        const m = matchSiteByCoords(lastActiveLog.lat, lastActiveLog.lng, allowedGeofences);
        activeSiteName = m.insideSite?.siteName || m.closestSite?.siteName || null;
      }
    }

    const sitesList = employee.sites.map((es) => es.site);

    let globalMonthlyStatus: GlobalMonthlyEvaluation | null = null;
    if (employee.isGlobal && (employee.contractMonthlyHours ?? 0) > 0) {
      try {
        const currentMonth = getJerusalemParts(new Date()).dateStr.slice(0, 7);
        const monthData = await computeWorkerMonthData(
          employee.empId,
          currentMonth,
          effectiveShifts,
          employee.client.autoDeductLunch ?? false
        );
        globalMonthlyStatus = evaluateGlobalMonthlyStatus({
          workedHours: monthData.totalNet,
          contractMonthlyHours: employee.contractMonthlyHours!,
          periodMonth: currentMonth,
          schedules: employee.schedules,
        });
      } catch (gErr) {
        console.error('Worker globalMonthlyStatus error:', gErr);
      }
    }

    res.json({
      success: true,
      employee: {
        id: employee.id,
        empId: employee.empId,
        name: employee.name,
        position: employee.position ?? null,
        companyName: employee.client.name,
        isMobile: employee.isMobile,
        strictGps: employee.strictGps,
        multiSiteTransit: employee.multiSiteTransit ?? false,
        autoCloseShift: employee.autoCloseShift ?? false,
        isGlobal: employee.isGlobal ?? false,
        contractMonthlyHours: employee.contractMonthlyHours ?? null,
        privacyConsentAt: employee.privacyConsentAt ?? null,
        globalMonthlyStatus,
        geofence: employee.geofence,
        sites: sitesList,
        shifts: effectiveShifts,
      },
      status: {
        isOnShift,
        lastAction: lastLog?.action ?? null,
        lastActionTime: activeClockInTime ?? lastLog?.dateTime ?? null,
        activeSiteName,
        scheduledEndTime: scheduledEndTimeStr,
        scheduledShiftType,
        autoClosedDueToShiftEnd,
        autoClosedDueToStrictGps,
        lastExitedSiteName,
      },
    });
  } catch (err) {
    console.error('Worker profile error:', err);
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

/**
 * 1.1 Worker Privacy & Personal Data Processing Consent
 */
workerRouter.post('/consent', async (req: Request, res: Response) => {
  try {
    const { empId, acceptedAt } = req.body || {};
    if (!empId || typeof empId !== 'string') {
      res.status(400).json({ error: 'Не указан empId' });
      return;
    }

    const employee = await prisma.employee.findUnique({ where: { empId } });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const consentTime = acceptedAt ? new Date(acceptedAt) : new Date();
    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        privacyConsentAt: employee.privacyConsentAt || consentTime,
        ...(!employee.encryptedIdentity ? { encryptedIdentity: encryptField(employee.empId) } : {}),
      },
    });

    res.json({
      success: true,
      privacyConsentAt: updated.privacyConsentAt,
    });
  } catch (err) {
    console.error('Worker consent error:', err);
    res.status(500).json({ error: 'Ошибка сохранения согласия' });
  }
});

const workerLogSchema = z.object({
  empId: z.string().min(1),
  action: z.enum(['CLOCK_IN', 'CLOCK_OUT', 'AUTO_PAUSE', 'AUTO_RESUME', 'AUTO_EXIT']),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  dateTime: z.string().or(z.date()).optional(),
  note: z.string().optional(),
  expense: z.number().optional(),
});

/**
 * 2. Worker Clock In / Out / Pause / Resume
 */
workerRouter.post('/log', async (req: Request, res: Response) => {
  try {
    const data = workerLogSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({
      where: { empId: data.empId },
      include: {
        client: true,
        sites: { include: { site: true } },
        logs: {
          take: 20,
          orderBy: { dateTime: 'desc' },
        },
      },
    });

    if (!employee || !employee.client.isActive) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const logDateTime = data.dateTime ? new Date(data.dateTime) : new Date();
    const lastLog = employee.logs[0];

    // Deduplicate rapid accidental/repeated same-state actions within 5 minutes
    if (lastLog) {
      const diffMs = Math.abs(logDateTime.getTime() - new Date(lastLog.dateTime).getTime());
      const isDuplicateClockIn =
        (data.action === 'CLOCK_IN' || data.action === 'AUTO_RESUME') &&
        (lastLog.action === 'CLOCK_IN' || lastLog.action === 'AUTO_RESUME') &&
        diffMs < 5 * 60 * 1000;
      const isDuplicateClockOut =
        (data.action === 'CLOCK_OUT' || data.action === 'AUTO_EXIT') &&
        (lastLog.action === 'CLOCK_OUT' || lastLog.action === 'AUTO_EXIT') &&
        diffMs < 5 * 60 * 1000;

      if (isDuplicateClockIn || isDuplicateClockOut) {
        res.json({ success: true, log: lastLog, deduplicated: true });
        return;
      }
    }

    // Geofence check if not mobile worker
    let autoGeneratedNote: string | null = null;
    let effectiveAction = data.action;
    let shiftStartTime: Date | null = null;
    let transitResumed: {
      transitMinutes: number;
      fromSite: string;
      toSite: string;
    } | null = null;

    if (!employee.isMobile) {
      const allowedGeofences = buildAllowedGeofences(employee);

      if (allowedGeofences.length > 0) {
        const hasCoords =
          data.lat !== undefined &&
          data.lat !== null &&
          data.lng !== undefined &&
          data.lng !== null &&
          !isNaN(Number(data.lat)) &&
          !isNaN(Number(data.lng));

        if (!hasCoords) {
          // On CLOCK_IN: non-mobile workers assigned to a site/geofence MUST provide valid GPS coordinates
          if (data.action === 'CLOCK_IN' || data.action === 'AUTO_RESUME') {
            res.status(400).json({
              error: 'Не удалось определить GPS-координаты. Включите геолокацию (GPS) на телефоне и разрешите доступ.',
              errorCode: 'GPS_REQUIRED',
            });
            return;
          }
          // On CLOCK_OUT or AUTO_EXIT without GPS coordinates: record note if strictGps or multiSiteTransit is enabled
          if (
            (data.action === 'CLOCK_OUT' || data.action === 'AUTO_EXIT') &&
            (employee.strictGps || employee.multiSiteTransit) &&
            !data.note
          ) {
            autoGeneratedNote = 'Выход без GPS (геолокация отключена)';
          }
        } else {
          const { insideSite, closestSite, minDistance } = matchSiteByCoords(
            data.lat,
            data.lng,
            allowedGeofences
          );
          const insideAny = Boolean(insideSite);
          const bestRadius = closestSite?.radius || 100;
          const bestSiteName = closestSite?.siteName || closestSite?.address || '';

          // On CLOCK_IN / AUTO_RESUME: must be inside at least one allowed geofence/site
          if ((data.action === 'CLOCK_IN' || data.action === 'AUTO_RESUME') && !insideAny) {
            res.status(400).json({
              error: 'Вы вне зоны объекта!',
              errorCode: 'OUT_OF_GEOFENCE',
              distanceMeters: minDistance,
              radius: bestRadius,
            });
            return;
          }

          // Multi-Site Transit (Option B):
          // If worker is marked as moving between fixed sites (`multiSiteTransit`) and arrived by GPS at Site B:
          // Case 1: Worker exited Site A earlier today (timer was stopped via AUTO_EXIT/CLOCK_OUT).
          //         Cap credited transit duration by normative travel time (+40% buffer) to avoid paying for long personal stops.
          if (
            (data.action === 'CLOCK_IN' || data.action === 'AUTO_RESUME') &&
            employee.multiSiteTransit &&
            insideSite &&
            lastLog &&
            (lastLog.action === 'AUTO_EXIT' || lastLog.action === 'CLOCK_OUT')
          ) {
            const logDateStr = getJerusalemParts(logDateTime).dateStr;
            const lastLogDateStr = getJerusalemParts(lastLog.dateTime).dateStr;
            const transitMs = logDateTime.getTime() - new Date(lastLog.dateTime).getTime();

            if (logDateStr === lastLogDateStr && transitMs > 0 && transitMs <= 6 * 3600 * 1000) {
              const prevActiveLog = employee.logs.find(
                (l, idx) => idx > 0 && (l.action === 'CLOCK_IN' || l.action === 'AUTO_RESUME')
              );
              const fromPrevCoords = matchSiteByCoords(
                prevActiveLog?.lat,
                prevActiveLog?.lng,
                allowedGeofences
              );
              const fromExitCoords = matchSiteByCoords(lastLog.lat, lastLog.lng, allowedGeofences);
              const prevSiteName =
                fromPrevCoords.insideSite?.siteName ||
                fromPrevCoords.closestSite?.siteName ||
                fromExitCoords.closestSite?.siteName ||
                null;

              if (prevSiteName && prevSiteName !== insideSite.siteName) {
                const prevLat = fromPrevCoords.closestSite?.lat || lastLog.lat;
                const prevLng = fromPrevCoords.closestSite?.lng || lastLog.lng;
                const normativeMinutes = (prevLat && prevLng && insideSite.lat && insideSite.lng)
                  ? estimateNormativeTransitMinutes(prevLat, prevLng, insideSite.lat, insideSite.lng)
                  : 20;

                const maxAllowedTransitMinutes = Math.max(45, Math.round(normativeMinutes * 1.5 + 15));
                const rawTransitMinutes = Math.max(1, Math.round(transitMs / 60000));
                // If within allowed transit window, credit actual transit minutes; if excessive gap, credit normative road time
                const transitMinutes =
                  rawTransitMinutes <= maxAllowedTransitMinutes ? rawTransitMinutes : normativeMinutes;

                if (rawTransitMinutes <= maxAllowedTransitMinutes) {
                  // Normal drive between sites: convert previous exit into AUTO_PAUSE so shift continues seamlessly
                  await prisma.timeLog.update({
                    where: { id: lastLog.id },
                    data: { action: 'AUTO_PAUSE' },
                  });

                  // Find the opening CLOCK_IN of the active shift so live timer shows full elapsed shift time
                  for (let i = 1; i < employee.logs.length; i++) {
                    const l = employee.logs[i]!;
                    if (l.action === 'CLOCK_IN') {
                      shiftStartTime = l.dateTime;
                    } else if (l.action === 'AUTO_RESUME' || l.action === 'AUTO_PAUSE') {
                      continue;
                    } else {
                      break;
                    }
                  }
                } else {
                  // Worker had a long gap exceeding normative travel time:
                  // Credit only the normative transitMinutes onto the first session's end time,
                  // leaving the excess personal gap unpaid and starting a second session at Site B.
                  const cappedExitTime = new Date(
                    new Date(lastLog.dateTime).getTime() + transitMinutes * 60 * 1000
                  );
                  await prisma.timeLog.update({
                    where: { id: lastLog.id },
                    data: {
                      action: 'AUTO_EXIT',
                      dateTime: cappedExitTime,
                    },
                  });
                  shiftStartTime = logDateTime;
                }

                effectiveAction = 'AUTO_RESUME';
                transitResumed = {
                  transitMinutes,
                  fromSite: prevSiteName,
                  toSite: insideSite.siteName,
                };
              }
            }
          }

          // Case 2 (Option B): Worker arrived at Site B while shift was STILL ACTIVE at Site A!
          // (Phone was locked/asleep in pocket during the drive, so AUTO_EXIT never fired at Site A)
          if (
            (data.action === 'CLOCK_IN' || data.action === 'AUTO_RESUME') &&
            employee.multiSiteTransit &&
            insideSite &&
            lastLog &&
            (lastLog.action === 'CLOCK_IN' || lastLog.action === 'AUTO_RESUME')
          ) {
            const logDateStr = getJerusalemParts(logDateTime).dateStr;
            const lastLogDateStr = getJerusalemParts(lastLog.dateTime).dateStr;

            if (logDateStr === lastLogDateStr) {
              const fromPrevCoords = matchSiteByCoords(
                lastLog.lat,
                lastLog.lng,
                allowedGeofences
              );
              const prevSiteName =
                fromPrevCoords.insideSite?.siteName ||
                fromPrevCoords.closestSite?.siteName ||
                null;

              if (prevSiteName && prevSiteName !== insideSite.siteName) {
                const prevLat = fromPrevCoords.closestSite?.lat || lastLog.lat;
                const prevLng = fromPrevCoords.closestSite?.lng || lastLog.lng;
                const normativeMinutes = (prevLat && prevLng && insideSite.lat && insideSite.lng)
                  ? estimateNormativeTransitMinutes(prevLat, prevLng, insideSite.lat, insideSite.lng)
                  : 20;

                const lastActiveTime = new Date(lastLog.dateTime).getTime();
                const transitMs = normativeMinutes * 60 * 1000;
                // Departure from Site A was at (now - normativeTransitMinutes), but not earlier than the last active log + 1 min
                const departDateTime = new Date(
                  Math.max(lastActiveTime + 60000, logDateTime.getTime() - transitMs)
                );
                const transitMinutes = Math.max(1, Math.round((logDateTime.getTime() - departDateTime.getTime()) / 60000));

                // 1. Record retroactive AUTO_PAUSE at departure from Site A
                await prisma.timeLog.create({
                  data: {
                    empId: employee.empId,
                    employeeId: employee.id,
                    clientId: employee.clientId,
                    action: 'AUTO_PAUSE',
                    lat: prevLat,
                    lng: prevLng,
                    dateTime: departDateTime,
                  },
                });

                // 2. This current entry becomes AUTO_RESUME at Site B
                effectiveAction = 'AUTO_RESUME';
                transitResumed = {
                  transitMinutes,
                  fromSite: prevSiteName,
                  toSite: insideSite.siteName,
                };

                // 3. Find opening CLOCK_IN of the active shift
                for (let i = 0; i < employee.logs.length; i++) {
                  const l = employee.logs[i]!;
                  if (l.action === 'CLOCK_IN') {
                    shiftStartTime = l.dateTime;
                  } else if (l.action === 'AUTO_RESUME' || l.action === 'AUTO_PAUSE') {
                    continue;
                  } else {
                    break;
                  }
                }
              }
            }
          }

          // On CLOCK_OUT or AUTO_EXIT outside geofence: record departure / out-of-zone note
          if ((data.action === 'CLOCK_OUT' || data.action === 'AUTO_EXIT') && !insideAny && !data.note) {
            const siteLabel = bestSiteName ? ` "${bestSiteName}"` : '';
            const dist = Math.round(minDistance);
            if (employee.strictGps || employee.multiSiteTransit) {
              autoGeneratedNote = `Покинул объект${siteLabel} (строгий GPS, ${dist}м)`;
            } else {
              autoGeneratedNote = `Выход вне объекта${siteLabel} (${dist}м)`;
            }
          }
        }
      }
    }

    const log = await prisma.timeLog.create({
      data: {
        empId: employee.empId,
        employeeId: employee.id,
        clientId: employee.clientId,
        action: effectiveAction,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        dateTime: logDateTime,
      },
    });

    // If multi-site transit occurred, replace the temporary exit note from the previous site with the transit note
    if (transitResumed) {
      const jerusalemParts = getJerusalemParts(logDateTime);
      const transitNoteText = `Время на переезд между объектами: ${transitResumed.transitMinutes} мин (из "${transitResumed.fromSite}" в "${transitResumed.toSite}")`;

      const recentNotesToday = await prisma.dailyNote.findMany({
        where: {
          employeeId: employee.id,
          date: jerusalemParts.dateStr,
        },
        orderBy: { id: 'desc' },
      });

      const tempExitNote = recentNotesToday.find(
        (n) =>
          n.noteText.startsWith('Покинул объект') ||
          n.noteText.startsWith('Left work site') ||
          n.noteText.startsWith('עזב את האתר') ||
          n.noteText.startsWith('غادر الموقع') ||
          n.noteText.startsWith('Выход вне объекта') ||
          n.noteText.startsWith('Clock-out outside site') ||
          n.noteText.startsWith('יציאה מחוץ לאתר') ||
          n.noteText.startsWith('خروج خارج الموقع')
      );

      if (tempExitNote) {
        await prisma.dailyNote.update({
          where: { id: tempExitNote.id },
          data: { noteText: transitNoteText },
        });
      } else {
        await prisma.dailyNote.create({
          data: {
            clientId: employee.clientId,
            empId: employee.empId,
            employeeId: employee.id,
            date: jerusalemParts.dateStr,
            noteText: transitNoteText,
            expense: 0,
          },
        });
      }
    }

    // Save note or expense if provided (or auto-generated by GPS geofence check)
    const finalNote = data.note || autoGeneratedNote;
    if (finalNote || data.expense) {
      const jerusalemParts = getJerusalemParts(logDateTime);
      await prisma.dailyNote.create({
        data: {
          clientId: employee.clientId,
          empId: employee.empId,
          employeeId: employee.id,
          date: jerusalemParts.dateStr,
          noteText: finalNote || 'Расход со смены',
          expense: data.expense || 0,
        },
      });
    }

    // Calculate today's worked hours summary on CLOCK_OUT or AUTO_EXIT
    let todaySummary: {
      totalNetHours: number;
      hours: number;
      minutes: number;
      isCallout?: boolean;
      sessionIndex?: number;
      dayTotalNetHours?: number;
    } | null = null;
    if (data.action === 'CLOCK_OUT' || data.action === 'AUTO_EXIT') {
      try {
        const jerusalemParts = getJerusalemParts(logDateTime);
        const startOfDay = new Date(logDateTime);
        startOfDay.setHours(0, 0, 0, 0);

        const todayLogs = await prisma.timeLog.findMany({
          where: {
            empId: employee.empId,
            dateTime: {
              gte: new Date(startOfDay.getTime() - 24 * 3600 * 1000),
            },
          },
          orderBy: { dateTime: 'asc' },
        });

        const todaySessions: WorkSession[] = [];
        let cIn: Date | null = null;
        for (const l of todayLogs) {
          if (l.action === 'CLOCK_IN' || (l.action === 'AUTO_RESUME' && !cIn)) {
            cIn = l.dateTime;
          } else if (l.action === 'CLOCK_OUT' || l.action === 'AUTO_EXIT') {
            if (cIn) {
              todaySessions.push({ clockIn: cIn, clockOut: l.dateTime });
              cIn = null;
            }
          }
        }

        const sameDaySessions = todaySessions.filter(
          (s) => getJerusalemParts(s.clockIn).dateStr === jerusalemParts.dateStr
        );

        const shiftsConfig = (employee.shifts || employee.client.defaultShifts) as unknown as ClientShiftsConfig;
        const nightStart = shiftsConfig?.night?.start || '22:00';
        const nightEnd = shiftsConfig?.night?.end || '06:00';
        const shabbatEnter = shiftsConfig?.shabbatEnter || '16:00';
        const overtimeThreshold =
          Number(shiftsConfig?.overtimeThreshold) > 0 ? Number(shiftsConfig?.overtimeThreshold) : 9;

        const sessionCalcs = calculateDailySessionsBreakdown(
          sameDaySessions,
          employee.client.autoDeductLunch,
          nightStart,
          nightEnd,
          shabbatEnter,
          overtimeThreshold
        );
        const lastCalc = sessionCalcs[sessionCalcs.length - 1];
        const dayTotalNetHours =
          Math.round(sessionCalcs.reduce((acc, c) => acc + c.netHours, 0) * 100) / 100;
        const currentShiftNet = lastCalc ? lastCalc.netHours : dayTotalNetHours;

        const totalMinutes = Math.round(currentShiftNet * 60);
        todaySummary = {
          totalNetHours: currentShiftNet,
          hours: Math.floor(totalMinutes / 60),
          minutes: totalMinutes % 60,
          isCallout: lastCalc?.isCallout ?? false,
          sessionIndex: lastCalc?.sessionIndex ?? 1,
          dayTotalNetHours,
        };
      } catch (sumErr) {
        console.error('Error calculating today summary on clock-out:', sumErr);
      }
    }

    res.json({
      success: true,
      log,
      todaySummary,
      ...(shiftStartTime ? { shiftStartTime } : {}),
      ...(transitResumed ? { transitResumed } : {}),
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Неверные параметры запроса' });
      return;
    }
    console.error('Worker log error:', err);
    res.status(500).json({ error: 'Ошибка записи отметки' });
  }
});

const workerSyncSchema = z.object({
  empId: z.string().min(1),
  logs: z.array(workerLogSchema),
});

/**
 * 2.1 Batch offline logs synchronization
 */
workerRouter.post('/sync', async (req: Request, res: Response) => {
  try {
    const { empId, logs } = workerSyncSchema.parse(req.body);

    const employee = await prisma.employee.findUnique({
      where: { empId },
      include: { client: true },
    });

    if (!employee || !employee.client.isActive) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    // Sort chronologically
    const sortedLogs = [...logs].sort((a, b) => {
      const timeA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
      const timeB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
      return timeA - timeB;
    });

    const createdLogs = [];
    for (const logData of sortedLogs) {
      const logDateTime = logData.dateTime ? new Date(logData.dateTime) : new Date();

      const log = await prisma.timeLog.create({
        data: {
          empId: employee.empId,
          employeeId: employee.id,
          clientId: employee.clientId,
          action: logData.action,
          lat: logData.lat ?? null,
          lng: logData.lng ?? null,
          dateTime: logDateTime,
        },
      });
      createdLogs.push(log);

      if (logData.note || logData.expense) {
        const jerusalemParts = getJerusalemParts(logDateTime);
        await prisma.dailyNote.create({
          data: {
            clientId: employee.clientId,
            empId: employee.empId,
            employeeId: employee.id,
            date: jerusalemParts.dateStr,
            noteText: logData.note || 'Расход со смены (офлайн)',
            expense: logData.expense || 0,
          },
        });
      }
    }

    res.json({ success: true, count: createdLogs.length, logs: createdLogs });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Неверные параметры пакета синхронизации' });
      return;
    }
    console.error('Worker sync error:', err);
    res.status(500).json({ error: 'Ошибка синхронизации логов' });
  }
});

/**
 * 3. Worker GPS Pause
 */
workerRouter.post('/gps-pause', async (req: Request, res: Response) => {
  try {
    const { empId, lat, lng } = req.body;
    const employee = await prisma.employee.findUnique({ where: { empId } });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const log = await prisma.timeLog.create({
      data: {
        empId,
        employeeId: employee.id,
        clientId: employee.clientId,
        action: 'AUTO_PAUSE',
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        dateTime: new Date(),
      },
    });

    res.json({ success: true, log });
  } catch (err) {
    console.error('GPS pause error:', err);
    res.status(500).json({ error: 'Ошибка фиксации паузы' });
  }
});

/**
 * 4. Worker GPS Resume
 */
workerRouter.post('/gps-resume', async (req: Request, res: Response) => {
  try {
    const { empId, lat, lng } = req.body;
    const employee = await prisma.employee.findUnique({ where: { empId } });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const log = await prisma.timeLog.create({
      data: {
        empId,
        employeeId: employee.id,
        clientId: employee.clientId,
        action: 'AUTO_RESUME',
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null,
        dateTime: new Date(),
      },
    });

    res.json({ success: true, log });
  } catch (err) {
    console.error('GPS resume error:', err);
    res.status(500).json({ error: 'Ошибка возобновления' });
  }
});

/**
 * 5. Worker Notes
 */
workerRouter.post('/notes', async (req: Request, res: Response) => {
  try {
    const { empId, noteText, expense } = req.body;
    const employee = await prisma.employee.findUnique({ where: { empId } });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const dateStr = getJerusalemParts(new Date()).dateStr;
    const note = await prisma.dailyNote.create({
      data: {
        clientId: employee.clientId,
        empId,
        employeeId: employee.id,
        date: dateStr,
        noteText: noteText || '',
        expense: expense ? parseFloat(expense) : 0,
      },
    });

    res.json({ success: true, note });
  } catch (err) {
    console.error('Worker note error:', err);
    res.status(500).json({ error: 'Ошибка сохранения заметки' });
  }
});

/**
 * 6. Worker Monthly Report (JSON)
 */
workerRouter.get('/report/:empId', async (req: Request, res: Response) => {
  try {
    const empId = req.params['empId'] as string;
    const month = (req.query['month'] as string) || getJerusalemParts(new Date()).dateStr.slice(0, 7); // YYYY-MM

    const employee = await prisma.employee.findUnique({
      where: { empId },
      include: {
        client: true,
        schedules: true,
      },
    });

    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const shiftsConfig = (employee.shifts || employee.client.defaultShifts) as unknown as ClientShiftsConfig;
    const monthData = await computeWorkerMonthData(
      empId,
      month,
      shiftsConfig,
      employee.client.autoDeductLunch ?? false
    );

    let globalMonthlyStatus: GlobalMonthlyEvaluation | null = null;
    if (employee.isGlobal && (employee.contractMonthlyHours ?? 0) > 0) {
      globalMonthlyStatus = evaluateGlobalMonthlyStatus({
        workedHours: monthData.totalNet,
        contractMonthlyHours: employee.contractMonthlyHours!,
        periodMonth: month,
        schedules: employee.schedules,
      });
    }

    res.json({
      success: true,
      employeeName: employee.name,
      month,
      summary: {
        totalNet: monthData.totalNet,
        totalNight: monthData.totalNight,
        totalSaturday: monthData.totalSaturday,
        totalOvertime: monthData.totalOvertime,
        totalOvertime125: monthData.totalOvertime125,
        totalOvertime150: monthData.totalOvertime150,
      },
      globalMonthlyStatus,
      days: monthData.days,
    });
  } catch (err) {
    console.error('Worker report error:', err);
    res.status(500).json({ error: 'Ошибка формирования отчёта' });
  }
});

/**
 * 7. Worker Monthly PDF Report
 */
workerRouter.get('/report/:empId/pdf', async (req: Request, res: Response) => {
  try {
    const empId = req.params['empId'] as string;
    const month = (req.query['month'] as string) || getJerusalemParts(new Date()).dateStr.slice(0, 7);
    const lang = (req.query['lang'] as string) || 'he';

    const employee = await prisma.employee.findUnique({
      where: { empId },
      include: { client: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const shiftsConfig = (employee.shifts || employee.client.defaultShifts) as unknown as ClientShiftsConfig;
    const monthData = await computeWorkerMonthData(
      empId,
      month,
      shiftsConfig,
      employee.client.autoDeductLunch ?? false
    );

    const rows: ReportRow[] = monthData.days.map((d: any) => ({
      empId: employee.empId,
      name: employee.name,
      date: d.date,
      dayOfWeek: d.dayOfWeek,
      firstIn: d.firstIn,
      lastOut: d.lastOut,
      grossHours: d.grossHours,
      lunchDeducted: d.lunchDeducted,
      netHours: d.netHours,
      nightHours: d.nightHours,
      saturdayHours: d.saturdayHours,
      overtimeHours: d.overtimeHours,
      overtime125Hours: d.overtime125Hours,
      overtime150Hours: d.overtime150Hours,
      isManual: d.isManual,
      notes: d.notes || '',
      sessionsCount: d.sessionsCount,
      sessionIndex: d.sessionIndex,
      isCallout: d.isCallout,
    }));

    const pdfBytes = await generatePdfReport(
      rows,
      employee.client.name,
      `${employee.name} - ${month}`,
      employee.client.logoUrl,
      lang,
      employee.name
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Worker_${employee.empId}_${month}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Worker PDF report error:', err);
    res.status(500).json({ error: 'Ошибка генерации PDF' });
  }
});

/**
 * 7.1 Worker Monthly CSV Report
 */
workerRouter.get('/report/:empId/csv', async (req: Request, res: Response) => {
  try {
    const empId = req.params['empId'] as string;
    const month = (req.query['month'] as string) || getJerusalemParts(new Date()).dateStr.slice(0, 7);
    const lang = (req.query['lang'] as string) || 'he';

    const employee = await prisma.employee.findUnique({
      where: { empId },
      include: { client: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const shiftsConfig = (employee.shifts || employee.client.defaultShifts) as unknown as ClientShiftsConfig;
    const monthData = await computeWorkerMonthData(
      empId,
      month,
      shiftsConfig,
      employee.client.autoDeductLunch ?? false
    );

    const rows: ReportRow[] = monthData.days.map((d: any) => ({
      empId: employee.empId,
      name: employee.name,
      date: d.date,
      dayOfWeek: d.dayOfWeek,
      firstIn: d.firstIn,
      lastOut: d.lastOut,
      grossHours: d.grossHours,
      lunchDeducted: d.lunchDeducted,
      netHours: d.netHours,
      nightHours: d.nightHours,
      saturdayHours: d.saturdayHours,
      overtimeHours: d.overtimeHours,
      overtime125Hours: d.overtime125Hours,
      overtime150Hours: d.overtime150Hours,
      isManual: d.isManual,
      notes: d.notes || '',
      sessionsCount: d.sessionsCount,
      sessionIndex: d.sessionIndex,
      isCallout: d.isCallout,
    }));

    const csvData = generateCsvReport(rows, employee.client.name, lang);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="Worker_${employee.empId}_${month}.csv"`);
    res.send(csvData);
  } catch (err) {
    console.error('Worker CSV report error:', err);
    res.status(500).json({ error: 'Ошибка генерации CSV' });
  }
});

/**
 * 8. Worker Push Subscription
 */
workerRouter.post('/subscribe', async (req: Request, res: Response) => {
  try {
    const { empId, subscription } = req.body;
    if (!empId || !subscription || !subscription.endpoint) {
      res.status(400).json({ error: 'Неверные параметры подписки' });
      return;
    }

    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        empId,
        p256dh: subscription.keys?.p256dh || '',
        auth: subscription.keys?.auth || '',
      },
      create: {
        empId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh || '',
        auth: subscription.keys?.auth || '',
      },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Worker push subscribe error:', err);
    res.status(500).json({ error: 'Ошибка сохранения подписки' });
  }
});
