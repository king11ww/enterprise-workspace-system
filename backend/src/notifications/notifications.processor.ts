import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { NOTIFICATIONS_QUEUE, NOTIFICATION_JOBS } from './notifications.constants.js';
import type { BookingNotificationJobData } from './dto/notification-job.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Processor(NOTIFICATIONS_QUEUE)
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<BookingNotificationJobData>): Promise<void> {
    const data = job.data;
    const startTimeStr = new Date(data.startTime).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });
    const endTimeStr = new Date(data.endTime).toLocaleString('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
    });

    switch (job.name) {
      case NOTIFICATION_JOBS.BOOKING_CONFIRMATION: {
        this.logger.log(
          `🚀 [Worker Process] Processing Confirmation Email (Job #${job.id}) for user: ${data.userEmail}`,
        );

        // Giả lập thời gian trễ gửi email qua SMTP (100ms - 200ms)
        await new Promise((resolve) => setTimeout(resolve, 150));

        this.logger.log(`
┌──────────────────────────────────────────────────────────────┐
│ 📨 EMAIL DISPATCHED (MOCK SMTP)                              │
├──────────────────────────────────────────────────────────────┤
│ Đến (To):       ${data.userName} <${data.userEmail}>
│ Tiêu đề:        [Xác nhận] Đặt thành công: ${data.resourceName}
│ Địa điểm:       ${data.resourceLocation || 'Không xác định'}
│ Thời gian:      ${startTimeStr} -> ${endTimeStr}
│ Nội dung:       Xin chào ${data.userName}, yêu cầu đặt chỗ của
│                 bạn cho "${data.title || data.resourceName}" đã được hệ thống
│                 xác nhận thành công.
└──────────────────────────────────────────────────────────────┘`);

        // Ghi vết vào AuditLog
        await this.prisma.auditLog.create({
          data: {
            userId: data.userId,
            action: 'NOTIFICATION_EMAIL_SENT',
            entityType: 'Booking',
            entityId: data.bookingId,
            payload: {
              jobId: job.id,
              recipient: data.userEmail,
              type: 'CONFIRMATION',
              resource: data.resourceName,
              dispatchedAt: new Date().toISOString(),
            },
          },
        });
        break;
      }

      case NOTIFICATION_JOBS.BOOKING_CANCELLATION: {
        this.logger.log(
          `🚀 [Worker Process] Processing Cancellation Notice (Job #${job.id}) for user: ${data.userEmail}`,
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        this.logger.log(`
┌──────────────────────────────────────────────────────────────┐
│ ⚠️ CANCELLATION NOTICE DISPATCHED                            │
├──────────────────────────────────────────────────────────────┤
│ Đến (To):       ${data.userName} <${data.userEmail}>
│ Tiêu đề:        [Thông báo] Lịch đặt đã bị hủy: ${data.resourceName}
│ Thời gian:      ${startTimeStr} -> ${endTimeStr}
└──────────────────────────────────────────────────────────────┘`);

        await this.prisma.auditLog.create({
          data: {
            userId: data.userId,
            action: 'NOTIFICATION_CANCELLATION_SENT',
            entityType: 'Booking',
            entityId: data.bookingId,
            payload: {
              jobId: job.id,
              recipient: data.userEmail,
              type: 'CANCELLATION',
              resource: data.resourceName,
              dispatchedAt: new Date().toISOString(),
            },
          },
        });
        break;
      }

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }
}
