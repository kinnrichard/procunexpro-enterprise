import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TaxesService } from './taxes.service';

@Controller('taxes')
@UseGuards(JwtAuthGuard)
export class TaxesController {
  constructor(private readonly taxesService: TaxesService) {}

  @Get('active')
  findAllActive(@Req() req: any) {
    return this.taxesService.findAllActive(req.user.tenantId);
  }

  @Get()
  findAll(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string, @Query('search') search?: string) {
    return this.taxesService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined, limit: limit ? Number.parseInt(limit) : undefined, search,
    });
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.taxesService.create(req.user.tenantId, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.taxesService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.taxesService.delete(req.user.tenantId, id);
  }
}
