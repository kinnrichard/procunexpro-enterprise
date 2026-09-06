import { Module } from '@nestjs/common';
import { PlatformController } from './platform.controller';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  controllers: [PlatformController],
})
export class PlatformModule {}
