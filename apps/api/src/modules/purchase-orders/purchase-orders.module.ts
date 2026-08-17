import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [PermissionsModule, ApprovalsModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersService],
  exports: [PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
