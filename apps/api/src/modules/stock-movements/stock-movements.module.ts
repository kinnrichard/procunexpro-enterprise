import { Module } from '@nestjs/common';
import { StockMovementsController } from './stock-movements.controller';
import { StockMovementsService } from './stock-movements.service';
import { StockMovementImportService } from './stock-movement-import.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [PermissionsModule, ApprovalsModule],
  controllers: [StockMovementsController],
  providers: [StockMovementsService, StockMovementImportService],
  exports: [StockMovementsService],
})
export class StockMovementsModule {}
