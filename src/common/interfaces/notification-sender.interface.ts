export interface NotificationPayload {
  recipientUserId: string;
  title: string;
  message: string;
  type: string;
  relatedEquipmentId?: string;
}

export const NOTIFICATION_SENDER = 'NOTIFICATION_SENDER';

/**
 * Abstraction for delivering a notification. `InAppNotificationSender`
 * persists to the Notification collection today; an
 * `EmailNotificationSender` (nodemailer) could implement the same
 * interface and be swapped in via the `NOTIFICATION_SENDER` DI token
 * without touching NotificationsService call sites.
 */
export interface NotificationSender {
  send(payload: NotificationPayload): Promise<void>;
}
