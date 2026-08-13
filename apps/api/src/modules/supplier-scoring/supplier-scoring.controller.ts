import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { SupplierScoringService } from './supplier-scoring.service';

const MODULE = 'supplier-scoring';

@Controller('supplier-scoring')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SupplierScoringController {
  constructor(private readonly supplierScoringService: SupplierScoringService) {}

  @Get('leaderboard')
  @RequirePermission(MODULE, 'view')
  getLeaderboard(@Req() req: any) {
    return this.supplierScoringService.getLeaderboard(req.user.tenantId);
  }

  @Get('vendor/:vendorId')
  @RequirePermission(MODULE, 'view')
  getVendorScores(@Req() req: any, @Param('vendorId') vendorId: string) {
    return this.supplierScoringService.getVendorScores(req.user.tenantId, vendorId);
  }

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('period') period?: string,
    @Query('vendorId') vendorId?: string,
    @Query('createdDateFrom') createdDateFrom?: string,
    @Query('createdDateTo') createdDateTo?: string,
  ) {
    return this.supplierScoringService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      period,
      vendorId,
      createdDateFrom,
      createdDateTo,
    });
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.supplierScoringService.create(req.user.tenantId, body);
  }

  @Put(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.supplierScoringService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.supplierScoringService.delete(req.user.tenantId, id);
  }
}
