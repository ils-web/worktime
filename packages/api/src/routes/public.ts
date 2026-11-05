import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@timetracker/db';
import {
  DEFAULT_COMPANY_POSITIONS,
  ClientShiftsConfig,
  PayrollSystemId,
  PayrollCodesConfig,
  getJerusalemParts,
  jerusalemDateTimeToDate,
} from '@timetracker/shared';
import { signSessionToken } from '../middleware/auth';
import { computeClientReportRows } from './client';
import {
  aggregateMonthlyPayroll,
  generatePayrollExportFile,
  DEFAULT_PAYROLL_CODES,
} from '../services/payrollIntegrationService';

export const publicRouter = Router();

const contactSchema = z.object({
  name: z.string().min(1),
  company: z.string().optional(),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().optional(),
});

/**
 * Public landing lead form
 */
publicRouter.post('/contact', async (req: Request, res: Response) => {
  try {
    const data = contactSchema.parse(req.body);

    const contact = await prisma.contactRequest.create({
      data: {
        name: data.name,
        company: data.company || null,
        phone: data.phone,
        email: data.email || null,
        message: data.message || null,
      },
    });

    res.json({ success: true, id: contact.id });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Пожалуйста, заполните обязательные поля (имя и телефон)' });
      return;
    }
    console.error('Contact error:', err);
    res.status(500).json({ error: 'Ошибка сохранения заявки' });
  }
});

const registerSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  name: z.string().min(2),
  phone: z.string().optional(),
});

/**
 * Self-registration for new Client (starts 14-day trial)
 */
publicRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);

    const existing = await prisma.client.findUnique({
      where: { username: data.username },
    });

    if (existing) {
      res.status(400).json({ error: 'Пользователь с таким логином уже существует' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    const defaultShifts = {
      morning: { start: '07:00', end: '16:00' },
      evening: { start: '16:00', end: '00:00' },
      night: { start: '00:00', end: '07:00' },
    };

    const client = await prisma.client.create({
      data: {
        username: data.username,
        passwordHash,
        name: data.name,
        trialEndsAt,
        defaultShifts,
        positions: DEFAULT_COMPANY_POSITIONS,
      },
    });

    // Auto-login newly registered client
    const token = signSessionToken({
      id: client.id,
      role: 'client',
      name: client.name,
      clientId: client.id,
    });

    const isProd = process.env['NODE_ENV'] === 'production';
    res.cookie('session', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      success: true,
      role: 'client',
      clientId: client.id,
      name: client.name,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Логин должен быть от 3 символов, пароль от 6 символов' });
      return;
    }
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

/**
 * External ERP / Payroll API v1 (Priority, Rivhit, Hilan, Michpal, Make/Zapier)
 * GET /api/public/v1/payroll?apiKey=...&month=YYYY-MM&system=api|priority|michpal|...
 */
publicRouter.get('/v1/payroll', async (req: Request, res: Response) => {
  try {
    const apiKey =
      (req.query['apiKey'] as string) ||
      (req.headers['x-api-key'] as string) ||
      '';

    if (!apiKey || !apiKey.startsWith('tw_')) {
      res.status(401).json({ error: 'Missing or invalid API Key (tw_...)' });
      return;
    }

    const clients = await prisma.client.findMany({
      select: { id: true, name: true, taxId: true, defaultShifts: true },
    });

    const matchedClient = clients.find((c) => {
      const shifts = c.defaultShifts as unknown as ClientShiftsConfig | null;
      const savedKey = shifts?.payrollConfig?.apiKey;
      const defaultKey = `tw_${c.id.slice(0, 6)}_${crypto
        .createHash('sha256')
        .update(`${c.id}_payroll_secret`)
        .digest('hex')
        .slice(0, 20)}`;
      return savedKey === apiKey || defaultKey === apiKey;
    });

    if (!matchedClient) {
      res.status(403).json({ error: 'Invalid API Key' });
      return;
    }

    const now = new Date();
    const currentMonth = getJerusalemParts(now).dateStr.slice(0, 7);
    const monthParam = req.query['month'] as string | undefined;
    const periodMonth =
      monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonth;

    const [yStr, mStr] = periodMonth.split('-');
    const year = parseInt(yStr!, 10);
    const month = parseInt(mStr!, 10);
    const lastDay = new Date(year, month, 0).getDate();

    const startDate = jerusalemDateTimeToDate(`${periodMonth}-01`, '00:00');
    const endDate = jerusalemDateTimeToDate(
      `${periodMonth}-${String(lastDay).padStart(2, '0')}`,
      '23:59'
    );

    const [reportData, employees, notes] = await Promise.all([
      computeClientReportRows(matchedClient.id, startDate, endDate),
      prisma.employee.findMany({
        where: { clientId: matchedClient.id },
        select: { empId: true, name: true },
      }),
      prisma.dailyNote.findMany({
        where: {
          clientId: matchedClient.id,
          date: {
            gte: `${periodMonth}-01`,
            lte: `${periodMonth}-${String(lastDay).padStart(2, '0')}`,
          },
        },
        select: { empId: true, expense: true },
      }),
    ]);

    const expensesByEmpId = new Map<string, number>();
    for (const n of notes) {
      if (n.expense && n.expense > 0) {
        expensesByEmpId.set(n.empId, (expensesByEmpId.get(n.empId) || 0) + n.expense);
      }
    }

    const shiftsObj = (matchedClient.defaultShifts as unknown as ClientShiftsConfig) || null;
    const payrollConfig: PayrollCodesConfig = {
      ...DEFAULT_PAYROLL_CODES,
      companyCode: matchedClient.taxId || DEFAULT_PAYROLL_CODES.companyCode,
      ...(shiftsObj?.payrollConfig || {}),
    };

    const summaries = aggregateMonthlyPayroll(reportData.rows, expensesByEmpId, employees);
    const system = ((req.query['system'] as string) || 'api') as PayrollSystemId;

    const exported = generatePayrollExportFile({
      system,
      periodMonth,
      clientName: matchedClient.name,
      summaries,
      dailyRows: reportData.rows,
      codes: payrollConfig,
    });

    res.setHeader('Content-Type', exported.contentType);
    if (system !== 'api') {
      res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    }
    res.send(exported.content);
  } catch (err) {
    console.error('Public API v1 payroll error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
