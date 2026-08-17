import {
  Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { StockLotsService } from './stock-lots.service';

const MODULE = 'products';

@Controller('stock-lots')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockLotsController {
  constructor(private readonly service: StockLotsService) {}

  @Get('expiring')
  @RequirePermission(MODULE, 'view')
  expiring(@Req() req: any, @Query('days') days?: string) {
    return this.service.expiring(req.user.tenantId, days ? Number.parseInt(days) : 30);
  }

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('qcStatus') qcStatus?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('areaId') areaId?: string,
    @Query('locationId') locationId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('search') search?: string,
  ) {
    return this.service.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      productId,
      status,
      qcStatus,
      warehouseId,
      areaId,
      locationId,
      dateFrom,
      dateTo,
      search,
    });
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.user.tenantId, body, req.user.id);
  }

  @Put(':id/approve')
  @RequirePermission(MODULE, 'view')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.service.approve(req.user.tenantId, id, req.user.id, req.user.role);
  }

  @Put(':id/reject')
  @RequirePermission(MODULE, 'view')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.service.reject(req.user.tenantId, id, req.user.id, req.user.role, body?.reason);
  }

  @Put(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(req.user.tenantId, id, body);
  }
}
