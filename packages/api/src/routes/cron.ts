import { Router, Request, Response } from 'express';
import { prisma } from '@timetracker/db';
import { calculateClientBilling } from '@timetracker/shared';

export const cronRouter = Router();

function verifyCronSecret(req: Request): boolean {
  const cronSecret = process.env['CRON_SECRET'];
  if (!cronSecret) {
    return false;
  }

  // Check Authorization Bearer header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    if (token === cronSecret) return true;
  }

  // Check Vercel Cron header (if verified by Vercel infrastructure)
  const vercelCronHeader = req.headers['x-vercel-cron'];
  if (vercelCronHeader) {
    // Also require CRON_SECRET if header is passed
    const customSecret = req.headers['x-cron-secret'];
    if (customSecret === cronSecret) return true;
  }

  return false;
}

/**
 * Monthly billing cron endpoint.
 * Generates invoices for the previous calendar month.
 */
cronRouter.get('/billing', async (req: Request, res: Response) => {
  if (!verifyCronSecret(req)) {
    res.status(401).json({ error: 'Unauthorized: Invalid cron secret' });
    return;
  }

  try {
    // Calculate previous calendar month in UTC
    const now = new Date();
    const prevMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const year = prevMonthDate.getUTCFullYear();
    const month = String(prevMonthDate.getUTCMonth() + 1).padStart(2, '0');
    const periodMonth = `${year}-${month}`; // YYYY-MM

    const startDate = new Date(Date.UTC(year, prevMonthDate.getUTCMonth(), 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, prevMonthDate.getUTCMonth() + 1, 0, 23, 59, 59));

    const clients = await prisma.client.findMany({
      where: { isActive: true },
      include: {
        employees: {
          select: { empId: true, createdAt: true },
        },
        logs: {
          where: {
            dateTime: { gte: startDate, lte: endDate },
          },
          orderBy: { dateTime: 'asc' },
        },
        invoices: {
          where: { periodMonth },
        },
      },
    });

    const generatedInvoices: any[] = [];

    for (const client of clients) {
      // Check if invoice already exists (idempotency guard)
      if (client.invoices.length > 0) {
        continue;
      }

      // Calculate total hours
      let totalHours = 0;
      let lastIn: Date | null = null;
      for (const log of client.logs) {
        if (log.action === 'CLOCK_IN') {
          lastIn = log.dateTime;
        } else if (log.action === 'CLOCK_OUT' || log.action === 'AUTO_EXIT') {
          if (lastIn) {
            const diff = (log.dateTime.getTime() - lastIn.getTime()) / 3600000;
            if (diff > 0 && diff < 24) totalHours += diff;
            lastIn = null;
          }
        }
      }

      const billing = calculateClientBilling({
        tariffMode: client.tariffMode,
        employees: client.employees,
        period: { startDate, endDate },
        pricePerUser: client.pricePerUser,
        totalHours,
        pricePerHour: client.pricePerHour,
      });

      const invoice = await prisma.invoice.create({
        data: {
          clientId: client.id,
          periodMonth,
          amount: billing.totalAmount,
          status: 'pending',
          details: {
            tariffMode: client.tariffMode,
            totalWorkerDays: billing.totalWorkerDays,
            totalHours: billing.totalHours,
            pricePerUser: client.pricePerUser,
            pricePerHour: client.pricePerHour,
          },
        },
      });

      generatedInvoices.push({
        clientId: client.id,
        clientName: client.name,
        periodMonth,
        amount: invoice.amount,
      });
    }

    res.json({
      success: true,
      periodMonth,
      generatedCount: generatedInvoices.length,
      invoices: generatedInvoices,
    });
  } catch (err) {
    console.error('Billing cron error:', err);
    res.status(500).json({ error: 'Ошибка выполнения биллинг-cron' });
  }
});
