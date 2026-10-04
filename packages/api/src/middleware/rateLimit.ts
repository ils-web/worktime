import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();

/**
 * In-memory rate limiting middleware.
 * Prevents brute force login attacks (e.g., max 15 requests per minute per IP).
 */
export function rateLimiter(options: { windowMs?: number; max?: number } = {}) {
  const windowMs = options.windowMs ?? 60 * 1000; // 1 minute
  const max = options.max ?? 15; // 15 requests

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const record = rateLimitMap.get(ip);
    if (!record || now > record.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (record.count >= max) {
      res.status(429).json({
        error: 'Too many requests. Please try again later.',
        errorCode: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    record.count++;
    next();
  };
}
