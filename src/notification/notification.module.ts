import { Module } from '@nestjs/common';
import { EmailService } from './notification.service';

@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class NotificationModule {}
