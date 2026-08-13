import { Module } from '@nestjs/common';
import { InventoryBalanceController } from './inventory-balance.controller';
import { InventoryBalanceService } from './inventory-balance.service';

@Module({
  controllers: [InventoryBalanceController],
  providers: [InventoryBalanceService],
})
export class InventoryBalanceModule {}
