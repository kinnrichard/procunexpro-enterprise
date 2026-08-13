import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ContractsService } from './contracts.service';

const MODULE = 'contracts';

@Controller('contracts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get('expiring')
  @RequirePermission(MODULE, 'view')
  getExpiring(@Req() req: any) {
    return this.contractsService.getExpiring(req.user.tenantId);
  }

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('createdDateFrom') createdDateFrom?: string,
    @Query('createdDateTo') createdDateTo?: string,
    @Query('valueMin') valueMin?: string,
    @Query('valueMax') valueMax?: string,
  ) {
    return this.contractsService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      vendorId,
      createdDateFrom,
      createdDateTo,
      valueMin,
      valueMax,
    });
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.contractsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.contractsService.create(req.user.tenantId, body);
  }

  @Put(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.contractsService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.contractsService.delete(req.user.tenantId, id);
  }

  @Put(':id/activate')
  @RequirePermission(MODULE, 'edit')
  activate(@Req() req: any, @Param('id') id: string) {
    return this.contractsService.activate(req.user.tenantId, id);
  }

  @Put(':id/terminate')
  @RequirePermission(MODULE, 'edit')
  terminate(@Req() req: any, @Param('id') id: string) {
    return this.contractsService.terminate(req.user.tenantId, id);
  }
}
