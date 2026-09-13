import { describe, it, expect } from 'vitest';
import { 
  estimateDiet, 
  normalizeDietType, 
  DietEstimateResult 
} from '../../../src/services/pricingEngine';
import { RatesConfig, DietBandType } from '../../../src/types';
import { 
  STANDARD_RATES_FIXTURE, 
  CUSTOM_PREMIUM_RATES_FIXTURE,
  MPSV_LEGAL_RATES_2026 
} from '../../fixtures/rates.fixture';

/**
 * Feature 15: MPSV 3-Tier Meal Allowance Engine
 * 
 * Requirements:
 * - < 5h: 0 Kč (none, "Bez nároku (< 5 h)")
 * - 5–12h: 166 Kč (band_1, "5–12 h (Pásmo 1)")
 * - 12–18h: 256 Kč (band_2, "12–18 h (Pásmo 2)")
 * - > 18h: 398 Kč (band_3, "nad 18 h (Pásmo 3)")
 * - Custom rate overrides from RatesConfig (dietBand1Rate, dietBand2Rate, dietBand3Rate)
 * - Safe handling of boundary values and edge cases
 * - Legacy diet type normalization
 */
describe('Feature 15: MPSV 3-Tier Meal Allowance Engine', () => {
  const legalRates: RatesConfig = STANDARD_RATES_FIXTURE;

  // Test 1: Band 0 (< 5h duration -> 0 Kč)
  it('returns 0 Kč and type none for shift duration strictly under 5.0 hours', () => {
    const testDurations = [0, 1.0, 2.5, 4.0, 4.9, 4.99];

    for (const duration of testDurations) {
      const res: DietEstimateResult = estimateDiet(duration, legalRates);
      expect(res.allowance).toBe(0);
      expect(res.type).toBe('none');
      expect(res.description).toContain('< 5 h');
    }
  });

  // Test 2: Band 1 (5.0h to 12.0h inclusive -> 166 Kč)
  it('returns Band 1 (166 Kč) for duration between 5.0h and 12.0h inclusive', () => {
    // Exact lower boundary
    const lower = estimateDiet(5.0, legalRates);
    expect(lower.allowance).toBe(MPSV_LEGAL_RATES_2026.tier1_5_to_12h);
    expect(lower.type).toBe('band_1');
    expect(lower.description).toContain('Pásmo 1');

    // Mid-range shifts
    const mid75 = estimateDiet(7.5, legalRates);
    expect(mid75.allowance).toBe(166);
    expect(mid75.type).toBe('band_1');

    const mid10 = estimateDiet(10.0, legalRates);
    expect(mid10.allowance).toBe(166);
    expect(mid10.type).toBe('band_1');

    // Exact upper boundary
    const upper12 = estimateDiet(12.0, legalRates);
    expect(upper12.allowance).toBe(MPSV_LEGAL_RATES_2026.tier1_5_to_12h);
    expect(upper12.type).toBe('band_1');
  });

  // Test 3: Band 2 (> 12.0h to 18.0h inclusive -> 256 Kč)
  it('returns Band 2 (256 Kč) for duration strictly greater than 12.0h up to 18.0h inclusive', () => {
    // Boundary just above 12h
    const justAbove12 = estimateDiet(12.01, legalRates);
    expect(justAbove12.allowance).toBe(MPSV_LEGAL_RATES_2026.tier2_12_to_18h);
    expect(justAbove12.type).toBe('band_2');
    expect(justAbove12.description).toContain('Pásmo 2');

    const shift14 = estimateDiet(14.0, legalRates);
    expect(shift14.allowance).toBe(256);
    expect(shift14.type).toBe('band_2');

    const shift165 = estimateDiet(16.5, legalRates);
    expect(shift165.allowance).toBe(256);
    expect(shift165.type).toBe('band_2');

    // Exact upper boundary at 18.0h
    const upper18 = estimateDiet(18.0, legalRates);
    expect(upper18.allowance).toBe(MPSV_LEGAL_RATES_2026.tier2_12_to_18h);
    expect(upper18.type).toBe('band_2');
  });

  // Test 4: Band 3 (> 18.0h -> 398 Kč, marathon shifts)
  it('returns Band 3 (398 Kč) for duration strictly greater than 18.0 hours', () => {
    // Boundary just above 18h
    const justAbove18 = estimateDiet(18.01, legalRates);
    expect(justAbove18.allowance).toBe(MPSV_LEGAL_RATES_2026.tier3_over_18h);
    expect(justAbove18.type).toBe('band_3');
    expect(justAbove18.description).toContain('Pásmo 3');

    // 20-hour marathon shift (Scenario 4)
    const shift20 = estimateDiet(20.0, legalRates);
    expect(shift20.allowance).toBe(398);
    expect(shift20.type).toBe('band_3');

    // Full 24-hour continuous shift
    const shift24 = estimateDiet(24.0, legalRates);
    expect(shift24.allowance).toBe(398);
    expect(shift24.type).toBe('band_3');

    // Extreme emergency outage shift (36h)
    const shift36 = estimateDiet(36.0, legalRates);
    expect(shift36.allowance).toBe(398);
    expect(shift36.type).toBe('band_3');
  });

  // Test 5: Custom Rates Configuration Override
  it('respects custom band rates configured in RatesConfig', () => {
    // CUSTOM_PREMIUM_RATES_FIXTURE has custom band rates: 200, 320, 480
    expect(estimateDiet(8.0, CUSTOM_PREMIUM_RATES_FIXTURE).allowance).toBe(200);
    expect(estimateDiet(8.0, CUSTOM_PREMIUM_RATES_FIXTURE).type).toBe('band_1');

    expect(estimateDiet(14.0, CUSTOM_PREMIUM_RATES_FIXTURE).allowance).toBe(320);
    expect(estimateDiet(14.0, CUSTOM_PREMIUM_RATES_FIXTURE).type).toBe('band_2');

    expect(estimateDiet(22.0, CUSTOM_PREMIUM_RATES_FIXTURE).allowance).toBe(480);
    expect(estimateDiet(22.0, CUSTOM_PREMIUM_RATES_FIXTURE).type).toBe('band_3');

    // Custom configuration with legacy fallback keys (dietHalfDayRate, dietFullDayRate, dietOver18Rate)
    const legacyFallbackRates: RatesConfig = {
      ...legalRates,
      dietBand1Rate: undefined,
      dietBand2Rate: undefined,
      dietBand3Rate: undefined,
      dietHalfDayRate: 175,
      dietFullDayRate: 270,
      dietOver18Rate: 410,
    };
    expect(estimateDiet(6.0, legacyFallbackRates).allowance).toBe(175);
    expect(estimateDiet(13.0, legacyFallbackRates).allowance).toBe(270);
    expect(estimateDiet(19.0, legacyFallbackRates).allowance).toBe(410);
  });

  // Test 6: Adversarial and Boundary Inputs
  it('handles negative, zero, and NaN durations gracefully without crashing', () => {
    expect(estimateDiet(0, legalRates).allowance).toBe(0);
    expect(estimateDiet(-1, legalRates).allowance).toBe(0);
    expect(estimateDiet(-24, legalRates).allowance).toBe(0);
    expect(estimateDiet(NaN, legalRates).allowance).toBe(0);
    expect(estimateDiet(Number.POSITIVE_INFINITY, legalRates).allowance).toBe(398);
  });

  // Test 7: Normalization of legacy and modern diet types
  it('correctly normalizes legacy and modern diet type strings via normalizeDietType', () => {
    expect(normalizeDietType('half_day')).toBe('band_1');
    expect(normalizeDietType('full_day')).toBe('band_2');
    expect(normalizeDietType('band_1')).toBe('band_1');
    expect(normalizeDietType('band_2')).toBe('band_2');
    expect(normalizeDietType('band_3')).toBe('band_3');
    expect(normalizeDietType('custom')).toBe('custom');
    expect(normalizeDietType('none')).toBe('none');
    expect(normalizeDietType(undefined)).toBe('none');
    expect(normalizeDietType('')).toBe('none');
    expect(normalizeDietType('invalid_value')).toBe('none');
  });
});
