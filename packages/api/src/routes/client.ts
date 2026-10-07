import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@timetracker/db';
import {
  calculateDailyHours,
  getJerusalemParts,
  WorkSession,
  ClientShiftsConfig,
  jerusalemDateTimeToDate,
  parseClientDateTime,
  addDays,
  formatIsoToDisplayDate,
  getDayOfWeek,
} from '@timetracker/shared';
import { authRequired, requireRole } from '../middleware/auth';
import { generateCsvReport, ReportRow } from '../services/csvReportService';
import { generatePdfReport } from '../services/pdfReportService';

export const clientRouter = Router();

// Require client or foreman role
clientRouter.use(authRequired, requireRole('client', 'foreman'));

/**
 * Helper to get active clientId from session
 */
function getTargetClientId(req: Request): string {
  return req.user?.clientId ?? req.user?.id ?? '';
}

/**
 * 1. Employees: List
 */
clientRouter.get('/employees', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const isForeman = req.user?.role === 'foreman';

    const whereClause: any = { clientId };
    if (isForeman) {
      whereClause.foremanId = req.user?.id;
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        foreman: { select: { id: true, name: true } },
        sites: { include: { site: true } },
        logs: {
          take: 1,
          orderBy: { dateTime: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const enriched = employees.map((emp) => {
      const lastLog = emp.logs[0];
      const isOnShift = lastLog ? lastLog.action === 'CLOCK_IN' || lastLog.action === 'AUTO_RESUME' : false;
      return {
        ...emp,
        isOnShift,
        lastLogAction: lastLog?.action ?? null,
        lastLogTime: lastLog?.dateTime ?? null,
      };
    });

    res.json({ success: true, employees: enriched });
  } catch (err) {
    console.error('List employees error:', err);
    res.status(500).json({ error: 'Ошибка получения сотрудников' });
  }
});

const createEmployeeSchema = z.object({
  empId: z.string().min(2),
  name: z.string().min(2),
  isMobile: z.boolean().default(false),
  strictGps: z.boolean().default(false),
  autoCloseShift: z.boolean().default(false),
  geofence: z.any().optional(),
  shifts: z.any().optional(),
  foremanId: z.string().optional().nullable(),
  siteIds: z.array(z.string()).optional(),
});

/**
 * 2. Employees: Create (client & foreman)
 */
clientRouter.post('/employees', requireRole('client', 'foreman'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const data = createEmployeeSchema.parse(req.body);

    const existing = await prisma.employee.findUnique({
      where: { empId: data.empId },
    });
    if (existing) {
      res.status(400).json({ error: 'Сотрудник с таким ID уже существует' });
      return;
    }

    const employee = await prisma.employee.create({
      data: {
        clientId,
        empId: data.empId,
        name: data.name,
        isMobile: data.isMobile,
        strictGps: data.strictGps,
        autoCloseShift: data.autoCloseShift,
        geofence: data.geofence || null,
        shifts: data.shifts || null,
        foremanId: data.foremanId || null,
      },
      include: {
        sites: { include: { site: true } },
        foreman: { select: { id: true, name: true } },
      },
    });

    if (data.siteIds && data.siteIds.length > 0) {
      await prisma.employeeSite.createMany({
        data: data.siteIds.map((siteId) => ({
          employeeId: employee.id,
          siteId,
        })),
      });
    }

    res.json({ success: true, employee });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Заполните обязательные поля корректно' });
      return;
    }
    console.error('Create employee error:', err);
    res.status(500).json({ error: 'Ошибка создания сотрудника' });
  }
});

/**
 * 3. Employees: Update (client & foreman)
 */
clientRouter.put('/employees/:empId', requireRole('client', 'foreman'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const currentEmpId = req.params['empId'] as string;
    const { name, newEmpId, isMobile, strictGps, autoCloseShift, geofence, shifts, foremanId, siteIds } = req.body;

    const employee = await prisma.employee.findFirst({
      where: { empId: currentEmpId, clientId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    let finalEmpId = employee.empId;
    if (newEmpId && newEmpId !== currentEmpId) {
      const existing = await prisma.employee.findUnique({ where: { empId: newEmpId } });
      if (existing) {
        res.status(400).json({ error: 'Сотрудник с таким ID ссылки уже существует' });
        return;
      }
      finalEmpId = newEmpId;
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        empId: finalEmpId,
        ...(name ? { name } : {}),
        ...(isMobile !== undefined ? { isMobile } : {}),
        ...(strictGps !== undefined ? { strictGps } : {}),
        ...(autoCloseShift !== undefined ? { autoCloseShift } : {}),
        ...(geofence !== undefined ? { geofence } : {}),
        ...(shifts !== undefined ? { shifts } : {}),
        ...(foremanId !== undefined ? { foremanId: foremanId || null } : {}),
      },
      include: {
        sites: { include: { site: true } },
        foreman: { select: { id: true, name: true } },
      },
    });

    if (siteIds !== undefined && Array.isArray(siteIds)) {
      await prisma.employeeSite.deleteMany({ where: { employeeId: employee.id } });
      if (siteIds.length > 0) {
        await prisma.employeeSite.createMany({
          data: siteIds.map((sId: string) => ({
            employeeId: employee.id,
            siteId: sId,
          })),
        });
      }
    }

    res.json({ success: true, employee: updated });
  } catch (err) {
    console.error('Update employee error:', err);
    res.status(500).json({ error: 'Ошибка обновления сотрудника' });
  }
});

/**
 * 4. Employees: Delete (client only)
 */
clientRouter.delete('/employees/:empId', requireRole('client'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const empId = req.params['empId'] as string;

    const employee = await prisma.employee.findFirst({
      where: { empId, clientId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    await prisma.employee.delete({ where: { id: employee.id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete employee error:', err);
    res.status(500).json({ error: 'Ошибка удаления сотрудника' });
  }
});

/**
 * 5. Employees: Toggle mobile
 */
clientRouter.patch('/employees/:empId/mobile', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const empId = req.params['empId'] as string;

    const employee = await prisma.employee.findFirst({
      where: { empId, clientId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: { isMobile: !employee.isMobile },
    });

    res.json({ success: true, isMobile: updated.isMobile });
  } catch (err) {
    console.error('Patch employee mobile error:', err);
    res.status(500).json({ error: 'Ошибка изменения режима' });
  }
});

/**
 * 6. Employees: Force exit (closes open shift)
 */
clientRouter.post('/employees/:id/force-exit', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const id = parseInt(req.params['id'] as string, 10);

    const employee = await prisma.employee.findFirst({
      where: { id, clientId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    // Record CLOCK_OUT as manual force exit
    const log = await prisma.timeLog.create({
      data: {
        empId: employee.empId,
        employeeId: employee.id,
        clientId,
        action: 'CLOCK_OUT',
        isManual: true,
        dateTime: new Date(),
      },
    });

    res.json({ success: true, log });
  } catch (err) {
    console.error('Force exit error:', err);
    res.status(500).json({ error: 'Ошибка закрытия смены' });
  }
});

/**
 * 7. Foremen: CRUD (client only)
 */
clientRouter.get('/foremen', requireRole('client'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const foremen = await prisma.foreman.findMany({
      where: { clientId },
      include: { _count: { select: { employees: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, foremen });
  } catch (err) {
    console.error('List foremen error:', err);
    res.status(500).json({ error: 'Ошибка получения бригадиров' });
  }
});

clientRouter.post('/foremen', requireRole('client'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const { username, password, name } = req.body;
    if (!username || !password || !name) {
      res.status(400).json({ error: 'Заполните имя, логин и пароль' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const foreman = await prisma.foreman.create({
      data: {
        clientId,
        username,
        passwordHash,
        name,
      },
    });

    res.json({ success: true, foreman });
  } catch (err) {
    console.error('Create foreman error:', err);
    res.status(500).json({ error: 'Ошибка создания бригадира' });
  }
});

clientRouter.post('/foremen/:id/toggle', requireRole('client'), async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const f = await prisma.foreman.findUnique({ where: { id } });
    if (!f) {
      res.status(404).json({ error: 'Бригадир не найден' });
      return;
    }

    const updated = await prisma.foreman.update({
      where: { id },
      data: { isActive: !f.isActive },
    });

    res.json({ success: true, isActive: updated.isActive });
  } catch (err) {
    console.error('Toggle foreman error:', err);
    res.status(500).json({ error: 'Ошибка переключения статуса бригадира' });
  }
});

clientRouter.delete('/foremen/:id', requireRole('client'), async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    await prisma.foreman.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete foreman error:', err);
    res.status(500).json({ error: 'Ошибка удаления бригадира' });
  }
});

/**
 * 8. Schedules: Get & Set
 */
clientRouter.get('/schedule', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const schedules = await prisma.schedule.findMany({
      where: { clientId },
      include: { employee: { select: { empId: true, name: true } } },
    });
    res.json({ success: true, schedules });
  } catch (err) {
    console.error('Get schedule error:', err);
    res.status(500).json({ error: 'Ошибка получения расписания' });
  }
});

clientRouter.post('/schedule', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const { employeeId, dayOfWeek, shiftType } = req.body;

    const schedule = await prisma.schedule.upsert({
      where: {
        employeeId_dayOfWeek: { employeeId, dayOfWeek },
      },
      update: { shiftType },
      create: { clientId, employeeId, dayOfWeek, shiftType },
    });

    res.json({ success: true, schedule });
  } catch (err) {
    console.error('Save schedule error:', err);
    res.status(500).json({ error: 'Ошибка сохранения расписания' });
  }
});

/**
 * 9. Client Settings
 */
clientRouter.get('/settings', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: {
        id: true,
        name: true,
        username: true,
        logoUrl: true,
        defaultShifts: true,
        autoDeductLunch: true,
        trialEndsAt: true,
        tariffMode: true,
      },
    });

    res.json({ success: true, settings: client });
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Ошибка получения настроек' });
  }
});

clientRouter.post('/settings', requireRole('client'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const { name, defaultShifts, autoDeductLunch } = req.body;

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: {
        ...(name ? { name } : {}),
        ...(defaultShifts ? { defaultShifts } : {}),
        ...(autoDeductLunch !== undefined ? { autoDeductLunch } : {}),
      },
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Ошибка сохранения настроек' });
  }
});

clientRouter.post('/settings/logo', requireRole('client'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const { logoUrl } = req.body;

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: { logoUrl: logoUrl || null },
    });

    res.json({ success: true, logoUrl: updated.logoUrl });
  } catch (err) {
    console.error('Update logo error:', err);
    res.status(500).json({ error: 'Ошибка сохранения логотипа' });
  }
});

/**
 * 10. Logs: Recent & Quick/Manual entry
 */
clientRouter.get('/logs/recent', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const logs = await prisma.timeLog.findMany({
      where: { clientId },
      include: { employee: { select: { id: true, empId: true, name: true } } },
      orderBy: { dateTime: 'desc' },
      take: 50,
    });

    let todayStats: any = null;
    try {
      const now = new Date();
      const todayStr = getJerusalemParts(now).dateStr;
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const yesterday = new Date(startOfDay.getTime() - 24 * 3600 * 1000);

      const { rows } = await computeClientReportRows(clientId, yesterday, now);
      const todayRows = rows.filter((r) => r.date === todayStr);

      let totalCompletedHours = 0;
      for (const r of todayRows) {
        totalCompletedHours += r.netHours;
      }

      const completedShiftsCount = logs.filter(
        (l) =>
          (l.action === 'CLOCK_OUT' || l.action === 'AUTO_EXIT') &&
          getJerusalemParts(l.dateTime).dateStr === todayStr
      ).length;

      const clockInsCount = logs.filter(
        (l) => l.action === 'CLOCK_IN' && getJerusalemParts(l.dateTime).dateStr === todayStr
      ).length;

      const manualLogsToday = logs.filter(
        (l) => l.isManual && getJerusalemParts(l.dateTime).dateStr === todayStr
      );

      const topWorkersToday = todayRows
        .map((r) => ({ empId: r.empId, name: r.name, hours: r.netHours }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 5);

      todayStats = {
        totalCompletedHours: Number(totalCompletedHours.toFixed(1)),
        completedShiftsCount,
        clockInsCount,
        manualLogsToday,
        topWorkersToday,
      };
    } catch (statErr) {
      console.error('Error computing todayStats in recent logs:', statErr);
    }

    res.json({ success: true, logs, todayStats });
  } catch (err) {
    console.error('Recent logs error:', err);
    res.status(500).json({ error: 'Ошибка получения логов' });
  }
});

clientRouter.post('/logs/quick', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const { empId, action } = req.body;

    const employee = await prisma.employee.findFirst({
      where: { empId, clientId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const log = await prisma.timeLog.create({
      data: {
        empId,
        employeeId: employee.id,
        clientId,
        action,
        isManual: true,
        dateTime: new Date(),
      },
    });

    res.json({ success: true, log });
  } catch (err) {
    console.error('Quick log error:', err);
    res.status(500).json({ error: 'Ошибка быстрой отметки' });
  }
});

clientRouter.post('/logs/manual', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const { empId, clockIn, clockOut, notes } = req.body;

    const employee = await prisma.employee.findFirst({
      where: { empId, clientId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const inTime = parseClientDateTime(clockIn);
    const outTime = parseClientDateTime(clockOut);

    if (outTime <= inTime) {
      res.status(400).json({ error: 'Время окончания смены должно быть позже времени начала' });
      return;
    }

    const logIn = await prisma.timeLog.create({
      data: {
        empId,
        employeeId: employee.id,
        clientId,
        action: 'CLOCK_IN',
        dateTime: inTime,
        isManual: true,
      },
    });

    const logOut = await prisma.timeLog.create({
      data: {
        empId,
        employeeId: employee.id,
        clientId,
        action: 'CLOCK_OUT',
        dateTime: outTime,
        isManual: true,
      },
    });

    if (notes && typeof notes === 'string' && notes.trim()) {
      const dStr = getJerusalemParts(inTime).dateStr;
      const existingNote = await prisma.dailyNote.findFirst({
        where: { clientId, empId, date: dStr },
      });
      if (existingNote) {
        await prisma.dailyNote.update({
          where: { id: existingNote.id },
          data: { noteText: notes.trim() },
        });
      } else {
        await prisma.dailyNote.create({
          data: {
            clientId,
            empId,
            employeeId: employee.id,
            date: dStr,
            noteText: notes.trim(),
            expense: 0,
          },
        });
      }
    }

    res.json({ success: true, logIn, logOut });
  } catch (err) {
    console.error('Manual log error:', err);
    res.status(500).json({ error: 'Ошибка ручного добавления смены' });
  }
});

clientRouter.put('/logs/manual', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const { empId, clockIn, clockOut, notes, logIds } = req.body;

    const employee = await prisma.employee.findFirst({
      where: { empId, clientId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const inTime = parseClientDateTime(clockIn);
    const outTime = parseClientDateTime(clockOut);

    if (outTime <= inTime) {
      res.status(400).json({ error: 'Время окончания смены должно быть позже времени начала' });
      return;
    }

    if (Array.isArray(logIds) && logIds.length >= 2) {
      const logs = await prisma.timeLog.findMany({
        where: { id: { in: logIds }, clientId, empId },
        orderBy: { dateTime: 'asc' },
      });
      const inLog = logs.find((l) => l.action === 'CLOCK_IN') || logs[0];
      const outLog =
        logs.find((l) => l.action === 'CLOCK_OUT' || l.action === 'AUTO_EXIT') ||
        logs[logs.length - 1];

      if (inLog) {
        await prisma.timeLog.update({
          where: { id: inLog.id },
          data: { dateTime: inTime, isManual: true },
        });
      }
      if (outLog && outLog.id !== inLog?.id) {
        await prisma.timeLog.update({
          where: { id: outLog.id },
          data: { dateTime: outTime, isManual: true },
        });
      }

      // Delete any extraneous intermediate/duplicate logs that belonged to this shift session
      const extraLogs = logs.filter((l) => l.id !== inLog?.id && l.id !== outLog?.id);
      if (extraLogs.length > 0) {
        await prisma.timeLog.deleteMany({
          where: { id: { in: extraLogs.map((l) => l.id) } },
        });
      }
    } else if (Array.isArray(logIds) && logIds.length === 1) {
      const existing = await prisma.timeLog.findFirst({
        where: { id: logIds[0], clientId, empId },
      });
      if (existing) {
        await prisma.timeLog.update({
          where: { id: existing.id },
          data: { dateTime: inTime, action: 'CLOCK_IN', isManual: true },
        });
        await prisma.timeLog.create({
          data: {
            empId,
            employeeId: employee.id,
            clientId,
            action: 'CLOCK_OUT',
            dateTime: outTime,
            isManual: true,
          },
        });
      }
    } else {
      await prisma.timeLog.create({
        data: {
          empId,
          employeeId: employee.id,
          clientId,
          action: 'CLOCK_IN',
          dateTime: inTime,
          isManual: true,
        },
      });
      await prisma.timeLog.create({
        data: {
          empId,
          employeeId: employee.id,
          clientId,
          action: 'CLOCK_OUT',
          dateTime: outTime,
          isManual: true,
        },
      });
    }

    if (typeof notes === 'string') {
      const dStr = getJerusalemParts(inTime).dateStr;
      const existingNote = await prisma.dailyNote.findFirst({
        where: { clientId, empId, date: dStr },
      });
      if (notes.trim()) {
        if (existingNote) {
          await prisma.dailyNote.update({
            where: { id: existingNote.id },
            data: { noteText: notes.trim() },
          });
        } else {
          await prisma.dailyNote.create({
            data: {
              clientId,
              empId,
              employeeId: employee.id,
              date: dStr,
              noteText: notes.trim(),
              expense: 0,
            },
          });
        }
      } else if (existingNote) {
        await prisma.dailyNote.delete({
          where: { id: existingNote.id },
        });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Edit manual shift error:', err);
    res.status(500).json({ error: 'Ошибка обновления смены' });
  }
});

clientRouter.delete('/logs/manual', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const { logIds, empId, date } = req.body || {};

    let deletedCount = 0;
    if (Array.isArray(logIds) && logIds.length > 0) {
      const result = await prisma.timeLog.deleteMany({
        where: { id: { in: logIds }, clientId },
      });
      deletedCount = result.count;
    } else if (empId && date) {
      const dayStart = jerusalemDateTimeToDate(date, '00:00');
      const dayEnd = jerusalemDateTimeToDate(addDays(date, 1), '12:00');
      const result = await prisma.timeLog.deleteMany({
        where: {
          clientId,
          empId,
          dateTime: { gte: dayStart, lte: dayEnd },
        },
      });
      deletedCount = result.count;
    }

    res.json({ success: true, count: deletedCount });
  } catch (err) {
    console.error('Delete shift error:', err);
    res.status(500).json({ error: 'Ошибка удаления смены' });
  }
});

/**
 * 11. Core Hours & Report Calculation Logic
 */
async function computeClientReportRows(
  clientId: string,
  startDateInput: Date,
  endDateInput: Date,
  foremanId?: string,
  empId?: string
): Promise<{ rows: ReportRow[]; clientName: string; logoUrl: string | null }> {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { name: true, logoUrl: true, autoDeductLunch: true, defaultShifts: true },
  });

  const shiftsConfig = (client?.defaultShifts as unknown as ClientShiftsConfig) || {
    morning: { start: '07:00', end: '16:00' },
    evening: { start: '16:00', end: '00:00' },
    night: { start: '22:00', end: '06:00' },
  };

  const nightStart = shiftsConfig.night?.start || '22:00';
  const nightEnd = shiftsConfig.night?.end || '06:00';
  const autoDeductLunch = client?.autoDeductLunch ?? false;

  const whereEmp: any = { clientId };
  if (foremanId) whereEmp.foremanId = foremanId;
  if (empId) whereEmp.empId = empId;

  const startParts = getJerusalemParts(startDateInput);
  const endParts = getJerusalemParts(endDateInput);
  const startDateStr = startParts.dateStr;
  const endDateStr = endParts.dateStr;

  const qStart = jerusalemDateTimeToDate(startDateStr, '00:00');
  const qEnd = jerusalemDateTimeToDate(addDays(endDateStr, 1), '23:59');

  const employees = await prisma.employee.findMany({
    where: whereEmp,
    include: {
      logs: {
        where: { dateTime: { gte: qStart, lte: qEnd } },
        orderBy: { dateTime: 'asc' },
      },
      dailyNotes: {
        where: {
          date: {
            gte: startDateStr,
            lte: endDateStr,
          },
        },
      },
    },
  });

  interface TrackedSession extends WorkSession {
    inLogId: number;
    outLogId?: number;
    isManual: boolean;
    allLogIds: number[];
  }

  const reportRows: ReportRow[] = [];

  for (const emp of employees) {
    // 1. Group logs into sessions (In -> Out)
    const sessions: TrackedSession[] = [];
    let currentInLog: { id: number; dateTime: Date; isManual: boolean; allLogIds: number[] } | null = null;

    for (const log of emp.logs) {
      if (log.action === 'CLOCK_IN') {
        if (!currentInLog) {
          currentInLog = {
            id: log.id,
            dateTime: log.dateTime,
            isManual: !!log.isManual,
            allLogIds: [log.id],
          };
        } else {
          // If an unclosed CLOCK_IN already exists:
          // If the new one is manual and previous was not, prioritize the manual record.
          // Otherwise, retain the earlier CLOCK_IN as the start of work, tracking all IDs.
          if (log.isManual && !currentInLog.isManual) {
            currentInLog = {
              id: log.id,
              dateTime: log.dateTime,
              isManual: true,
              allLogIds: [...currentInLog.allLogIds, log.id],
            };
          } else {
            currentInLog.allLogIds.push(log.id);
          }
        }
      } else if (log.action === 'CLOCK_OUT' || log.action === 'AUTO_EXIT') {
        if (currentInLog) {
          sessions.push({
            clockIn: currentInLog.dateTime,
            clockOut: log.dateTime,
            inLogId: currentInLog.id,
            outLogId: log.id,
            isManual: currentInLog.isManual || !!log.isManual,
            allLogIds: [...currentInLog.allLogIds, log.id],
          });
          currentInLog = null;
        }
      }
    }

    // 2. Group sessions by calendar date in Asia/Jerusalem
    const sessionsByDate: Record<string, TrackedSession[]> = {};
    for (const s of sessions) {
      const parts = getJerusalemParts(s.clockIn);
      const d = parts.dateStr;
      if (d < startDateStr || d > endDateStr) continue;
      if (!sessionsByDate[d]) sessionsByDate[d] = [];
      sessionsByDate[d].push(s);
    }

    // 3. Notes by date
    const notesByDate: Record<string, string> = {};
    for (const n of emp.dailyNotes) {
      notesByDate[n.date] = n.noteText;
    }

    // 4. Calculate for each date
    for (const [dateStr, daySessions] of Object.entries(sessionsByDate)) {
      const dailyCalc = calculateDailyHours(
        daySessions,
        autoDeductLunch,
        nightStart,
        nightEnd
      );

      const firstInParts = getJerusalemParts(daySessions[0]!.clockIn);
      const lastOutParts = getJerusalemParts(daySessions[daySessions.length - 1]!.clockOut);
      const hasManual = daySessions.some((s) => s.isManual);
      const allLogIds = daySessions.flatMap((s) => s.allLogIds);
      const shiftsSummary = daySessions.length > 1
        ? daySessions.map((s) => `${getJerusalemParts(s.clockIn).timeStr}-${getJerusalemParts(s.clockOut).timeStr}`).join(', ')
        : undefined;

      reportRows.push({
        empId: emp.empId,
        name: emp.name,
        date: dateStr,
        dayOfWeek: getDayOfWeek(dateStr, 'he'),
        firstIn: firstInParts.timeStr,
        lastOut: lastOutParts.timeStr,
        grossHours: dailyCalc.grossHours,
        lunchDeducted: dailyCalc.lunchDeductedHours,
        netHours: dailyCalc.netHours,
        nightHours: dailyCalc.nightHours,
        saturdayHours: dailyCalc.saturdayHours,
        overtimeHours: dailyCalc.overtimeHours,
        notes: notesByDate[dateStr] || '',
        isManual: hasManual,
        logIds: allLogIds,
        shiftsSummary,
        sessionsCount: daySessions.length,
      });
    }
  }

  // Sort by date asc, empId asc
  reportRows.sort((a, b) => a.date.localeCompare(b.date) || a.empId.localeCompare(b.empId));

  return {
    rows: reportRows,
    clientName: client?.name || 'Company',
    logoUrl: client?.logoUrl || null,
  };
}

/**
 * Hours JSON report
 */
clientRouter.get('/hours', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const startDateStr = req.query['startDate'] as string;
    const endDateStr = req.query['endDate'] as string;
    const empId = req.query['empId'] as string | undefined;

    const startDate = startDateStr ? parseClientDateTime(startDateStr) : new Date(Date.now() - 30 * 86400000);
    const endDate = endDateStr ? parseClientDateTime(endDateStr) : new Date();

    const isForeman = req.user?.role === 'foreman';
    const foremanId = isForeman ? req.user?.id : undefined;

    const { rows, clientName } = await computeClientReportRows(
      clientId,
      startDate,
      endDate,
      foremanId,
      empId
    );

    res.json({
      success: true,
      clientName,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      hours: rows,
    });
  } catch (err) {
    console.error('Hours report error:', err);
    res.status(500).json({ error: 'Ошибка формирования отчёта по часам' });
  }
});

/**
 * Server-generated CSV Report
 */
clientRouter.get('/reports/csv', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const startDateStr = req.query['startDate'] as string;
    const endDateStr = req.query['endDate'] as string;
    const empId = req.query['empId'] as string | undefined;

    const startDate = startDateStr ? parseClientDateTime(startDateStr) : new Date(Date.now() - 30 * 86400000);
    const endDate = endDateStr ? parseClientDateTime(endDateStr) : new Date();

    const isForeman = req.user?.role === 'foreman';
    const foremanId = isForeman ? req.user?.id : undefined;

    const { rows, clientName } = await computeClientReportRows(
      clientId,
      startDate,
      endDate,
      foremanId,
      empId
    );

    const csvData = generateCsvReport(rows, clientName);
    const filename = `Report_${clientName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${startDate.toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvData);
  } catch (err) {
    console.error('CSV report error:', err);
    res.status(500).json({ error: 'Ошибка генерации CSV' });
  }
});

/**
 * Server-generated PDF Report
 */
clientRouter.get('/reports/pdf', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const startDateStr = req.query['startDate'] as string;
    const endDateStr = req.query['endDate'] as string;
    const empId = req.query['empId'] as string | undefined;

    const startDate = startDateStr ? parseClientDateTime(startDateStr) : new Date(Date.now() - 30 * 86400000);
    const endDate = endDateStr ? parseClientDateTime(endDateStr) : new Date();

    const isForeman = req.user?.role === 'foreman';
    const foremanId = isForeman ? req.user?.id : undefined;

    const { rows, clientName, logoUrl } = await computeClientReportRows(
      clientId,
      startDate,
      endDate,
      foremanId,
      empId
    );

    const lang = (req.query['lang'] as string) || 'he';
    const sDate = startDateStr || startDate.toISOString().slice(0, 10);
    const eDate = endDateStr || endDate.toISOString().slice(0, 10);
    const periodTitle = `${formatIsoToDisplayDate(sDate)} - ${formatIsoToDisplayDate(eDate)}`;
    let singleEmpName: string | null = null;
    if (empId) {
      singleEmpName = rows.find((r) => r.empId === empId)?.name || null;
      if (!singleEmpName) {
        const empRecord = await prisma.employee.findFirst({
          where: { empId, clientId },
          select: { name: true },
        });
        singleEmpName = empRecord?.name || null;
      }
    }
    const pdfBytes = await generatePdfReport(rows, clientName, periodTitle, logoUrl, lang, singleEmpName);
    const filename = `Report_${(singleEmpName || clientName).replace(/[^a-zA-Z0-9_-]/g, '_')}_${sDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('PDF report error:', err);
    res.status(500).json({ error: 'Ошибка генерации PDF' });
  }
});

/**
 * 12. Notes & Expenses
 */
clientRouter.get('/notes', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const date = (req.query['date'] as string) || getJerusalemParts(new Date()).dateStr;

    const notes = await prisma.dailyNote.findMany({
      where: { clientId, date },
      include: { employee: { select: { empId: true, name: true } } },
    });

    res.json({ success: true, notes });
  } catch (err) {
    console.error('Get notes error:', err);
    res.status(500).json({ error: 'Ошибка получения заметок' });
  }
});

clientRouter.post('/notes', async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const { empId, date, noteText, expense } = req.body;

    const employee = await prisma.employee.findFirst({
      where: { empId, clientId },
    });

    const note = await prisma.dailyNote.create({
      data: {
        clientId,
        empId,
        employeeId: employee?.id || null,
        date,
        noteText,
        expense: expense ? parseFloat(expense) : 0,
      },
    });

    res.json({ success: true, note });
  } catch (err) {
    console.error('Create note error:', err);
    res.status(500).json({ error: 'Ошибка сохранения заметки' });
  }
});

/**
 * -------------------------------------------------------------
 * 13. WORK SITES (ОБЪЕКТЫ / РАБОЧИЕ МЕСТА)
 * -------------------------------------------------------------
 */

// List sites with employee counts and assigned employees
clientRouter.get('/sites', requireRole('client', 'foreman'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const sites = await prisma.workSite.findMany({
      where: { clientId },
      include: {
        employees: {
          include: {
            employee: {
              select: { id: true, empId: true, name: true },
            },
          },
        },
        _count: {
          select: { employees: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, sites });
  } catch (err) {
    console.error('List sites error:', err);
    res.status(500).json({ error: 'Ошибка получения списка объектов' });
  }
});

const siteSchema = z.object({
  name: z.string().min(2),
  address: z.string().optional().nullable(),
  lat: z.number(),
  lng: z.number(),
  radius: z.number().int().min(10).default(100),
  employeeIds: z.array(z.number()).optional(),
});

// Create site
clientRouter.post('/sites', requireRole('client', 'foreman'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const data = siteSchema.parse(req.body);

    const site = await prisma.workSite.create({
      data: {
        clientId,
        name: data.name,
        address: data.address || null,
        lat: data.lat,
        lng: data.lng,
        radius: data.radius,
      },
      include: {
        employees: {
          include: { employee: true },
        },
      },
    });

    if (data.employeeIds && data.employeeIds.length > 0) {
      await prisma.employeeSite.createMany({
        data: data.employeeIds.map((empDbId) => ({
          employeeId: empDbId,
          siteId: site.id,
        })),
      });
    }

    res.json({ success: true, site });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Заполните данные объекта корректно' });
      return;
    }
    console.error('Create site error:', err);
    res.status(500).json({ error: 'Ошибка создания объекта' });
  }
});

// Update site
clientRouter.put('/sites/:id', requireRole('client', 'foreman'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const id = req.params['id'] as string;
    const { name, address, lat, lng, radius, employeeIds } = req.body;

    const existing = await prisma.workSite.findFirst({ where: { id, clientId } });
    if (!existing) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    const updated = await prisma.workSite.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(address !== undefined ? { address } : {}),
        ...(typeof lat === 'number' ? { lat } : {}),
        ...(typeof lng === 'number' ? { lng } : {}),
        ...(typeof radius === 'number' ? { radius } : {}),
      },
    });

    if (employeeIds !== undefined && Array.isArray(employeeIds)) {
      await prisma.employeeSite.deleteMany({ where: { siteId: id } });
      if (employeeIds.length > 0) {
        await prisma.employeeSite.createMany({
          data: employeeIds.map((empDbId: number) => ({
            employeeId: empDbId,
            siteId: id,
          })),
        });
      }
    }

    res.json({ success: true, site: updated });
  } catch (err) {
    console.error('Update site error:', err);
    res.status(500).json({ error: 'Ошибка обновления объекта' });
  }
});

// Delete site
clientRouter.delete('/sites/:id', requireRole('client', 'foreman'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const id = req.params['id'] as string;

    const existing = await prisma.workSite.findFirst({ where: { id, clientId } });
    if (!existing) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    await prisma.workSite.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete site error:', err);
    res.status(500).json({ error: 'Ошибка удаления объекта' });
  }
});

// Assign employees to site
clientRouter.post('/sites/:id/employees', requireRole('client', 'foreman'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const id = req.params['id'] as string;
    const { employeeIds } = req.body;

    const existing = await prisma.workSite.findFirst({ where: { id, clientId } });
    if (!existing) {
      res.status(404).json({ error: 'Объект не найден' });
      return;
    }

    if (!Array.isArray(employeeIds)) {
      res.status(400).json({ error: 'employeeIds должен быть массивом' });
      return;
    }

    await prisma.employeeSite.deleteMany({ where: { siteId: id } });
    if (employeeIds.length > 0) {
      await prisma.employeeSite.createMany({
        data: employeeIds.map((empDbId: number) => ({
          employeeId: empDbId,
          siteId: id,
        })),
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Assign employees to site error:', err);
    res.status(500).json({ error: 'Ошибка назначения сотрудников на объект' });
  }
});
