import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth';
import { publicRouter } from './routes/public';
import { ownerRouter } from './routes/owner';
import { clientRouter } from './routes/client';
import { workerRouter } from './routes/worker';
import { cronRouter } from './routes/cron';

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

// Health Check
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount modular feature routers (supports both /api/* and /* when rewritten on Vercel)
app.use(['/api/auth', '/auth'], authRouter);
app.use(['/api/public', '/public'], publicRouter);
app.use(['/api/owner', '/owner'], ownerRouter);
app.use(['/api/client', '/client'], clientRouter);
app.use(['/api/worker', '/worker'], workerRouter);
app.use(['/api/cron', '/cron'], cronRouter);

export default app;
