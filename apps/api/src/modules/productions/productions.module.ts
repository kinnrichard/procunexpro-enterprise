import { Module } from '@nestjs/common';
import { ProductionsController } from './productions.controller';
import { ProductionsService } from './productions.service';
import { UnitsOfMeasureModule } from '../units-of-measure/units-of-measure.module';
import { StockLotsModule } from '../stock-lots/stock-lots.module';

@Module({
  imports: [UnitsOfMeasureModule, StockLotsModule],
  controllers: [ProductionsController],
  providers: [ProductionsService],
  exports: [ProductionsService],
})
export class ProductionsModule {}
