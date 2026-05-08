import {
  Controller, Get, Post, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DocumentsService } from './documents.service';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.documentsService.findAll(req.user.tenantId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
      entityType,
    });
  }

  @Get('stats')
  getStats(@Req() req: any) {
    return this.documentsService.getStats(req.user.tenantId);
  }

  @Get('entity/:entityType/:entityId')
  findByEntity(
    @Req() req: any,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.documentsService.findByEntity(req.user.tenantId, entityType, entityId);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.documentsService.create(req.user.tenantId, req.user.id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.documentsService.delete(req.user.tenantId, req.user.id, req.user.role, id);
  }
}
