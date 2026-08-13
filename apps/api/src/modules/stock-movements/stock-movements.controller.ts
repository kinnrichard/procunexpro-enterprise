import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { StockMovementsService } from './stock-movements.service';

@Controller('stock-movements')
@UseGuards(JwtAuthGuard)
export class StockMovementsController {
  constructor(private readonly stockMovementsService: StockMovementsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
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
      productId,
      warehouseId,
      createdDateFrom,
      createdDateTo,
    });
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.stockMovementsService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.stockMovementsService.create(req.user.tenantId, req.user.id, body);
  }
}
