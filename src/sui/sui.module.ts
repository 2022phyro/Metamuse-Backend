import { Module } from '@nestjs/common';
import { SuiService } from './sui.service';
import { SuiController } from './sui.controller';

@Module({
  providers: [SuiService],
  controllers: [SuiController],
  exports: [SuiService],
})
export class SuiModule {}
