import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { BudgetsService } from './budgets.service';

const MODULE = 'budgets';

@Controller('budgets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('fiscalYear') fiscalYear?: string,
    @Query('period') period?: string,
    @Query('createdDateFrom') createdDateFrom?: string,
    @Query('createdDateTo') createdDateTo?: string,
  ) {
    return this.budgetsService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear) : undefined,
      period,
      createdDateFrom,
      createdDateTo,
    });
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.budgetsService.create(req.user.tenantId, body);
  }

  @Put(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.budgetsService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.delete(req.user.tenantId, id);
  }

  @Put(':id/activate')
  @RequirePermission(MODULE, 'edit')
  activate(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.activate(req.user.tenantId, id);
  }

  @Put(':id/close')
  @RequirePermission(MODULE, 'edit')
  close(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.close(req.user.tenantId, id);
  }

  @Get(':id/allocations')
  @RequirePermission(MODULE, 'view')
  getAllocations(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.getAllocations(req.user.tenantId, id);
  }

  @Post(':id/allocations')
  @RequirePermission(MODULE, 'edit')
  addAllocation(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.budgetsService.addAllocation(req.user.tenantId, id, body);
  }

  @Delete(':budgetId/allocations/:allocationId')
  @RequirePermission(MODULE, 'edit')
  removeAllocation(
    @Req() req: any,
    @Param('budgetId') budgetId: string,
    @Param('allocationId') allocationId: string,
  ) {
    return this.budgetsService.removeAllocation(req.user.tenantId, budgetId, allocationId);
  }
}
