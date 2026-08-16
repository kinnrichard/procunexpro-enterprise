import {
  Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { StockMovementsService } from './stock-movements.service';

const MODULE = 'products';
const APPROVER_ROLES = ['SUPERADMIN', 'ADMIN', 'MANAGER'];

function assertCanApprove(role: string) {
  if (!APPROVER_ROLES.includes(role)) {
    throw new ForbiddenException('Only a manager can approve or reject stock movements');
  }
}

@Controller('stock-movements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('direction') direction?: string,
    @Query('productId') productId?: string,
    @Query('warehouseId') warehouseId?: string,
    @Query('createdDateFrom') createdDateFrom?: string,
    @Query('createdDateTo') createdDateTo?: string,
  ) {
    return this.stockMovementsService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      type,
      direction,
      productId,
      warehouseId,
      createdDateFrom,
      createdDateTo,
    });
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.stockMovementsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.stockMovementsService.create(req.user.tenantId, req.user.id, body);
  }

  @Put(':id/approve')
  @RequirePermission(MODULE, 'view')
  approve(@Req() req: any, @Param('id') id: string) {
    assertCanApprove(req.user.role);
    return this.stockMovementsService.approve(req.user.tenantId, req.user.id, id);
  }

  @Put(':id/reject')
  @RequirePermission(MODULE, 'view')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string }) {
    assertCanApprove(req.user.role);
    return this.stockMovementsService.reject(req.user.tenantId, req.user.id, id, body?.reason);
  }
}
