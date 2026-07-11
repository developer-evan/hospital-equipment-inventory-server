import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Role } from '../../common/enums/role.enum';
import { EquipmentService } from '../equipment/equipment.service';
import { MaintenanceType } from '../maintenance/enums/maintenance-type.enum';
import { MaintenanceDocument } from '../maintenance/schemas/maintenance.schema';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { UsersService } from '../users/users.service';
import { NotificationType } from './enums/notification-type.enum';
import { NotificationsService } from './notifications.service';

/**
 * Daily checks driving the three time-based notification types called
 * out in the spec (PM due, calibration due, warranty expiring).
 * "New equipment received" is event-driven instead — see
 * `equipment-lifecycle.listener.ts`.
 */
@Injectable()
export class NotificationsScheduler {
  private readonly logger = new Logger(NotificationsScheduler.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly maintenanceService: MaintenanceService,
    private readonly equipmentService: EquipmentService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async handleOverdueMaintenance(): Promise<void> {
    const flipped = await this.maintenanceService.markOverdueRecords();
    if (flipped > 0) {
      this.logger.log(`Marked ${flipped} maintenance record(s) as OVERDUE`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async handlePmAndCalibrationDue(): Promise<void> {
    const leadDays = this.configService.get<number>(
      'notifications.pmDueLeadDays',
    )!;
    const dueRecords =
      await this.maintenanceService.findDueWithinDays(leadDays);

    const admins = await this.usersService.findActiveByRoles([
      Role.ADMINISTRATOR,
    ]);
    const adminIds = admins.map((a) => a.id);

    for (const record of dueRecords) {
      const recipients = new Set<string>(adminIds);
      if (record.engineer) {
        recipients.add(
          (
            record.engineer as unknown as { _id: { toString(): string } }
          )._id.toString(),
        );
      }

      const type = this.notificationTypeFor(record);
      const equipmentLabel = this.equipmentLabel(record);

      await this.notificationsService.notifyUsers(
        Array.from(recipients),
        type,
        this.titleFor(type),
        `${equipmentLabel} has ${record.type.toLowerCase()} maintenance due on ${record.scheduledDate?.toDateString()}.`,
        (
          record.equipment as unknown as { _id: { toString(): string } }
        )._id?.toString(),
      );
    }

    this.logger.log(
      `Sent due-maintenance notifications for ${dueRecords.length} record(s)`,
    );
  }

  @Cron('30 7 * * *')
  async handleWarrantyExpiring(): Promise<void> {
    const leadDays = this.configService.get<number>(
      'notifications.warrantyExpiringLeadDays',
    )!;
    const expiringEquipment =
      await this.equipmentService.findWarrantyExpiringWithinDays(leadDays);

    const recipients = await this.usersService.findActiveByRoles([
      Role.ADMINISTRATOR,
      Role.BIOMEDICAL_ENGINEER,
    ]);
    const recipientIds = recipients.map((r) => r.id);

    for (const equipment of expiringEquipment) {
      await this.notificationsService.notifyUsers(
        recipientIds,
        NotificationType.WARRANTY_EXPIRING,
        'Warranty expiring soon',
        `${equipment.name} (${equipment.assetNumber}) warranty expires on ${equipment.warrantyEndDate?.toDateString()}.`,
        equipment.id,
      );
    }

    this.logger.log(
      `Sent warranty-expiring notifications for ${expiringEquipment.length} item(s)`,
    );
  }

  private notificationTypeFor(record: MaintenanceDocument): NotificationType {
    if (record.type === MaintenanceType.CALIBRATION)
      return NotificationType.CALIBRATION_DUE;
    return NotificationType.PM_DUE;
  }

  private titleFor(type: NotificationType): string {
    return type === NotificationType.CALIBRATION_DUE
      ? 'Calibration due soon'
      : 'Preventive maintenance due soon';
  }

  private equipmentLabel(record: MaintenanceDocument): string {
    const equipment = record.equipment as unknown as {
      name?: string;
      assetNumber?: string;
    };
    return equipment?.name
      ? `${equipment.name} (${equipment.assetNumber})`
      : 'Equipment';
  }
}
