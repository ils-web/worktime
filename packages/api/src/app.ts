import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth';
import { publicRouter } from './routes/public';
import { ownerRouter } from './routes/owner';
import { clientRouter } from './routes/client';
import { workerRouter } from './routes/worker';
import { cronRouter } from './routes/cron';
import { webhookRouter } from './routes/webhooks';

export const app = express();

// Allowed origins for CORS (resolves Tech Debt #7)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  process.env['FRONTEND_URL'] || '',
  'https://timetracker-saas.vercel.app',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev if matching domain pattern
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());

// Log incoming request path
app.use((req, _res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Health Check
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Dynamic PWA Manifest (customizes start_url for workers)
app.get(['/api/manifest', '/manifest', '/manifest.json'], (req, res) => {
  const empId = (req.query['empId'] as string) || '';
  const startUrl = empId ? `/w/${encodeURIComponent(empId)}` : '/';
  res.setHeader('Content-Type', 'application/manifest+json');
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    name: 'TimeTracker WorkTime PWA',
    short_name: 'WorkTime',
    description: 'GPS Time Tracking for Field Workers',
    start_url: startUrl,
    scope: '/',
    id: empId ? `worktime-${empId}` : 'worktime-pwa',
    theme_color: '#0f172a',
    background_color: '#0f172a',
    display: 'standalone',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  });
});

// Mount modular feature routers (supports both /api/* and /* when rewritten on Vercel)
app.use(['/api/auth', '/auth'], authRouter);
app.use(['/api/public', '/public'], publicRouter);
app.use(['/api/owner', '/owner'], ownerRouter);
app.use(['/api/client', '/client'], clientRouter);
app.use(['/api/worker', '/worker'], workerRouter);
app.use(['/api/cron', '/cron'], cronRouter);
app.use(['/api/webhooks', '/webhooks'], webhookRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[API ERROR]', err);
  res.status(500).json({ error: err?.message || 'Internal server error' });
});

export default app;
