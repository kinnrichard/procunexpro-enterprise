import { Body, Controller, Delete, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DashboardWidgetsService } from './dashboard-widgets.service';

const MODULE = 'dashboard';

@Controller('dashboard-widgets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardWidgetsController {
  constructor(private readonly service: DashboardWidgetsService) {}

  // Static catalog of every placeable widget.
  @Get('catalog')
  @RequirePermission(MODULE, 'view')
  catalog() {
    return { data: this.service.catalog() };
  }

  // All widgets (for edit mode).
  @Get()
  @RequirePermission(MODULE, 'view')
  async list(@Req() req: any) {
    return { data: await this.service.list(req.user.tenantId) };
  }

  // Widgets visible to the current viewer's role (what the dashboard renders).
  @Get('mine')
  @RequirePermission(MODULE, 'view')
  async mine(@Req() req: any) {
    return { data: await this.service.listForRole(req.user.tenantId, req.user.role) };
  }

  // Bulk-save grid positions after a drag/resize. (Before :id routes.)
  @Put('layout')
  @RequirePermission(MODULE, 'edit')
  async updateLayout(@Req() req: any, @Body() body: any) {
    return { data: await this.service.updateLayout(req.user.tenantId, body.items ?? body) };
  }

  @Get(':id/data')
  @RequirePermission(MODULE, 'view')
  async data(@Req() req: any, @Param('id') id: string) {
    return { data: await this.service.data(req.user.tenantId, id, req.user.role) };
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.user.tenantId, body);
  }

  @Put(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.service.remove(req.user.tenantId, id);
  }
}
