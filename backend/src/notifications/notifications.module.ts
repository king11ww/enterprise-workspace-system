import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NOTIFICATIONS_QUEUE } from './notifications.constants.js';
import { NotificationsProducerService } from './notifications-producer.service.js';
import { NotificationsProcessor } from './notifications.processor.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: NOTIFICATIONS_QUEUE,
    }),
  ],
  providers: [NotificationsProducerService, NotificationsProcessor],
  exports: [NotificationsProducerService],
})
export class NotificationsModule {}
