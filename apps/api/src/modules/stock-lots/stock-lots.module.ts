import { Module } from '@nestjs/common';
import { StockLotsController } from './stock-lots.controller';
import { StockLotsService } from './stock-lots.service';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [PermissionsModule],
  controllers: [StockLotsController],
  providers: [StockLotsService],
  exports: [StockLotsService],
})
export class StockLotsModule {}
