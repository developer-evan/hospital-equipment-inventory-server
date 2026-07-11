import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../../src/app.module';

export interface E2eContext {
  app: INestApplication;
  mongod: MongoMemoryServer;
}

/**
 * Boots the full AppModule (including the SeedModule, so the default
 * admin + departments exist) against a throwaway in-memory MongoDB
 * instance.
 *
 * Note: `AppModule`'s `ConfigModule.forRoot()` runs Joi validation
 * synchronously the moment `AppModule` is imported (i.e. at the top of
 * this file), using whatever a local `.env` already provides — that's
 * *before* this function's body ever runs. Env vars that only matter at
 * request/DI time (like `MONGODB_URI`, read lazily by `configuration()`
 * when Mongoose actually connects) can still be overridden here; env
 * vars Joi validates eagerly are patched in `global-env.setup.ts`
 * instead (wired up as a Jest `setupFiles` entry — see `jest-e2e.json`).
 */
export async function createE2eApp(): Promise<E2eContext> {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('hospital-equipment-inventory-e2e');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  await app.init();

  return { app, mongod };
}

export async function closeE2eApp(ctx: E2eContext | undefined): Promise<void> {
  if (!ctx) return;
  await ctx.app.close();
  await ctx.mongod.stop();
}

export const DEFAULT_ADMIN_CREDENTIALS = {
  get username() {
    return process.env.DEFAULT_ADMIN_USERNAME ?? 'admin';
  },
  get password() {
    return process.env.DEFAULT_ADMIN_PASSWORD ?? 'ChangeMe123!';
  },
};
