import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@timetracker/db';
import { AuthUserSession } from '@timetracker/shared';
import { signSessionToken, authRequired } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimit';

export const authRouter = Router();

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

/**
 * Universal login for Owner, Client, and Foreman.
 * Sets httpOnly cookie 'session' upon success.
 */
authRouter.post('/login', rateLimiter({ max: 20 }), async (req: Request, res: Response) => {
  try {
    const { username, password } = loginSchema.parse(req.body);

    let sessionUser: AuthUserSession | null = null;

    // 1. Check Owner login
    if (username.toLowerCase() === 'admin' || username.toLowerCase() === 'owner') {
      let settings = await prisma.saaSSettings.findFirst();
      
      // Auto-initialize default owner settings on fresh database
      if (!settings) {
        const defaultOwnerPass = process.env['INITIAL_OWNER_PASSWORD'] || 'admin123';
        const salt = await bcrypt.genSalt(10);
        const ownerPasswordHash = await bcrypt.hash(defaultOwnerPass, salt);
        settings = await prisma.saaSSettings.create({
          data: { ownerPasswordHash },
        });
      }

      const isMatch = await bcrypt.compare(password, settings.ownerPasswordHash);
      if (isMatch) {
        sessionUser = {
          id: 'owner',
          role: 'owner',
          name: 'Владелец системы',
        };
      }
    }

    // 2. Check Client login
    if (!sessionUser) {
      const client = await prisma.client.findUnique({
        where: { username },
      });

      if (client) {
        const isMatch = await bcrypt.compare(password, client.passwordHash);
        if (isMatch) {
          if (!client.isActive) {
            res.status(403).json({ error: 'Аккаунт компании отключен', errorCode: 'ACCOUNT_DISABLED' });
            return;
          }

          if (client.trialEndsAt && new Date() > new Date(client.trialEndsAt)) {
            res.status(403).json({ error: 'Пробный период завершен', errorCode: 'TRIAL_EXPIRED' });
            return;
          }

          sessionUser = {
            id: client.id,
            role: 'client',
            name: client.name,
            clientId: client.id,
          };
        }
      }
    }

    // 3. Check Foreman login
    if (!sessionUser) {
      const foreman = await prisma.foreman.findUnique({
        where: { username },
        include: { client: true },
      });

      if (foreman) {
        const isMatch = await bcrypt.compare(password, foreman.passwordHash);
        if (isMatch) {
          if (!foreman.isActive || !foreman.client.isActive) {
            res.status(403).json({ error: 'Аккаунт бригадира отключен', errorCode: 'ACCOUNT_DISABLED' });
            return;
          }

          if (foreman.client.trialEndsAt && new Date() > new Date(foreman.client.trialEndsAt)) {
            res.status(403).json({ error: 'Пробный период компании завершен', errorCode: 'TRIAL_EXPIRED' });
            return;
          }

          sessionUser = {
            id: foreman.id,
            role: 'foreman',
            name: foreman.name,
            clientId: foreman.clientId,
          };
        }
      }
    }

    if (!sessionUser) {
      res.status(401).json({ error: 'Неверный логин или пароль' });
      return;
    }

    // Generate JWT and set httpOnly cookie
    const token = signSessionToken(sessionUser);
    const isProd = process.env['NODE_ENV'] === 'production';

    res.cookie('session', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      role: sessionUser.role,
      name: sessionUser.name,
      clientId: sessionUser.clientId,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: 'Заполните логин и пароль' });
      return;
    }
    console.error('Login error:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

/**
 * Logout - Clears httpOnly cookie
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('session', { path: '/' });
  res.json({ success: true });
});

/**
 * Returns current authenticated user
 */
authRouter.get('/me', authRequired, (req: Request, res: Response) => {
  res.json({
    success: true,
    user: req.user,
  });
});
