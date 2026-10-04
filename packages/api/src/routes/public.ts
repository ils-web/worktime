import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@timetracker/db';
import { signSessionToken } from '../middleware/auth';

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
