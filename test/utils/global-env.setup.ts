/**
 * Runs once per e2e test file, before the test framework (and therefore
 * before any spec file's own imports, including `AppModule`) is
 * installed. `@nestjs/config`'s `ConfigModule.forRoot()` runs its Joi
 * validation synchronously against `process.env` the moment `AppModule`
 * is first imported, using whatever `dotenv` loaded from a local `.env`
 * at that point — too early for any env patching done inside a test's
 * `beforeAll`. `dotenv` only skips keys already present in `process.env`,
 * so pre-seeding non-empty placeholders here "wins" over blank values a
 * developer's local `.env` might define for optional keys.
 */
process.env.NODE_ENV ||= 'test';

for (const key of [
  'AWS_S3_BUCKET',
  'AWS_S3_REGION',
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
]) {
  process.env[key] ||= 'unused-in-e2e-tests';
}

// Generous limits so a handful of test requests never trip the global
// @nestjs/throttler default (per-route @Throttle() overrides, e.g. on
// /auth/login, are unaffected and still apply their own stricter limits).
process.env.THROTTLE_LIMIT ||= '1000';
process.env.THROTTLE_TTL_SECONDS ||= '60';
