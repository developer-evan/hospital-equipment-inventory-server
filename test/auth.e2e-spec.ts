import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import {
  closeE2eApp,
  createE2eApp,
  DEFAULT_ADMIN_CREDENTIALS,
  E2eContext,
} from './utils/e2e-setup';

describe('Auth (e2e)', () => {
  let ctx: E2eContext;
  let app: INestApplication<App>;

  beforeAll(async () => {
    ctx = await createE2eApp();
    app = ctx.app;
  }, 60_000);

  afterAll(async () => {
    await closeE2eApp(ctx);
  });

  it('rejects login with wrong credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        username: DEFAULT_ADMIN_CREDENTIALS.username,
        password: 'wrong-password',
      })
      .expect(401);
  });

  it('logs the seeded default administrator in and returns an access/refresh token pair', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(DEFAULT_ADMIN_CREDENTIALS)
      .expect(201);

    const { data } = response.body;
    expect(data.accessToken).toBeDefined();
    expect(data.refreshToken).toBeDefined();
    expect(data.user).toMatchObject({
      username: DEFAULT_ADMIN_CREDENTIALS.username,
      role: 'ADMINISTRATOR',
    });
  });

  it('rejects a request with no bearer token', async () => {
    await request(app.getHttpServer()).get('/users/me').expect(401);
  });

  it('accepts requests bearing a valid access token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(DEFAULT_ADMIN_CREDENTIALS)
      .expect(201);
    const { accessToken } = login.body.data;

    const me = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(me.body.data.username).toBe(DEFAULT_ADMIN_CREDENTIALS.username);
  });

  it('rotates tokens on refresh and invalidates the old refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(DEFAULT_ADMIN_CREDENTIALS)
      .expect(201);
    const { refreshToken } = login.body.data;

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);

    expect(refreshed.body.data.accessToken).toBeDefined();
    expect(refreshed.body.data.refreshToken).toBeDefined();
    expect(refreshed.body.data.refreshToken).not.toBe(refreshToken);

    // The rotated-out refresh token must no longer be usable.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('invalidates the refresh token on logout', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send(DEFAULT_ADMIN_CREDENTIALS)
      .expect(201);
    const { accessToken, refreshToken } = login.body.data;

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
