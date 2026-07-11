import { BadRequestException, Inject, Injectable } from '@nestjs/common';
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
