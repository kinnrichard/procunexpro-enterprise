import { Module } from '@nestjs/common';
import { DeliveryTermsController } from './delivery-terms.controller';
import { DeliveryTermsService } from './delivery-terms.service';

@Module({ controllers: [DeliveryTermsController], providers: [DeliveryTermsService], exports: [DeliveryTermsService] })
export class DeliveryTermsModule {}
