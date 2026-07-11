import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import {
  StorageProvider,
  StoredFileRef,
  UploadedFileInput,
} from '../../../common/interfaces/storage-provider.interface';

/**
 * Default storage provider — writes uploaded files to disk under
 * `UPLOAD_ROOT_DIR/<folder>/<uuid><ext>`. Files are served statically
 * by Express at the `/uploads` prefix (configured in `main.ts`).
 */
@Injectable()
export class LocalDiskStorageProvider implements StorageProvider {
  private readonly rootDir: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.rootDir = this.configService.get<string>('storage.uploadRootDir')!;
    this.baseUrl = this.configService.get<string>('storage.appBaseUrl')!;
  }

  async upload(file: UploadedFileInput): Promise<StoredFileRef> {
    const folderPath = join(this.rootDir, file.folder);
    await mkdir(folderPath, { recursive: true });

    const filename = `${randomUUID()}${extname(file.originalName)}`;
    const fullPath = join(folderPath, filename);
    await writeFile(fullPath, file.buffer);

    const key = `${file.folder}/${filename}`;
    return { key, url: this.getUrl(key) };
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(join(this.rootDir, key));
    } catch {
      // File already gone — deletion is idempotent from the caller's perspective.
    }
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/uploads/${key}`;
  }
}
