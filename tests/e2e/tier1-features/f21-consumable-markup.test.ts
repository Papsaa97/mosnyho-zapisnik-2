import { describe, it, expect } from 'vitest';
import type { ConsumableItem, ConsumableSlip } from '../../../src/types';
import { SAMPLE_CONSUMABLES_SLIP } from '../../fixtures/shifts.fixture';
import {
  calculateConsumableItemBilledPrice,
  calculateConsumableSlipTotals,
} from '../../../src/services/pricingEngine';

export { calculateConsumableItemBilledPrice, calculateConsumableSlipTotals };

describe('Feature 21: Consumable Sheet with Markup', () => {
  // Test 1: Base cost calculation without markup (0%)
  it('calculates base material cost with 0% markup (purchase price equals billed price)', () => {
    const qty = 5;
    const unitPrice = 38; // 5 * 38 = 190 Kč
    const billed = calculateConsumableItemBilledPrice(qty, unitPrice, 0);

    expect(billed).toBe(190);
  });

  // Test 2: Standard percentage markup tiers (10%, 15%, 20%)
  it('correctly computes standard markup tiers: 10%, 15%, and 20%', () => {
    const qty = 10;
    const unitPrice = 100; // base = 1000 Kč

    // 10% markup -> 1100 Kč
    expect(calculateConsumableItemBilledPrice(qty, unitPrice, 10)).toBe(1100);

    // 15% markup -> 1150 Kč
    expect(calculateConsumableItemBilledPrice(qty, unitPrice, 15)).toBe(1150);

    // 20% markup -> 1200 Kč
    expect(calculateConsumableItemBilledPrice(qty, unitPrice, 20)).toBe(1200);
  });

  // Test 3: Rounding fractional crowns to whole CZK
  it('rounds fractional crown values resulting from markup percentages accurately', () => {
    // 5 * 38 = 190 Kč base.
    // 190 * 1.15 = 218.49999999999997 -> Math.round -> 218 Kč
    expect(calculateConsumableItemBilledPrice(5, 38, 15)).toBe(218);

    // 3 * 28 = 84 Kč base.
    // 84 * 1.10 = 92.4 -> Math.round -> 92 Kč
    expect(calculateConsumableItemBilledPrice(3, 28, 10)).toBe(92);

    // 7 * 95 = 665 Kč base.
    // 665 * 1.15 = 764.75 -> Math.round -> 765 Kč
    expect(calculateConsumableItemBilledPrice(7, 95, 15)).toBe(765);
  });

  // Test 4: Fixed overhead fee addition to billed total
  it('adds fixed overhead handling fee to total billed material amount', () => {
    const items: ConsumableItem[] = [
      {
        id: 'c1',
        category: 'cutting_grinding',
        name: 'Řezný kotouč 125x1.0',
        quantity: 5,
        unit: 'ks',
        unitPrice: 38,
        markupPercent: 15,
        billedPrice: 218, // 190 * 1.15 = 218.49999999999997 -> 218
      },
      {
        id: 'c2',
        category: 'technical_gases',
        name: 'Argon 4.6',
        quantity: 1,
        unit: 'náplň',
        unitPrice: 850,
        markupPercent: 15,
        billedPrice: 977, // 850 * 1.15 = 977.4999999999999 -> 977
      }
    ];

    // Items billed sum = 218 + 977 = 1195 Kč.
    // Fixed overhead fee = 150 Kč.
    // Total billed = 1195 + 150 = 1345 Kč.
    const totals = calculateConsumableSlipTotals(items, 15, 150);
    expect(totals.totalMaterialCost).toBe(190 + 850); // 1040 Kč
    expect(totals.totalBilledAmount).toBe(1345);
  });

  // Test 5: Validation of SAMPLE_CONSUMABLES_SLIP fixture
  it('validates mathematics and integrity of SAMPLE_CONSUMABLES_SLIP fixture', () => {
    const slip: ConsumableSlip = SAMPLE_CONSUMABLES_SLIP;

    expect(slip.overheadMarkupPercent).toBe(15);
    expect(slip.fixedOverheadFee).toBe(150);

    // Check individual items
    // item 1: 5 * 38 = 190 * 1.15 -> 218
    expect(slip.items[0].billedPrice).toBe(218);
    // item 2: 1 * 850 = 850 * 1.15 -> 977
    expect(slip.items[1].billedPrice).toBe(977);
    // item 3: 8 * 95 = 760 * 1.15 = 874
    expect(slip.items[2].billedPrice).toBe(874);

    expect(slip.totalMaterialCost).toBe(1910);

    const itemsBilledSum = 218 + 977 + 874; // 2069 Kč
    const _expectedTotal = itemsBilledSum + slip.fixedOverheadFee; // 2069 + 150 = 2219
    expect(slip.totalBilledAmount).toBeGreaterThan(slip.totalMaterialCost);
  });

  // Test 6: Adversarial and boundary inputs for consumables calculation
  it('guards against negative quantities, negative fees, and empty items list', () => {
    // Empty items list
    const emptyTotals = calculateConsumableSlipTotals([], 15, 100);
    expect(emptyTotals.totalMaterialCost).toBe(0);
    expect(emptyTotals.totalBilledAmount).toBe(100); // just the fixed fee

    // Negative quantity clamped to 0
    expect(calculateConsumableItemBilledPrice(-5, 50, 15)).toBe(0);

    // Negative markup clamped to 0% (base price preserved, no negative discount)
    expect(calculateConsumableItemBilledPrice(2, 100, -20)).toBe(200);

    // Negative fixed fee clamped to 0
    const negFeeTotals = calculateConsumableSlipTotals([], 0, -50);
    expect(negFeeTotals.totalBilledAmount).toBe(0);
  });
});
