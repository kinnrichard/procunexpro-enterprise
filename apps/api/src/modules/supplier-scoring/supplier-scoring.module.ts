import { Module } from '@nestjs/common';
import { SupplierScoringController } from './supplier-scoring.controller';
import { SupplierScoringService } from './supplier-scoring.service';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [PermissionsModule],
  controllers: [SupplierScoringController],
  providers: [SupplierScoringService],
  exports: [SupplierScoringService],
})
export class SupplierScoringModule {}
