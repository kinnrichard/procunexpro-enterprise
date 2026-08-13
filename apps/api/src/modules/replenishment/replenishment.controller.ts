import {
  Controller, Get, Post, Body, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ReplenishmentService } from './replenishment.service';

@Controller('replenishment')
@UseGuards(JwtAuthGuard)
export class ReplenishmentController {
  constructor(private readonly service: ReplenishmentService) {}

  @Get('suggestions')
  suggestions(@Req() req: any) {
    return this.service.suggestions(req.user.tenantId);
  }

  @Post('generate')
  generate(@Req() req: any, @Body() body: any) {
    return this.service.generate(req.user.tenantId, req.user.id, body);
  }
}
