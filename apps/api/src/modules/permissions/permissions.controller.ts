import { Controller, Get, Put, Body, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsService } from './permissions.service';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  // Full matrix (for the Settings screen)
  @Get()
  getMatrix(@Req() req: any) {
    return this.service.getMatrix(req.user.tenantId);
  }

  @Put()
  updateMatrix(@Req() req: any, @Body() body: any) {
    return this.service.updateMatrix(req.user.tenantId, body.items ?? body);
  }

  // The current user's effective permissions (for the frontend to hide/disable buttons)
  @Get('mine')
  mine(@Req() req: any) {
    return this.service.getEffective(req.user.tenantId, req.user.role);
  }
}
