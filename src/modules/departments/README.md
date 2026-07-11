# Departments module

Hospital department master data. Seeded with 19 standard departments on
first boot (see root README → Seed data) and referenced by `users`,
`equipment`, `maintenance`, `receiving`, `dashboard`, and `reports`.

## Schema (`Department`)

| Field | Type | Notes |
|-------|------|-------|
| `name` | string | unique, required |
| `code` | string | unique, uppercase, required — short mnemonic (e.g. `ICU`, `THR`) |
| `location` | string | optional |
| `isActive` | boolean | default `true` |
| `createdBy`, `updatedBy`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt` | — | from `BaseSchema` |

## Endpoints

| Method | Path | Roles | Body / Query |
|--------|------|-------|--------------|
| `POST` | `/departments` | `ADMINISTRATOR` | `{ name, code, location?, isActive? }` |
| `GET` | `/departments` | any authenticated | `page`, `limit`, `sort`, `search` (matches name/code) |
| `GET` | `/departments/active` | any authenticated | — (unpaginated list of active departments, for dropdowns) |
| `GET` | `/departments/:id` | any authenticated | — |
| `PATCH` | `/departments/:id` | `ADMINISTRATOR` | partial `{ name?, code?, location?, isActive? }` |
| `DELETE` | `/departments/:id` | `ADMINISTRATOR` | — (soft delete, `204 No Content`) |

## Sample requests

**Create a department**

```http
POST /departments
Authorization: Bearer <adminAccessToken>
Content-Type: application/json

{ "name": "Cardiology", "code": "CARD", "location": "Block C, 2nd Floor" }
```

```json
{
  "data": {
    "id": "665f1b2c8a1e2f001234567a",
    "name": "Cardiology",
    "code": "CARD",
    "location": "Block C, 2nd Floor",
    "isActive": true
  },
  "meta": {}
}
```

**List active departments for a dropdown**

```http
GET /departments/active
Authorization: Bearer <accessToken>
```

```json
{ "data": [ { "id": "...", "name": "ICU", "code": "ICU" }, "..." ], "meta": {} }
```

## Business logic notes

- `ensureSeeded()` (used by `SeedService`) is idempotent — it checks for an
  existing document by `code` before inserting, so re-running the seed on
  every boot never creates duplicates.
- Deletion is soft (`isDeleted`/`deletedAt`); a department with equipment
  still assigned to it is not currently blocked from deletion at the API
  layer — deleting a department does not cascade to its equipment.
