import { Controller, Get, Param } from '@nestjs/common';
import { PublicItemsService } from './public-items.service';

// Public (no auth) — used by the scanned-QR landing page.
@Controller('public/items')
export class PublicItemsController {
  constructor(private readonly service: PublicItemsService) {}

  @Get(':id')
  findPublic(@Param('id') id: string) {
    return this.service.findPublic(id);
  }
}
