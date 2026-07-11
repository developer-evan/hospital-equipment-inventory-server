import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type {
  NotificationPayload,
  NotificationSender,
} from '../../../common/interfaces/notification-sender.interface';
import { NotificationType } from '../enums/notification-type.enum';
import {
  Notification,
  NotificationDocument,
} from '../schemas/notification.schema';

/**
 * Default implementation: persists to the Notification collection so
 * it shows up in the recipient's in-app notification list. An
 * `EmailNotificationSender` (nodemailer) implementing the same
 * `NotificationSender` interface could be swapped in later via the
 * `NOTIFICATION_SENDER` DI token in `NotificationsModule` — no call
 * sites elsewhere would need to change.
 */
@Injectable()
export class InAppNotificationSender implements NotificationSender {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
  ) {}

  async send(payload: NotificationPayload): Promise<void> {
    await this.notificationModel.create({
      recipient: new Types.ObjectId(payload.recipientUserId),
      type: payload.type as NotificationType,
      title: payload.title,
      message: payload.message,
      relatedEquipment: payload.relatedEquipmentId
        ? new Types.ObjectId(payload.relatedEquipmentId)
        : undefined,
    });
  }
}
