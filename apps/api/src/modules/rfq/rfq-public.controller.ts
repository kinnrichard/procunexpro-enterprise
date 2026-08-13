import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { RfqService } from './rfq.service';

@Controller('rfq-public')
export class RfqPublicController {
  constructor(private readonly rfqService: RfqService) {}

  @Get(':token')
  getPublicRfq(@Param('token') token: string) {
    return this.rfqService.getPublicRfq(token);
  }

  @Post(':token/submit')
  submitQuote(@Param('token') token: string, @Body() body: any) {
    return this.rfqService.submitPublicQuote(token, body);
  }
}
