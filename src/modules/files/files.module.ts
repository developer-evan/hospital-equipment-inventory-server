import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { STORAGE_PROVIDER } from '../../common/interfaces/storage-provider.interface';
import { FilesService } from './files.service';
import { LocalDiskStorageProvider } from './providers/local-disk-storage.provider';
import { S3StorageProvider } from './providers/s3-storage.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    LocalDiskStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER,
      inject: [ConfigService, LocalDiskStorageProvider, S3StorageProvider],
      useFactory: (
        configService: ConfigService,
        localProvider: LocalDiskStorageProvider,
        s3Provider: S3StorageProvider,
      ) =>
        configService.get<string>('storage.driver') === 's3'
          ? s3Provider
          : localProvider,
    },
    FilesService,
  ],
  exports: [FilesService],
})
export class FilesModule {}
