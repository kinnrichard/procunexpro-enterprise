import { Module } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';

@Module({
  controllers: [ApprovalsController],
  providers: [ApprovalsService, PrismaService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
