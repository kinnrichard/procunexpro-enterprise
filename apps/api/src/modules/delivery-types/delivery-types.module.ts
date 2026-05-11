import { Module } from '@nestjs/common';
import { DeliveryTypesController } from './delivery-types.controller';
import { DeliveryTypesService } from './delivery-types.service';

@Module({ controllers: [DeliveryTypesController], providers: [DeliveryTypesService], exports: [DeliveryTypesService] })
export class DeliveryTypesModule {}
