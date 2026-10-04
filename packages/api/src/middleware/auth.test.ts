import { describe, it, expect, beforeEach } from 'vitest';
import {
  signSessionToken,
  verifySessionToken,
  extractSessionFromCookies,
} from './auth';

describe('Auth Middleware & Session Token', () => {
  beforeEach(() => {
    process.env['JWT_SECRET'] = 'test-secret-key-12345678901234567890';
  });

  it('signs and verifies user session JWT token', () => {
    const payload = {
      id: 'client-1',
      role: 'client' as const,
      name: 'Test Client',
      clientId: 'client-1',
    };

    const token = signSessionToken(payload);
    expect(token).toBeDefined();

    const decoded = verifySessionToken(token);
    expect(decoded.id).toBe('client-1');
    expect(decoded.role).toBe('client');
    expect(decoded.name).toBe('Test Client');
  });

  it('extracts session token from cookie header', () => {
    const payload = {
      id: 'owner-1',
      role: 'owner' as const,
      name: 'Owner',
    };

    const token = signSessionToken(payload);
    const cookieHeader = `session=${token}; Path=/; HttpOnly`;

    const extracted = extractSessionFromCookies(cookieHeader);
    expect(extracted).not.toBeNull();
    expect(extracted?.role).toBe('owner');
  });

  it('returns null on invalid or missing cookie', () => {
    expect(extractSessionFromCookies('')).toBeNull();
    expect(extractSessionFromCookies('session=invalid-token')).toBeNull();
    expect(extractSessionFromCookies('other_cookie=xyz')).toBeNull();
  });
});
