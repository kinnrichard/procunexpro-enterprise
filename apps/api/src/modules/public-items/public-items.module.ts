import { Module } from '@nestjs/common';
import { PublicItemsController } from './public-items.controller';
import { PublicItemsService } from './public-items.service';

@Module({
  controllers: [PublicItemsController],
  providers: [PublicItemsService],
})
export class PublicItemsModule {}
