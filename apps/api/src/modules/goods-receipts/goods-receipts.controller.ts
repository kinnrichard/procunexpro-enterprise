import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { GoodsReceiptsService } from './goods-receipts.service';

@Controller('goods-receipts')
@UseGuards(JwtAuthGuard)
export class GoodsReceiptsController {
  constructor(private readonly service: GoodsReceiptsService) {}

  @Get('receivable-pos')
  receivablePos(@Req() req: any) {
    return this.service.receivablePurchaseOrders(req.user.tenantId);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      purchaseOrderId,
      dateFrom,
      dateTo,
    });
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.service.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.user.tenantId, req.user.id, body);
  }
}
