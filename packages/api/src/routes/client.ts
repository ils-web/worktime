import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@timetracker/db';
import {
  calculateDailyHours,
  getJerusalemParts,
  WorkSession,
  ClientShiftsConfig,
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
  geofence: z.any().optional(),
  shifts: z.any().optional(),
  foremanId: z.string().optional().nullable(),
});

/**
 * 2. Employees: Create (client only)
 */
clientRouter.post('/employees', requireRole('client'), async (req: Request, res: Response) => {
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
        geofence: data.geofence || null,
        shifts: data.shifts || null,
        foremanId: data.foremanId || null,
      },
    });

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
 * 3. Employees: Update (client only)
 */
clientRouter.put('/employees/:empId', requireRole('client'), async (req: Request, res: Response) => {
  try {
    const clientId = getTargetClientId(req);
    const empId = req.params['empId'] as string;
    const { name, isMobile, strictGps, geofence, shifts, foremanId } = req.body;

    const employee = await prisma.employee.findFirst({
      where: { empId, clientId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const updated = await prisma.employee.update({
      where: { id: employee.id },
      data: {
        ...(name ? { name } : {}),
        ...(isMobile !== undefined ? { isMobile } : {}),
        ...(strictGps !== undefined ? { strictGps } : {}),
        ...(geofence !== undefined ? { geofence } : {}),
        ...(shifts !== undefined ? { shifts } : {}),
        ...(foremanId !== undefined ? { foremanId: foremanId || null } : {}),
      },
    });

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
      include: { employee: { select: { name: true } } },
      orderBy: { dateTime: 'desc' },
      take: 50,
    });
    res.json({ success: true, logs });
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
    const { empId, clockIn, clockOut } = req.body;

    const employee = await prisma.employee.findFirst({
      where: { empId, clientId },
    });
    if (!employee) {
      res.status(404).json({ error: 'Сотрудник не найден' });
      return;
    }

    const inTime = new Date(clockIn);
    const outTime = new Date(clockOut);

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

    res.json({ success: true, logIn, logOut });
  } catch (err) {
    console.error('Manual log error:', err);
    res.status(500).json({ error: 'Ошибка ручного добавления смены' });
  }
});

/**
 * 11. Core Hours & Report Calculation Logic
 */
async function computeClientReportRows(
  clientId: string,
  startDate: Date,
  endDate: Date,
  foremanId?: string
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

  const employees = await prisma.employee.findMany({
    where: whereEmp,
    include: {
      logs: {
        where: { dateTime: { gte: startDate, lte: endDate } },
        orderBy: { dateTime: 'asc' },
      },
      dailyNotes: {
        where: {
          date: {
            gte: getJerusalemParts(startDate).dateStr,
            lte: getJerusalemParts(endDate).dateStr,
          },
        },
      },
    },
  });

  const reportRows: ReportRow[] = [];

  for (const emp of employees) {
    // 1. Group logs into sessions (In -> Out)
    const sessions: WorkSession[] = [];
    let currentIn: Date | null = null;

    for (const log of emp.logs) {
      if (log.action === 'CLOCK_IN') {
        currentIn = log.dateTime;
      } else if (log.action === 'CLOCK_OUT' || log.action === 'AUTO_EXIT') {
        if (currentIn) {
          sessions.push({ clockIn: currentIn, clockOut: log.dateTime });
          currentIn = null;
        }
      }
    }

    // 2. Group sessions by calendar date in Asia/Jerusalem
    const sessionsByDate: Record<string, WorkSession[]> = {};
    for (const s of sessions) {
      const parts = getJerusalemParts(s.clockIn);
      const d = parts.dateStr;
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

      reportRows.push({
        empId: emp.empId,
        name: emp.name,
        date: dateStr,
        firstIn: firstInParts.timeStr,
        lastOut: lastOutParts.timeStr,
        grossHours: dailyCalc.grossHours,
        lunchDeducted: dailyCalc.lunchDeductedHours,
        netHours: dailyCalc.netHours,
        nightHours: dailyCalc.nightHours,
        saturdayHours: dailyCalc.saturdayHours,
        overtimeHours: dailyCalc.overtimeHours,
        notes: notesByDate[dateStr] || '',
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

    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 86400000);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    const isForeman = req.user?.role === 'foreman';
    const foremanId = isForeman ? req.user?.id : undefined;

    const { rows, clientName } = await computeClientReportRows(
      clientId,
      startDate,
      endDate,
      foremanId
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

    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 86400000);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    const isForeman = req.user?.role === 'foreman';
    const foremanId = isForeman ? req.user?.id : undefined;

    const { rows, clientName } = await computeClientReportRows(
      clientId,
      startDate,
      endDate,
      foremanId
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

    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 86400000);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    const isForeman = req.user?.role === 'foreman';
    const foremanId = isForeman ? req.user?.id : undefined;

    const { rows, clientName, logoUrl } = await computeClientReportRows(
      clientId,
      startDate,
      endDate,
      foremanId
    );

    const periodTitle = `${startDate.toISOString().slice(0, 10)} - ${endDate.toISOString().slice(0, 10)}`;
    const pdfBytes = await generatePdfReport(rows, clientName, periodTitle, logoUrl);
    const filename = `Report_${clientName.replace(/[^a-zA-Z0-9_-]/g, '_')}_${startDate.toISOString().slice(0, 10)}.pdf`;

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
