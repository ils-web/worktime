/**
 * TimeTracker SaaS v2 - Legacy Data Migration Script
 * Migrates data from legacy v1 database schema to modern v2 schema.
 *
 * Usage:
 *   npx ts-node scripts/migrate-legacy-data.ts [--dry-run]
 *
 * Environment variables:
 *   OLD_DATABASE_URL - Connection string to legacy Postgres database
 *   DATABASE_URL     - Connection string to modern Neon v2 database
 */

import { prisma } from '@timetracker/db';
import bcrypt from 'bcryptjs';
import { Pool } from '@neondatabase/serverless';

const isDryRun = process.argv.includes('--dry-run');
const oldDatabaseUrl = process.env['OLD_DATABASE_URL'];

interface MigrationStats {
  saasSettings: number;
  clients: number;
  foremen: number;
  employees: number;
  schedules: number;
  timeLogs: number;
  dailyNotes: number;
  invoices: number;
  pushSubscriptions: number;
  contactRequests: number;
  errors: string[];
}

const stats: MigrationStats = {
  saasSettings: 0,
  clients: 0,
  foremen: 0,
  employees: 0,
  schedules: 0,
  timeLogs: 0,
  dailyNotes: 0,
  invoices: 0,
  pushSubscriptions: 0,
  contactRequests: 0,
  errors: [],
};

// Map legacy action strings to new LogAction enum
function mapLegacyLogAction(rawAction: string): 'CLOCK_IN' | 'CLOCK_OUT' | 'AUTO_PAUSE' | 'AUTO_RESUME' | 'AUTO_EXIT' {
  const norm = (rawAction || '').trim().toLowerCase();
  if (norm === 'вход' || norm === 'clock_in' || norm === 'in') return 'CLOCK_IN';
  if (norm === 'выход' || norm === 'clock_out' || norm === 'out') return 'CLOCK_OUT';
  if (norm.includes('авто-пауза') || norm === 'auto_pause' || norm === 'pause') return 'AUTO_PAUSE';
  if (norm.includes('продолж') || norm === 'auto_resume' || norm === 'resume') return 'AUTO_RESUME';
  if (norm.includes('авто-выход') || norm === 'auto_exit' || norm === 'forced_exit') return 'AUTO_EXIT';
  return 'CLOCK_IN';
}

async function runMigration() {
  console.log('==================================================');
  console.log('   TimeTracker SaaS v2 - Legacy Data Migration    ');
  console.log(`   Mode: ${isDryRun ? 'DRY-RUN (Simulated)' : 'LIVE MIGRATION'} `);
  console.log('==================================================\n');

  if (!oldDatabaseUrl) {
    console.log('ℹ️  OLD_DATABASE_URL is not set.');
    console.log('   Starting fresh database without legacy data (per project instructions).');
    console.log('   To migrate from an existing database, specify:');
    console.log('   OLD_DATABASE_URL=postgres://... npx ts-node scripts/migrate-legacy-data.ts\n');
    return;
  }

  const oldPool = new Pool({ connectionString: oldDatabaseUrl });

  try {
    console.log('Connecting to old database...');
    const client = await oldPool.connect();
    console.log('Connected to old database successfully!\n');

    // 1. SaaSSettings
    console.log('Migrating SaaSSettings...');
    try {
      const res = await client.query('SELECT * FROM "SaaSSettings" LIMIT 1');
      if (res.rows.length > 0) {
        const row = res.rows[0];
        const salt = await bcrypt.genSalt(10);
        const ownerPasswordHash = await bcrypt.hash(row.ownerPassword || 'admin123', salt);

        if (!isDryRun) {
          await prisma.saaSSettings.upsert({
            where: { id: 1 },
            update: {
              ownerPasswordHash,
              notificationEmail: row.notificationEmail || null,
              trialDays: row.trialDays || 14,
              maxEmployeesPerClient: row.maxEmployeesPerClient || 50,
            },
            create: {
              id: 1,
              ownerPasswordHash,
              notificationEmail: row.notificationEmail || null,
              trialDays: row.trialDays || 14,
              maxEmployeesPerClient: row.maxEmployeesPerClient || 50,
            },
          });
        }
        stats.saasSettings++;
      }
    } catch (e: any) {
      stats.errors.push(`SaaSSettings: ${e.message}`);
    }

    // 2. Clients
    console.log('Migrating Clients...');
    try {
      const res = await client.query('SELECT * FROM "Client"');
      for (const row of res.rows) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(row.password || 'client123', salt);

        // Bundle flat shift columns into modern JSON defaultShifts
        const defaultShifts = {
          morning: {
            start: row.shiftMorningStart || '07:00',
            end: row.shiftMorningEnd || '16:00',
          },
          evening: {
            start: row.shiftEveningStart || '16:00',
            end: row.shiftEveningEnd || '00:00',
          },
          night: {
            start: row.shiftNightStart || '00:00',
            end: row.shiftNightEnd || '07:00',
          },
        };

        const tariffMode = (row.tariffMode || '').toLowerCase().includes('hour')
          ? 'PER_HOUR'
          : 'PER_USER';

        if (!isDryRun) {
          await prisma.client.upsert({
            where: { id: row.id },
            update: {
              username: row.username,
              passwordHash,
              name: row.name || row.username,
              logoUrl: row.logoUrl || null,
              isActive: row.isActive ?? true,
              trialEndsAt: row.trialEndsAt ? new Date(row.trialEndsAt) : null,
              defaultShifts,
              tariffMode,
              pricePerUser: parseFloat(row.pricePerUser || 0),
              pricePerHour: parseFloat(row.pricePerHour || 0),
              autoDeductLunch: row.autoDeductLunch ?? false,
              createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
            },
            create: {
              id: row.id,
              username: row.username,
              passwordHash,
              name: row.name || row.username,
              logoUrl: row.logoUrl || null,
              isActive: row.isActive ?? true,
              trialEndsAt: row.trialEndsAt ? new Date(row.trialEndsAt) : null,
              defaultShifts,
              tariffMode,
              pricePerUser: parseFloat(row.pricePerUser || 0),
              pricePerHour: parseFloat(row.pricePerHour || 0),
              autoDeductLunch: row.autoDeductLunch ?? false,
              createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
            },
          });
        }
        stats.clients++;
      }
    } catch (e: any) {
      stats.errors.push(`Clients: ${e.message}`);
    }

    // 3. Foremen
    console.log('Migrating Foremen...');
    try {
      const res = await client.query('SELECT * FROM "Foreman"');
      for (const row of res.rows) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(row.password || 'foreman123', salt);

        if (!isDryRun) {
          await prisma.foreman.upsert({
            where: { id: row.id },
            update: {
              username: row.username,
              passwordHash,
              name: row.name,
              clientId: row.clientId,
              department: row.department || null,
            },
            create: {
              id: row.id,
              username: row.username,
              passwordHash,
              name: row.name,
              clientId: row.clientId,
              department: row.department || null,
            },
          });
        }
        stats.foremen++;
      }
    } catch (e: any) {
      stats.errors.push(`Foremen: ${e.message}`);
    }

    // 4. Employees (formerly Geofence)
    console.log('Migrating Employees (from Geofence)...');
    try {
      const res = await client.query('SELECT * FROM "Geofence"');
      for (const row of res.rows) {
        const isMobile = row.isMobile ?? false;
        const geofence = isMobile
          ? null
          : {
              lat: parseFloat(row.lat || 0),
              lng: parseFloat(row.lng || 0),
              radius: parseFloat(row.radius || 100),
              address: row.address || null,
            };

        if (!isDryRun) {
          await prisma.employee.upsert({
            where: { empId: row.empId },
            update: {
              clientId: row.clientId,
              name: row.name || row.empId,
              isMobile,
              strictGps: row.strictGps ?? false,
              geofence,
              foremanId: row.foremanId || null,
            },
            create: {
              empId: row.empId,
              clientId: row.clientId,
              name: row.name || row.empId,
              isMobile,
              strictGps: row.strictGps ?? false,
              geofence,
              foremanId: row.foremanId || null,
            },
          });
        }
        stats.employees++;
      }
    } catch (e: any) {
      stats.errors.push(`Employees: ${e.message}`);
    }

    // 5. TimeLogs (formerly Log)
    console.log('Migrating TimeLogs (from Log)...');
    try {
      const res = await client.query('SELECT * FROM "Log"');
      for (const row of res.rows) {
        const action = mapLegacyLogAction(row.action);

        if (!isDryRun) {
          await prisma.timeLog.create({
            data: {
              empId: row.empId,
              clientId: row.clientId,
              action,
              lat: row.lat ? parseFloat(row.lat) : null,
              lng: row.lng ? parseFloat(row.lng) : null,
              dateTime: row.dateTime ? new Date(row.dateTime) : new Date(),
              isManual: row.isManual ?? false,
            },
          });
        }
        stats.timeLogs++;
      }
    } catch (e: any) {
      stats.errors.push(`TimeLogs: ${e.message}`);
    }

    // 6. DailyNotes
    console.log('Migrating DailyNotes...');
    try {
      const res = await client.query('SELECT * FROM "DailyNote"');
      for (const row of res.rows) {
        if (!isDryRun) {
          await prisma.dailyNote.create({
            data: {
              clientId: row.clientId,
              empId: row.empId,
              date: row.date || row.dateStr,
              noteText: row.noteText || row.note || '',
              expense: parseFloat(row.expense || 0),
              createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
            },
          });
        }
        stats.dailyNotes++;
      }
    } catch (e: any) {
      stats.errors.push(`DailyNotes: ${e.message}`);
    }

    // 7. ContactRequests
    console.log('Migrating ContactRequests...');
    try {
      const res = await client.query('SELECT * FROM "ContactRequest"');
      for (const row of res.rows) {
        if (!isDryRun) {
          await prisma.contactRequest.create({
            data: {
              name: row.name,
              company: row.company || null,
              phone: row.phone,
              email: row.email || null,
              message: row.message || null,
              status: row.status || 'new',
              notes: row.notes || null,
              createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
            },
          });
        }
        stats.contactRequests++;
      }
    } catch (e: any) {
      stats.errors.push(`ContactRequests: ${e.message}`);
    }

    client.release();
    await oldPool.end();

    console.log('\n==================================================');
    console.log('              Migration Summary                    ');
    console.log('==================================================');
    console.log(` SaaSSettings:      ${stats.saasSettings}`);
    console.log(` Clients:           ${stats.clients}`);
    console.log(` Foremen:           ${stats.foremen}`);
    console.log(` Employees:         ${stats.employees}`);
    console.log(` TimeLogs:          ${stats.timeLogs}`);
    console.log(` DailyNotes:        ${stats.dailyNotes}`);
    console.log(` ContactRequests:   ${stats.contactRequests}`);
    if (stats.errors.length > 0) {
      console.log(` Errors encountered (${stats.errors.length}):`);
      stats.errors.forEach((err) => console.log(`   - ${err}`));
    }
    console.log('==================================================\n');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration().catch(console.error);
