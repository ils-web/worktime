# TimeTracker SaaS v2 ⏱️📍

Production-grade GPS-enabled field worker time tracking SaaS platform built on modern TypeScript stack.

## Tech Stack

- **Frontend:** React 18, Vite, TypeScript, Tailwind CSS, Vite PWA
- **Database:** Serverless PostgreSQL on Neon, Prisma ORM
- **Backend:** Vercel Serverless Functions (Modular TypeScript)
- **Monorepo:** npm workspaces (`apps/web`, `packages/api`, `packages/db`, `packages/shared`)

---

## Monorepo Structure

```
.
├── apps/
│   └── web/                # React 18 + Vite SPA & Worker PWA
├── packages/
│   ├── api/                # Modular serverless API routes
│   ├── db/                 # Prisma schema & Neon serverless client
│   └── shared/             # Domain models & pure business calculation rules
├── vercel.json             # Single deployment config
└── package.json            # npm workspaces root
```

---

## Getting Started

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and fill in credentials:
```bash
cp .env.example .env
```

### 3. Generate Prisma Client
```bash
npm run db:generate
```

### 4. Run Development Server
```bash
npm run dev
```

### 5. Run Tests
```bash
npm test
```

---

## Business Rules Highlights

- **Asia/Jerusalem Timezone**: All shift, night hours, and Saturday calculations are evaluated strictly in `Asia/Jerusalem`.
- **Night Hours**: Minute-by-minute evaluation of interval within the night window, including overnight shifts crossing midnight.
- **Saturday Hours**: If clock-in OR clock-out falls on Saturday (`day === 6`), entire shift hours count as Saturday hours.
- **Daily Overtime**: Hours exceeding 9 hours per calendar day count as overtime.
- **Auto Lunch Deduction**: 0.5 hour deducted if total daily hours >= 6 and no 30+ minute gap between sessions.
- **Haversine Geofence**: Strict radius verification in meters. Mobile workers bypass geofence checks.
