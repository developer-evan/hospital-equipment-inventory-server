import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER } from '../../common/interfaces/storage-provider.interface';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { LocalDiskStorageProvider } from './providers/local-disk-storage.provider';
import { MongoGridFsStorageProvider } from './providers/mongodb-gridfs-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Module({
  imports: [ConfigModule],
  controllers: [FilesController],
  providers: [
    LocalDiskStorageProvider,
    MongoGridFsStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [
        ConfigService,
        LocalDiskStorageProvider,
        MongoGridFsStorageProvider,
        S3StorageProvider,
      ],
      useFactory: (
        configService: ConfigService,
        localProvider: LocalDiskStorageProvider,
        mongoProvider: MongoGridFsStorageProvider,
        s3Provider: S3StorageProvider,
      ) => {
        const driver = configService.get<string>('storage.driver');
        if (driver === 's3') return s3Provider;
        if (driver === 'mongodb') return mongoProvider;
        return localProvider;
      },
    },
    FilesService,
  ],
  exports: [FilesService],
})
export class FilesModule {}
