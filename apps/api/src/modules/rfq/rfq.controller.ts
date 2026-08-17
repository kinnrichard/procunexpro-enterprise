import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { RfqService } from './rfq.service';

const MODULE = 'rfq';

@Controller('rfq')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RfqController {
  constructor(private readonly rfqService: RfqService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('createdDateFrom') createdDateFrom?: string,
    @Query('createdDateTo') createdDateTo?: string,
  ) {
    return this.rfqService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      vendorId,
      createdDateFrom,
      createdDateTo,
    });
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.findOne(req.user.tenantId, id);
  }

  @Get(':id/compare')
  @RequirePermission(MODULE, 'view')
  compare(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.compare(req.user.tenantId, id);
  }

  @Post('from-pr-items')
  @RequirePermission(MODULE, 'create')
  createFromPrItems(@Req() req: any, @Body() body: any) {
    return this.rfqService.createFromPrItems(req.user.tenantId, req.user.id, body);
  }

  @Post('from-purchase-request')
  @RequirePermission(MODULE, 'create')
  createFromPurchaseRequest(@Req() req: any, @Body() body: any) {
    return this.rfqService.createFromPurchaseRequest(req.user.tenantId, req.user.id, body);
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.rfqService.create(req.user.tenantId, body, req.user.id);
  }

  @Put(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.rfqService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.delete(req.user.tenantId, id);
  }

  @Put(':id/publish')
  @RequirePermission(MODULE, 'edit')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.publish(req.user.tenantId, id, req.user.id);
  }

  @Put(':id/approve')
  @RequirePermission(MODULE, 'view')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.approve(req.user.tenantId, id, req.user.id, req.user.role);
  }

  @Put(':id/reject')
  @RequirePermission(MODULE, 'view')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: { reason?: string }) {
    return this.rfqService.reject(req.user.tenantId, id, req.user.id, req.user.role, body?.reason);
  }

  @Put(':id/close')
  @RequirePermission(MODULE, 'edit')
  close(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.close(req.user.tenantId, id);
  }

  @Post(':id/quotes')
  @RequirePermission(MODULE, 'edit')
  addQuote(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.rfqService.addQuote(req.user.tenantId, id, body);
  }

  @Put(':id/quotes/:quoteId')
  @RequirePermission(MODULE, 'edit')
  updateQuote(
    @Req() req: any,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
    @Body() body: any,
  ) {
    return this.rfqService.updateQuote(req.user.tenantId, id, quoteId, body);
  }

  @Put(':id/award/:quoteId')
  @RequirePermission(MODULE, 'edit')
  award(
    @Req() req: any,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.rfqService.award(req.user.tenantId, id, quoteId);
  }

  @Post(':id/items')
  @RequirePermission(MODULE, 'edit')
  addItem(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.rfqService.addItem(req.user.tenantId, id, body);
  }

  @Patch(':id/items/:itemId')
  @RequirePermission(MODULE, 'edit')
  updateItem(
    @Req() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: any,
  ) {
    return this.rfqService.updateItem(req.user.tenantId, id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  @RequirePermission(MODULE, 'edit')
  deleteItem(
    @Req() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.rfqService.deleteItem(req.user.tenantId, id, itemId);
  }

  @Delete(':id/quotes/:quoteId')
  @RequirePermission(MODULE, 'edit')
  deleteQuote(
    @Req() req: any,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.rfqService.deleteQuote(req.user.tenantId, id, quoteId);
  }

  @Put(':id/cancel')
  @RequirePermission(MODULE, 'edit')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.cancel(req.user.tenantId, id);
  }
}
