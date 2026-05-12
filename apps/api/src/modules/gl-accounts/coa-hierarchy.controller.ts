import { Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CoaHierarchyService } from './coa-hierarchy.service';

@Controller('coa')
@UseGuards(JwtAuthGuard)
export class CoaHierarchyController {
  constructor(private readonly service: CoaHierarchyService) {}

  // Classifications
  @Get('classifications')
  getClassifications(@Req() req: any, @Query('accountType') accountType?: string) {
    return this.service.getClassifications(req.user.tenantId, accountType);
  }
  @Post('classifications')
  createClassification(@Req() req: any, @Body() body: any) {
    return this.service.createClassification(req.user.tenantId, body);
  }
  @Put('classifications/:id')
  updateClassification(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateClassification(req.user.tenantId, id, body);
  }
  @Delete('classifications/:id')
  deleteClassification(@Req() req: any, @Param('id') id: string) {
    return this.service.deleteClassification(req.user.tenantId, id);
  }

  // Categories
  @Get('categories')
  getCategories(@Req() req: any, @Query('classificationId') classificationId?: string) {
    return this.service.getCategories(req.user.tenantId, classificationId);
  }
  @Post('categories')
  createCategory(@Req() req: any, @Body() body: any) {
    return this.service.createCategory(req.user.tenantId, body);
  }
  @Put('categories/:id')
  updateCategory(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateCategory(req.user.tenantId, id, body);
  }
  @Delete('categories/:id')
  deleteCategory(@Req() req: any, @Param('id') id: string) {
    return this.service.deleteCategory(req.user.tenantId, id);
  }

  // Sub Categories
  @Get('sub-categories')
  getSubCategories(@Req() req: any, @Query('categoryId') categoryId?: string) {
    return this.service.getSubCategories(req.user.tenantId, categoryId);
  }
  @Post('sub-categories')
  createSubCategory(@Req() req: any, @Body() body: any) {
    return this.service.createSubCategory(req.user.tenantId, body);
  }
  @Put('sub-categories/:id')
  updateSubCategory(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateSubCategory(req.user.tenantId, id, body);
  }
  @Delete('sub-categories/:id')
  deleteSubCategory(@Req() req: any, @Param('id') id: string) {
    return this.service.deleteSubCategory(req.user.tenantId, id);
  }
}
