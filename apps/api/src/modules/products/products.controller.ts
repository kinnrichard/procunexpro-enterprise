import {
  Controller, Get, Post, Put, Delete, Body, Param, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProductsService } from './products.service';

@Controller('products')
@UseGuards(JwtAuthGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get('low-stock')
  getLowStock(@Req() req: any) {
    return this.productsService.getLowStock(req.user.tenantId);
  }

  @Get()
  findAll(
    @Req() req: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.productsService.findAll(req.user.tenantId, {
      page: page ? parseInt(page) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      search,
    });
  }

  @Get(':id/pricings-summary')
  getPricingsSummary(@Req() req: any, @Param('id') id: string) {
    return this.productsService.getPricingsSummary(req.user.tenantId, id);
  }

  @Get(':id')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.productsService.findOne(req.user.tenantId, id);
  }

  @Post()
  create(@Req() req: any, @Body() body: any) {
    return this.productsService.create(req.user.tenantId, body);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.update(req.user.tenantId, id, body);
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.productsService.delete(req.user.tenantId, id);
  }

  // --- Images ---

  @Post(':id/images')
  addImage(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.addImage(req.user.tenantId, id, body);
  }

  @Put(':id/images/:imageId')
  updateImage(@Req() req: any, @Param('id') id: string, @Param('imageId') imageId: string, @Body() body: any) {
    return this.productsService.updateImage(req.user.tenantId, id, imageId, body);
  }

  @Delete(':id/images/:imageId')
  deleteImage(@Req() req: any, @Param('id') id: string, @Param('imageId') imageId: string) {
    return this.productsService.deleteImage(req.user.tenantId, id, imageId);
  }

  // --- Documents ---

  @Post(':id/documents')
  addDocument(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.addDocument(req.user.tenantId, id, body);
  }

  @Delete(':id/documents/:docId')
  deleteDocument(@Req() req: any, @Param('id') id: string, @Param('docId') docId: string) {
    return this.productsService.deleteDocument(req.user.tenantId, id, docId);
  }

  // --- Pricing ---

  @Post(':id/pricings')
  addPricing(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.productsService.addPricing(req.user.tenantId, id, body);
  }

  @Post(':id/pricings/:pricingId/apply')
  applyPricing(@Req() req: any, @Param('id') id: string, @Param('pricingId') pricingId: string) {
    return this.productsService.applyPricing(req.user.tenantId, id, pricingId);
  }

  @Put(':id/pricings/:pricingId')
  updatePricing(@Req() req: any, @Param('id') id: string, @Param('pricingId') pricingId: string, @Body() body: any) {
    return this.productsService.updatePricing(req.user.tenantId, id, pricingId, body);
  }

  @Delete(':id/pricings/:pricingId')
  deletePricing(@Req() req: any, @Param('id') id: string, @Param('pricingId') pricingId: string) {
    return this.productsService.deletePricing(req.user.tenantId, id, pricingId);
  }
}
