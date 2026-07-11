# Auth module

JWT authentication: login, refresh-token rotation, and logout. Delegates user
lookup to the `users` module and stores a hash of the current refresh token
on the `User` document (no separate token collection).

## Endpoints

| Method | Path | Access | Body |
|--------|------|--------|------|
| `POST` | `/auth/login` | Public (throttled: 5/min) | `{ username, password }` |
| `POST` | `/auth/refresh` | Public + valid refresh token (throttled: 10/min) | `{ refreshToken }` |
| `POST` | `/auth/logout` | Any authenticated user | — (uses Bearer access token) |

## Sample requests

**Login**

```http
POST /auth/login
Content-Type: application/json

{ "username": "admin", "password": "ChangeMe123!" }
```

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "665f1b2c...",
      "username": "admin",
      "email": "admin@hospital.local",
      "fullName": "System Administrator",
      "role": "ADMINISTRATOR",
      "departments": []
    }
  },
  "meta": {}
}
```

**Refresh** — rotates the refresh token; the old one is invalidated
immediately (its stored hash is overwritten), so it cannot be reused even if
still unexpired.

```http
POST /auth/refresh
Content-Type: application/json

{ "refreshToken": "eyJhbGciOiJIUzI1NiIs..." }
```

```json
{ "data": { "accessToken": "...", "refreshToken": "..." }, "meta": {} }
```

**Logout**

```http
POST /auth/logout
Authorization: Bearer <accessToken>
```

Returns `204 No Content` and clears the stored refresh-token hash, so any
outstanding refresh token for that user becomes invalid.

## Business logic notes

- **Access token** (short-lived, `JWT_ACCESS_EXPIRES_IN`, default `15m`):
  payload `{ sub, username, role, departments[] }`, signed with
  `JWT_ACCESS_SECRET`.
- **Refresh token** (long-lived, `JWT_REFRESH_EXPIRES_IN`, default `7d`):
  payload `{ sub, jti }` (a random `jti` per issuance guarantees two tokens
  minted in the same second still differ), signed with `JWT_REFRESH_SECRET`.
- **Refresh token storage:** the server stores a **SHA-256 hex digest** of
  the refresh token (compared in constant time with `crypto.timingSafeEqual`)
  on `User.refreshTokenHash` — deliberately **not** bcrypt. Refresh tokens
  are long, high-entropy JWTs, and bcrypt silently truncates its input at 72
  bytes; since a JWT's differentiating content (`jti`/`iat`/`exp`/signature)
  falls past that cut-off, bcrypt would treat *every* refresh token ever
  issued to a user as matching *any* hash ever stored for that user,
  defeating rotation and logout invalidation entirely.
- Login rejects deactivated accounts (`403`) and wrong credentials (`401`).
- Every successful login/refresh persists a freshly rotated pair; `login`
  also stamps `lastLoginAt`.
