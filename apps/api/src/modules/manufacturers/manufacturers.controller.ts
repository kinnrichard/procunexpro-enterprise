import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ManufacturersService } from './manufacturers.service';

@Controller('manufacturers')
@UseGuards(JwtAuthGuard)
export class ManufacturersController {
  constructor(private readonly manufacturersService: ManufacturersService) {}

  @Get('active')
  findAllActive(@Req() req: any) {
    return this.manufacturersService.findAllActive(req.user.tenantId);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.manufacturersService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
    });
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.manufacturersService.create(req.user.tenantId, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.manufacturersService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.manufacturersService.delete(req.user.tenantId, id);
  }
}
