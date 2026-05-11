import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { SupplierScoringService } from './supplier-scoring.service';

@Controller('supplier-scoring')
@UseGuards(JwtAuthGuard)
export class SupplierScoringController {
  constructor(private readonly supplierScoringService: SupplierScoringService) {}

  @Get('leaderboard')
  getLeaderboard(@Req() req: any) {
    return this.supplierScoringService.getLeaderboard(req.user.tenantId);
  }

  @Get('vendor/:vendorId')
  getVendorScores(@Req() req: any, @Param('vendorId') vendorId: string) {
    return this.supplierScoringService.getVendorScores(req.user.tenantId, vendorId);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('period') period?: string,
  ) {
    return this.supplierScoringService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      period,
    });
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.supplierScoringService.create(req.user.tenantId, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.supplierScoringService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.supplierScoringService.delete(req.user.tenantId, id);
  }
}
