import { Module } from '@nestjs/common';
import { DashboardWidgetsController } from './dashboard-widgets.controller';
import { DashboardWidgetsService } from './dashboard-widgets.service';
import { DashboardModule } from '../dashboard/dashboard.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [DashboardModule, PermissionsModule],
  controllers: [DashboardWidgetsController],
  providers: [DashboardWidgetsService],
})
export class DashboardWidgetsModule {}
