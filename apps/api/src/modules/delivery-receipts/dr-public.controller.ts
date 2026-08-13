import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { DeliveryReceiptsService } from './delivery-receipts.service';

// Public, no-auth, token-based endpoints for the customer's receiver to view + sign
@Controller('dr-public')
export class DrPublicController {
  constructor(private readonly service: DeliveryReceiptsService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.service.getByToken(token);
  }

  @Post(':token/sign')
  sign(@Param('token') token: string, @Body() body: any) {
    return this.service.signByToken(token, body);
  }
}
