import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { LocationsService } from './locations.service';

// Reference/geo data — any authenticated user may read it (no module permission).
@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly service: LocationsService) {}

  @Get('countries')
  countries() {
    return this.service.countries();
  }

  @Get('provinces')
  provinces(@Query('countryCode') countryCode: string) {
    return this.service.provinces(countryCode);
  }

  @Get('cities')
  cities(@Query('countryCode') countryCode: string, @Query('provinceCode') provinceCode: string) {
    return this.service.cities(countryCode, provinceCode);
  }
}
