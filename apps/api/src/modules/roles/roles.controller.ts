import {
  Body, Controller, Delete, ForbiddenException, Get, Param, Post, Put, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FULL_ACCESS_ROLES } from '../permissions/permissions.constants';
import { RolesService } from './roles.service';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly service: RolesService) {}

  @Get()
  list(@Req() req: any) {
    return this.service.list(req.user.tenantId);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    this.assertAdmin(req);
    return this.service.create(req.user.tenantId, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.service.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    this.assertAdmin(req);
    return this.service.remove(req.user.tenantId, id);
  }

  private assertAdmin(req: any) {
    if (!FULL_ACCESS_ROLES.includes(req.user.role)) {
      throw new ForbiddenException('Only admins can manage roles');
    }
  }
}
