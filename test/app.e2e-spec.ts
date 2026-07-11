import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { closeE2eApp, createE2eApp, E2eContext } from './utils/e2e-setup';

describe('AppController (e2e)', () => {
  let ctx: E2eContext;
  let app: INestApplication<App>;

  beforeAll(async () => {
    ctx = await createE2eApp();
    app = ctx.app;
  }, 60_000);

  afterAll(async () => {
    await closeE2eApp(ctx);
  });

  it('GET /health returns an ok status payload (public, no auth required)', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);

    expect(response.body.data).toMatchObject({
      status: 'ok',
      service: 'hospital-equipment-inventory-sys',
    });
  });

  it('rejects unauthenticated requests to protected routes', async () => {
    await request(app.getHttpServer()).get('/departments').expect(401);
  });
});
