import { Module } from '@nestjs/common';
import { GlAccountsController } from './gl-accounts.controller';
import { GlAccountsService } from './gl-accounts.service';

@Module({ controllers: [GlAccountsController], providers: [GlAccountsService], exports: [GlAccountsService] })
export class GlAccountsModule {}
