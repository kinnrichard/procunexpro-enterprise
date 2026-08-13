import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PurchaseOrdersService } from './purchase-orders.service';

const MODULE = 'purchase-orders';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('vendorId') vendorId?: string,
    @Query('orderDateFrom') orderDateFrom?: string,
    @Query('orderDateTo') orderDateTo?: string,
    @Query('amountMin') amountMin?: string,
    @Query('amountMax') amountMax?: string,
  ) {
    return this.purchaseOrdersService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      priority,
      vendorId,
      orderDateFrom,
      orderDateTo,
      amountMin,
      amountMax,
    });
  }

  @Post('from-pr-items')
  @RequirePermission(MODULE, 'create')
  createFromPrItems(@Req() req: any, @Body() body: any) {
    return this.purchaseOrdersService.createFromPrItems(req.user.tenantId, req.user.id, body);
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.purchaseOrdersService.create(req.user.tenantId, req.user.id, body);
  }

  @Put(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.purchaseOrdersService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.delete(req.user.tenantId, id);
  }

  @Patch(':id/items/:itemId')
  @RequirePermission(MODULE, 'edit')
  updateItem(@Req() req: any, @Param('id') id: string, @Param('itemId') itemId: string, @Body() body: any) {
    return this.purchaseOrdersService.updateItem(req.user.tenantId, id, itemId, body);
  }

  @Put(':id/submit')
  @RequirePermission(MODULE, 'edit')
  submit(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.submit(req.user.tenantId, id);
  }

  @Put(':id/approve')
  @RequirePermission(MODULE, 'edit')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.approve(req.user.tenantId, id, req.user.id);
  }

  @Put(':id/send')
  @RequirePermission(MODULE, 'edit')
  send(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.send(req.user.tenantId, id);
  }

  @Put(':id/receive')
  @RequirePermission(MODULE, 'edit')
  receive(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.receive(req.user.tenantId, id, req.user.id);
  }
}
