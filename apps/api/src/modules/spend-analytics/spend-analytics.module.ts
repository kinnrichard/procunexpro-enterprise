import { Module } from '@nestjs/common';
import { SpendAnalyticsController } from './spend-analytics.controller';
import { SpendAnalyticsService } from './spend-analytics.service';

@Module({
  controllers: [SpendAnalyticsController],
  providers: [SpendAnalyticsService],
  exports: [SpendAnalyticsService],
})
export class SpendAnalyticsModule {}
