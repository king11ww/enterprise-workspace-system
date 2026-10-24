import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { NOTIFICATIONS_QUEUE, NOTIFICATION_JOBS } from './notifications.constants.js';
import type { BookingNotificationJobData } from './dto/notification-job.dto.js';

@Injectable()
export class NotificationsProducerService {
  private readonly logger = new Logger(NotificationsProducerService.name);

  constructor(
    @InjectQueue(NOTIFICATIONS_QUEUE)
    private readonly notificationsQueue: Queue<BookingNotificationJobData>,
  ) {}

  async sendBookingConfirmation(data: BookingNotificationJobData) {
    try {
      const job = await this.notificationsQueue.add(
        NOTIFICATION_JOBS.BOOKING_CONFIRMATION,
        data,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(
        `[Queue] Pushed ${NOTIFICATION_JOBS.BOOKING_CONFIRMATION} job #${job.id} for Booking ${data.bookingId} to user ${data.userEmail}`,
      );

      return job;
    } catch (error) {
      this.logger.error(
        `[Queue] Failed to push notification job: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sendBookingCancellation(data: BookingNotificationJobData) {
    try {
      const job = await this.notificationsQueue.add(
        NOTIFICATION_JOBS.BOOKING_CANCELLATION,
        data,
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );

      this.logger.log(
        `[Queue] Pushed ${NOTIFICATION_JOBS.BOOKING_CANCELLATION} job #${job.id} for Booking ${data.bookingId} to user ${data.userEmail}`,
      );

      return job;
    } catch (error) {
      this.logger.error(
        `[Queue] Failed to push cancellation job: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
