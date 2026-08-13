import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { InventoryBalanceService } from './inventory-balance.service';

@Controller('inventory-balance')
@UseGuards(JwtAuthGuard)
export class InventoryBalanceController {
  constructor(private readonly service: InventoryBalanceService) {}

  @Get('summary')
  summary(@Req() req: any) {
    return this.service.summary(req.user.tenantId);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
    @Query('warehouseId') warehouseId?: string,
  ) {
    return this.service.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      lowStock: lowStock === 'true',
      warehouseId,
    });
  }
}
