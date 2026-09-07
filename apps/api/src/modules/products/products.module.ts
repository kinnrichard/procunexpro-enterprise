import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ItemImportService } from './item-import.service';
import { PricingImportService } from './pricing-import.service';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [PermissionsModule],
  controllers: [ProductsController],
  providers: [ProductsService, ItemImportService, PricingImportService],
  exports: [ProductsService],
})
export class ProductsModule {}
