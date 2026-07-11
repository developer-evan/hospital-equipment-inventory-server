import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

/**
 * Shared multer config: buffers files in memory (so `StorageProvider`
 * implementations decide where bytes ultimately land) and enforces the
 * configured max upload size. Reads `UPLOAD_MAX_FILE_SIZE_MB` directly
 * from `process.env` (rather than `ConfigService`) because decorator
 * options like `@UseInterceptors(FileInterceptor('photo', options))`
 * are evaluated at module-import time, before Nest's DI container (and
 * therefore `ConfigService`) is guaranteed to be ready.
 */
export function memoryMulterOptions(): MulterOptions {
  const maxFileSizeMb = parseInt(
    process.env.UPLOAD_MAX_FILE_SIZE_MB ?? '10',
    10,
  );
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxFileSizeMb * 1024 * 1024 },
  };
}
