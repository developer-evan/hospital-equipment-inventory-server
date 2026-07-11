# Files module

Internal file-storage abstraction. **Has no HTTP controller of its own** — it
is consumed by `equipment` (photos, manuals, QR codes) and `maintenance`
(photos) via `FilesService`.

## Storage provider interface

```typescript
interface StorageProvider {
  upload(file: UploadedFileInput): Promise<StoredFileRef>;
  delete(key: string): Promise<void>;
  getUrl(key: string): string;
}
```

Selected at DI time via the `STORAGE_DRIVER` env var (`local` | `s3`),
injected under the `STORAGE_PROVIDER` token — no calling code changes when
switching providers.

| Driver | Class | Status |
|--------|-------|--------|
| `local` (default) | `LocalDiskStorageProvider` | Fully implemented — writes to `UPLOAD_ROOT_DIR/<folder>/<uuid><ext>`, served statically by Express at `/uploads/*` |
| `s3` | `S3StorageProvider` | Stubbed with clear `TODO`s — swap in the AWS SDK v3 calls using `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |

`StoredFileRef` shape: `{ key: string, url: string }`. For local storage,
`url` is `${APP_BASE_URL}/uploads/${key}`.

## `FilesService`

| Method | Purpose |
|--------|---------|
| `uploadOne(file, folder, allowedMimeTypes)` | Validates MIME type, delegates to the active provider |
| `uploadMany(files, folder, allowedMimeTypes)` | Parallel `uploadOne` for multi-file uploads |
| `deleteByKey(key)` | Removes a previously stored file |

Callers pass a `folder` to namespace uploads:

| Folder | Used by |
|--------|---------|
| `equipment-photos` | `POST /equipment/:id/photos` |
| `equipment-manuals` | `POST /equipment/:id/manual` |
| `qr-codes` | Auto-generated QR PNGs on equipment create/regenerate |
| `maintenance-photos` | `POST /maintenance/:id/photos` |

## Allowed MIME types (`files.constants.ts`)

- **Images** (`ALLOWED_IMAGE_MIME_TYPES`): `image/jpeg`, `image/png`, `image/webp`
- **Documents** (`ALLOWED_DOCUMENT_MIME_TYPES`): the above + `application/pdf`

Uploads use Multer memory storage (`memoryMulterOptions()`), with a per-file
size cap from `UPLOAD_MAX_FILE_SIZE_MB`. Files rejected by MIME type or size
throw `400 Bad Request` before ever reaching the storage provider.
