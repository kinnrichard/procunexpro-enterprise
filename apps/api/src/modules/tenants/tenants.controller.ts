import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Controller('tenants')
@UseGuards(JwtAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  // Creating/managing organizations is a platform-developer action.
  private assertSuperAdmin(req: any) {
    if (req.user?.role !== 'SUPERADMIN') {
      throw new ForbiddenException('Only the developer (SUPERADMIN) can manage organizations');
    }
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    this.assertSuperAdmin(req);
    return this.tenantsService.findAll({
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
    });
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    this.assertSuperAdmin(req);
    return this.tenantsService.findOne(id);
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateTenantDto) {
    this.assertSuperAdmin(req);
    return this.tenantsService.create(body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    this.assertSuperAdmin(req);
    return this.tenantsService.update(id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    this.assertSuperAdmin(req);
    return this.tenantsService.delete(id);
  }
}
