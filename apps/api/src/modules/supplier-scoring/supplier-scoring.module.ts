import { Module } from '@nestjs/common';
import { SupplierScoringController } from './supplier-scoring.controller';
import { SupplierScoringService } from './supplier-scoring.service';

@Module({
  controllers: [SupplierScoringController],
  providers: [SupplierScoringService],
  exports: [SupplierScoringService],
})
export class SupplierScoringModule {}
