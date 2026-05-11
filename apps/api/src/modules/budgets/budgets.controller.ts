import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { BudgetsService } from './budgets.service';

@Controller('budgets')
@UseGuards(JwtAuthGuard)
export class BudgetsController {
  constructor(private readonly budgetsService: BudgetsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('fiscalYear') fiscalYear?: string,
  ) {
    return this.budgetsService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      fiscalYear: fiscalYear ? Number.parseInt(fiscalYear) : undefined,
    });
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.budgetsService.create(req.user.tenantId, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.budgetsService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.delete(req.user.tenantId, id);
  }

  @Put(':id/activate')
  activate(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.activate(req.user.tenantId, id);
  }

  @Put(':id/close')
  close(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.close(req.user.tenantId, id);
  }

  @Get(':id/allocations')
  getAllocations(@Req() req: any, @Param('id') id: string) {
    return this.budgetsService.getAllocations(req.user.tenantId, id);
  }

  @Post(':id/allocations')
  addAllocation(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.budgetsService.addAllocation(req.user.tenantId, id, body);
  }

  @Delete(':budgetId/allocations/:allocationId')
  removeAllocation(
    @Req() req: any,
    @Param('budgetId') budgetId: string,
    @Param('allocationId') allocationId: string,
  ) {
    return this.budgetsService.removeAllocation(req.user.tenantId, budgetId, allocationId);
  }
}
