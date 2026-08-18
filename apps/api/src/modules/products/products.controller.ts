import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, Res, UseGuards,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ProductsService } from './products.service';
import { ItemImportService } from './item-import.service';

const MODULE = 'products';

@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly itemImport: ItemImportService,
  ) {}

  @Get('low-stock')
  @RequirePermission(MODULE, 'view')
  getLowStock(@Req() req: any) {
    return this.productsService.getLowStock(req.user.tenantId);
  }

  // --- Bulk import ---

  @Get('import-template')
  @RequirePermission(MODULE, 'create')
  async importTemplate(@Req() req: any, @Res() res: Response) {
    const buffer = await this.itemImport.buildTemplate(req.user.tenantId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="items-import-template.xlsx"');
    res.send(buffer);
  }

  @Post('import')
  @RequirePermission(MODULE, 'create')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  importItems(@Req() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.itemImport.importItems(req.user.tenantId, file);
  }

  @Get()
  @RequirePermission(MODULE, 'view')
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('inventoryType') inventoryType?: string,
    @Query('categoryId') categoryId?: string,
    @Query('manufacturerId') manufacturerId?: string,
    @Query('createdDateFrom') createdDateFrom?: string,
    @Query('createdDateTo') createdDateTo?: string,
  ) {
    return this.productsService.findAll(req.user.tenantId, {
      page: page ? Number.parseInt(page) : undefined,
      limit: limit ? Number.parseInt(limit) : undefined,
      search,
      status,
      inventoryType,
      categoryId,
      manufacturerId,
      createdDateFrom,
      createdDateTo,
    });
  }

  @Get(':id/pricings-summary')
  @RequirePermission(MODULE, 'view')
  getPricingsSummary(@Req() req: any, @Param('id') id: string) {
    return this.productsService.getPricingsSummary(req.user.tenantId, id);
  }

  @Get(':id')
  @RequirePermission(MODULE, 'view')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.productsService.findOne(req.user.tenantId, id);
  }

  @Post()
  @RequirePermission(MODULE, 'create')
  create(@Req() req: any, @Body() body: any) {
    return this.productsService.create(req.user.tenantId, body);
  }

  @Put(':id')
  @RequirePermission(MODULE, 'edit')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  @RequirePermission(MODULE, 'delete')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.productsService.delete(req.user.tenantId, id);
  }

  // --- Bill of Materials (composition) ---

  @Get(':id/components')
  @RequirePermission(MODULE, 'view')
  getComponents(@Req() req: any, @Param('id') id: string) {
    return this.productsService.getComponents(req.user.tenantId, id);
  }

  @Put(':id/components')
  @RequirePermission(MODULE, 'edit')
  setComponents(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.setComponents(req.user.tenantId, id, body);
  }

  // --- Images ---

  @Post(':id/images')
  @RequirePermission(MODULE, 'edit')
  addImage(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.addImage(req.user.tenantId, id, body);
  }

  @Put(':id/images/:imageId')
  @RequirePermission(MODULE, 'edit')
  updateImage(@Req() req: any, @Param('id') id: string, @Param('imageId') imageId: string, @Body() body: any) {
    return this.productsService.updateImage(req.user.tenantId, id, imageId, body);
  }

  @Delete(':id/images/:imageId')
  @RequirePermission(MODULE, 'delete')
  deleteImage(@Req() req: any, @Param('id') id: string, @Param('imageId') imageId: string) {
    return this.productsService.deleteImage(req.user.tenantId, id, imageId);
  }

  // --- Documents ---

  @Post(':id/documents')
  @RequirePermission(MODULE, 'edit')
  addDocument(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.addDocument(req.user.tenantId, id, body);
  }

  @Delete(':id/documents/:docId')
  @RequirePermission(MODULE, 'delete')
  deleteDocument(@Req() req: any, @Param('id') id: string, @Param('docId') docId: string) {
    return this.productsService.deleteDocument(req.user.tenantId, id, docId);
  }

  // --- Pricing ---

  @Post(':id/pricings')
  @RequirePermission(MODULE, 'edit')
  addPricing(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.addPricing(req.user.tenantId, id, body);
  }

  @Post(':id/pricings/:pricingId/apply')
  @RequirePermission(MODULE, 'edit')
  applyPricing(@Req() req: any, @Param('id') id: string, @Param('pricingId') pricingId: string) {
    return this.productsService.applyPricing(req.user.tenantId, id, pricingId);
  }

  @Put(':id/pricings/:pricingId')
  @RequirePermission(MODULE, 'edit')
  updatePricing(@Req() req: any, @Param('id') id: string, @Param('pricingId') pricingId: string, @Body() body: any) {
    return this.productsService.updatePricing(req.user.tenantId, id, pricingId, body);
  }

  @Delete(':id/pricings/:pricingId')
  @RequirePermission(MODULE, 'delete')
  deletePricing(@Req() req: any, @Param('id') id: string, @Param('pricingId') pricingId: string) {
    return this.productsService.deletePricing(req.user.tenantId, id, pricingId);
  }
}
