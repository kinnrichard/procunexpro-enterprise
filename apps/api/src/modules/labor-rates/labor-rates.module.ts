import { Module } from '@nestjs/common';
import { LaborRatesController } from './labor-rates.controller';
import { LaborRatesService } from './labor-rates.service';

@Module({
  controllers: [LaborRatesController],
  providers: [LaborRatesService],
  exports: [LaborRatesService],
})
export class LaborRatesModule {}
