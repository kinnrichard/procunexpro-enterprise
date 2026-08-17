import { Module } from '@nestjs/common';
import { GoodsReceiptsController } from './goods-receipts.controller';
import { GoodsReceiptsService } from './goods-receipts.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [PermissionsModule, ApprovalsModule],
  controllers: [GoodsReceiptsController],
  providers: [GoodsReceiptsService],
  exports: [GoodsReceiptsService],
})
export class GoodsReceiptsModule {}
