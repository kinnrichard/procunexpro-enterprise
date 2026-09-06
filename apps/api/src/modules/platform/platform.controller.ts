import {
  Controller, Get, Post, Patch, Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { PlatformKeyGuard } from './platform-key.guard';
import { TenantsService } from '../tenants/tenants.service';
import { CreateTenantDto } from '../tenants/dto/create-tenant.dto';

// Platform-admin console API — org (tenant) management, gated by the platform key.
// Decoupled from tenant user logins (see /admin page).
@Controller('platform')
@UseGuards(PlatformKeyGuard)
export class PlatformController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get('tenants')
  async listTenants(@Query('search') search?: string) {
    const result = await this.tenantsService.findAll({ page: 1, limit: 500, search });
    const data = (result.data as any[]).map((t) => ({
      id: t.id,
      companyName: t.companyName,
      schemaName: t.schemaName,
      status: t.status,
      userCount: t._count?.users ?? 0,
      createdAt: t.createdAt,
    }));
    return { data, total: result.total };
  }

  @Post('tenants')
  createTenant(@Body() body: CreateTenantDto) {
    return this.tenantsService.create(body);
  }

  @Patch('tenants/:id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.tenantsService.update(id, { status: body.status });
  }
}
