import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { STORAGE_PROVIDER } from '../../common/interfaces/storage-provider.interface';
import type {
  StorageProvider,
  StoredFileRef,
} from '../../common/interfaces/storage-provider.interface';

export interface MulterFileLike {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

@Injectable()
export class FilesService {
  constructor(
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    private readonly configService: ConfigService,
  ) {}

  async uploadOne(
    file: MulterFileLike,
    folder: string,
    allowedMimeTypes: string[],
  ): Promise<StoredFileRef> {
    this.assertMimeType(file, allowedMimeTypes);
    return this.storageProvider.upload({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      folder,
    });
  }

  async uploadMany(
    files: MulterFileLike[],
    folder: string,
    allowedMimeTypes: string[],
  ): Promise<StoredFileRef[]> {
    return Promise.all(
      files.map((file) => this.uploadOne(file, folder, allowedMimeTypes)),
    );
  }

  async deleteByKey(key: string): Promise<void> {
    return this.storageProvider.delete(key);
  }

  /** Storage key only — safe to persist (public URL is derived at read time). */
  storageKeyFromRef(ref: StoredFileRef): string {
    return ref.key;
  }

  /** Rebuild a public URL using the current base URL (fixes stale localhost links in DB). */
  resolveStoredUrl(stored?: string): string | undefined {
    if (!stored) {
      return stored;
    }
    return this.storageProvider.getUrl(this.extractStorageKey(stored));
  }

  extractStorageKey(stored: string): string {
    const marker = '/uploads/';
    const markerIndex = stored.indexOf(marker);
    if (markerIndex !== -1) {
      return stored.slice(markerIndex + marker.length);
    }
    if (/^https?:\/\//i.test(stored)) {
      try {
        const pathname = new URL(stored).pathname;
        if (pathname.startsWith('/uploads/')) {
          return pathname.slice('/uploads/'.length);
        }
      } catch {
        /* keep stored as-is */
      }
    }
    return stored;
  }

  async pipeDownload(key: string, res: Response): Promise<void> {
    if (this.configService.get<string>('storage.driver') !== 'mongodb') {
      throw new NotFoundException(`File "${key}" not found`);
    }
    const { stream, contentType } =
      await this.storageProvider.openDownloadStream(key);
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    res.setHeader('Cache-Control', 'public, max-age=86400');
    stream.pipe(res);
  }

  private assertMimeType(
    file: MulterFileLike,
    allowedMimeTypes: string[],
  ): void {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: ${allowedMimeTypes.join(', ')}`,
      );
    }
  }
}
