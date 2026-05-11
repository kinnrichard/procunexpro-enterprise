import { Module } from '@nestjs/common';
import { PurchaseTermsController } from './purchase-terms.controller';
import { PurchaseTermsService } from './purchase-terms.service';

@Module({ controllers: [PurchaseTermsController], providers: [PurchaseTermsService], exports: [PurchaseTermsService] })
export class PurchaseTermsModule {}
