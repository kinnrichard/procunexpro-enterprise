import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PurchaseRequestsService } from './purchase-requests.service';

class FindAllPurchaseRequestsQuery {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  priority?: string;
  companyId?: string;
  departmentId?: string;
  requiredDateFrom?: string;
  requiredDateTo?: string;
  createdDateFrom?: string;
  createdDateTo?: string;
  amountMin?: string;
  amountMax?: string;
}

@Controller('purchase-requests')
@UseGuards(JwtAuthGuard)
export class PurchaseRequestsController {
  constructor(private readonly purchaseRequestsService: PurchaseRequestsService) {}

  @Get()
  findAll(@Req() req: any, @Query() query: FindAllPurchaseRequestsQuery) {
    const { page, limit, search, status, priority, companyId, departmentId,
      requiredDateFrom, requiredDateTo, createdDateFrom, createdDateTo,
      amountMin, amountMax } = query;
    return this.purchaseRequestsService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      priority,
      companyId,
      departmentId,
      requiredDateFrom,
      requiredDateTo,
      createdDateFrom,
      createdDateTo,
      amountMin: amountMin ? Number.parseFloat(amountMin) : undefined,
      amountMax: amountMax ? Number.parseFloat(amountMax) : undefined,
    });
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.purchaseRequestsService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.purchaseRequestsService.create(req.user.tenantId, req.user.id, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.purchaseRequestsService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.purchaseRequestsService.delete(req.user.tenantId, id);
  }

  // ─── Line Item CRUD ──────────────────────────────────────

  @Post(':id/items')
  addItem(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.purchaseRequestsService.addItem(req.user.tenantId, id, body);
  }

  @Patch(':id/items/:itemId')
  updateItem(@Req() req: any, @Param('id') id: string, @Param('itemId') itemId: string, @Body() body: any) {
    return this.purchaseRequestsService.updateItem(req.user.tenantId, id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  deleteItem(@Req() req: any, @Param('id') id: string, @Param('itemId') itemId: string) {
    return this.purchaseRequestsService.deleteItem(req.user.tenantId, id, itemId);
  }

  @Post(':id/items/apply-vendor')
  applyVendorToAll(@Req() req: any, @Param('id') id: string, @Body() body: { vendorId: string }) {
    return this.purchaseRequestsService.applyVendorToAll(req.user.tenantId, id, body.vendorId);
  }

  // ─── Status Transitions ──────────────────────────────────

  @Put(':id/submit')
  submit(@Req() req: any, @Param('id') id: string) {
    return this.purchaseRequestsService.submit(req.user.tenantId, id);
  }

  @Put(':id/approve')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.purchaseRequestsService.approve(req.user.tenantId, id, req.user.id);
  }

  @Put(':id/reject')
  reject(@Req() req: any, @Param('id') id: string, @Body() body: { rejectionNote?: string }) {
    return this.purchaseRequestsService.reject(req.user.tenantId, id, body.rejectionNote || '', req.user.id);
  }
}
