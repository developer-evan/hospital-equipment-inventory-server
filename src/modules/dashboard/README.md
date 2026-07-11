# Dashboard module

A single aggregated KPI summary endpoint for equipment counts, status
breakdown, department distribution, and preventive-maintenance due this
month — computed via one MongoDB `$facet` aggregation round trip against the
`equipment` collection, plus one `countDocuments` against `maintenance`.

**No own schema** — reads from `Equipment` and `Maintenance`.

## Endpoint

| Method | Path | Access | Query |
|--------|------|--------|-------|
| `GET` | `/dashboard/summary` | any authenticated (department-scoped) | `department?` (MongoId, narrows all counts to one department) |

## Response shape (`DashboardSummary`)

```typescript
{
  totalEquipment: number;
  working: number;
  underRepair: number;
  condemned: number;
  pendingInstallation: number;
  decommissioned: number;
  pmDueThisMonth: number;
  receivedToday: number;
  byDepartment: { departmentId: string; departmentName: string; count: number }[];
}
```

## Sample request

```http
GET /dashboard/summary
Authorization: Bearer <accessToken>
```

```json
{
  "data": {
    "totalEquipment": 142,
    "working": 118,
    "underRepair": 9,
    "condemned": 3,
    "pendingInstallation": 6,
    "decommissioned": 6,
    "pmDueThisMonth": 14,
    "receivedToday": 2,
    "byDepartment": [
      { "departmentId": "665f1b2c8a1e2f0012345678", "departmentName": "ICU", "count": 27 },
      { "departmentId": "665f1b2c8a1e2f0012345679", "departmentName": "Theatre", "count": 19 }
    ]
  },
  "meta": {}
}
```

Narrowed to one department:

```http
GET /dashboard/summary?department=665f1b2c8a1e2f0012345678
Authorization: Bearer <accessToken>
```

## Business logic notes

- **Department scoping:** `ADMINISTRATOR`/`STORE_OFFICER` see hospital-wide
  counts by default; `BIOMEDICAL_ENGINEER`/`DEPARTMENT_USER` are always
  scoped to their assigned departments, regardless of the `department` query
  param (it can only narrow *within* their allowed set).
- **`receivedToday`** — equipment with `createdAt >= start of today` (local
  server time, midnight).
- **`pmDueThisMonth`** — `PREVENTIVE`/`CALIBRATION` maintenance records with
  status `SCHEDULED` or `OVERDUE` and `scheduledDate` within the current
  calendar month, restricted to equipment IDs the caller can see.
- `byDepartment` is sorted by `count` descending.
