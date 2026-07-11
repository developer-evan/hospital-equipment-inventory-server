import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NOTIFICATION_SENDER } from '../../common/interfaces/notification-sender.interface';
import { EquipmentModule } from '../equipment/equipment.module';
import { MaintenanceModule } from '../maintenance/maintenance.module';
import { UsersModule } from '../users/users.module';
import { EquipmentLifecycleListener } from './listeners/equipment-lifecycle.listener';
import { NotificationsController } from './notifications.controller';
import { NotificationsScheduler } from './notifications.scheduler';
import { NotificationsService } from './notifications.service';
import { InAppNotificationSender } from './providers/in-app-notification.sender';
import {
  Notification,
  NotificationSchema,
} from './schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
    ]),
    UsersModule,
    EquipmentModule,
    MaintenanceModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsScheduler,
    EquipmentLifecycleListener,
    InAppNotificationSender,
    { provide: NOTIFICATION_SENDER, useExisting: InAppNotificationSender },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
