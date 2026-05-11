import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PurchaseOrdersService } from './purchase-orders.service';

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard)
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.purchaseOrdersService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      priority,
    });
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.purchaseOrdersService.create(req.user.tenantId, req.user.id, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.purchaseOrdersService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.delete(req.user.tenantId, id);
  }

  @Put(':id/submit')
  submit(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.submit(req.user.tenantId, id);
  }

  @Put(':id/approve')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.approve(req.user.tenantId, id, req.user.id);
  }

  @Put(':id/send')
  send(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.send(req.user.tenantId, id);
  }

  @Put(':id/receive')
  receive(@Req() req: any, @Param('id') id: string) {
    return this.purchaseOrdersService.receive(req.user.tenantId, id, req.user.id);
  }
}
