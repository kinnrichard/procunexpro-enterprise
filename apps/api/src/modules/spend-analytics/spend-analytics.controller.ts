import {
  Controller, Get, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SpendAnalyticsService } from './spend-analytics.service';

@Controller('spend-analytics')
@UseGuards(JwtAuthGuard)
export class SpendAnalyticsController {
  constructor(private readonly spendAnalyticsService: SpendAnalyticsService) {}

  @Get('by-vendor')
  byVendor(@Req() req: any) {
    return this.spendAnalyticsService.byVendor(req.user.tenantId);
  }

  @Get('by-category')
  byCategory(@Req() req: any) {
    return this.spendAnalyticsService.byCategory(req.user.tenantId);
  }

  @Get('by-department')
  byDepartment(@Req() req: any) {
    return this.spendAnalyticsService.byDepartment(req.user.tenantId);
  }

  @Get('trends')
  trends(@Req() req: any) {
    return this.spendAnalyticsService.trends(req.user.tenantId);
  }

  @Get('summary')
  summary(@Req() req: any) {
    return this.spendAnalyticsService.summary(req.user.tenantId);
  }
}
