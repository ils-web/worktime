import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@timetracker/db';
import {
  checkGeofence,
  calculateDailyHours,
  getJerusalemParts,
  WorkSession,
  GeofenceConfig,
  ClientShiftsConfig,
} from '@timetracker/shared';
import { generatePdfReport } from '../services/pdfReportService';
import { ReportRow } from '../services/csvReportService';

interface TrackedSession extends WorkSession {
  isManual?: boolean;
}

export const workerRouter = Router();

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
          },
        },
        sites: {
          include: { site: true },
        },
        logs: {
          take: 1,
          orderBy: { dateTime: 'desc' },
        },
      },
    });

    if (!employee || !employee.client.isActive) {
      res.status(404).json({ error: 'Сотрудник не найден или аккаунт компании отключен' });
      return;
    }

    const lastLog = employee.logs[0];
    const isOnShift = lastLog ? lastLog.action === 'CLOCK_IN' || lastLog.action === 'AUTO_RESUME' : false;

    // Shift overrides or client default shifts
    const effectiveShifts = employee.shifts || employee.client.defaultShifts;

    const sitesList = employee.sites.map((es) => es.site);

    res.json({
      success: true,
      employee: {
        id: employee.id,
        empId: employee.empId,
        name: employee.name,
        companyName: employee.client.name,
        isMobile: employee.isMobile,
        strictGps: employee.strictGps,
        geofence: employee.geofence,
        sites: sitesList,
        shifts: effectiveShifts,
      },
      status: {
        isOnShift,
        lastAction: lastLog?.action ?? null,
        lastActionTime: lastLog?.dateTime ?? null,
      },
    });
  } catch (err) {
    console.error('Worker profile error:', err);
    res.status(500).json({ error: 'Ошибка получения профиля' });
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
      },
    });

    if (!employee || !employee.client.isActive) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    // Geofence check if not mobile worker
    if (!employee.isMobile) {
      const allowedGeofences: GeofenceConfig[] = [];

      // 1. Assigned sites
      if (employee.sites && employee.sites.length > 0) {
        for (const es of employee.sites) {
          if (es.site.lat && es.site.lng && es.site.radius) {
            allowedGeofences.push({
              lat: es.site.lat,
              lng: es.site.lng,
              radius: es.site.radius,
              address: es.site.name + (es.site.address ? ` (${es.site.address})` : ''),
            });
          }
        }
      }

      // 2. Custom employee geofence fallback
      if (allowedGeofences.length === 0 && employee.geofence) {
        const gf = employee.geofence as unknown as GeofenceConfig;
        if (gf.lat && gf.lng && gf.radius) {
          allowedGeofences.push(gf);
        }
      }

      if (allowedGeofences.length > 0 && data.lat !== undefined && data.lat !== null && data.lng !== undefined && data.lng !== null) {
        let insideAny = false;
        let minDistance = Infinity;
        let bestRadius = 100;

        for (const gf of allowedGeofences) {
          const { isInside, distanceMeters } = checkGeofence(data.lat, data.lng, gf.lat, gf.lng, gf.radius);
          if (distanceMeters < minDistance) {
            minDistance = distanceMeters;
            bestRadius = gf.radius;
          }
          if (isInside) {
            insideAny = true;
            break;
          }
        }

        // On CLOCK_IN: must be inside at least one allowed geofence/site
        if (data.action === 'CLOCK_IN' && !insideAny) {
          res.status(400).json({
            error: 'Вы вне зоны объекта!',
            errorCode: 'OUT_OF_GEOFENCE',
            distanceMeters: minDistance,
            radius: bestRadius,
          });
          return;
        }
        // On CLOCK_OUT: allowed even outside geofence (Section 1.4)
      }
    }

    const logDateTime = data.dateTime ? new Date(data.dateTime) : new Date();

    const log = await prisma.timeLog.create({
      data: {
        empId: employee.empId,
        employeeId: employee.id,
        clientId: employee.clientId,
        action: data.action,
        lat: data.lat ?? null,
        lng: data.lng ?? null,
        dateTime: logDateTime,
      },
    });

    // Save note or expense if provided (fixes bug #5: fields date & noteText)
    if (data.note || data.expense) {
      const jerusalemParts = getJerusalemParts(logDateTime);
      await prisma.dailyNote.create({
        data: {
          clientId: employee.clientId,
          empId: employee.empId,
          employeeId: employee.id,
          date: jerusalemParts.dateStr,
          noteText: data.note || 'Расход со смены',
          expense: data.expense || 0,
        },
      });
    }

    // Calculate today's worked hours summary on CLOCK_OUT
    let todaySummary: { totalNetHours: number; hours: number; minutes: number } | null = null;
    if (data.action === 'CLOCK_OUT') {
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
          if (l.action === 'CLOCK_IN') {
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
        const daily = calculateDailyHours(sameDaySessions, employee.client.autoDeductLunch, nightStart, nightEnd);

        const totalMinutes = Math.round(daily.netHours * 60);
        todaySummary = {
          totalNetHours: daily.netHours,
          hours: Math.floor(totalMinutes / 60),
          minutes: totalMinutes % 60,
        };
      } catch (sumErr) {
        console.error('Error calculating today summary on clock-out:', sumErr);
      }
    }

    res.json({ success: true, log, todaySummary });
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
        dailyNotes: {
          where: { date: { startsWith: month } },
        },
      },
    });

    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    // Determine start and end of requested month
    const [yearStr, mStr] = month.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const m = parseInt(mStr || '10', 10);
    const startDate = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));
    const fetchEndDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);

    const logs = await prisma.timeLog.findMany({
      where: {
        empId,
        dateTime: { gte: startDate, lte: fetchEndDate },
      },
      orderBy: { dateTime: 'asc' },
    });

    // Group into sessions
    const sessions: TrackedSession[] = [];
    let currentInLog: (typeof logs)[0] | null = null;
    for (const log of logs) {
      if (log.action === 'CLOCK_IN') {
        currentInLog = log;
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

    const filteredSessions = sessions.filter((s) => s.clockIn >= startDate && s.clockIn <= endDate);

    // Group sessions by date
    const sessionsByDate: Record<string, TrackedSession[]> = {};
    for (const s of filteredSessions) {
      const d = getJerusalemParts(s.clockIn).dateStr;
      if (!sessionsByDate[d]) sessionsByDate[d] = [];
      sessionsByDate[d].push(s);
    }

    const shiftsConfig = (employee.shifts || employee.client.defaultShifts) as unknown as ClientShiftsConfig;
    const nightStart = shiftsConfig?.night?.start || '22:00';
    const nightEnd = shiftsConfig?.night?.end || '06:00';
    const autoDeductLunch = employee.client.autoDeductLunch;

    const days: any[] = [];
    let totalNet = 0;
    let totalNight = 0;
    let totalSat = 0;
    let totalOt = 0;

    for (const [dateStr, daySessions] of Object.entries(sessionsByDate)) {
      const daily = calculateDailyHours(daySessions, autoDeductLunch, nightStart, nightEnd);
      totalNet += daily.netHours;
      totalNight += daily.nightHours;
      totalSat += daily.saturdayHours;
      totalOt += daily.overtimeHours;

      days.push({
        date: dateStr,
        grossHours: daily.grossHours,
        lunchDeducted: daily.lunchDeductedHours,
        netHours: daily.netHours,
        nightHours: daily.nightHours,
        saturdayHours: daily.saturdayHours,
        overtimeHours: daily.overtimeHours,
        isManual: daySessions.some((s) => s.isManual),
      });
    }

    res.json({
      success: true,
      employeeName: employee.name,
      month,
      summary: {
        totalNet: Math.round(totalNet * 100) / 100,
        totalNight: Math.round(totalNight * 100) / 100,
        totalSaturday: Math.round(totalSat * 100) / 100,
        totalOvertime: Math.round(totalOt * 100) / 100,
      },
      days,
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

    const employee = await prisma.employee.findUnique({
      where: { empId },
      include: { client: true },
    });

    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const [yearStr, mStr] = month.split('-');
    const year = parseInt(yearStr || '2026', 10);
    const m = parseInt(mStr || '10', 10);
    const startDate = new Date(Date.UTC(year, m - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, m, 0, 23, 59, 59));
    const fetchEndDate = new Date(endDate.getTime() + 24 * 60 * 60 * 1000);

    const logs = await prisma.timeLog.findMany({
      where: {
        empId,
        dateTime: { gte: startDate, lte: fetchEndDate },
      },
      orderBy: { dateTime: 'asc' },
    });

    const sessions: TrackedSession[] = [];
    let currentInLog: (typeof logs)[0] | null = null;
    for (const log of logs) {
      if (log.action === 'CLOCK_IN') {
        currentInLog = log;
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

    const filteredSessions = sessions.filter((s) => s.clockIn >= startDate && s.clockIn <= endDate);

    const sessionsByDate: Record<string, TrackedSession[]> = {};
    for (const s of filteredSessions) {
      const d = getJerusalemParts(s.clockIn).dateStr;
      if (!sessionsByDate[d]) sessionsByDate[d] = [];
      sessionsByDate[d].push(s);
    }

    const shiftsConfig = (employee.shifts || employee.client.defaultShifts) as unknown as ClientShiftsConfig;
    const nightStart = shiftsConfig?.night?.start || '22:00';
    const nightEnd = shiftsConfig?.night?.end || '06:00';

    const rows: ReportRow[] = [];
    for (const [dateStr, daySessions] of Object.entries(sessionsByDate)) {
      const daily = calculateDailyHours(daySessions, employee.client.autoDeductLunch, nightStart, nightEnd);
      const firstIn = getJerusalemParts(daySessions[0]!.clockIn).timeStr;
      const lastOut = getJerusalemParts(daySessions[daySessions.length - 1]!.clockOut).timeStr;

      rows.push({
        empId: employee.empId,
        name: employee.name,
        date: dateStr,
        firstIn,
        lastOut,
        grossHours: daily.grossHours,
        lunchDeducted: daily.lunchDeductedHours,
        netHours: daily.netHours,
        nightHours: daily.nightHours,
        saturdayHours: daily.saturdayHours,
        overtimeHours: daily.overtimeHours,
        isManual: daySessions.some((s) => s.isManual),
        notes: '',
      });
    }

    const pdfBytes = await generatePdfReport(
      rows,
      employee.client.name,
      `Employee ${employee.name} - ${month}`,
      employee.client.logoUrl
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
