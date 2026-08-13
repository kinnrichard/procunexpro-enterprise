import {
  Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RfqService } from './rfq.service';

@Controller('rfq')
@UseGuards(JwtAuthGuard)
export class RfqController {
  constructor(private readonly rfqService: RfqService) {}

  @Get()
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
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.findOne(req.user.tenantId, id);
  }

  @Get(':id/compare')
  compare(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.compare(req.user.tenantId, id);
  }

  @Post('from-pr-items')
  createFromPrItems(@Req() req: any, @Body() body: any) {
    return this.rfqService.createFromPrItems(req.user.tenantId, req.user.id, body);
  }

  @Post('from-purchase-request')
  createFromPurchaseRequest(@Req() req: any, @Body() body: any) {
    return this.rfqService.createFromPurchaseRequest(req.user.tenantId, req.user.id, body);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.rfqService.create(req.user.tenantId, body, req.user.id);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.rfqService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.delete(req.user.tenantId, id);
  }

  @Put(':id/publish')
  publish(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.publish(req.user.tenantId, id);
  }

  @Put(':id/close')
  close(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.close(req.user.tenantId, id);
  }

  @Post(':id/quotes')
  addQuote(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.rfqService.addQuote(req.user.tenantId, id, body);
  }

  @Put(':id/quotes/:quoteId')
  updateQuote(
    @Req() req: any,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
    @Body() body: any,
  ) {
    return this.rfqService.updateQuote(req.user.tenantId, id, quoteId, body);
  }

  @Put(':id/award/:quoteId')
  award(
    @Req() req: any,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.rfqService.award(req.user.tenantId, id, quoteId);
  }

  @Post(':id/items')
  addItem(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.rfqService.addItem(req.user.tenantId, id, body);
  }

  @Patch(':id/items/:itemId')
  updateItem(
    @Req() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: any,
  ) {
    return this.rfqService.updateItem(req.user.tenantId, id, itemId, body);
  }

  @Delete(':id/items/:itemId')
  deleteItem(
    @Req() req: any,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.rfqService.deleteItem(req.user.tenantId, id, itemId);
  }

  @Delete(':id/quotes/:quoteId')
  deleteQuote(
    @Req() req: any,
    @Param('id') id: string,
    @Param('quoteId') quoteId: string,
  ) {
    return this.rfqService.deleteQuote(req.user.tenantId, id, quoteId);
  }

  @Put(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.rfqService.cancel(req.user.tenantId, id);
  }
}
