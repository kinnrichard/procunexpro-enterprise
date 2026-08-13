import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VendorsService } from './vendors.service';

@Controller('vendors')
@UseGuards(JwtAuthGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('country') country?: string,
    @Query('paymentTerms') paymentTerms?: string,
    @Query('createdDateFrom') createdDateFrom?: string,
    @Query('createdDateTo') createdDateTo?: string,
  ) {
    return this.vendorsService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      country,
      paymentTerms,
      createdDateFrom,
      createdDateTo,
    });
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.vendorsService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.vendorsService.create(req.user.tenantId, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.vendorsService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.vendorsService.delete(req.user.tenantId, id);
  }

  @Put(':id/approve')
  approve(@Req() req: any, @Param('id') id: string) {
    return this.vendorsService.approve(req.user.tenantId, id, req.user.id);
  }

  @Put(':id/suspend')
  suspend(@Req() req: any, @Param('id') id: string) {
    return this.vendorsService.suspend(req.user.tenantId, id);
  }
}
