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
 * Covers logging a preventive maintenance visit against a piece of
 * equipment and completing it, including the auto-computed next due
 * date (equipment.pmFrequencyDays days after the scheduled date).
 */
describe('Maintenance (e2e)', () => {
  let ctx: E2eContext;
  let app: INestApplication<App>;
  let adminToken: string;
  let engineerToken: string;
  let engineerId: string;
  let equipmentId: string;

  const authedPost = (path: string, token: string) =>
    request(app.getHttpServer())
      .post(path)
      .set('Authorization', `Bearer ${token}`);
  const authedPatch = (path: string, token: string) =>
    request(app.getHttpServer())
      .patch(path)
      .set('Authorization', `Bearer ${token}`);
  const authedGet = (path: string, token: string) =>
    request(app.getHttpServer())
      .get(path)
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
      .send({ name: 'Theatre E2E Suite', code: 'THR-E2E' })
      .expect(201);
    const departmentId: string =
      department.body.data._id ?? department.body.data.id;

    const engineerUser = await authedPost('/users', adminToken)
      .send({
        username: 'pm.engineer.e2e',
        email: 'pm.engineer.e2e@hospital.local',
        password: 'EngineerPass123!',
        fullName: 'PM Engineer E2E',
        role: 'BIOMEDICAL_ENGINEER',
        departments: [departmentId],
      })
      .expect(201);
    engineerId = engineerUser.body.data._id ?? engineerUser.body.data.id;

    const engineerLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'pm.engineer.e2e', password: 'EngineerPass123!' })
      .expect(201);
    engineerToken = engineerLogin.body.data.accessToken;

    const equipment = await authedPost('/equipment', adminToken)
      .send({
        name: 'Anaesthesia Machine',
        category: 'Theatre Equipment',
        manufacturer: 'Draeger',
        serialNumber: `SN-MAINT-E2E-${Date.now()}`,
        department: departmentId,
        status: 'WORKING',
        pmFrequencyDays: 30,
      })
      .expect(201);
    equipmentId = equipment.body.data._id ?? equipment.body.data.id;
  }, 60_000);

  afterAll(async () => {
    await closeE2eApp(ctx);
  });

  let maintenanceId: string;

  it('schedules a PREVENTIVE maintenance record and computes the next due date', async () => {
    const scheduledDate = '2026-02-01T00:00:00.000Z';
    const response = await authedPost('/maintenance', engineerToken)
      .send({
        equipment: equipmentId,
        type: 'PREVENTIVE',
        scheduledDate,
        engineer: engineerId,
      })
      .expect(201);

    expect(response.body.data.status).toBe('SCHEDULED');
    // pmFrequencyDays = 30 on the equipment record above.
    expect(response.body.data.nextDueDate).toBe('2026-03-03T00:00:00.000Z');
    maintenanceId = response.body.data._id ?? response.body.data.id;
  });

  it('rejects a non-corrective record with no scheduled date', async () => {
    await authedPost('/maintenance', engineerToken)
      .send({ equipment: equipmentId, type: 'CALIBRATION' })
      .expect(400);
  });

  it('lists the maintenance schedule for the equipment', async () => {
    const response = await authedGet(
      `/maintenance/equipment/${equipmentId}/history`,
      adminToken,
    ).expect(200);

    const ids = (
      response.body.data as Array<{ _id?: string; id?: string }>
    ).map((item) => item._id ?? item.id);
    expect(ids).toContain(maintenanceId);
  });

  it('marks the record complete, records the service report, and schedules the next occurrence', async () => {
    const response = await authedPatch(
      `/maintenance/${maintenanceId}/complete`,
      engineerToken,
    )
      .send({
        performedDate: '2026-02-02T00:00:00.000Z',
        serviceReport: 'Replaced CO2 absorbent, verified leak test passed.',
        spareParts: [
          { partName: 'CO2 absorbent canister', quantity: 1, cost: 25 },
        ],
      })
      .expect(200);

    expect(response.body.data.status).toBe('COMPLETED');
    expect(response.body.data.serviceReport).toContain('CO2 absorbent');
  });

  it('automatically scheduled the next PREVENTIVE occurrence', async () => {
    const response = await authedGet(
      `/maintenance/equipment/${equipmentId}/history`,
      adminToken,
    ).expect(200);

    const records = response.body.data as Array<{
      status: string;
      type: string;
    }>;
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'COMPLETED', type: 'PREVENTIVE' }),
        expect.objectContaining({ status: 'SCHEDULED', type: 'PREVENTIVE' }),
      ]),
    );
  });

  it('rejects completing an already-completed record', async () => {
    await authedPatch(`/maintenance/${maintenanceId}/complete`, engineerToken)
      .send({})
      .expect(400);
  });
});
