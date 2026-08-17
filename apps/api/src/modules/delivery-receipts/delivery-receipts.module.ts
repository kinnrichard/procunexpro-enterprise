import { Module } from '@nestjs/common';
import { DeliveryReceiptsController } from './delivery-receipts.controller';
import { DrPublicController } from './dr-public.controller';
import { DeliveryReceiptsService } from './delivery-receipts.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [PermissionsModule, ApprovalsModule],
  controllers: [DeliveryReceiptsController, DrPublicController],
  providers: [DeliveryReceiptsService],
  exports: [DeliveryReceiptsService],
})
export class DeliveryReceiptsModule {}
