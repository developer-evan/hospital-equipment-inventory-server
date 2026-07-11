# Notifications module

In-app notifications for the current user, plus scheduled (cron) and
event-driven fan-out to admins and biomedical engineers. The `NotificationSender`
interface documents exactly where an email sender (e.g. nodemailer) would
plug in later — only an `InAppNotificationSender` is wired today.

## Schema (`Notification`)

| Field | Type | Notes |
|-------|------|-------|
| `recipient` | ObjectId → `User` | required, indexed |
| `type` | `NotificationType` | required |
| `title` | string | required |
| `message` | string | required |
| `relatedEquipment` | ObjectId → `Equipment` | optional |
| `isRead` | boolean | default `false` |
| `readAt` | Date | optional |
| `createdAt`, `updatedAt` | Date | timestamps |

`NotificationType`: `PM_DUE` \| `CALIBRATION_DUE` \| `WARRANTY_EXPIRING` \|
`MAINTENANCE_OVERDUE` \| `EQUIPMENT_RECEIVED` \| `EQUIPMENT_INSTALLED`

## Endpoints

| Method | Path | Access | Notes |
|--------|------|--------|-------|
| `GET` | `/notifications` | any authenticated (own notifications only) | Paginated |
| `GET` | `/notifications/unread-count` | any authenticated | `{ count: number }` |
| `PATCH` | `/notifications/:id/read` | any authenticated (own only) | Marks one notification read |
| `PATCH` | `/notifications/read-all` | any authenticated | `{ updated: number }` |

### `GET /notifications` query params

Extends the standard `page`, `limit`, `sort` with `unreadOnly` (boolean).

## Sample requests

```http
GET /notifications?unreadOnly=true&page=1&limit=20
Authorization: Bearer <accessToken>
```

```json
{
  "data": [
    {
      "id": "...",
      "type": "PM_DUE",
      "title": "Preventive maintenance due",
      "message": "Patient Monitor (EQ-2026-00042) is due for PM on 2026-08-01",
      "relatedEquipment": "665f1b2c8a1e2f001234567b",
      "isRead": false
    }
  ],
  "meta": { "page": 1, "limit": 20, "totalItems": 1, "totalPages": 1 }
}
```

```http
PATCH /notifications/read-all
Authorization: Bearer <accessToken>
```

```json
{ "data": { "updated": 4 }, "meta": {} }
```

## Scheduled jobs (`NotificationsScheduler`, `@nestjs/schedule`)

| Schedule | Action |
|----------|--------|
| Daily 06:00 | `MaintenanceService.markOverdueRecords()` — flips past-due `SCHEDULED` records to `OVERDUE` |
| Daily 07:00 | Notifies `ADMINISTRATOR`s + the assigned engineer for PM/calibration due within `PM_DUE_LEAD_DAYS` days |
| Daily 07:30 | Notifies `ADMINISTRATOR`s + all `BIOMEDICAL_ENGINEER`s for equipment whose warranty expires within `WARRANTY_EXPIRING_LEAD_DAYS` days |

## Event listeners (`EquipmentLifecycleListener`)

| Listens to | Emitted by | Recipients | Notification type |
|------------|-----------|-------------|--------------------|
| `equipment.received` | [`receiving`](../receiving/README.md) | `ADMINISTRATOR`, `BIOMEDICAL_ENGINEER` | `EQUIPMENT_RECEIVED` |
| `equipment.installed` | [`receiving`](../receiving/README.md) | `ADMINISTRATOR` | `EQUIPMENT_INSTALLED` |

## Extending with email

Swap in an email-capable sender by implementing `NotificationSender`
(`src/common/interfaces/notification-sender.interface.ts`) and rebinding the
DI token used by `NotificationsModule` — no controller/service code changes
required.
