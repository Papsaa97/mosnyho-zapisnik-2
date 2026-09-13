import { describe, it, expect } from 'vitest';
import {
  calculateEffectiveHourlyRate,
  calculateTravelTotal,
  calculateGrandTotal,
  estimateDiet,
} from '../../../src/services/pricingEngine';
import { STANDARD_RATES_FIXTURE } from '../../fixtures/rates.fixture';
import {
  ConsumableSlip,
  SAMPLE_CONSUMABLES_SLIP,
} from '../../fixtures/shifts.fixture';
import { calculateConsumableSlipTotals } from '../tier2-boundaries/markupHelper';

describe('Tier 3 Cross-Feature: Materials with Diets & Labor Balance Integration (materials-with-diets-balance.test.ts)', () => {
  const rates = STANDARD_RATES_FIXTURE;

  // 1. Comprehensive multi-component balance summation
  it('correctly aggregates labor, travel km, travel time, MPSV diet, and marked-up materials into grand balance', () => {
    // 10.0h labor @ 775 Kč/h (620 * 1.25 complexity multiplier)
    const laborHours = 10.0;
    const hourlyRate = 775;
    const laborEarnings = laborHours * hourlyRate; // 7750 Kč
    expect(laborEarnings).toBe(7750);

    // Travel: 95 km @ 11 Kč/km + 2.0h travel time @ 350 Kč/h
    const distanceKm = 95;
    const kmRate = 11;
    const travelHours = 2.0;
    const travelRate = 350;

    // Diet: 10.0h shift + 2.0h travel = 12.0h -> exactly Band 1 (166 Kč)
    const totalDuration = laborHours + travelHours;
    const diet = estimateDiet(totalDuration, rates);
    expect(diet.allowance).toBe(166);

    const travelTotal = calculateTravelTotal(
      distanceKm,
      kmRate,
      travelHours,
      travelRate,
      diet.allowance
    );
    // 95*11 (1045) + 2*350 (700) + 166 (diet) = 1911 Kč
    expect(travelTotal).toBe(1911);

    // Consumables Slip: 3 items (1800 Kč base) with 15% markup + 150 Kč overhead fee
    const slip: ConsumableSlip = SAMPLE_CONSUMABLES_SLIP;
    const slipTotals = calculateConsumableSlipTotals(
      slip.items,
      slip.overheadMarkupPercent,
      slip.fixedOverheadFee
    );
    expect(slipTotals.totalMaterialCost).toBe(1800);
    expect(slipTotals.totalBilledAmount).toBe(2221);

    // Grand total: Labor (7750) + Travel & Diets (1911) + Materials (2221)
    const extraCosts = [{ id: 'materials-slip', description: 'Spotřební materiál', amount: slipTotals.totalBilledAmount }];
    const grandTotal = calculateGrandTotal({
      totalHours: laborHours,
      pricing: { calculatedHourlyRate: hourlyRate },
      travel: {
        distanceKm,
        ratePerKm: kmRate,
        travelTimeHours: travelHours,
        travelHourlyRate: travelRate,
        dietAllowance: diet.allowance,
      },
      extraCosts,
    });

    // 7750 + 1911 + 2221 = 11882 Kč
    expect(grandTotal).toBe(11882);
  });

  // 2. Manual Diet Override with Materials Markup and Weekend Surcharge
  it('correctly handles manual diet override combined with weekend surcharges and material markup', () => {
    // 8.0h labor @ base 500 Kč/h with weekend surcharge (25%) -> 625 Kč/h
    const effectiveRate = calculateEffectiveHourlyRate(500, 1.0, ['weekend'], rates.surcharges);
    expect(effectiveRate).toBe(625);
    const labor = 8.0 * effectiveRate; // 5000 Kč
    expect(labor).toBe(5000);

    // Travel: 40 km @ 11 Kč/km (440 Kč) + 1h @ 350 Kč/h (350 Kč)
    // Custom manual diet override: 120 Kč (e.g. employee provided with lunch)
    const customDiet = 120;
    const travelTotal = calculateTravelTotal(40, 11, 1.0, 350, customDiet);
    expect(travelTotal).toBe(440 + 350 + 120); // 910 Kč

    // Materials: 5 grinding discs @ 45 Kč with 20% markup = 270 Kč
    const materialBilled = Math.round(5 * 45 * 1.2);
    expect(materialBilled).toBe(270);

    const grandTotal = calculateGrandTotal({
      totalHours: 8.0,
      pricing: { calculatedHourlyRate: effectiveRate },
      travel: {
        distanceKm: 40,
        ratePerKm: 11,
        travelTimeHours: 1.0,
        travelHourlyRate: 350,
        dietAllowance: customDiet,
      },
      extraCosts: [{ id: 'mat-1', description: 'Kotouče', amount: materialBilled }],
    });

    // 5000 + 910 + 270 = 6180 Kč
    expect(grandTotal).toBe(6180);
  });

  // 3. 20-Hour Marathon Shift Balance (Tier 3 MPSV Diet, Zero Materials)
  it('correctly computes marathon 20h shift balance with Tier 3 MPSV diet (398 Kč) and zero materials', () => {
    const hours = 20.0;
    const rate = 800;
    const diet = estimateDiet(hours + 1.0, rates); // 21h total -> Band 3 (398 Kč)
    expect(diet.allowance).toBe(398);
    expect(diet.type).toBe('band_3');

    const grandTotal = calculateGrandTotal({
      totalHours: hours,
      pricing: { calculatedHourlyRate: rate },
      travel: {
        distanceKm: 20,
        ratePerKm: 11,
        travelTimeHours: 1.0,
        travelHourlyRate: 350,
        dietAllowance: diet.allowance,
      },
      extraCosts: [],
    });

    // Labor: 20 * 800 = 16000
    // Travel: 20*11 (220) + 1*350 (350) + 398 = 968
    // Grand Total: 16000 + 968 = 16968 Kč
    expect(grandTotal).toBe(16968);
  });

  // 4. Dynamic Material Addition Recalculation
  it('dynamically recalculates grand total when adding an additional consumable item to the slip', () => {
    const baseEntry = {
      totalHours: 6.0,
      pricing: { calculatedHourlyRate: 600 },
      travel: { distanceKm: 0, ratePerKm: 11, travelTimeHours: 0, travelHourlyRate: 350, dietAllowance: 166 },
      extraCosts: [{ id: 'c-1', description: 'Anchor pack', amount: 500 }],
    };

    const initialTotal = calculateGrandTotal(baseEntry);
    expect(initialTotal).toBe(6.0 * 600 + 166 + 500); // 3600 + 166 + 500 = 4266

    // Add extra gas cylinder: 1000 Kč
    const updatedEntry = {
      ...baseEntry,
      extraCosts: [...baseEntry.extraCosts, { id: 'c-2', description: 'Argon gas', amount: 1000 }],
    };
    const updatedTotal = calculateGrandTotal(updatedEntry);
    expect(updatedTotal).toBe(initialTotal + 1000);
    expect(updatedTotal).toBe(5266);
  });
});
