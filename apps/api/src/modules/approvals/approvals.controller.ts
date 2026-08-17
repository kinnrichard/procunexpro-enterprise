import {
  Body, Controller, ForbiddenException, Get, Param, Put, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { FULL_ACCESS_ROLES } from '../permissions/permissions.constants';
import { ApprovalsService, APPROVAL_MODULES } from './approvals.service';

@Controller('approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(private readonly service: ApprovalsService) {}

  @Get('modules')
  modules() {
    return APPROVAL_MODULES;
  }

  @Get('workflows')
  listWorkflows(@Req() req: any) {
    return this.service.listWorkflows(req.user.tenantId);
  }

  @Put('workflows/:entityType')
  upsertWorkflow(@Req() req: any, @Param('entityType') entityType: string, @Body() body: any) {
    this.assertAdmin(req);
    return this.service.upsertWorkflow(req.user.tenantId, entityType, body);
  }

  @Get('requests/:entityType/:entityId')
  getRequest(@Req() req: any, @Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.service.getRequest(req.user.tenantId, entityType, entityId);
  }

  private assertAdmin(req: any) {
    if (!FULL_ACCESS_ROLES.includes(req.user.role)) {
      throw new ForbiddenException('Only admins can configure approval workflows');
    }
  }
}
