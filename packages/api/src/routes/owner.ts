import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@timetracker/db';
import { calculateClientBilling } from '@timetracker/shared';
import { authRequired, requireRole } from '../middleware/auth';

export const ownerRouter = Router();

// Protect all owner routes
ownerRouter.use(authRequired, requireRole('owner'));

/**
 * List all clients with employee count & status
 */
ownerRouter.get('/clients', async (_req: Request, res: Response) => {
  try {
    const clients = await prisma.client.findMany({
      include: {
        _count: {
          select: { employees: true, foremen: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, clients });
  } catch (err) {
    console.error('Owner list clients error:', err);
    res.status(500).json({ error: 'Ошибка получения списка клиентов' });
  }
});

const createClientSchema = z.object({
  username: z.string().min(3),
  password: z.string().min(6),
  name: z.string().min(2),
  tariffMode: z.enum(['PER_USER', 'PER_HOUR']).default('PER_USER'),
  pricePerUser: z.number().default(0),
  pricePerHour: z.number().default(0),
  trialDays: z.number().default(14),
});

/**
 * Create a new client tenant
 */
ownerRouter.post('/clients', async (req: Request, res: Response) => {
  try {
    const data = createClientSchema.parse(req.body);

    const existing = await prisma.client.findUnique({
      where: { username: data.username },
    });
    if (existing) {
      res.status(400).json({ error: 'Клиент с таким логином уже существует' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);
    const trialEndsAt = new Date(Date.now() + data.trialDays * 24 * 60 * 60 * 1000);

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
        tariffMode: data.tariffMode,
        pricePerUser: data.pricePerUser,
        pricePerHour: data.pricePerHour,
        trialEndsAt,
        defaultShifts,
      },
    });

    res.json({ success: true, client });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Проверьте введённые данные' });
      return;
    }
    console.error('Owner create client error:', err);
    res.status(500).json({ error: 'Ошибка создания клиента' });
  }
});

/**
 * Toggle client active status (block / unblock)
 */
ownerRouter.post('/clients/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      res.status(404).json({ error: 'Клиент не найден' });
      return;
    }

    const updated = await prisma.client.update({
      where: { id },
      data: { isActive: !client.isActive },
    });

    res.json({ success: true, isActive: updated.isActive });
  } catch (err) {
    console.error('Owner toggle client error:', err);
    res.status(500).json({ error: 'Ошибка переключения статуса' });
  }
});

/**
 * Reset client password
 */
ownerRouter.post('/clients/:id/reset-password', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'Пароль должен быть от 6 символов' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    await prisma.client.update({
      where: { id },
      data: { passwordHash },
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Owner reset password error:', err);
    res.status(500).json({ error: 'Ошибка сброса пароля' });
  }
});

/**
 * Update client tariff and trial settings
 */
ownerRouter.post('/clients/:id/tariff', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const { tariffMode, pricePerUser, pricePerHour, trialEndsAt } = req.body;

    const updated = await prisma.client.update({
      where: { id },
      data: {
        ...(tariffMode ? { tariffMode } : {}),
        ...(typeof pricePerUser === 'number' ? { pricePerUser } : {}),
        ...(typeof pricePerHour === 'number' ? { pricePerHour } : {}),
        ...(trialEndsAt !== undefined ? { trialEndsAt: trialEndsAt ? new Date(trialEndsAt) : null } : {}),
      },
    });

    res.json({ success: true, client: updated });
  } catch (err) {
    console.error('Owner update tariff error:', err);
    res.status(500).json({ error: 'Ошибка обновления тарифа' });
  }
});

/**
 * Delete client organization and all associated data (Cascade)
 */
ownerRouter.delete('/clients/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      res.status(404).json({ error: 'Компания не найдена' });
      return;
    }

    await prisma.client.delete({ where: { id } });
    res.json({ success: true, message: `Компания "${client.name}" успешно удалена` });
  } catch (err) {
    console.error('Owner delete client error:', err);
    res.status(500).json({ error: 'Ошибка удаления компании' });
  }
});

/**
 * Bulk delete all test companies (username starts with 'testclient_' or name contains 'Тестовая')
 */
ownerRouter.post('/clients/cleanup-test', async (_req: Request, res: Response) => {
  try {
    const result = await prisma.client.deleteMany({
      where: {
        OR: [
          { username: { startsWith: 'testclient_' } },
          { name: { contains: 'Тестовая' } },
        ],
      },
    });

    res.json({ success: true, count: result.count });
  } catch (err) {
    console.error('Owner cleanup test clients error:', err);
    res.status(500).json({ error: 'Ошибка очистки тестовых компаний' });
  }
});

/**
 * Billing preview calculation across clients
 */
ownerRouter.get('/billing', async (req: Request, res: Response) => {
  try {
    const startDateStr = req.query['startDate'] as string;
    const endDateStr = req.query['endDate'] as string;

    const startDate = startDateStr ? new Date(startDateStr) : new Date(Date.now() - 30 * 86400000);
    const endDate = endDateStr ? new Date(endDateStr) : new Date();

    const clients = await prisma.client.findMany({
      include: {
        employees: {
          select: { empId: true, createdAt: true },
        },
        logs: {
          where: {
            dateTime: { gte: startDate, lte: endDate },
          },
          select: { empId: true, action: true, dateTime: true },
          orderBy: { dateTime: 'asc' },
        },
      },
    });

    const billingData = clients.map((client) => {
      // Approximate hours from CLOCK_IN to CLOCK_OUT pairs
      let totalHours = 0;
      let lastInTime: Date | null = null;
      for (const log of client.logs) {
        if (log.action === 'CLOCK_IN') {
          lastInTime = log.dateTime;
        } else if (log.action === 'CLOCK_OUT' || log.action === 'AUTO_EXIT') {
          if (lastInTime) {
            const diff = (log.dateTime.getTime() - lastInTime.getTime()) / 3600000;
            if (diff > 0 && diff < 24) {
              totalHours += diff;
            }
            lastInTime = null;
          }
        }
      }

      const calculated = calculateClientBilling({
        tariffMode: client.tariffMode,
        employees: client.employees,
        period: { startDate, endDate },
        pricePerUser: client.pricePerUser,
        totalHours,
        pricePerHour: client.pricePerHour,
      });

      return {
        clientId: client.id,
        name: client.name,
        tariffMode: client.tariffMode,
        totalWorkerDays: calculated.totalWorkerDays,
        totalHours: calculated.totalHours,
        totalAmount: calculated.totalAmount,
      };
    });

    res.json({ success: true, billing: billingData });
  } catch (err) {
    console.error('Owner billing error:', err);
    res.status(500).json({ error: 'Ошибка расчета биллинга' });
  }
});

/**
 * Invoices list & management
 */
ownerRouter.get('/invoices', async (_req: Request, res: Response) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: { client: { select: { name: true, username: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, invoices });
  } catch (err) {
    console.error('Owner invoices error:', err);
    res.status(500).json({ error: 'Ошибка получения счетов' });
  }
});

ownerRouter.post('/invoices', async (req: Request, res: Response) => {
  try {
    const { clientId, periodMonth, amount, details } = req.body;
    if (!clientId || !periodMonth || typeof amount !== 'number') {
      res.status(400).json({ error: 'Необходимо указать clientId, periodMonth и amount' });
      return;
    }

    const invoice = await prisma.invoice.upsert({
      where: {
        clientId_periodMonth: { clientId, periodMonth },
      },
      update: { amount, details },
      create: { clientId, periodMonth, amount, details },
    });

    res.json({ success: true, invoice });
  } catch (err) {
    console.error('Owner create invoice error:', err);
    res.status(500).json({ error: 'Ошибка создания счёта' });
  }
});

ownerRouter.post('/invoices/:id/toggle', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const inv = await prisma.invoice.findUnique({ where: { id } });
    if (!inv) {
      res.status(404).json({ error: 'Счёт не найден' });
      return;
    }

    const newStatus = inv.status === 'paid' ? 'pending' : 'paid';
    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        status: newStatus,
        paidAt: newStatus === 'paid' ? new Date() : null,
      },
    });

    res.json({ success: true, invoice: updated });
  } catch (err) {
    console.error('Owner toggle invoice error:', err);
    res.status(500).json({ error: 'Ошибка изменения статуса счета' });
  }
});

ownerRouter.delete('/invoices/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    await prisma.invoice.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Owner delete invoice error:', err);
    res.status(500).json({ error: 'Ошибка удаления счёта' });
  }
});

/**
 * Leads (Landing Contact Requests)
 */
ownerRouter.get('/leads', async (_req: Request, res: Response) => {
  try {
    const leads = await prisma.contactRequest.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, leads });
  } catch (err) {
    console.error('Owner leads error:', err);
    res.status(500).json({ error: 'Ошибка получения заявок' });
  }
});

ownerRouter.post('/leads/:id/comment', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    const { comment, status } = req.body;

    const updated = await prisma.contactRequest.update({
      where: { id },
      data: {
        ...(comment !== undefined ? { comment } : {}),
        ...(status ? { status } : {}),
      },
    });

    res.json({ success: true, lead: updated });
  } catch (err) {
    console.error('Owner comment lead error:', err);
    res.status(500).json({ error: 'Ошибка обновления заявки' });
  }
});

ownerRouter.delete('/leads/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params['id'] as string, 10);
    await prisma.contactRequest.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error('Owner delete lead error:', err);
    res.status(500).json({ error: 'Ошибка удаления заявки' });
  }
});

/**
 * Change owner password
 */
ownerRouter.post('/password', async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      res.status(400).json({ error: 'Пароль должен быть от 6 символов' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const ownerPasswordHash = await bcrypt.hash(newPassword, salt);

    const first = await prisma.saaSSettings.findFirst();
    if (first) {
      await prisma.saaSSettings.update({
        where: { id: first.id },
        data: { ownerPasswordHash },
      });
    } else {
      await prisma.saaSSettings.create({
        data: { ownerPasswordHash },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Owner change password error:', err);
    res.status(500).json({ error: 'Ошибка смены пароля' });
  }
});
