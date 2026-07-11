export default () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),

  mongodbUri: process.env.MONGODB_URI,

  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },

  storage: {
    driver: process.env.STORAGE_DRIVER ?? 'local',
    uploadRootDir: process.env.UPLOAD_ROOT_DIR ?? './uploads',
    maxFileSizeMb: parseInt(process.env.UPLOAD_MAX_FILE_SIZE_MB ?? '10', 10),
    appBaseUrl: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    s3: {
      bucket: process.env.AWS_S3_BUCKET,
      region: process.env.AWS_S3_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  },

  cors: {
    origin: process.env.CORS_ORIGIN ?? '*',
  },

  defaultAdmin: {
    username: process.env.DEFAULT_ADMIN_USERNAME ?? 'admin',
    email: process.env.DEFAULT_ADMIN_EMAIL ?? 'admin@hospital.local',
    password: process.env.DEFAULT_ADMIN_PASSWORD ?? 'ChangeMe123!',
  },

  maintenance: {
    pmDefaultFrequencyDays: parseInt(
      process.env.PM_DEFAULT_FREQUENCY_DAYS ?? '90',
      10,
    ),
    calibrationDefaultFrequencyDays: parseInt(
      process.env.CALIBRATION_DEFAULT_FREQUENCY_DAYS ?? '365',
      10,
    ),
  },

  notifications: {
    pmDueLeadDays: parseInt(process.env.PM_DUE_LEAD_DAYS ?? '7', 10),
    warrantyExpiringLeadDays: parseInt(
      process.env.WARRANTY_EXPIRING_LEAD_DAYS ?? '30',
      10,
    ),
  },

  throttle: {
    ttlSeconds: parseInt(process.env.THROTTLE_TTL_SECONDS ?? '60', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
  },
});
