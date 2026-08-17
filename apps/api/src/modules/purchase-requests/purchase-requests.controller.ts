import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { PurchaseRequestsService } from './purchase-requests.service';

const MODULE = 'purchase-requests';

class FindAllPrQuery {
  @IsOptional() @IsString() page?: string;
  @IsOptional() @IsString() limit?: string;
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() priority?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsString() departmentId?: string;
  @IsOptional() @IsString() requiredDateFrom?: string;
  @IsOptional() @IsString() requiredDateTo?: string;
  @IsOptional() @IsString() createdDateFrom?: string;
  @IsOptional() @IsString() createdDateTo?: string;
  @IsOptional() @IsString() amountMin?: string;
  @IsOptional() @IsString() amountMax?: string;
}

@Controller('purchase-requests')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PurchaseRequestsController {
  constructor(private readonly purchaseRequestsService: PurchaseRequestsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(@Req() req: any, @Query() query: FindAllPrQuery) {
    return this.purchaseRequestsService.findAll(req.user.tenantId, {
      page: query.page ? Number.parseInt(query.page) : undefined,
      limit: query.limit ? Number.parseInt(query.limit) : undefined,
      search: query.search, status: query.status, priority: query.priority,
      companyId: query.companyId, departmentId: query.departmentId,
      requiredDateFrom: query.requiredDateFrom, requiredDateTo: query.requiredDateTo,
      createdDateFrom: query.createdDateFrom, createdDateTo: query.createdDateTo,
      amountMin: query.amountMin ? Number.parseFloat(query.amountMin) : undefined,
      amountMax: query.amountMax ? Number.parseFloat(query.amountMax) : undefined,
    });
  }

  @Get('items/all')
  @RequirePermission(MODULE, 'view')
  findAllItems(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string, @Query('prStatus') prStatus?: string) {
    return this.purchaseRequestsService.findAllItems(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search, prStatus,
    });
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.purchaseRequestsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.purchaseRequestsService.create(req.user.tenantId, req.user.id, body);
  }

  @Put(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.purchaseRequestsService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.purchaseRequestsService.delete(req.user.tenantId, id);
  }

  // ─── Line Item CRUD ──────────────────────────────────────

  @Post(':id/items')
  @RequirePermission(MODULE, 'edit')
  addItem(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.purchaseRequestsService.addItem(req.user.tenantId, id, body);
  }

  @Patch(':id/items/:itemId')
  @RequirePermission(MODULE, 'edit')
  updateItem(@Req() req: any, @Param('id') id: string, @Param('itemId') itemId: string, @Body() body: any) {
    return this.purchaseRequestsService.updateItem(req.user.tenantId, id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  @RequirePermission(MODULE, 'edit')
  deleteItem(@Req() req: any, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.purchaseRequestsService.deleteItem(req.user.tenantId, id, itemId);
  }

  @Post(':id/items/apply-vendor')
  @RequirePermission(MODULE, 'edit')
  applyVendorToAll(@Req() req: any, @Param('id') id: string, @Body() body: { vendorId: string }) {
    return this.purchaseRequestsService.applyVendorToAll(req.user.tenantId, id, body.vendorId);
  }

  // ─── Status Transitions ──────────────────────────────────

  @Put(':id/submit')
  @RequirePermission(MODULE, 'edit')
  submit(@Req() req: any, @Param('id') id: string) {
    return this.purchaseRequestsService.submit(req.user.tenantId, id, req.user.id);
  }

  @Put(':id/approve')
  @RequirePermission(MODULE, 'view')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.purchaseRequestsService.approve(req.user.tenantId, id, req.user.id, req.user.role);
  }

  @Put(':id/reject')
  @RequirePermission(MODULE, 'view')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: { rejectionNote?: string }) {
    return this.purchaseRequestsService.reject(req.user.tenantId, id, body.rejectionNote || '', req.user.id, req.user.role);
  }

  @Put(':id/procurement-sub-status')
  @RequirePermission(MODULE, 'edit')
  updateProcurementSubStatus(@Req() req: any, @Param('id') id: string, @Body() body: { subStatus: string }) {
    return this.purchaseRequestsService.updateProcurementSubStatus(req.user.tenantId, id, body.subStatus);
  }
}
