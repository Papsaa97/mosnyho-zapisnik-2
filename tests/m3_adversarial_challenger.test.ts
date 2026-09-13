import { describe, it, expect } from 'vitest';
import {
  calculateConsumableItemBilledPrice,
  calculateItemBilledPrice,
  calculateConsumableSlipTotals,
  calculateGrandTotal,
  calculateGrandTotalWithMaterials,
  formatActivityTagsForProtocol,
  formatCurrency,
  formatHours,
} from '../src/services/pricingEngine';
import {
  STANDARD_CONSUMABLES_CATALOG,
  MANDATORY_ACTIVITY_CHIPS,
  toggleActivityChip,
} from '../src/services/consumablesCatalog';
import { shiftFormReducer, createInitialState } from '../src/components/form/shiftFormReducer';
import { DEFAULT_SETTINGS } from '../src/db/seedData';
import { ConsumableItem, QuickActionTag } from '../src/types';

describe('M3 Empirical Challenger Stress Test Suite (Materials & Glove-Friendly Tags)', () => {

  // =========================================================================
  // Section 1: calculateConsumableItemBilledPrice & calculateItemBilledPrice
  // =========================================================================
  describe('1. calculateConsumableItemBilledPrice & calculateItemBilledPrice', () => {

    it('handles 0% markup across various quantities and unit prices without any price increase', () => {
      expect(calculateConsumableItemBilledPrice(1, 100, 0)).toBe(100);
      expect(calculateConsumableItemBilledPrice(10, 150, 0)).toBe(1500);
      expect(calculateConsumableItemBilledPrice(50, 38, 0)).toBe(1900);
      expect(calculateConsumableItemBilledPrice(100, 2.5, 0)).toBe(250);
      expect(calculateItemBilledPrice(150, 10, 0)).toBe(1500);
    });

    it('guarantees parameter commutativity between calculateConsumableItemBilledPrice(q, p, m) and calculateItemBilledPrice(p, q, m)', () => {
      const testCases = [
        { q: 5, p: 38, m: 15 },
        { q: 2.5, p: 850, m: 10 },
        { q: 12, p: 95.5, m: 20 },
        { q: 0.5, p: 1200, m: 0 },
        { q: 100, p: 3.45, m: 15 },
      ];
      for (const { q, p, m } of testCases) {
        const fromConsumable = calculateConsumableItemBilledPrice(q, p, m);
        const fromItem = calculateItemBilledPrice(p, q, m);
        expect(fromConsumable).toBe(fromItem);
      }
    });

    it('correctly handles decimal quantities (e.g. 0.5 bottle of gas, 2.5 kg wire, 0.75 m tube)', () => {
      // 0.5 bottle of Argon @ 850 Kč with 15% markup:
      // Base: 0.5 * 850 = 425 Kč.
      // Billed: 425 * 1.15 = 488.75 -> Math.round -> 489 Kč
      expect(calculateConsumableItemBilledPrice(0.5, 850, 15)).toBe(489);

      // 2.5 kg welding wire @ 140 Kč/kg with 20% markup:
      // Base: 2.5 * 140 = 350 Kč.
      // Billed: 350 * 1.20 = 420 Kč
      expect(calculateConsumableItemBilledPrice(2.5, 140, 20)).toBe(420);

      // 0.33 of technical gas @ 1200 Kč with 10% markup:
      // Base: 0.33 * 1200 = 396 Kč.
      // Billed: 396 * 1.10 = 435.6 -> Math.round -> 436 Kč
      expect(calculateConsumableItemBilledPrice(0.33, 1200, 10)).toBe(436);
    });

    it('correctly handles decimal unit prices with fractional Czech crowns and rounds cleanly', () => {
      // 100 units @ 3.45 Kč with 20% markup:
      // Base: 100 * 3.45 = 345 Kč.
      // Billed: 345 * 1.20 = 414 Kč
      expect(calculateConsumableItemBilledPrice(100, 3.45, 20)).toBe(414);

      // 12 units @ 95.75 Kč with 10% markup:
      // Base: 12 * 95.75 = 1149 Kč.
      // Billed: 1149 * 1.10 = 1263.9 -> Math.round -> 1264 Kč
      expect(calculateConsumableItemBilledPrice(12, 95.75, 10)).toBe(1264);

      // 1 unit @ 99.49 Kč with 0% markup:
      // Base: 99.49 -> Math.round -> 99 Kč
      expect(calculateConsumableItemBilledPrice(1, 99.49, 0)).toBe(99);

      // 1 unit @ 99.50 Kč with 0% markup:
      // Base: 99.50 -> Math.round -> 100 Kč
      expect(calculateConsumableItemBilledPrice(1, 99.50, 0)).toBe(100);
    });

    it('safely guards against negative quantities, prices, and markups without producing negative costs or discounts', () => {
      // Negative quantity clamped to 0
      expect(calculateConsumableItemBilledPrice(-5, 100, 15)).toBe(0);
      expect(calculateConsumableItemBilledPrice(-0.01, 100, 15)).toBe(0);

      // Negative price clamped to 0
      expect(calculateConsumableItemBilledPrice(5, -100, 15)).toBe(0);
      expect(calculateConsumableItemBilledPrice(5, -0.01, 15)).toBe(0);

      // Negative markup clamped to 0% (does not discount below base price)
      expect(calculateConsumableItemBilledPrice(2, 100, -20)).toBe(200);
      expect(calculateConsumableItemBilledPrice(5, 50, -50)).toBe(250);

      // All negative
      expect(calculateConsumableItemBilledPrice(-5, -50, -10)).toBe(0);
    });

    it('safely guards against NaN, undefined, null, and non-numeric inputs', () => {
      // @ts-expect-error testing runtime robustness
      expect(calculateConsumableItemBilledPrice(NaN, 100, 15)).toBe(0);
      // @ts-expect-error testing runtime robustness
      expect(calculateConsumableItemBilledPrice(10, NaN, 15)).toBe(0);
      // @ts-expect-error testing runtime robustness
      expect(calculateConsumableItemBilledPrice(10, 100, NaN)).toBe(1000);
      // @ts-expect-error testing runtime robustness
      expect(calculateConsumableItemBilledPrice(undefined, 100, 15)).toBe(0);
      // @ts-expect-error testing runtime robustness
      expect(calculateConsumableItemBilledPrice(10, undefined, 15)).toBe(0);
      // @ts-expect-error testing runtime robustness
      expect(calculateConsumableItemBilledPrice(null, 100, 15)).toBe(0);
      // @ts-expect-error testing runtime robustness
      expect(calculateConsumableItemBilledPrice(10, null, 15)).toBe(0);
    });

    it('handles zero quantity and zero price gracefully', () => {
      expect(calculateConsumableItemBilledPrice(0, 100, 20)).toBe(0);
      expect(calculateConsumableItemBilledPrice(100, 0, 20)).toBe(0);
      expect(calculateConsumableItemBilledPrice(0, 0, 0)).toBe(0);
    });

    it('accurately computes very large numbers without overflow or loss of integer precision', () => {
      // Large commercial order: 500 bottles of Argon @ 850 Kč = 425,000 Kč + 15% markup = 488,750 Kč
      expect(calculateConsumableItemBilledPrice(500, 850, 15)).toBe(488750);

      // 10,000 heavy duty anchors @ 125.50 Kč = 1,255,000 Kč + 20% markup = 1,506,000 Kč
      expect(calculateConsumableItemBilledPrice(10000, 125.5, 20)).toBe(1506000);
    });

    it('correctly handles standard and non-standard markup percentages (0%, 10%, 15%, 20%, 33.33%, 100%, 250%)', () => {
      const base = 100;
      expect(calculateConsumableItemBilledPrice(1, base, 0)).toBe(100);
      expect(calculateConsumableItemBilledPrice(1, base, 10)).toBe(110);
      expect(calculateConsumableItemBilledPrice(1, base, 15)).toBe(115);
      expect(calculateConsumableItemBilledPrice(1, base, 20)).toBe(120);
      expect(calculateConsumableItemBilledPrice(1, base, 33.33)).toBe(133);
      expect(calculateConsumableItemBilledPrice(1, base, 100)).toBe(200);
      expect(calculateConsumableItemBilledPrice(1, base, 250)).toBe(350);
    });
  });

  // =========================================================================
  // Section 2: calculateConsumableSlipTotals
  // =========================================================================
  describe('2. calculateConsumableSlipTotals', () => {

    it('handles empty items array with 0 and positive fixed fee', () => {
      const res1 = calculateConsumableSlipTotals([], 15, 0);
      expect(res1.totalMaterialCost).toBe(0);
      expect(res1.totalBilledAmount).toBe(0);

      const res2 = calculateConsumableSlipTotals([], 15, 150);
      expect(res2.totalMaterialCost).toBe(0);
      expect(res2.totalBilledAmount).toBe(150);

      const res3 = calculateConsumableSlipTotals([], 0, 250);
      expect(res3.totalMaterialCost).toBe(0);
      expect(res3.totalBilledAmount).toBe(250);
    });

    it('handles nullish or undefined items array safely', () => {
      // @ts-expect-error testing runtime resilience
      const resNull = calculateConsumableSlipTotals(null, 15, 200);
      expect(resNull.totalMaterialCost).toBe(0);
      expect(resNull.totalBilledAmount).toBe(200);

      // @ts-expect-error testing runtime resilience
      const resUndef = calculateConsumableSlipTotals(undefined, 15, 100);
      expect(resUndef.totalMaterialCost).toBe(0);
      expect(resUndef.totalBilledAmount).toBe(100);
    });

    it('guards against negative or NaN fixed overhead fees', () => {
      const resNeg = calculateConsumableSlipTotals([], 15, -150);
      expect(resNeg.totalBilledAmount).toBe(0);

      const resNaN = calculateConsumableSlipTotals([], 15, NaN);
      expect(resNaN.totalBilledAmount).toBe(0);
    });

    it('calculates totals for items with individual markupPercent and precomputed billedPrice', () => {
      const items: ConsumableItem[] = [
        {
          id: 'item-1',
          category: 'cutting_grinding',
          name: 'Discs',
          quantity: 5,
          unit: 'ks',
          unitPrice: 38,
          markupPercent: 15,
          billedPrice: 218, // 190 * 1.15 = 218.5 -> Math.round -> 218 in IEEE 754
        },
        {
          id: 'item-2',
          category: 'technical_gases',
          name: 'Argon',
          quantity: 1,
          unit: 'náplň',
          unitPrice: 850,
          markupPercent: 15,
          billedPrice: 977, // 850 * 1.15 = 977.5 -> 977
        },
      ];

      const res = calculateConsumableSlipTotals(items, 15, 150);
      expect(res.totalMaterialCost).toBe(190 + 850); // 1040
      expect(res.totalBilledAmount).toBe(218 + 977 + 150); // 1345
    });

    it('calculates totals for items without individual markupPercent using slip-level overhead markup', () => {
      const items: ConsumableItem[] = [
        {
          id: 'item-1',
          category: 'fasteners',
          name: 'M12 Screws',
          quantity: 10,
          unit: 'ks',
          unitPrice: 20,
          billedPrice: 200,
        },
        {
          id: 'item-2',
          category: 'anchors',
          name: 'Resin',
          quantity: 2,
          unit: 'ks',
          unitPrice: 400,
          billedPrice: 800,
        },
      ];

      // Total cost = 10*20 + 2*400 = 1000 Kč
      // Overhead markup = 15% -> 1150 Kč billed + 200 Kč fee = 1350 Kč
      const res = calculateConsumableSlipTotals(items, 15, 200);
      expect(res.totalMaterialCost).toBe(1000);
      expect(res.totalBilledAmount).toBe(1350);
    });

    it('calculates totals for items with 0% overhead markup and 0 fixed fee', () => {
      const items: ConsumableItem[] = [
        {
          id: 'item-1',
          category: 'fasteners',
          name: 'M12 Screws',
          quantity: 10,
          unit: 'ks',
          unitPrice: 20,
          billedPrice: 200,
        },
      ];
      const res = calculateConsumableSlipTotals(items, 0, 0);
      expect(res.totalMaterialCost).toBe(200);
      expect(res.totalBilledAmount).toBe(200);
    });

    it('defensively clamps negative item quantities to 0 in calculateConsumableSlipTotals', () => {
      const items: ConsumableItem[] = [
        {
          id: 'bad-item',
          category: 'fasteners',
          name: 'Negative screws',
          quantity: -5,
          unit: 'ks',
          unitPrice: 100,
          billedPrice: 0,
        },
      ];
      const res = calculateConsumableSlipTotals(items, 15, 0);
      // Hardened: negative item quantities clamp to 0
      expect(res.totalMaterialCost).toBe(0);
      expect(res.totalBilledAmount).toBe(0);
    });

    it('accurately aggregates large sheets with 50+ items without arithmetic drift', () => {
      const items: ConsumableItem[] = [];
      for (let i = 0; i < 50; i++) {
        items.push({
          id: `item-${i}`,
          category: 'fasteners',
          name: `Anchor Bolt ${i}`,
          quantity: 10,
          unit: 'ks',
          unitPrice: 50,
          markupPercent: 20,
          billedPrice: 600,
        });
      }
      // 50 items * 500 Kč cost = 25,000 Kč cost
      // 50 items * 600 Kč billed = 30,000 Kč billed
      // Fixed fee: 250 Kč -> 30,250 Kč
      const res = calculateConsumableSlipTotals(items, 20, 250);
      expect(res.totalMaterialCost).toBe(25000);
      expect(res.totalBilledAmount).toBe(30250);
    });
  });

  // =========================================================================
  // Section 3: calculateGrandTotalWithMaterials & Manual Override
  // =========================================================================
  describe('3. calculateGrandTotalWithMaterials & Manual Override', () => {

    const baseEntry = {
      totalHours: 8,
      pricing: {
        baseHourlyRate: 500,
        complexityMultiplier: 1.0,
        shiftSurcharges: [],
        calculatedHourlyRate: 500,
        isManualOverride: false,
        manualTotalOverride: undefined,
      },
      travel: {
        distanceKm: 50,
        ratePerKm: 10, // 500 Kč
        travelTimeHours: 1,
        travelHourlyRate: 300, // 300 Kč
        dietAllowance: 166, // 166 Kč
      },
      extraCosts: [
        { id: 'extra-1', description: 'Parking', amount: 200 },
      ],
    };

    it('calculates grand total when consumableSlip is undefined (matches calculateGrandTotal)', () => {
      // Labor: 8 * 500 = 4000
      // Travel: 500 + 300 + 166 = 966
      // Extras: 200
      // Total: 4000 + 966 + 200 = 5166
      const baseTotal = calculateGrandTotal(baseEntry);
      expect(baseTotal).toBe(5166);

      const totalWithMaterials = calculateGrandTotalWithMaterials(baseEntry);
      expect(totalWithMaterials).toBe(5166);
      expect(totalWithMaterials).toBe(baseTotal);
    });

    it('correctly integrates consumableSlip into grand total without double-counting', () => {
      const entryWithMaterials = {
        ...baseEntry,
        consumableSlip: {
          items: [
            {
              id: 'c1',
              category: 'cutting_grinding' as const,
              name: 'Discs',
              quantity: 5,
              unit: 'ks',
              unitPrice: 38,
              markupPercent: 15,
              billedPrice: 218,
            },
          ],
          overheadMarkupPercent: 15,
          fixedOverheadFee: 150,
          totalMaterialCost: 190,
          totalBilledAmount: 368, // 218 + 150 = 368
        },
      };

      const baseTotal = calculateGrandTotal(entryWithMaterials);
      expect(baseTotal).toBe(5166); // base does NOT include materials

      const grandTotal = calculateGrandTotalWithMaterials(entryWithMaterials);
      // 5166 + 368 = 5534
      expect(grandTotal).toBe(5534);
      expect(grandTotal).toBe(baseTotal + entryWithMaterials.consumableSlip.totalBilledAmount);
    });

    it('strictly respects manualTotalOverride when isManualOverride is true, bypassing material summation', () => {
      const entryWithManualOverride = {
        ...baseEntry,
        pricing: {
          ...baseEntry.pricing,
          isManualOverride: true,
          manualTotalOverride: 12000,
        },
        consumableSlip: {
          items: [],
          overheadMarkupPercent: 15,
          fixedOverheadFee: 150,
          totalMaterialCost: 190,
          totalBilledAmount: 5000,
        },
      };

      const baseTotal = calculateGrandTotal(entryWithManualOverride);
      expect(baseTotal).toBe(12000);

      const grandTotal = calculateGrandTotalWithMaterials(entryWithManualOverride);
      expect(grandTotal).toBe(12000); // MUST be exactly manualTotalOverride, NOT 12000 + 5000
    });

    it('falls back to calculated total if isManualOverride is true but manualTotalOverride is 0 or negative', () => {
      const entryWithZeroOverride = {
        ...baseEntry,
        pricing: {
          ...baseEntry.pricing,
          isManualOverride: true,
          manualTotalOverride: 0,
        },
        consumableSlip: {
          items: [],
          overheadMarkupPercent: 15,
          fixedOverheadFee: 0,
          totalMaterialCost: 0,
          totalBilledAmount: 400,
        },
      };

      const grandTotal = calculateGrandTotalWithMaterials(entryWithZeroOverride);
      // Base: 5166 + 400 = 5566
      expect(grandTotal).toBe(5566);
    });
  });

  // =========================================================================
  // Section 4: Glove-Friendly Activity Chips & Formatters
  // =========================================================================
  describe('4. Glove-Friendly Activity Chips & Formatters', () => {

    it('verifies that MANDATORY_ACTIVITY_CHIPS contains all 5 required glove-friendly tags', () => {
      const expectedChips: QuickActionTag[] = [
        'Příprava',
        'Svařování',
        'Montáž ve výškách',
        'Broušení/začištění',
        'Kotvení',
      ];
      expect(MANDATORY_ACTIVITY_CHIPS).toEqual(expectedChips);
      expect(MANDATORY_ACTIVITY_CHIPS.length).toBe(5);
    });

    it('toggleActivityChip correctly toggles chips in selection array without mutation', () => {
      const initial: QuickActionTag[] = ['Příprava'];

      // Add 'Svařování'
      const step1 = toggleActivityChip(initial, 'Svařování');
      expect(step1).toEqual(['Příprava', 'Svařování']);
      expect(initial).toEqual(['Příprava']); // immutability check

      // Add 'Kotvení'
      const step2 = toggleActivityChip(step1, 'Kotvení');
      expect(step2).toEqual(['Příprava', 'Svařování', 'Kotvení']);

      // Remove 'Svařování'
      const step3 = toggleActivityChip(step2, 'Svařování');
      expect(step3).toEqual(['Příprava', 'Kotvení']);

      // Remove 'Příprava'
      const step4 = toggleActivityChip(step3, 'Příprava');
      expect(step4).toEqual(['Kotvení']);

      // Remove last tag
      const step5 = toggleActivityChip(step4, 'Kotvení');
      expect(step5).toEqual([]);
    });

    it('formatActivityTagsForProtocol formats tags cleanly for protocol print summary', () => {
      expect(formatActivityTagsForProtocol([])).toBe('');
      // @ts-expect-error testing runtime robustness
      expect(formatActivityTagsForProtocol(undefined)).toBe('');
      // @ts-expect-error testing runtime robustness
      expect(formatActivityTagsForProtocol(null)).toBe('');

      expect(formatActivityTagsForProtocol(['Svařování'])).toBe('Svařování');
      expect(formatActivityTagsForProtocol(['Příprava', 'Svařování', 'Kotvení']))
        .toBe('Příprava, Svařování, Kotvení');
    });
  });

  // =========================================================================
  // Section 5: Standard Consumables Catalog Verification
  // =========================================================================
  describe('5. Standard Consumables Catalog Verification', () => {

    it('ensures catalog has at least 25 items across all 5 standard categories', () => {
      expect(STANDARD_CONSUMABLES_CATALOG.length).toBeGreaterThanOrEqual(25);

      const categories = new Set(STANDARD_CONSUMABLES_CATALOG.map(i => i.category));
      expect(categories.has('cutting_grinding')).toBe(true);
      expect(categories.has('technical_gases')).toBe(true);
      expect(categories.has('anchors')).toBe(true);
      expect(categories.has('fasteners')).toBe(true);
      expect(categories.has('welding_consumables')).toBe(true);
    });

    it('ensures every catalog item has non-empty name, unit, and positive unit price', () => {
      for (const item of STANDARD_CONSUMABLES_CATALOG) {
        expect(item.name.trim().length).toBeGreaterThan(0);
        expect(item.unit.trim().length).toBeGreaterThan(0);
        expect(item.unitPrice).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // Section 6: ShiftFormReducer Materials & Tags Integration
  // =========================================================================
  describe('6. ShiftFormReducer Materials & Tags Integration', () => {

    it('properly manages ADD, UPDATE_QTY, REMOVE, MARKUP, and FIXED_FEE in shiftFormReducer', () => {
      let state = createInitialState(null, null, DEFAULT_SETTINGS);
      expect(state.consumableSlip).toBeUndefined();

      // 1. Add item
      const item1: ConsumableItem = {
        id: 'c1',
        category: 'cutting_grinding',
        name: 'Řezný kotouč 125',
        quantity: 5,
        unit: 'ks',
        unitPrice: 38,
        markupPercent: 15,
        billedPrice: 218,
      };
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: item1 });
      expect(state.consumableSlip).toBeDefined();
      expect(state.consumableSlip?.items.length).toBe(1);
      expect(state.consumableSlip?.totalMaterialCost).toBe(190);
      expect(state.consumableSlip?.totalBilledAmount).toBe(218);

      // 2. Add second item
      const item2: ConsumableItem = {
        id: 'c2',
        category: 'technical_gases',
        name: 'Argon',
        quantity: 1,
        unit: 'náplň',
        unitPrice: 850,
        markupPercent: 15,
        billedPrice: 977,
      };
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: item2 });
      expect(state.consumableSlip?.items.length).toBe(2);
      expect(state.consumableSlip?.totalMaterialCost).toBe(190 + 850);
      expect(state.consumableSlip?.totalBilledAmount).toBe(218 + 977);

      // 3. Set fixed fee to 150 Kč
      state = shiftFormReducer(state, { type: 'SET_CONSUMABLE_FIXED_FEE', fee: 150 });
      expect(state.consumableSlip?.fixedOverheadFee).toBe(150);
      expect(state.consumableSlip?.totalBilledAmount).toBe(218 + 977 + 150);

      // 4. Update quantity of item 1 from 5 to 10
      state = shiftFormReducer(state, { type: 'UPDATE_CONSUMABLE_ITEM_QTY', id: 'c1', quantity: 10 });
      // 10 * 38 = 380 Kč base. 380 * 1.15 = 437 Kč billed.
      const updatedItem1 = state.consumableSlip?.items.find(i => i.id === 'c1');
      expect(updatedItem1?.quantity).toBe(10);
      expect(updatedItem1?.billedPrice).toBe(437);
      expect(state.consumableSlip?.totalMaterialCost).toBe(380 + 850);
      expect(state.consumableSlip?.totalBilledAmount).toBe(437 + 977 + 150);

      // 5. Update quantity to 0 -> should remove item
      state = shiftFormReducer(state, { type: 'UPDATE_CONSUMABLE_ITEM_QTY', id: 'c1', quantity: 0 });
      expect(state.consumableSlip?.items.length).toBe(1);
      expect(state.consumableSlip?.items[0].id).toBe('c2');
      expect(state.consumableSlip?.totalMaterialCost).toBe(850);
      expect(state.consumableSlip?.totalBilledAmount).toBe(977 + 150);

      // 6. Remove remaining item
      state = shiftFormReducer(state, { type: 'REMOVE_CONSUMABLE_ITEM', id: 'c2' });
      expect(state.consumableSlip?.items.length).toBe(0);
      expect(state.consumableSlip?.totalMaterialCost).toBe(0);
      expect(state.consumableSlip?.totalBilledAmount).toBe(150); // only fixed fee remaining
    });

    it('empirically reveals that SET_CONSUMABLE_MARKUP retains old markup when items have explicit markupPercent', () => {
      let state = createInitialState(null, null, DEFAULT_SETTINGS);
      const item: ConsumableItem = {
        id: 'c1',
        category: 'cutting_grinding',
        name: 'Kotouč',
        quantity: 10,
        unit: 'ks',
        unitPrice: 100, // 1000 Kč base
        markupPercent: 15,
        billedPrice: 1150,
      };
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item });
      expect(state.consumableSlip?.totalBilledAmount).toBe(1150);

      // When items have markupPercent defined, SET_CONSUMABLE_MARKUP retains old item-level markup:
      const stateAfter20 = shiftFormReducer(state, { type: 'SET_CONSUMABLE_MARKUP', markupPercent: 20 });
      expect(stateAfter20.consumableSlip?.overheadMarkupPercent).toBe(20);
      expect(stateAfter20.consumableSlip?.items[0].billedPrice).toBe(1150); // stays 1150
      expect(stateAfter20.consumableSlip?.totalBilledAmount).toBe(1150);
    });

    it('empirically verifies that SET_CONSUMABLE_MARKUP updates items that omitted markupPercent', () => {
      let state = createInitialState(null, null, DEFAULT_SETTINGS);
      const itemWithoutMarkup: ConsumableItem = {
        id: 'c2',
        category: 'cutting_grinding',
        name: 'Kotouč bez marže',
        quantity: 10,
        unit: 'ks',
        unitPrice: 100, // 1000 Kč base
        billedPrice: 1000,
      };
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: itemWithoutMarkup });

      // When markup is updated to 20%:
      const stateAfter20 = shiftFormReducer(state, { type: 'SET_CONSUMABLE_MARKUP', markupPercent: 20 });
      expect(stateAfter20.consumableSlip?.overheadMarkupPercent).toBe(20);
      expect(stateAfter20.consumableSlip?.items[0].billedPrice).toBe(1200);
      expect(stateAfter20.consumableSlip?.totalBilledAmount).toBe(1200);
    });

    it('toggles activity tags in shiftFormReducer and hydrates from workActionTags', () => {
      let state = createInitialState(null, null, DEFAULT_SETTINGS);
      expect(state.activityTags).toEqual([]);

      // Toggle 'Svařování' on
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Svařování' });
      expect(state.activityTags).toContain('Svařování');

      // Toggle 'Kotvení' on
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Kotvení' });
      expect(state.activityTags).toEqual(['Svařování', 'Kotvení']);

      // Toggle 'Svařování' off
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Svařování' });
      expect(state.activityTags).toEqual(['Kotvení']);

      // Hydration from an entry specifying workActionTags
      const entryWithWorkActionTags = {
        workActionTags: ['Příprava' as QuickActionTag, 'Montáž ve výškách' as QuickActionTag]
      };
      const hydratedState = createInitialState(null, entryWithWorkActionTags, DEFAULT_SETTINGS);
      expect(hydratedState.activityTags).toEqual(['Příprava', 'Montáž ve výškách']);
    });
  });

  // =========================================================================
  // Section 7: Currency & Hours Display Formatters
  // =========================================================================
  describe('7. Currency & Hours Display Formatters', () => {
    it('formats Czech currency with non-breaking space and Kč symbol', () => {
      const formatted = formatCurrency(12450);
      expect(formatted).toMatch(/12.*450.*Kč/);
      expect(formatCurrency(0)).toMatch(/0.*Kč/);
    });

    it('formats hours with Czech comma notation', () => {
      expect(formatHours(8.5)).toBe('8,5 h');
      expect(formatHours(10)).toBe('10,0 h');
      expect(formatHours(0)).toBe('0,0 h');
    });
  });
});
