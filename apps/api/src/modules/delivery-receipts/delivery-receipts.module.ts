import { Module } from '@nestjs/common';
import { DeliveryReceiptsController } from './delivery-receipts.controller';
import { DrPublicController } from './dr-public.controller';
import { DeliveryReceiptsService } from './delivery-receipts.service';

@Module({
  controllers: [DeliveryReceiptsController, DrPublicController],
  providers: [DeliveryReceiptsService],
  exports: [DeliveryReceiptsService],
})
export class DeliveryReceiptsModule {}
