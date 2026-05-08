import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { WarehousesService } from './warehouses.service';

@Controller('warehouses')
@UseGuards(JwtAuthGuard)
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.warehousesService.findAll(req.user.tenantId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
    });
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.warehousesService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.warehousesService.create(req.user.tenantId, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.warehousesService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.warehousesService.delete(req.user.tenantId, id);
  }

  // --- Locations ---

  @Get(':id/locations')
  getLocations(@Req() req: any, @Param('id') id: string) {
    return this.warehousesService.getLocations(id, req.user.tenantId);
  }

  @Post(':id/locations')
  createLocation(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.warehousesService.createLocation(id, req.user.tenantId, body);
  }

  @Delete(':warehouseId/locations/:locationId')
  deleteLocation(
    @Req() req: any,
    @Param('warehouseId') warehouseId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.warehousesService.deleteLocation(warehouseId, locationId, req.user.tenantId);
  }
}
