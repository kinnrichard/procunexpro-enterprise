import { Module } from '@nestjs/common';
import { RfqController } from './rfq.controller';
import { RfqPublicController } from './rfq-public.controller';
import { RfqService } from './rfq.service';
import { EmailService } from '../../common/services/email.service';

@Module({
  controllers: [RfqController, RfqPublicController],
  providers: [RfqService, EmailService],
  exports: [RfqService],
})
export class RfqModule {}
