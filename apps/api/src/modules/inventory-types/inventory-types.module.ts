import { Module } from '@nestjs/common';
import { InventoryTypesController } from './inventory-types.controller';
import { InventoryTypesService } from './inventory-types.service';

@Module({
  controllers: [InventoryTypesController],
  providers: [InventoryTypesService],
  exports: [InventoryTypesService],
})
export class InventoryTypesModule {}
