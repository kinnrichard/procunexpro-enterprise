import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ProductionsService } from './productions.service';

const MODULE = 'productions';

@Controller('productions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductionsController {
  constructor(private readonly productionsService: ProductionsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('productId') productId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.productionsService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      productId,
      dateFrom,
      dateTo,
    });
  }

  @Get('forecast')
  @RequirePermission(MODULE, 'view')
  forecast(@Req() req: any) {
    return this.productionsService.forecast(req.user.tenantId);
  }

  @Get('preview')
  @RequirePermission(MODULE, 'view')
  preview(
    @Req() req: any,
    @Query('productId') productId: string,
    @Query('quantity') quantity?: string,
  ) {
    return this.productionsService.previewFromBom(
      req.user.tenantId,
      productId,
      quantity ? Number.parseFloat(quantity) : 1,
    );
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.productionsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.productionsService.create(req.user.tenantId, req.user.id, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productionsService.update(req.user.tenantId, id, body);
  }

  @Post(':id/complete')
  @RequirePermission(MODULE, 'edit')
  complete(@Req() req: any, @Param('id') id: string) {
    return this.productionsService.complete(req.user.tenantId, id, req.user.id);
  }

  @Post(':id/cancel')
  @RequirePermission(MODULE, 'edit')
  cancel(@Req() req: any, @Param('id') id: string) {
    return this.productionsService.cancel(req.user.tenantId, id);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.productionsService.delete(req.user.tenantId, id);
  }
}
