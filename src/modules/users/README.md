# Users module

User account management: CRUD, profile self-service, activation status, and
password changes. Also exposes `findActiveByRoles` internally for the
notifications module's fan-out queries.

## Schema (`User`)

| Field | Type | Notes |
|-------|------|-------|
| `username` | string | unique, required |
| `email` | string | unique, lowercase, required |
| `password` | string | bcrypt hash, `select: false` (never returned) |
| `fullName` | string | required |
| `role` | `Role` enum | `ADMINISTRATOR` \| `BIOMEDICAL_ENGINEER` \| `DEPARTMENT_USER` \| `STORE_OFFICER` |
| `departments` | ObjectId[] → `Department` | default `[]` |
| `isActive` | boolean | default `true` |
| `refreshTokenHash` | string | `select: false`; see `auth` module |
| `lastLoginAt` | Date | optional |
| `createdBy`, `updatedBy`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt` | — | from `BaseSchema` |

## Endpoints

| Method | Path | Roles | Body / Query |
|--------|------|-------|--------------|
| `POST` | `/users` | `ADMINISTRATOR` | `CreateUserDto` |
| `GET` | `/users` | `ADMINISTRATOR` | `page`, `limit`, `sort`, `search` (matches username/email/fullName) |
| `GET` | `/users/me` | any authenticated | — |
| `PATCH` | `/users/me/password` | any authenticated | `{ currentPassword, newPassword }` |
| `GET` | `/users/:id` | `ADMINISTRATOR` | — |
| `PATCH` | `/users/:id` | `ADMINISTRATOR` | `UpdateUserDto` (partial `CreateUserDto`, no password) |
| `PATCH` | `/users/:id/status` | `ADMINISTRATOR` | `{ isActive: boolean }` |
| `PATCH` | `/users/:id/password` | `ADMINISTRATOR` | `{ newPassword }` |

## Sample requests

**Create a user**

```http
POST /users
Authorization: Bearer <adminAccessToken>
Content-Type: application/json

{
  "username": "jane.engineer",
  "email": "jane@hospital.local",
  "password": "StrongPass123!",
  "fullName": "Jane Doe",
  "role": "BIOMEDICAL_ENGINEER",
  "departments": ["665f1b2c8a1e2f0012345678"]
}
```

```json
{
  "data": {
    "id": "665f1b2c8a1e2f0012345679",
    "username": "jane.engineer",
    "email": "jane@hospital.local",
    "fullName": "Jane Doe",
    "role": "BIOMEDICAL_ENGINEER",
    "departments": ["665f1b2c8a1e2f0012345678"],
    "isActive": true
  },
  "meta": {}
}
```

**List users (paginated, filtered)**

```http
GET /users?page=1&limit=10&search=jane
Authorization: Bearer <adminAccessToken>
```

```json
{
  "data": [ { "id": "...", "username": "jane.engineer", "...": "..." } ],
  "meta": { "page": 1, "limit": 10, "totalItems": 1, "totalPages": 1 }
}
```

**Change own password**

```http
PATCH /users/me/password
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "currentPassword": "StrongPass123!", "newPassword": "EvenStronger456!" }
```

## Business logic notes

- Passwords are hashed with bcrypt before persisting; `password` and
  `refreshTokenHash` are excluded from every query unless explicitly
  `.select()`-ed (used only by `auth`).
- `PATCH /users/me/password` requires the caller's current password;
  `PATCH /users/:id/password` (admin-only) does not, for account recovery.
- Deactivating a user (`isActive: false`) does not delete their data — it
  blocks future logins/refreshes (`403 Forbidden` from `auth`), leaving
  historical records (equipment, maintenance) intact.
- Deletion is a soft delete (`isDeleted`/`deletedAt`), consistent with every
  other domain collection.
