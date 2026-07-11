export interface UploadedFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  /** Logical folder, e.g. "equipment-photos", "equipment-manuals", "qr-codes". */
  folder: string;
}

export interface StoredFileRef {
  /** Storage key/path, opaque to callers (used to delete later). */
  key: string;
  /** Publicly resolvable URL to fetch the file. */
  url: string;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';

/**
 * Swappable file storage abstraction. `LocalDiskStorageProvider` is the
 * default implementation; `S3StorageProvider` is stubbed for later use
 * by switching `STORAGE_DRIVER=s3` in the environment (see FilesModule).
 */
export interface StorageProvider {
  upload(file: UploadedFileInput): Promise<StoredFileRef>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}
