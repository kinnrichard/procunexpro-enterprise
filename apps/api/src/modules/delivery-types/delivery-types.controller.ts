import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DeliveryTypesService } from './delivery-types.service';

@Controller('delivery-types')
@UseGuards(JwtAuthGuard)
export class DeliveryTypesController {
  constructor(private readonly service: DeliveryTypesService) {}

  @Get('active')
  findAllActive(@Req() req: any) { return this.service.findAllActive(req.user.tenantId); }

  @Get()
  findAll(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.service.findAll(req.user.tenantId, { page: page ? Number.parseInt(page) : undefined, limit: limit ? Number.parseInt(limit) : undefined, search });
  }

  @Post()
  create(@Req() req: any, @Body() body: any) { return this.service.create(req.user.tenantId, body); }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) { return this.service.update(req.user.tenantId, id, body); }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) { return this.service.delete(req.user.tenantId, id); }
}
