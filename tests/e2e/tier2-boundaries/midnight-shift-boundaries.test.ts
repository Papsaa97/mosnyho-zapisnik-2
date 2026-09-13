import { describe, it, expect } from 'vitest';
import {
  calculateNetHours,
  calculateEffectiveHourlyRate,
  estimateDiet,
  calculateGrandTotal,
} from '../../../src/services/pricingEngine';
import { STANDARD_RATES_FIXTURE } from '../../fixtures/rates.fixture';

describe('Tier 2 Boundary: Midnight Shift & Overnight Boundaries (midnight-shift-boundaries.test.ts)', () => {
  const rates = STANDARD_RATES_FIXTURE;

  // 1. Classic Midnight Crossing Shifts
  it('correctly calculates shifts crossing midnight (22:00 to 06:00 = 8.0h)', () => {
    // 22:00 to 06:00 = 8 hours gross, 0 break = 8.0h
    const hours = calculateNetHours('22:00', '06:00', 0);
    expect(hours).toBe(8.0);

    // 22:00 to 06:00 with 30m break = 7.5h
    const hoursWithBreak = calculateNetHours('22:00', '06:00', 30);
    expect(hoursWithBreak).toBe(7.5);
  });

  // 2. Late Night to Morning Crossing
  it('calculates 23:30 to 07:30 with 30m break as 7.5h', () => {
    const hours = calculateNetHours('23:30', '07:30', 30);
    expect(hours).toBe(7.5);
  });

  // 3. Evening to Early Morning Crossing
  it('calculates 18:00 to 02:00 with 60m break as 7.0h', () => {
    const hours = calculateNetHours('18:00', '02:00', 60);
    expect(hours).toBe(7.0);
  });

  // 4. Micro-Interval Midnight Boundary (23:59 to 00:01)
  it('handles micro-interval 23:59 to 00:01 crossing midnight (2 minutes = 0.03h)', () => {
    const hours = calculateNetHours('23:59', '00:01', 0);
    expect(hours).toBe(0.03); // Math.round((2/60)*100)/100 = 0.03
  });

  // 5. Marathon 20-Hour Shift Crossing Midnight (04:00 to 01:00 Next Day)
  it('calculates marathon 20h shift (04:00 to 01:00 with 60m break = 20.0h)', () => {
    // 04:00 to 01:00 next day = 21 elapsed hours - 60 min break = 20.0h
    const netHours = calculateNetHours('04:00', '01:00', 60);
    expect(netHours).toBe(20.0);

    // Diet on 20h shift qualifies for Tier 3 MPSV (398 Kč)
    const diet = estimateDiet(netHours, rates);
    expect(diet.allowance).toBe(398);
    expect(diet.type).toBe('band_3');
  });

  // 6. Break Exceeding Shift Duration Guard
  it('caps break so net hours never drop below 0 when break exceeds duration', () => {
    // 22:00 to 02:00 = 4h (240 min) with 300 min break
    const hours = calculateNetHours('22:00', '02:00', 300);
    expect(hours).toBe(0);

    // Negative break input safe clamp
    const negativeBreakHours = calculateNetHours('22:00', '06:00', -60);
    expect(negativeBreakHours).toBe(8.0);
  });

  // 7. Night Shift Surcharge Integration on Midnight Shift
  it('applies night shift surcharge (20%) on midnight shift labor rate', () => {
    const baseRate = 600;
    // Standard night surcharge: 20%
    const rateWithNight = calculateEffectiveHourlyRate(
      baseRate,
      1.0,
      ['night'],
      rates.surcharges
    );
    // 600 * 1.20 = 720 Kč
    expect(rateWithNight).toBe(720);

    // Combined night + weekend surcharge (20% + 25% = 45%)
    const rateWeekendNight = calculateEffectiveHourlyRate(
      baseRate,
      1.0,
      ['night', 'weekend'],
      rates.surcharges
    );
    // 600 * 1.45 = 870 Kč
    expect(rateWeekendNight).toBe(870);
  });

  // 8. Overnight Grand Total Earnings Integration
  it('computes grand total earnings accurately for an overnight shift', () => {
    const totalHours = calculateNetHours('20:00', '06:00', 60); // 10h - 1h = 9.0h
    const calculatedRate = calculateEffectiveHourlyRate(620, 1.0, ['night'], rates.surcharges); // 620 * 1.2 = 744 Kč
    const diet = estimateDiet(totalHours + 1.0, rates); // 9h work + 1h travel = 10h -> Band 1 (166 Kč)

    const grandTotal = calculateGrandTotal({
      totalHours,
      pricing: { calculatedHourlyRate: calculatedRate },
      travel: {
        distanceKm: 40,
        ratePerKm: 11,
        travelTimeHours: 1.0,
        travelHourlyRate: 350,
        dietAllowance: diet.allowance,
      },
      extraCosts: [],
    });

    // Labor: 9 * 744 = 6696
    // Travel: 40*11 (440) + 1*350 (350) + 166 (diet) = 956
    // Total = 6696 + 956 = 7652
    expect(grandTotal).toBe(7652);
  });
});
