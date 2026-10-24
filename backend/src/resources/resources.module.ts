import { Module } from '@nestjs/common';
import { ResourcesService } from './resources.service.js';
import { ResourcesController } from './resources.controller.js';

@Module({
  controllers: [ResourcesController],
  providers: [ResourcesService],
  exports: [ResourcesService],
})
export class ResourcesModule {}
