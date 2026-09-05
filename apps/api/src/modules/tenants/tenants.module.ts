import { Module } from '@nestjs/common';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { RolesModule } from '../roles/roles.module';
import { InventoryTypesModule } from '../inventory-types/inventory-types.module';

@Module({
  imports: [RolesModule, InventoryTypesModule],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
