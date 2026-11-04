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
  let testEmployeeDbId: number = 0;

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
    testEmployeeDbId = res.body.employee.id;
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

  it('8b. Worker clock-in WITHOUT GPS coordinates (lat: null) is blocked with 400 GPS_REQUIRED error', async () => {
    const res = await request(app)
      .post('/api/worker/log')
      .send({
        empId: testEmpId,
        action: 'CLOCK_IN',
        lat: null,
        lng: null,
      });

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('GPS_REQUIRED');
    expect(res.body.error).toContain('GPS');
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

  it('10b. Strict GPS auto-exit: stops shift when leaving site, records AUTO_EXIT and note', async () => {
    // 1. Worker clocks in inside geofence
    const clockInRes = await request(app)
      .post('/api/worker/log')
      .send({
        empId: testEmpId,
        action: 'CLOCK_IN',
        lat: 32.0853,
        lng: 34.7818,
      });
    expect(clockInRes.status).toBe(200);

    // 2. Strict GPS triggers AUTO_EXIT when exiting geofence with note
    const autoExitRes = await request(app)
      .post('/api/worker/log')
      .send({
        empId: testEmpId,
        action: 'AUTO_EXIT',
        lat: 32.1800, // outside geofence
        lng: 34.8900,
        note: 'Покинул объект (строгий GPS, 1500м)',
      });

    expect(autoExitRes.status).toBe(200);
    expect(autoExitRes.body.success).toBe(true);
    expect(autoExitRes.body.log.action).toBe('AUTO_EXIT');

    // 3. Worker profile shows shift is closed and autoClosedDueToStrictGps is true
    const profileRes = await request(app).get(`/api/worker/profile/${testEmpId}`);
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.status.isOnShift).toBe(false);
    expect(profileRes.body.status.autoClosedDueToStrictGps).toBe(true);

    // 4. Hours report contains the strict GPS note
    const hoursRes = await request(app)
      .get('/api/client/hours')
      .set('Cookie', clientCookie);
    expect(hoursRes.status).toBe(200);
    const todayRow = hoursRes.body.hours.find((h: any) => h.empId === testEmpId);
    expect(todayRow).toBeDefined();
    expect(todayRow.notes).toContain('строгий GPS');
  });

  it('11. Client and Worker can fetch server-generated localized CSV (Hebrew default + Russian) and PDF reports', async () => {
    const csvHeRes = await request(app)
      .get('/api/client/reports/csv')
      .set('Cookie', clientCookie);

    expect(csvHeRes.status).toBe(200);
    expect(csvHeRes.headers['content-type']).toContain('text/csv');
    expect(csvHeRes.text).toContain(testEmpId);
    expect(csvHeRes.text).toContain('דוח שעות נוכחות - חברה');
    expect(csvHeRes.text).toContain('קוד עובד');

    const csvRuRes = await request(app)
      .get('/api/client/reports/csv?lang=ru')
      .set('Cookie', clientCookie);

    expect(csvRuRes.status).toBe(200);
    expect(csvRuRes.text).toContain('Отчет по часам компании');
    expect(csvRuRes.text).toContain('ID Сотрудника');

    const workerCsvRes = await request(app)
      .get(`/api/worker/report/${testEmpId}/csv?lang=he`);
    expect(workerCsvRes.status).toBe(200);
    expect(workerCsvRes.text).toContain('דוח שעות נוכחות - חברה');

    const pdfRes = await request(app)
      .get('/api/client/reports/pdf')
      .set('Cookie', clientCookie);

    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers['content-type']).toContain('application/pdf');
    expect(pdfRes.body.length).toBeGreaterThan(100);
  }, 15000);

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

  it('14. Client can assign two shifts per day (morning_evening) in schedule matrix', async () => {
    const schedRes = await request(app)
      .post('/api/client/schedule')
      .set('Cookie', clientCookie)
      .send({
        employeeId: testEmployeeDbId,
        dayOfWeek: 1, // Monday
        shiftType: 'morning_evening',
      });

    expect(schedRes.status).toBe(200);
    expect(schedRes.body.success).toBe(true);
    expect(schedRes.body.schedule.shiftType).toBe('morning_evening');

    const getRes = await request(app)
      .get('/api/client/schedule')
      .set('Cookie', clientCookie);

    expect(getRes.status).toBe(200);
    expect(getRes.body.success).toBe(true);
    const found = getRes.body.schedules.find(
      (s: any) => s.employeeId === testEmployeeDbId && s.dayOfWeek === 1
    );
    expect(found).toBeDefined();
    expect(found.shiftType).toBe('morning_evening');
  });

  it('14b. Multi-Site Transit employee stops timer on exit from Site A and auto-resumes with transit time on arrival at Site B', async () => {
    // 1. Create two sites: Site A and Site B
    const siteARes = await request(app)
      .post('/api/client/sites')
      .set('Cookie', clientCookie)
      .send({
        name: 'Объект Север',
        address: 'Тель-Авив Север',
        lat: 32.1,
        lng: 34.8,
        radius: 150,
      });
    expect(siteARes.status).toBe(200);
    const siteAId = siteARes.body.site.id;

    const siteBRes = await request(app)
      .post('/api/client/sites')
      .set('Cookie', clientCookie)
      .send({
        name: 'Объект Юг',
        address: 'Тель-Авив Юг',
        lat: 32.05,
        lng: 34.76,
        radius: 150,
      });
    expect(siteBRes.status).toBe(200);
    const siteBId = siteBRes.body.site.id;

    // 2. Create employee with multiSiteTransit = true assigned to both sites
    const transitEmpId = `TR_${Date.now()}`;
    const empRes = await request(app)
      .post('/api/client/employees')
      .set('Cookie', clientCookie)
      .send({
        empId: transitEmpId,
        name: 'Транзитный Работник',
        isMobile: false,
        strictGps: true,
        multiSiteTransit: true,
        siteIds: [siteAId, siteBId],
      });
    expect(empRes.status).toBe(200);
    expect(empRes.body.employee.multiSiteTransit).toBe(true);

    // 3. Simulate CLOCK_IN at Site A (60 mins ago) and AUTO_EXIT when leaving Site A (25 mins ago)
    const nowMs = Date.now();
    const clockInAtSiteA = new Date(nowMs - 60 * 60 * 1000).toISOString();
    const exitFromSiteA = new Date(nowMs - 25 * 60 * 1000).toISOString();

    await request(app)
      .post('/api/worker/log')
      .send({
        empId: transitEmpId,
        action: 'CLOCK_IN',
        lat: 32.1,
        lng: 34.8,
        dateTime: clockInAtSiteA,
      });

    await request(app)
      .post('/api/worker/log')
      .send({
        empId: transitEmpId,
        action: 'AUTO_EXIT',
        lat: 32.095,
        lng: 34.795,
        dateTime: exitFromSiteA,
        note: 'Покинул объект "Объект Север" (строгий GPS, 650м)',
      });

    // Verify worker profile shows timer stopped and lastExitedSiteName = 'Объект Север'
    const profileStopped = await request(app).get(`/api/worker/profile/${transitEmpId}`);
    expect(profileStopped.status).toBe(200);
    expect(profileStopped.body.status.isOnShift).toBe(false);
    expect(profileStopped.body.status.lastExitedSiteName).toBe('Объект Север');

    // 4. Worker arrives at Site B by GPS -> CLOCK_IN converts previous AUTO_EXIT to AUTO_PAUSE and logs AUTO_RESUME
    const arriveSiteBRes = await request(app)
      .post('/api/worker/log')
      .send({
        empId: transitEmpId,
        action: 'CLOCK_IN',
        lat: 32.05,
        lng: 34.76,
      });

    expect(arriveSiteBRes.status).toBe(200);
    expect(arriveSiteBRes.body.success).toBe(true);
    expect(arriveSiteBRes.body.log.action).toBe('AUTO_RESUME');
    expect(arriveSiteBRes.body.transitResumed).toBeDefined();
    expect(arriveSiteBRes.body.transitResumed.fromSite).toBe('Объект Север');
    expect(arriveSiteBRes.body.transitResumed.toSite).toBe('Объект Юг');
    expect(arriveSiteBRes.body.transitResumed.transitMinutes).toBeGreaterThanOrEqual(24);

    // Verify profile now shows isOnShift: true and lastActionTime is original Site A start time
    const profileResumed = await request(app).get(`/api/worker/profile/${transitEmpId}`);
    expect(profileResumed.body.status.isOnShift).toBe(true);
    expect(new Date(profileResumed.body.status.lastActionTime).getTime()).toBe(
      new Date(clockInAtSiteA).getTime()
    );
  }, 15000);

  it('14c. Multi-Site Transit (Option B): Direct transition while shift is active (phone in pocket) retroactively inserts AUTO_PAUSE and credits normative transit time', async () => {
    // 1. Create 2 test sites
    const site1Res = await request(app)
      .post('/api/client/sites')
      .set('Cookie', clientCookie)
      .send({
        name: 'База Восток',
        address: 'Тель-Авив Восток',
        lat: 32.08,
        lng: 34.82,
        radius: 150,
      });
    const site1Id = site1Res.body.site.id;

    const site2Res = await request(app)
      .post('/api/client/sites')
      .set('Cookie', clientCookie)
      .send({
        name: 'База Запад',
        address: 'Тель-Авив Запад',
        lat: 32.07,
        lng: 34.76,
        radius: 150,
      });
    const site2Id = site2Res.body.site.id;

    // 2. Create employee with multiSiteTransit
    const directEmpId = `DIR_${Date.now()}`;
    await request(app)
      .post('/api/client/employees')
      .set('Cookie', clientCookie)
      .send({
        empId: directEmpId,
        name: 'Прямой Транзитник',
        isMobile: false,
        strictGps: true,
        multiSiteTransit: true,
        siteIds: [site1Id, site2Id],
      });

    // 3. Clock in at Site 1 (90 mins ago) - shift remains ACTIVE (no AUTO_EXIT)
    const nowMs = Date.now();
    const clockInAtSite1 = new Date(nowMs - 90 * 60 * 1000).toISOString();
    await request(app)
      .post('/api/worker/log')
      .send({
        empId: directEmpId,
        action: 'CLOCK_IN',
        lat: 32.08,
        lng: 34.82,
        dateTime: clockInAtSite1,
      });

    // Check profile shows active at 'База Восток'
    const prof1 = await request(app).get(`/api/worker/profile/${directEmpId}`);
    expect(prof1.body.status.isOnShift).toBe(true);
    expect(prof1.body.status.activeSiteName).toBe('База Восток');

    // 4. Worker arrives at Site 2 with shift still open (phone was asleep in pocket during drive)
    // PWA detects GPS is now inside 'База Запад' and triggers CLOCK_IN
    const arriveSite2Res = await request(app)
      .post('/api/worker/log')
      .send({
        empId: directEmpId,
        action: 'CLOCK_IN',
        lat: 32.07,
        lng: 34.76,
      });

    expect(arriveSite2Res.status).toBe(200);
    expect(arriveSite2Res.body.success).toBe(true);
    expect(arriveSite2Res.body.log.action).toBe('AUTO_RESUME');
    expect(arriveSite2Res.body.transitResumed).toBeDefined();
    expect(arriveSite2Res.body.transitResumed.fromSite).toBe('База Восток');
    expect(arriveSite2Res.body.transitResumed.toSite).toBe('База Запад');
    expect(arriveSite2Res.body.transitResumed.transitMinutes).toBeGreaterThanOrEqual(10);

    // Profile at Site 2 should now be active at 'База Запад'
    const prof2 = await request(app).get(`/api/worker/profile/${directEmpId}`);
    expect(prof2.body.status.isOnShift).toBe(true);
    expect(prof2.body.status.activeSiteName).toBe('База Запад');
  }, 15000);

  it('15. Owner can delete client and cleanup test clients', async () => {
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
