import { Injectable } from '@nestjs/common';
import { Country, State, City } from 'country-state-city';

// select-philippines-address ships no type declarations — it's a CommonJS module
// of promise-returning helpers backed by the official PSGC dataset.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const psgc = require('select-philippines-address');

const PH = 'PH';

type Option = { name: string; code: string };

@Injectable()
export class LocationsService {
  private phProvincesCache: Option[] | null = null;

  countries() {
    const all = Country.getAllCountries().map((c) => ({ name: c.name, code: c.isoCode }));
    const ph = all.filter((c) => c.code === PH);
    const rest = all
      .filter((c) => c.code !== PH)
      .sort((a, b) => a.name.localeCompare(b.name));
    // Philippines pinned first, everything else alphabetical.
    return { data: [...ph, ...rest] };
  }

  async provinces(countryCode: string) {
    if (!countryCode) return { data: [] };
    if (countryCode === PH) return { data: await this.getPhProvinces() };

    const states = State.getStatesOfCountry(countryCode)
      .map((s) => ({ name: s.name, code: s.isoCode }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { data: states };
  }

  async cities(countryCode: string, provinceCode: string) {
    if (!countryCode || !provinceCode) return { data: [] };

    if (countryCode === PH) {
      const rows: any[] = await psgc.cities(provinceCode);
      const data = rows
        .map((c) => ({ name: this.clean(c.city_name), code: c.city_code }))
        .sort((a, b) => a.name.localeCompare(b.name));
      return { data };
    }

    const cities = City.getCitiesOfState(countryCode, provinceCode)
      .map((c) => ({ name: c.name, code: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { data: cities };
  }

  private async getPhProvinces(): Promise<Option[]> {
    if (this.phProvincesCache) return this.phProvincesCache;

    const regions: any[] = await psgc.regions();
    const collected: Option[] = [];
    for (const r of regions) {
      const provs: any[] = await psgc.provinces(r.region_code);
      for (const p of provs) collected.push({ name: this.clean(p.province_name), code: p.province_code });
    }

    // PSGC lists a few NCR districts under duplicate codes — dedupe by code.
    const seen = new Set<string>();
    const deduped = collected
      .filter((p) => (seen.has(p.code) ? false : seen.add(p.code)))
      .sort((a, b) => a.name.localeCompare(b.name));

    this.phProvincesCache = deduped;
    return deduped;
  }

  private clean(value: string): string {
    return value.replace(/\bNcr\b/g, 'NCR').trim();
  }
}
