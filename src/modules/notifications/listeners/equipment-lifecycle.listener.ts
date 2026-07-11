import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Role } from '../../../common/enums/role.enum';
import {
  EquipmentEvents,
  EquipmentInstalledEvent,
  EquipmentReceivedEvent,
} from '../../receiving/events/equipment-lifecycle.events';
import { UsersService } from '../../users/users.service';
import { NotificationType } from '../enums/notification-type.enum';
import { NotificationsService } from '../notifications.service';

/**
 * Reacts to lifecycle events emitted by `ReceivingService` — this is
 * the "new equipment received" notification path called out in the
 * spec as event-driven rather than cron-driven.
 */
@Injectable()
export class EquipmentLifecycleListener {
  private readonly logger = new Logger(EquipmentLifecycleListener.name);

  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
  ) {}

  @OnEvent(EquipmentEvents.RECEIVED)
  async handleEquipmentReceived(event: EquipmentReceivedEvent): Promise<void> {
    const recipients = await this.usersService.findActiveByRoles([
      Role.ADMINISTRATOR,
      Role.BIOMEDICAL_ENGINEER,
    ]);

    await this.notificationsService.notifyUsers(
      recipients.map((r) => r.id),
      NotificationType.EQUIPMENT_RECEIVED,
      'New equipment received',
      `Asset ${event.assetNumber} was registered and is pending installation confirmation.`,
      event.equipmentId,
    );

    this.logger.log(
      `Notified ${recipients.length} user(s) about received equipment ${event.assetNumber}`,
    );
  }

  @OnEvent(EquipmentEvents.INSTALLED)
  async handleEquipmentInstalled(
    event: EquipmentInstalledEvent,
  ): Promise<void> {
    const recipients = await this.usersService.findActiveByRoles([
      Role.ADMINISTRATOR,
    ]);

    await this.notificationsService.notifyUsers(
      recipients.map((r) => r.id),
      NotificationType.EQUIPMENT_INSTALLED,
      'Equipment installed',
      `Asset ${event.assetNumber} installation was confirmed and is now active.`,
      event.equipmentId,
    );
  }
}
