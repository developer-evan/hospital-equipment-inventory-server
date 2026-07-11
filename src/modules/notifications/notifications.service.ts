import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { buildPaginationMeta } from '../../common/dto/pagination-query.dto';
import { NOTIFICATION_SENDER } from '../../common/interfaces/notification-sender.interface';
import type { NotificationSender } from '../../common/interfaces/notification-sender.interface';
import { PaginatedResult } from '../../common/interceptors/response.interceptor';
import { QueryNotificationDto } from './dto/query-notification.dto';
import { NotificationType } from './enums/notification-type.enum';
import {
  Notification,
  NotificationDocument,
} from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name)
    private readonly notificationModel: Model<NotificationDocument>,
    @Inject(NOTIFICATION_SENDER) private readonly sender: NotificationSender,
  ) {}

  async notifyUsers(
    recipientUserIds: (string | Types.ObjectId)[],
    type: NotificationType,
    title: string,
    message: string,
    relatedEquipmentId?: string,
  ): Promise<void> {
    await Promise.all(
      recipientUserIds.map((recipientUserId) =>
        this.sender.send({
          recipientUserId: recipientUserId.toString(),
          type,
          title,
          message,
          relatedEquipmentId,
        }),
      ),
    );
  }

  async findForUser(
    userId: string,
    query: QueryNotificationDto,
  ): Promise<PaginatedResult<NotificationDocument>> {
    const filter: Record<string, unknown> = {
      recipient: new Types.ObjectId(userId),
    };
    if (query.unreadOnly) filter.isRead = false;

    const [items, totalItems] = await Promise.all([
      this.notificationModel
        .find(filter)
        .populate('relatedEquipment', 'assetNumber name')
        .sort({ createdAt: -1 })
        .skip(query.skip)
        .limit(query.limit ?? 10)
        .lean(),
      this.notificationModel.countDocuments(filter),
    ]);

    return {
      items: items as unknown as NotificationDocument[],
      meta: buildPaginationMeta(query.page ?? 1, query.limit ?? 10, totalItems),
    };
  }

  async countUnread(userId: string): Promise<number> {
    return this.notificationModel.countDocuments({
      recipient: new Types.ObjectId(userId),
      isRead: false,
    });
  }

  async markAsRead(id: string, userId: string): Promise<NotificationDocument> {
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: id, recipient: new Types.ObjectId(userId) },
      { isRead: true, readAt: new Date() },
      { new: true },
    );
    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }
    return notification;
  }

  async markAllAsRead(userId: string): Promise<number> {
    const result = await this.notificationModel.updateMany(
      { recipient: new Types.ObjectId(userId), isRead: false },
      { isRead: true, readAt: new Date() },
    );
    return result.modifiedCount;
  }
}
