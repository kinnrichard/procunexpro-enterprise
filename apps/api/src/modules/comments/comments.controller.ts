import { Controller, Get, Post, Put, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CommentsService } from './comments.service';

@Controller('comments')
@UseGuards(JwtAuthGuard)
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  @Get('entity/:entityType/:entityId')
  findByEntity(@Req() req: any, @Param('entityType') entityType: string, @Param('entityId') entityId: string) {
    return this.service.findByEntity(req.user.tenantId, entityType, entityId);
  }

  @Post()
  create(@Req() req: any, @Body() body: { entityType: string; entityId: string; content: string; parentId?: string }) {
    return this.service.create(req.user.tenantId, req.user.id, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.service.update(req.user.tenantId, req.user.id, req.user.role, id, body.content);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.service.delete(req.user.tenantId, req.user.id, req.user.role, id);
  }
}
