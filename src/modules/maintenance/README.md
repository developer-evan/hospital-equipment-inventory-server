# Maintenance module

Preventive, corrective, and calibration maintenance records for equipment —
scheduling, completion, spare-parts logging, and overdue tracking. Modeled as
a single collection with a `type` discriminator rather than three separate
schemas, since the fields overlap heavily and it keeps cross-type queries
(calendar view, engineer workload) simple.

## Schema (`Maintenance`)

| Field | Type | Notes |
|-------|------|-------|
| `equipment` | ObjectId → `Equipment` | required, indexed |
| `type` | `MaintenanceType` | `PREVENTIVE` \| `CORRECTIVE` \| `CALIBRATION` |
| `scheduledDate` | Date | required for `PREVENTIVE`/`CALIBRATION` |
| `performedDate` | Date | optional; set on completion |
| `engineer` | ObjectId → `User` | optional |
| `spareParts` | `{ partName, quantity, cost }[]` | default `[]` |
| `serviceReport` | string | optional |
| `photoUrls` | string[] | default `[]` |
| `status` | `MaintenanceStatus` | `SCHEDULED` \| `IN_PROGRESS` \| `OVERDUE` \| `COMPLETED` |
| `nextDueDate` | Date | computed for recurring types (`PREVENTIVE`/`CALIBRATION`) |
| `createdBy`, `updatedBy`, `isDeleted`, `deletedAt`, `createdAt`, `updatedAt` | — | from `BaseSchema` |

## Endpoints

| Method | Path | Roles | Notes |
|--------|------|-------|-------|
| `POST` | `/maintenance` | `ADMINISTRATOR`, `BIOMEDICAL_ENGINEER` | `CreateMaintenanceDto` |
| `GET` | `/maintenance` | any authenticated (department-scoped) | Paginated, filterable |
| `GET` | `/maintenance/schedule` | any authenticated (department-scoped) | Defaults to `SCHEDULED` + `OVERDUE` if `status` is omitted |
| `GET` | `/maintenance/equipment/:equipmentId/history` | any authenticated | Unpaginated array, most recent first |
| `GET` | `/maintenance/:id` | any authenticated | `equipment` + `engineer` populated |
| `PATCH` | `/maintenance/:id` | `ADMINISTRATOR`, `BIOMEDICAL_ENGINEER` | `UpdateMaintenanceDto` |
| `PATCH` | `/maintenance/:id/complete` | `ADMINISTRATOR`, `BIOMEDICAL_ENGINEER` | `CompleteMaintenanceDto` |
| `POST` | `/maintenance/:id/photos` | `ADMINISTRATOR`, `BIOMEDICAL_ENGINEER` | Multipart field `photos`, up to 10 images |
| `DELETE` | `/maintenance/:id` | `ADMINISTRATOR` | Soft delete, `204 No Content` |

### `GET /maintenance` / `GET /maintenance/schedule` query params (`QueryMaintenanceDto`)

Extends the standard `page`, `limit`, `sort` with:

| Param | Type | Notes |
|-------|------|-------|
| `equipment` | MongoId | filter by equipment |
| `engineer` | MongoId | filter by assigned engineer |
| `type` | `MaintenanceType` | exact match |
| `status` | `MaintenanceStatus` | exact match |
| `from` / `to` | ISO date | range on `scheduledDate` |

## Sample requests

**Schedule preventive maintenance**

```http
POST /maintenance
Authorization: Bearer <engineerAccessToken>
Content-Type: application/json

{
  "equipment": "665f1b2c8a1e2f001234567b",
  "type": "PREVENTIVE",
  "scheduledDate": "2026-08-01",
  "engineer": "665f1b2c8a1e2f001234567d"
}
```

**Mark complete** (with spare parts used)

```http
PATCH /maintenance/665f1b2c8a1e2f001234567e/complete
Authorization: Bearer <engineerAccessToken>
Content-Type: application/json

{
  "performedDate": "2026-08-01",
  "serviceReport": "Replaced CO2 absorbent canister, tested and calibrated.",
  "spareParts": [{ "partName": "CO2 absorbent canister", "quantity": 1, "cost": 25 }]
}
```

```json
{ "data": { "status": "COMPLETED", "performedDate": "2026-08-01T00:00:00.000Z", "...": "..." }, "meta": {} }
```

**View the maintenance schedule** (upcoming + overdue)

```http
GET /maintenance/schedule?page=1&limit=20
Authorization: Bearer <accessToken>
```

**Equipment maintenance history**

```http
GET /maintenance/equipment/665f1b2c8a1e2f001234567b/history
Authorization: Bearer <accessToken>
```

## Business logic notes

- **On create:** status is `COMPLETED` if `performedDate` is already supplied,
  otherwise `SCHEDULED`; `nextDueDate` is computed for `PREVENTIVE`/`CALIBRATION`
  using the equipment's `pmFrequencyDays`/`calibrationFrequencyDays`.
- **On `markComplete`:** sets `status: COMPLETED`, emits `maintenance.completed`,
  and for recurring types (`PREVENTIVE`/`CALIBRATION`) automatically creates the
  *next* `SCHEDULED` occurrence based on the equipment's cadence. The next
  occurrence correctly resolves the equipment reference whether or not the
  completed record's `equipment` field was populated.
- **`markOverdueRecords()`** flips any `SCHEDULED` record whose `scheduledDate`
  has passed to `OVERDUE`; invoked daily by the notifications cron job (see
  [`notifications`](../notifications/README.md)).
- **Department scoping:** for `BIOMEDICAL_ENGINEER`/`DEPARTMENT_USER`, list
  queries are scoped by resolving the equipment IDs in their assigned
  departments first, then filtering maintenance records to those IDs.
