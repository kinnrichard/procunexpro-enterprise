import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@Req() req: any) {
    return this.dashboardService.getStats(req.user.tenantId);
  }

  @Get('recent-activity')
  getRecentActivity(@Req() req: any) {
    return this.dashboardService.getRecentActivity(req.user.tenantId);
  }

  @Get('charts/procurement')
  getProcurementChart(@Req() req: any) {
    return this.dashboardService.getProcurementChart(req.user.tenantId);
  }

  @Get('charts/stock-alerts')
  getStockAlerts(@Req() req: any) {
    return this.dashboardService.getStockAlerts(req.user.tenantId);
  }
}
