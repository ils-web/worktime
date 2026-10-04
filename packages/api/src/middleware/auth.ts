import jwt from 'jsonwebtoken';
import { parse } from 'cookie';
import { AuthUserSession } from '@timetracker/shared';

export function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret) {
    throw new Error('FATAL: JWT_SECRET environment variable is missing.');
  }
  return secret;
}

export function signSessionToken(payload: AuthUserSession): string {
  const secret = getJwtSecret();
  // 7 days expiration as specified
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
