import {
  Controller, Get, Post, Put, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StockLotsService } from './stock-lots.service';

@Controller('stock-lots')
@UseGuards(JwtAuthGuard)
export class StockLotsController {
  constructor(private readonly service: StockLotsService) {}

  @Get('expiring')
  expiring(@Req() req: any, @Query('days') days?: string) {
    return this.service.expiring(req.user.tenantId, days ? Number.parseInt(days) : 30);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('productId') productId?: string,
    @Query('status') status?: string,
    @Query('qcStatus') qcStatus?: string,
    @Query('warehouseId') warehouseId?: string,
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
      dateFrom,
      dateTo,
      search,
    });
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.service.create(req.user.tenantId, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.update(req.user.tenantId, id, body);
  }
}
