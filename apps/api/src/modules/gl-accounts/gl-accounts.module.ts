import { Module } from '@nestjs/common';
import { GlAccountsController } from './gl-accounts.controller';
import { GlAccountsService } from './gl-accounts.service';
import { CoaHierarchyController } from './coa-hierarchy.controller';
import { CoaHierarchyService } from './coa-hierarchy.service';

@Module({
  controllers: [GlAccountsController, CoaHierarchyController],
  providers: [GlAccountsService, CoaHierarchyService],
  exports: [GlAccountsService, CoaHierarchyService],
})
export class GlAccountsModule {}
