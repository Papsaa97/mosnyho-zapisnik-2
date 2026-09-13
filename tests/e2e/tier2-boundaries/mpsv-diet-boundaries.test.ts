import { describe, it, expect } from 'vitest';
import { estimateDiet, calculateNetHours } from '../../../src/services/pricingEngine';
import { STANDARD_RATES_FIXTURE, CUSTOM_PREMIUM_RATES_FIXTURE } from '../../fixtures/rates.fixture';
import { RatesConfig } from '../../../src/types';

describe('Tier 2 Boundary: MPSV Diet Boundaries (mpsv-diet-boundaries.test.ts)', () => {
  const rates: RatesConfig = STANDARD_RATES_FIXTURE;

  // 1. Boundary: 4h59m vs 5h00m
  it('correctly distinguishes 4h59m (0 Kč, none) vs 5h00m (166 Kč, band_1)', () => {
    // 4 hours and 59 minutes = 4 + 59/60 = 4.98333... hours
    const duration4h59m = 4 + 59 / 60;
    const res4h59 = estimateDiet(duration4h59m, rates);
    expect(res4h59.allowance).toBe(0);
    expect(res4h59.type).toBe('none');
    expect(res4h59.description).toContain('< 5 h');

    // Exactly 5.0 hours
    const res5h00 = estimateDiet(5.0, rates);
    expect(res5h00.allowance).toBe(166);
    expect(res5h00.type).toBe('band_1');
    expect(res5h00.description).toContain('Pásmo 1');

    // Just below 5h: 4.999h
    const res4999 = estimateDiet(4.999, rates);
    expect(res4999.allowance).toBe(0);
    expect(res4999.type).toBe('none');
  });

  // 2. Boundary: 11h59m vs 12h00m vs 12h01m
  it('correctly evaluates 11h59m (166 Kč) vs 12h00m (166 Kč) vs 12h01m (256 Kč)', () => {
    // 11h 59m = 11 + 59/60 = 11.98333... hours
    const duration11h59m = 11 + 59 / 60;
    const res11h59 = estimateDiet(duration11h59m, rates);
    expect(res11h59.allowance).toBe(166);
    expect(res11h59.type).toBe('band_1');

    // Exactly 12.0 hours (upper inclusive limit of Band 1)
    const res12h00 = estimateDiet(12.0, rates);
    expect(res12h00.allowance).toBe(166);
    expect(res12h00.type).toBe('band_1');

    // 12h 01m = 12 + 1/60 = 12.01666... hours (enters Band 2)
    const duration12h01m = 12 + 1 / 60;
    const res12h01 = estimateDiet(duration12h01m, rates);
    expect(res12h01.allowance).toBe(256);
    expect(res12h01.type).toBe('band_2');
    expect(res12h01.description).toContain('Pásmo 2');

    // Micro-boundary: 12.0001h
    const resMicro = estimateDiet(12.0001, rates);
    expect(resMicro.allowance).toBe(256);
    expect(resMicro.type).toBe('band_2');
  });

  // 3. Boundary: 17h59m vs 18h00m vs 18h01m
  it('correctly evaluates 17h59m (256 Kč) vs 18h00m (256 Kč) vs 18h01m (398 Kč)', () => {
    // 17h 59m = 17 + 59/60 = 17.98333... hours
    const duration17h59m = 17 + 59 / 60;
    const res17h59 = estimateDiet(duration17h59m, rates);
    expect(res17h59.allowance).toBe(256);
    expect(res17h59.type).toBe('band_2');

    // Exactly 18.0 hours (upper inclusive limit of Band 2)
    const res18h00 = estimateDiet(18.0, rates);
    expect(res18h00.allowance).toBe(256);
    expect(res18h00.type).toBe('band_2');

    // 18h 01m = 18 + 1/60 = 18.01666... hours (enters Band 3)
    const duration18h01m = 18 + 1 / 60;
    const res18h01 = estimateDiet(duration18h01m, rates);
    expect(res18h01.allowance).toBe(398);
    expect(res18h01.type).toBe('band_3');
    expect(res18h01.description).toContain('Pásmo 3');

    // Micro-boundary: 18.0001h
    const resMicro = estimateDiet(18.0001, rates);
    expect(resMicro.allowance).toBe(398);
    expect(resMicro.type).toBe('band_3');
  });

  // 4. Zero and infinitesimal duration boundaries
  it('returns 0 Kč and type none for 0m, 0.0h, and sub-minute intervals', () => {
    expect(estimateDiet(0, rates)).toEqual({
      allowance: 0,
      type: 'none',
      description: 'Bez nároku (< 5 h)',
    });
    expect(estimateDiet(0.001, rates)).toEqual({
      allowance: 0,
      type: 'none',
      description: 'Bez nároku (< 5 h)',
    });
  });

  // 5. Marathon shifts (24h and beyond)
  it('returns Band 3 (398 Kč) for 24h continuous shifts and multi-day thresholds', () => {
    const res24h = estimateDiet(24.0, rates);
    expect(res24h.allowance).toBe(398);
    expect(res24h.type).toBe('band_3');

    const res36h = estimateDiet(36.0, rates);
    expect(res36h.allowance).toBe(398);
    expect(res36h.type).toBe('band_3');
  });

  // 6. Negative and non-finite input guards
  it('guards safely against negative, NaN, and infinite inputs without throwing', () => {
    expect(estimateDiet(-1, rates).allowance).toBe(0);
    expect(estimateDiet(-0.001, rates).allowance).toBe(0);
    expect(estimateDiet(-24, rates).allowance).toBe(0);
    expect(estimateDiet(NaN, rates).allowance).toBe(0);
    expect(estimateDiet(undefined as any, rates).allowance).toBe(0);
    expect(estimateDiet(null as any, rates).allowance).toBe(0);
  });

  // 7. Combined shift duration + travel time boundary calculations
  it('calculates diets correctly when shift duration is combined with travel time', () => {
    // 4h 30m shift (4.5h) + 30m travel (0.5h) = 5.0h -> exactly Band 1 (166 Kč)
    const netShiftHours1 = calculateNetHours('07:00', '12:00', 30); // 4.5h
    const travelHours1 = 0.5;
    const combined1 = netShiftHours1 + travelHours1;
    expect(combined1).toBe(5.0);
    expect(estimateDiet(combined1, rates).allowance).toBe(166);
    expect(estimateDiet(combined1, rates).type).toBe('band_1');

    // 10.0h shift + 2.0h travel = 12.0h -> exactly Band 1 (166 Kč)
    const combined2 = 10.0 + 2.0;
    expect(estimateDiet(combined2, rates).allowance).toBe(166);
    expect(estimateDiet(combined2, rates).type).toBe('band_1');

    // 10.0h shift + 2.1h travel = 12.1h -> Band 2 (256 Kč)
    const combined3 = 10.0 + 2.1;
    expect(estimateDiet(combined3, rates).allowance).toBe(256);
    expect(estimateDiet(combined3, rates).type).toBe('band_2');
  });

  // 8. Custom rates configuration boundary respect
  it('applies custom user rates when configured in RatesConfig', () => {
    const custom = CUSTOM_PREMIUM_RATES_FIXTURE;
    // custom rates: band1=200, band2=320, band3=480
    expect(estimateDiet(5.0, custom).allowance).toBe(200);
    expect(estimateDiet(12.0, custom).allowance).toBe(200);
    expect(estimateDiet(12.01, custom).allowance).toBe(320);
    expect(estimateDiet(18.0, custom).allowance).toBe(320);
    expect(estimateDiet(18.01, custom).allowance).toBe(480);
    expect(estimateDiet(24.0, custom).allowance).toBe(480);
  });
});
