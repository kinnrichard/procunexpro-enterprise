import { Module } from '@nestjs/common';
import { OriginsController } from './origins.controller';
import { OriginsService } from './origins.service';

@Module({
  controllers: [OriginsController],
  providers: [OriginsService],
  exports: [OriginsService],
})
export class OriginsModule {}
