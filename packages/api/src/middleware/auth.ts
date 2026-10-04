import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';
import { AuthUserSession, Role } from '@timetracker/shared';
import { prisma } from '@timetracker/db';

// Extend Express Request to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: AuthUserSession;
    }
  }
}

export function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
  }
  return secret;
}

export function signSessionToken(payload: AuthUserSession): string {
  const secret = getJwtSecret();
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

export function verifySessionToken(token: string): AuthUserSession {
  const secret = getJwtSecret();
  return jwt.verify(token, secret) as AuthUserSession;
}

export function extractSessionFromCookies(cookieHeader?: string): AuthUserSession | null {
  if (!cookieHeader) return null;
  const cookies = parse(cookieHeader);
  const sessionToken = cookies['session'];
  if (!sessionToken) return null;

  try {
    return verifySessionToken(sessionToken);
  } catch {
    return null;
  }
}

/**
 * Authentication Middleware:
 * Reads httpOnly session cookie (or Authorization header for API testing).
 */
export async function authRequired(req: Request, res: Response, next: NextFunction) {
  let token: string | undefined;

  // 1. Check httpOnly cookie
  if (req.cookies && req.cookies['session']) {
    token = req.cookies['session'];
  } else if (req.headers.cookie) {
    const parsed = parse(req.headers.cookie);
    token = parsed['session'];
  }

  // 2. Fallback to Bearer token for programmatic API access / tests
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized: No active session' });
    return;
  }

  try {
    const user = verifySessionToken(token);
    req.user = user;

    // Check if client/foreman and if account is active / trial not expired
    if (user.role === 'client' || user.role === 'foreman') {
      const clientId = user.clientId ?? user.id;
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { isActive: true, trialEndsAt: true },
      });

      if (!client || !client.isActive) {
        res.status(403).json({ error: 'Account is deactivated', errorCode: 'ACCOUNT_DISABLED' });
        return;
      }

      if (client.trialEndsAt && new Date() > new Date(client.trialEndsAt)) {
        res.status(403).json({ error: 'Trial expired', errorCode: 'TRIAL_EXPIRED' });
        return;
      }
    }

    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
  }
}

/**
 * Role-Based Access Control Middleware
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
      return;
    }
    next();
  };
}
