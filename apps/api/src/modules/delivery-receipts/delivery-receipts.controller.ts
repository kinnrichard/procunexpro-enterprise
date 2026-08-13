import {
  Controller, Get, Post, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DeliveryReceiptsService } from './delivery-receipts.service';

@Controller('delivery-receipts')
@UseGuards(JwtAuthGuard)
export class DeliveryReceiptsController {
  constructor(private readonly service: DeliveryReceiptsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('createdDateFrom') createdDateFrom?: string,
    @Query('createdDateTo') createdDateTo?: string,
  ) {
    return this.service.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      customerId,
      createdDateFrom,
      createdDateTo,
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

  @Post(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.service.cancel(req.user.tenantId, id);
  }
}
