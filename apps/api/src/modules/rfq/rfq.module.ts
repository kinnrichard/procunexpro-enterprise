import { Module } from '@nestjs/common';
import { RfqController } from './rfq.controller';
import { RfqPublicController } from './rfq-public.controller';
import { RfqService } from './rfq.service';
import { EmailService } from '../../common/services/email.service';
import { PermissionsModule } from '../permissions/permissions.module';
import { ApprovalsModule } from '../approvals/approvals.module';

@Module({
  imports: [PermissionsModule, ApprovalsModule],
  controllers: [RfqController, RfqPublicController],
  providers: [RfqService, EmailService],
  exports: [RfqService],
})
export class RfqModule {}
