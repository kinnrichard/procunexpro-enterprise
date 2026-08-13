import { Module } from '@nestjs/common';
import { ProductionsController } from './productions.controller';
import { ProductionsService } from './productions.service';
import { UnitsOfMeasureModule } from '../units-of-measure/units-of-measure.module';
import { StockLotsModule } from '../stock-lots/stock-lots.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [UnitsOfMeasureModule, StockLotsModule, PermissionsModule],
  controllers: [ProductionsController],
  providers: [ProductionsService],
  exports: [ProductionsService],
})
export class ProductionsModule {}
