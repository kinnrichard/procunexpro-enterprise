import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StockTransfersService } from './stock-transfers.service';

@Controller('stock-transfers')
@UseGuards(JwtAuthGuard)
export class StockTransfersController {
  constructor(private readonly service: StockTransfersService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('fromWarehouseId') fromWarehouseId?: string,
    @Query('toWarehouseId') toWarehouseId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.service.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      fromWarehouseId,
      toWarehouseId,
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
