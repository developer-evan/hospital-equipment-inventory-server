import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  StorageProvider,
  StoredFileRef,
  UploadedFileInput,
} from '../../../common/interfaces/storage-provider.interface';

/**
 * Stub for an S3-compatible object storage backend. Activate by setting
 * `STORAGE_DRIVER=s3` (see `FilesModule`) once real credentials/bucket
 * are available. To complete this provider:
 *
 *   1. `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
 *   2. Construct an `S3Client` from `AWS_S3_REGION` / `AWS_ACCESS_KEY_ID` /
 *      `AWS_SECRET_ACCESS_KEY` (see `configuration.ts` -> `storage.s3`).
 *   3. Implement `upload` with `PutObjectCommand`, `delete` with
 *      `DeleteObjectCommand`, and `getUrl` either as a public bucket URL
 *      or a presigned `GetObjectCommand` URL.
 *
 * Because no implementation depends on this class beyond the
 * `StorageProvider` interface, swapping it in is a one-line change in
 * `FilesModule` (or just `STORAGE_DRIVER=s3` if left wired below).
 */
@Injectable()
export class S3StorageProvider implements StorageProvider {
  constructor(private readonly configService: ConfigService) {}

  upload(_file: UploadedFileInput): Promise<StoredFileRef> {
    this.assertConfigured();
    throw new NotImplementedException(
      'S3StorageProvider.upload is a stub — see class-level TODO comments to implement.',
    );
  }

  delete(_key: string): Promise<void> {
    this.assertConfigured();
    throw new NotImplementedException(
      'S3StorageProvider.delete is a stub — see class-level TODO comments to implement.',
    );
  }

  getUrl(key: string): string {
    const bucket = this.configService.get<string>('storage.s3.bucket');
    const region = this.configService.get<string>('storage.s3.region');
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private assertConfigured(): void {
    const bucket = this.configService.get<string>('storage.s3.bucket');
    if (!bucket) {
      throw new NotImplementedException(
        'AWS_S3_BUCKET is not configured; S3StorageProvider cannot operate yet.',
      );
    }
  }
}
