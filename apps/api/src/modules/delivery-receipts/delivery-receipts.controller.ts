import {
  Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { DeliveryReceiptsService } from './delivery-receipts.service';

const MODULE = 'deliveries';

@Controller('delivery-receipts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DeliveryReceiptsController {
  constructor(private readonly service: DeliveryReceiptsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('createdDateFrom') createdDateFrom?: string,
    @Query('createdDateTo') createdDateTo?: string,
  ) {
    return this.service.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      customerId,
      createdDateFrom,
      createdDateTo,
    });
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.user.tenantId, req.user.id, body);
  }

  @Post(':id/cancel')
  @RequirePermission(MODULE, 'edit')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.service.cancel(req.user.tenantId, id);
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
}
