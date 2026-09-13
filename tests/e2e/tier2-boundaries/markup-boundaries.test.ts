import { describe, it, expect } from 'vitest';
import type { ConsumableItem } from '../../../src/types';
import {
  calculateItemBilledPrice,
  calculateConsumableSlipTotals,
} from '../../../src/services/pricingEngine';

export { calculateItemBilledPrice, calculateConsumableSlipTotals };

describe('Tier 2 Boundary: Consumable Markup Boundaries (markup-boundaries.test.ts)', () => {
  // 1. 0% Markup Boundary (No Increase)
  it('computes exact un-marked-up cost when markup is 0%', () => {
    // 10 units @ 150 Kč = 1500 Kč
    const billed = calculateItemBilledPrice(150, 10, 0);
    expect(billed).toBe(1500);

    const slip = calculateConsumableSlipTotals(
      [
        { id: '1', category: 'fasteners', name: 'M12 bolts', quantity: 10, unit: 'ks', unitPrice: 150, billedPrice: 1500 },
      ],
      0,
      0
    );
    expect(slip.totalMaterialCost).toBe(1500);
    expect(slip.totalBilledAmount).toBe(1500);
  });

  // 2. 100% Markup Boundary (Cost Doubling)
  it('doubles the billed amount when markup is exactly 100%', () => {
    // 5 units @ 200 Kč = 1000 Kč cost -> 100% markup = 2000 Kč
    const billed = calculateItemBilledPrice(200, 5, 100);
    expect(billed).toBe(2000);
  });

  // 3. Fractional Percentages and Rounding
  it('correctly rounds fractional markup percentages (17.5% and 33.33%) to whole Czech crowns', () => {
    // 1 unit @ 100 Kč with 17.5% markup = 117.5 -> rounded to 118 Kč
    expect(calculateItemBilledPrice(100, 1, 17.5)).toBe(118);

    // 1 unit @ 100 Kč with 33.33% markup = 133.33 -> rounded to 133 Kč
    expect(calculateItemBilledPrice(100, 1, 33.33)).toBe(133);

    // 3 units @ 38 Kč = 114 Kč * 1.15 (15% markup) = 131.1 -> rounded to 131 Kč
    expect(calculateItemBilledPrice(38, 3, 15)).toBe(131);
  });

  // 4. Decimal Item Prices
  it('handles decimal unit prices with accurate sub-crown precision before final rounding', () => {
    // 100 units @ 3.45 Kč = 345 Kč * 1.20 = 414 Kč
    expect(calculateItemBilledPrice(3.45, 100, 20)).toBe(414);

    // 12 units @ 95.75 Kč = 1149 Kč * 1.10 = 1263.9 -> rounded to 1264 Kč
    expect(calculateItemBilledPrice(95.75, 12, 10)).toBe(1264);
  });

  // 5. Zero Quantity Boundary
  it('returns 0 billed price when quantity is 0, regardless of unit price or markup', () => {
    expect(calculateItemBilledPrice(500, 0, 20)).toBe(0);
    expect(calculateItemBilledPrice(0, 50, 20)).toBe(0);
  });

  // 6. High Item Count (Scalability & Precision)
  it('correctly aggregates large sheets (50 items) without rounding divergence', () => {
    const manyItems: ConsumableItem[] = [];
    for (let i = 1; i <= 50; i++) {
      manyItems.push({
        id: `item-${i}`,
        category: 'fasteners',
        name: `Fastener ${i}`,
        quantity: 10,
        unit: 'ks',
        unitPrice: 20, // 200 Kč cost each
        markupPercent: 15, // 230 Kč billed each
        billedPrice: 230,
      });
    }

    const slipTotals = calculateConsumableSlipTotals(manyItems, 15, 0);
    // 50 items * 200 Kč = 10,000 Kč cost
    expect(slipTotals.totalMaterialCost).toBe(10_000);
    // 50 items * 230 Kč = 11,500 Kč billed
    expect(slipTotals.totalBilledAmount).toBe(11_500);
  });

  // 7. Fixed Overhead Fee Integration
  it('adds fixed overhead fee correctly on top of marked-up items and handles empty list with fee', () => {
    const items: ConsumableItem[] = [
      { id: '1', category: 'technical_gases', name: 'Gas', quantity: 1, unit: 'bottle', unitPrice: 1000, billedPrice: 1150 },
    ];

    // 1000 Kč + 15% markup = 1150 Kč + 250 Kč fee = 1400 Kč
    const withFee = calculateConsumableSlipTotals(items, 15, 250);
    expect(withFee.totalMaterialCost).toBe(1000);
    expect(withFee.totalBilledAmount).toBe(1400);

    // Empty list with fee
    const emptyWithFee = calculateConsumableSlipTotals([], 15, 250);
    expect(emptyWithFee.totalMaterialCost).toBe(0);
    expect(emptyWithFee.totalBilledAmount).toBe(250);
  });

  // 8. Negative and Malformed Guards
  it('guards safely against negative quantities, negative markup, and malformed inputs', () => {
    expect(calculateItemBilledPrice(-50, 10, 15)).toBe(0);
    expect(calculateItemBilledPrice(50, -10, 15)).toBe(0);
    expect(calculateItemBilledPrice(NaN, 10, 15)).toBe(0);
    expect(calculateItemBilledPrice(50, NaN, 15)).toBe(0);
  });
});
