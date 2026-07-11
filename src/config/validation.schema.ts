import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),

  MONGODB_URI: Joi.string().required(),

  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  STORAGE_DRIVER: Joi.string().valid('local', 's3').default('local'),
  UPLOAD_ROOT_DIR: Joi.string().default('./uploads'),
  UPLOAD_MAX_FILE_SIZE_MB: Joi.number().default(10),
  APP_BASE_URL: Joi.string().default('http://localhost:3000'),

  // `.allow('')` is required in addition to `.optional()` — Joi's `optional()`
  // only permits the key to be *absent*, not present-but-blank. Since these
  // are commonly left as `KEY=` placeholders in `.env` until STORAGE_DRIVER=s3
  // is actually adopted, an empty string must be a valid value too.
  AWS_S3_BUCKET: Joi.string().allow('').optional(),
  AWS_S3_REGION: Joi.string().allow('').optional(),
  AWS_ACCESS_KEY_ID: Joi.string().allow('').optional(),
  AWS_SECRET_ACCESS_KEY: Joi.string().allow('').optional(),

  CORS_ORIGIN: Joi.string().default('*'),

  DEFAULT_ADMIN_USERNAME: Joi.string().default('admin'),
  DEFAULT_ADMIN_EMAIL: Joi.string().default('admin@hospital.local'),
  DEFAULT_ADMIN_PASSWORD: Joi.string().min(8).default('ChangeMe123!'),

  PM_DEFAULT_FREQUENCY_DAYS: Joi.number().default(90),
  CALIBRATION_DEFAULT_FREQUENCY_DAYS: Joi.number().default(365),
  PM_DUE_LEAD_DAYS: Joi.number().default(7),
  WARRANTY_EXPIRING_LEAD_DAYS: Joi.number().default(30),

  THROTTLE_TTL_SECONDS: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(100),
});
