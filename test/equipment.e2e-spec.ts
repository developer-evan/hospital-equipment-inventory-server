import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  closeE2eApp,
  createE2eApp,
  DEFAULT_ADMIN_CREDENTIALS,
  E2eContext,
} from './utils/e2e-setup';

/**
 * Covers the Store Officer -> Biomedical Engineer equipment lifecycle:
 * register incoming equipment (PENDING_INSTALLATION, excluded from the
 * department's active inventory) -> engineer confirms installation
 * (WORKING, now visible) -> a further status transition is recorded
 * in equipment history.
 */
describe('Equipment lifecycle (e2e)', () => {
  let ctx: E2eContext;
  let app: INestApplication<App>;
  let adminToken: string;
  let storeOfficerToken: string;
  let engineerToken: string;
  let departmentId: string;

  const authedPost = (path: string, token: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`);
  const authedGet = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);
  const authedPatch = (path: string, token: string) =>
    request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${token}`);

  beforeAll(async () => {
    ctx = await createE2eApp();
    app = ctx.app;

    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send(DEFAULT_ADMIN_CREDENTIALS)
      .expect(201);
    adminToken = adminLogin.body.data.accessToken;

    const department = await authedPost('/departments', adminToken)
      .send({
        name: 'Intensive Care Unit',
        code: 'ICU-E2E',
        location: 'Block B',
      })
      .expect(201);
    departmentId = department.body.data._id ?? department.body.data.id;

    await authedPost('/users', adminToken)
      .send({
        username: 'storeofficer.e2e',
        email: 'storeofficer.e2e@hospital.local',
        password: 'StorePass123!',
        fullName: 'Store Officer E2E',
        role: 'STORE_OFFICER',
      })
      .expect(201);
    await authedPost('/users', adminToken)
      .send({
        username: 'engineer.e2e',
        email: 'engineer.e2e@hospital.local',
        password: 'EngineerPass123!',
        fullName: 'Biomedical Engineer E2E',
        role: 'BIOMEDICAL_ENGINEER',
        departments: [departmentId],
      })
      .expect(201);

    const storeOfficerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'storeofficer.e2e', password: 'StorePass123!' })
      .expect(201);
    storeOfficerToken = storeOfficerLogin.body.data.accessToken;

    const engineerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'engineer.e2e', password: 'EngineerPass123!' })
      .expect(201);
    engineerToken = engineerLogin.body.data.accessToken;
  }, 60_000);

  afterAll(async () => {
    await closeE2eApp(ctx);
  });

  let equipmentId: string;

  it('lets a Store Officer register incoming equipment as PENDING_INSTALLATION', async () => {
    const response = await authedPost('/receiving/register', storeOfficerToken)
      .send({
        name: 'Patient Monitor',
        category: 'Diagnostic Imaging',
        manufacturer: 'Philips',
        serialNumber: `SN-E2E-${Date.now()}`,
        department: departmentId,
      })
      .expect(201);

    expect(response.body.data.status).toBe('PENDING_INSTALLATION');
    equipmentId = response.body.data._id ?? response.body.data.id;
  });

  it('rejects a Department User attempting to register equipment (role-restricted)', async () => {
    await authedPost('/receiving/register', engineerToken)
      .send({
        name: 'Infusion Pump',
        category: 'Infusion',
        manufacturer: 'B. Braun',
        serialNumber: `SN-E2E-REJECT-${Date.now()}`,
        department: departmentId,
      })
      .expect(403);
  });

  it('excludes PENDING_INSTALLATION equipment from the active department inventory', async () => {
    const response = await authedGet(
      `/equipment?department=${departmentId}&status=WORKING`,
      adminToken,
    ).expect(200);

    const found = (
      response.body.data as Array<{ _id?: string; id?: string }>
    ).some((item) => (item._id ?? item.id) === equipmentId);
    expect(found).toBe(false);
  });

  it('lets a Biomedical Engineer confirm installation, transitioning to WORKING', async () => {
    const response = await authedPatch(
      `/receiving/${equipmentId}/confirm-installation`,
      engineerToken,
    )
      .send({ note: 'Verified power-on self-test passed' })
      .expect(200);

    expect(response.body.data.status).toBe('WORKING');
  });

  it('rejects confirming installation twice (state machine enforcement)', async () => {
    await authedPatch(
      `/receiving/${equipmentId}/confirm-installation`,
      engineerToken,
    )
      .send({})
      .expect(400);
  });

  it('now surfaces the equipment in the active department inventory', async () => {
    const response = await authedGet(
      `/equipment?department=${departmentId}&status=WORKING`,
      adminToken,
    ).expect(200);

    const found = (
      response.body.data as Array<{ _id?: string; id?: string }>
    ).some((item) => (item._id ?? item.id) === equipmentId);
    expect(found).toBe(true);
  });

  it('records both transitions in the equipment history trail', async () => {
    const response = await authedGet(
      `/receiving/${equipmentId}/history`,
      adminToken,
    ).expect(200);

    const transitions = response.body.data as Array<{
      fromStatus: string | null;
      toStatus: string;
    }>;
    expect(transitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromStatus: null,
          toStatus: 'PENDING_INSTALLATION',
        }),
        expect.objectContaining({
          fromStatus: 'PENDING_INSTALLATION',
          toStatus: 'WORKING',
        }),
      ]),
    );
  });

  it('allows a further valid transition (WORKING -> UNDER_REPAIR) via changeStatus', async () => {
    const response = await authedPatch(
      `/receiving/${equipmentId}/status`,
      engineerToken,
    )
      .send({ toStatus: 'UNDER_REPAIR', note: 'Fault reported by ward staff' })
      .expect(200);

    expect(response.body.data.status).toBe('UNDER_REPAIR');
  });
});
