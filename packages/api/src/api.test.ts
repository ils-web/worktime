import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from './app';
import { prisma } from '@timetracker/db';
import { signSessionToken } from './middleware/auth';

describe('TimeTracker API Endpoints', () => {
  const testUsername = `testclient_${Date.now()}`;
  const testPassword = 'Password123!';
  let clientCookie: string = '';
  const testEmpId = `EMP_${Date.now()}`;

  beforeAll(async () => {
    process.env['JWT_SECRET'] = 'test-secret-key-12345678901234567890';
    process.env['CRON_SECRET'] = 'test-cron-secret-1234567890';
  });

  it('1. Health check works', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('2. Public contact form saves leads', async () => {
    const res = await request(app)
      .post('/api/public/contact')
      .send({
        name: 'Иван Петров',
        company: 'ООО Стройка',
        phone: '+972501234567',
        message: 'Хочу демо системы',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.id).toBeDefined();
  });

  it('3. Public client self-registration starts 14-day trial', async () => {
    const res = await request(app)
      .post('/api/public/register')
      .send({
        username: testUsername,
        password: testPassword,
        name: 'Тестовая Компания',
        phone: '+972509998877',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.clientId).toBeDefined();

    // Check Set-Cookie was sent
    const cookies = res.headers['set-cookie'] as string[] | undefined;
    expect(cookies).toBeDefined();
    expect(cookies![0]).toContain('session=');
    expect(cookies![0]).toContain('HttpOnly');
    clientCookie = cookies![0] ?? '';
  });

  it('4. Auth login rejects incorrect password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUsername,
        password: 'wrong-password',
      });

    expect(res.status).toBe(401);
  });

  it('5. Auth login succeeds with valid credentials and returns no token in body', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        username: testUsername,
        password: testPassword,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.role).toBe('client');
    expect(res.body.token).toBeUndefined(); // Security: token must be in cookie only!

    const cookies = res.headers['set-cookie'] as string[] | undefined;
    expect(cookies![0]).toContain('session=');
  });

  it('6. Client creates an employee with geofence', async () => {
    // Geofence at Tel Aviv center (32.0853, 34.7818), 100m radius
    const res = await request(app)
      .post('/api/client/employees')
      .set('Cookie', clientCookie)
      .send({
        empId: testEmpId,
        name: 'Алексей Строитель',
        isMobile: false,
        strictGps: true,
        geofence: {
          lat: 32.0853,
          lng: 34.7818,
          radius: 100,
          address: 'Тель-Авив, ул. Дизенгоф 50',
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.employee.empId).toBe(testEmpId);
  });

  it('7. Worker profile is accessible by empId without password', async () => {
    const res = await request(app).get(`/api/worker/profile/${testEmpId}`);
    expect(res.status).toBe(200);
    expect(res.body.employee.name).toBe('Алексей Строитель');
    expect(res.body.status.isOnShift).toBe(false);
  });

  it('8. Worker clock-in OUTSIDE geofence is blocked with 400 error', async () => {
    // Coordinates 5 km away (outside 100m radius)
    const res = await request(app)
      .post('/api/worker/log')
      .send({
        empId: testEmpId,
        action: 'CLOCK_IN',
        lat: 32.1200,
        lng: 34.8000,
      });

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('OUT_OF_GEOFENCE');
    expect(res.body.error).toContain('Вы вне зоны');
  });

  it('9. Worker clock-in INSIDE geofence succeeds', async () => {
    // Exact location inside 100m radius
    const res = await request(app)
      .post('/api/worker/log')
      .send({
        empId: testEmpId,
        action: 'CLOCK_IN',
        lat: 32.0853,
        lng: 34.7818,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.log.action).toBe('CLOCK_IN');
  });

  it('10. Worker clock-out is ALLOWED even outside geofence (Section 1.4)', async () => {
    const res = await request(app)
      .post('/api/worker/log')
      .send({
        empId: testEmpId,
        action: 'CLOCK_OUT',
        lat: 32.1500, // Outside geofence
        lng: 34.8500,
        note: 'Закончил объект вовремя',
        expense: 50,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.log.action).toBe('CLOCK_OUT');
  });

  it('11. Client can fetch server-generated CSV and PDF reports', async () => {
    const csvRes = await request(app)
      .get('/api/client/reports/csv')
      .set('Cookie', clientCookie);

    expect(csvRes.status).toBe(200);
    expect(csvRes.headers['content-type']).toContain('text/csv');
    expect(csvRes.text).toContain(testEmpId);

    const pdfRes = await request(app)
      .get('/api/client/reports/pdf')
      .set('Cookie', clientCookie);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.body.length).toBeGreaterThan(100);
  });

  it('12. Manual shift CRUD: create with accurate timezone, mark isManual, edit, and delete', async () => {
    // 1. Create shift 08:00 - 17:00 on 2026-10-02
    const createRes = await request(app)
      .post('/api/client/logs/manual')
      .set('Cookie', clientCookie)
      .send({
        empId: testEmpId,
        clockIn: '2026-10-02T08:00:00',
        clockOut: '2026-10-02T17:00:00',
        notes: 'Смена по шаблону 08-17',
      });

    expect(createRes.status).toBe(200);
    expect(createRes.body.success).toBe(true);
    expect(createRes.body.logIn.isManual).toBe(true);
    expect(createRes.body.logOut.isManual).toBe(true);

    const logIds = [createRes.body.logIn.id, createRes.body.logOut.id];

    // 2. Fetch hours and verify exact 08:00 - 17:00 and isManual flag
    const hoursRes = await request(app)
      .get('/api/client/hours?startDate=2026-10-02&endDate=2026-10-02')
      .set('Cookie', clientCookie);

    expect(hoursRes.status).toBe(200);
    expect(hoursRes.body.hours.length).toBe(1);
    const shift = hoursRes.body.hours[0];
    expect(shift.firstIn).toBe('08:00');
    expect(shift.lastOut).toBe('17:00');
    expect(shift.grossHours).toBe(9);
    expect(shift.isManual).toBe(true);
    expect(shift.logIds).toEqual(expect.arrayContaining(logIds));

    // 3. Edit shift to 07:00 - 16:00
    const editRes = await request(app)
      .put('/api/client/logs/manual')
      .set('Cookie', clientCookie)
      .send({
        empId: testEmpId,
        clockIn: '2026-10-02T07:00:00',
        clockOut: '2026-10-02T16:00:00',
        notes: 'Отредактировано на 07-16',
        logIds,
      });

    expect(editRes.status).toBe(200);
    expect(editRes.body.success).toBe(true);

    const updatedHoursRes = await request(app)
      .get('/api/client/hours?startDate=2026-10-02&endDate=2026-10-02')
      .set('Cookie', clientCookie);

    const updatedShift = updatedHoursRes.body.hours[0];
    expect(updatedShift.firstIn).toBe('07:00');
    expect(updatedShift.lastOut).toBe('16:00');
    expect(updatedShift.notes).toBe('Отредактировано на 07-16');

    // 4. Delete shift
    const deleteRes = await request(app)
      .delete('/api/client/logs/manual')
      .set('Cookie', clientCookie)
      .send({ logIds });

    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const finalHoursRes = await request(app)
      .get('/api/client/hours?startDate=2026-10-02&endDate=2026-10-02')
      .set('Cookie', clientCookie);

    expect(finalHoursRes.body.hours.length).toBe(0);
  }, 15000);

  it('12. Billing cron requires CRON_SECRET and generates monthly report', async () => {
    // Without secret -> 401
    const unauthRes = await request(app).get('/api/cron/billing');
    expect(unauthRes.status).toBe(401);

    // With Bearer secret -> 200
    const authRes = await request(app)
      .get('/api/cron/billing')
      .set('Authorization', `Bearer ${process.env['CRON_SECRET']}`);

    expect(authRes.status).toBe(200);
    expect(authRes.body.success).toBe(true);
    expect(authRes.body.periodMonth).toBeDefined();
  });

  it('13. Worker offline sync processes queued events with historical timestamps', async () => {
    const historicalTime1 = new Date(Date.now() - 3600000).toISOString();
    const historicalTime2 = new Date(Date.now() - 1800000).toISOString();

    const syncRes = await request(app)
      .post('/api/worker/sync')
      .send({
        empId: testEmpId,
        logs: [
          {
            empId: testEmpId,
            action: 'CLOCK_IN',
            lat: 32.0853,
            lng: 34.7818,
            dateTime: historicalTime1,
          },
          {
            empId: testEmpId,
            action: 'CLOCK_OUT',
            lat: 32.0853,
            lng: 34.7818,
            dateTime: historicalTime2,
            note: 'Офлайн смена',
            expense: 25,
          },
        ],
      });

    expect(syncRes.status).toBe(200);
    expect(syncRes.body.success).toBe(true);
    expect(syncRes.body.count).toBe(2);
    expect(syncRes.body.logs[0].action).toBe('CLOCK_IN');
    expect(syncRes.body.logs[1].action).toBe('CLOCK_OUT');
  });

  it('14. Owner can delete client and cleanup test clients', async () => {
    const ownerToken = signSessionToken({ id: 'owner', role: 'owner', name: 'Master Owner' });
    const ownerCookie = `session=${ownerToken}`;

    // Test bulk test clients cleanup endpoint
    const cleanupRes = await request(app)
      .post('/api/owner/clients/cleanup-test')
      .set('Cookie', ownerCookie);

    expect(cleanupRes.status).toBe(200);
    expect(cleanupRes.body.success).toBe(true);
    expect(typeof cleanupRes.body.count).toBe('number');
  });

  afterAll(async () => {
    // Delete any test clients created during test runs
    await prisma.client.deleteMany({
      where: {
        OR: [
          { username: { startsWith: 'testclient_' } },
          { name: { contains: 'Тестовая' } },
        ],
      },
    });

    // Clean up test contact request
    await prisma.contactRequest.deleteMany({
      where: { phone: '+972501234567' },
    });

    await prisma.$disconnect();
  });
});
