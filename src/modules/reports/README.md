# Reports module

Exportable Excel (default) or PDF reports for inventory, condemned
equipment, preventive maintenance/calibration, corrective maintenance
("breakdown"), and per-engineer workload. **Every route requires the
`ADMINISTRATOR` role.**

**No own schema** — reads from `Equipment` and `Maintenance`. PDF generation
uses `pdfkit` programmatically (no Chromium/puppeteer dependency); Excel uses
`exceljs`.

## Endpoints

All `GET`, all return a **raw file download** (not the usual `{ data, meta }`
envelope — the controller writes directly to the response with `@Res()`).

| Path | Extra required query | Filters applied |
|------|----------------------|------------------|
| `/reports/inventory` | — | All `ReportFilterDto` fields |
| `/reports/department-inventory` | **`department`** | Same, `department` mandatory |
| `/reports/condemned` | — | Same, `status` forced to `CONDEMNED` |
| `/reports/pm` | — | Same, `type` forced to `PREVENTIVE` + `CALIBRATION` |
| `/reports/breakdown` | — | Same, `type` forced to `CORRECTIVE` |
| `/reports/engineer-work` | **`engineer`** | Same, scoped to one engineer |

### `ReportFilterDto` query params

| Param | Type | Notes |
|-------|------|-------|
| `department` | MongoId | optional unless noted above |
| `status` | `EquipmentStatus` | equipment reports only |
| `engineer` | MongoId | optional unless noted above |
| `from` / `to` | ISO date | inclusive range — `createdAt` for equipment reports, `scheduledDate` for maintenance reports |
| `format` | `excel` \| `pdf` | default `excel` |

## Sample requests

**Inventory report (Excel, default)**

```http
GET /reports/inventory?department=665f1b2c8a1e2f0012345678
Authorization: Bearer <adminAccessToken>
```

Response headers:

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="equipment-inventory-report.xlsx"
```

**Condemned equipment report (PDF)**

```http
GET /reports/condemned?format=pdf&from=2026-01-01&to=2026-06-30
Authorization: Bearer <adminAccessToken>
```

```
Content-Type: application/pdf
Content-Disposition: attachment; filename="condemned-equipment-report.pdf"
```

**Engineer workload report**

```http
GET /reports/engineer-work?engineer=665f1b2c8a1e2f001234567d&from=2026-07-01&to=2026-07-31
Authorization: Bearer <adminAccessToken>
```

Missing the required `engineer` param returns `400 Bad Request`
(`"engineer is required for the engineer work report"`).

## Report columns

**Equipment reports** (inventory / department-inventory / condemned):
Asset Number, Name, Category, Department, Status, Serial Number, Purchase
Date, Warranty End.

**Maintenance reports** (pm / breakdown / engineer-work):
Asset Number, Equipment, Type, Scheduled Date, Performed Date, Engineer,
Status, Spare Parts Cost (sum of `quantity × cost` across all spare parts
used on the record).

## Business logic notes

- Department scoping is still applied via `buildDepartmentFilter`, though in
  practice only `ADMINISTRATOR` can reach these endpoints, so it's a
  defense-in-depth no-op today.
- Filenames are slugified from the report title (lower-cased,
  non-alphanumeric runs replaced with `-`), e.g. `Equipment Inventory Report`
  → `equipment-inventory-report.xlsx`.
- Maintenance reports first resolve matching equipment IDs (when equipment
  filters are present), then filter maintenance records by
  `equipment: { $in: [...] }` — filters compose across both collections.
