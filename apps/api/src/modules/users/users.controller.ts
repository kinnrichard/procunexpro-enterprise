import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { UsersService } from './users.service';

const MODULE = 'users';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('status') status?: string,
    @Query('createdDateFrom') createdDateFrom?: string,
    @Query('createdDateTo') createdDateTo?: string,
  ) {
    return this.usersService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      role,
      status,
      createdDateFrom,
      createdDateTo,
    });
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.usersService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.usersService.create(req.user.tenantId, body);
  }

  @Put(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.usersService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.usersService.delete(req.user.tenantId, id);
  }

  @Put(':id/activate')
  @RequirePermission(MODULE, 'edit')
  activate(@Req() req: any, @Param('id') id: string) {
    return this.usersService.activate(req.user.tenantId, id);
  }

  @Put(':id/deactivate')
  @RequirePermission(MODULE, 'edit')
  deactivate(@Req() req: any, @Param('id') id: string) {
    return this.usersService.deactivate(req.user.tenantId, id);
  }
}
