import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectConnection } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { GridFSBucket } from 'mongodb';
import { Connection } from 'mongoose';
import { extname } from 'path';
import { finished } from 'stream/promises';
import {
  StorageProvider,
  StoredFileRef,
  StoredFileStream,
  UploadedFileInput,
} from '../../../common/interfaces/storage-provider.interface';

const GRIDFS_BUCKET = 'uploads';

/**
 * Persists uploads in MongoDB GridFS (same cluster as app data). Use on Render
 * or other hosts with ephemeral local disk via `STORAGE_DRIVER=mongodb`.
 */
@Injectable()
export class MongoGridFsStorageProvider implements StorageProvider {
  private readonly baseUrl: string;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl = this.configService.get<string>('storage.appBaseUrl')!;
  }

  private bucket(): GridFSBucket {
    const db = this.connection.db;
    if (!db) {
      throw new Error('MongoDB connection is not ready for GridFS');
    }
    return new GridFSBucket(db, { bucketName: GRIDFS_BUCKET });
  }

  async upload(file: UploadedFileInput): Promise<StoredFileRef> {
    const filename = `${randomUUID()}${extname(file.originalName)}`;
    const key = `${file.folder}/${filename}`;
    const bucket = this.bucket();
    const uploadStream = bucket.openUploadStream(key, {
      metadata: { folder: file.folder, contentType: file.mimeType },
    });

    uploadStream.end(file.buffer);
    await finished(uploadStream);

    return { key, url: this.getUrl(key) };
  }

  async delete(key: string): Promise<void> {
    const bucket = this.bucket();
    const matches = await bucket.find({ filename: key }).toArray();
    await Promise.all(matches.map((doc) => bucket.delete(doc._id)));
  }

  getUrl(key: string): string {
    return `${this.baseUrl}/uploads/${key}`;
  }

  async openDownloadStream(key: string): Promise<StoredFileStream> {
    const bucket = this.bucket();
    const matches = await bucket.find({ filename: key }).sort({ uploadDate: -1 }).limit(1).toArray();
    if (matches.length === 0) {
      throw new NotFoundException(`File "${key}" not found`);
    }
    const fileDoc = matches[0];
    const contentType =
      typeof fileDoc.metadata?.contentType === 'string'
        ? fileDoc.metadata.contentType
        : undefined;
    return {
      stream: bucket.openDownloadStream(fileDoc._id),
      contentType,
    };
  }
}
