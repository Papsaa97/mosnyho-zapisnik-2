import { describe, it, expect } from 'vitest';
import { 
  shiftFormReducer, 
  createInitialState, 
  ShiftFormState 
} from '../src/components/form/shiftFormReducer';
import { 
  STANDARD_CONSUMABLES_CATALOG, 
  CONSUMABLE_CATEGORIES, 
  MANDATORY_ACTIVITY_CHIPS, 
  toggleActivityChip 
} from '../src/services/consumablesCatalog';
import { 
  calculateConsumableItemBilledPrice, 
  calculateItemBilledPrice,
  calculateGrandTotalWithMaterials,
  calculateGrandTotal,
  formatActivityTagsForProtocol 
} from '../src/services/pricingEngine';
import { 
  WorkEntry, 
  ConsumableItem, 
  ConsumableSlip, 
  QuickActionTag, 
  RatesConfig, 
  ClientProfile 
} from '../src/types';
import { createIsolatedTestDb } from './helpers/dbHelper';
import { DEFAULT_SETTINGS } from '../src/db/seedData';

describe('Milestone M3 Challenger 2: Empirical Stress Test & Verification Suite', () => {
  const mockClients: ClientProfile[] = [
    {
      id: 'client-01',
      name: 'Metrostav DIZ s.r.o.',
      ic: '00014915',
      dic: 'CZ00014915',
      address: 'Koželužská 2450/4, 180 00 Praha 8',
      isPdpDefault: true,
      defaultHourlyRate: 650,
    },
    {
      id: 'client-02',
      name: 'Skanska a.s.',
      ic: '26271303',
      dic: 'CZ26271303',
      address: 'Křižíkova 682/34a, 186 00 Praha 8',
      isPdpDefault: false,
      defaultHourlyRate: 700,
    }
  ];

  const defaultRates: RatesConfig = DEFAULT_SETTINGS.rates;

  // Helper to create a clean initial state
  function getCleanFormState(): ShiftFormState {
    return createInitialState(null, null, { clients: mockClients, rates: defaultRates });
  }

  // =========================================================================
  // 1. Reducer Stress Tests (shiftFormReducer.ts)
  // =========================================================================
  describe('1. shiftFormReducer ConsumableSlip & ActivityTags Stress Tests', () => {
    it('1.1 repeatedly adds new and identical items with automatic quantity accumulation', () => {
      let state = getCleanFormState();
      expect(state.consumableSlip).toBeUndefined();

      const item1: ConsumableItem = {
        id: 'cut-125-1',
        category: 'cutting_grinding',
        name: 'Řezný kotouč 125 × 1.0 mm',
        quantity: 5,
        unit: 'ks',
        unitPrice: 35,
        billedPrice: 175,
      };

      // 1. Add first item to undefined consumableSlip
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: item1 });
      expect(state.consumableSlip).toBeDefined();
      expect(state.consumableSlip?.items).toHaveLength(1);
      expect(state.consumableSlip?.items[0].quantity).toBe(5);
      expect(state.consumableSlip?.items[0].billedPrice).toBe(175);
      expect(state.consumableSlip?.totalMaterialCost).toBe(175);
      expect(state.consumableSlip?.totalBilledAmount).toBe(175);

      // 2. Add identical item again (should accumulate quantity, not add a duplicate entry)
      const item1Additional: ConsumableItem = {
        id: 'cut-125-1',
        category: 'cutting_grinding',
        name: 'Řezný kotouč 125 × 1.0 mm',
        quantity: 3,
        unit: 'ks',
        unitPrice: 35,
        billedPrice: 105,
      };
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: item1Additional });
      expect(state.consumableSlip?.items).toHaveLength(1);
      expect(state.consumableSlip?.items[0].quantity).toBe(8);
      expect(state.consumableSlip?.items[0].billedPrice).toBe(280); // 8 * 35 = 280
      expect(state.consumableSlip?.totalMaterialCost).toBe(280);
      expect(state.consumableSlip?.totalBilledAmount).toBe(280);

      // 3. Add second different item with item-level markup
      const item2: ConsumableItem = {
        id: 'bolt-m10',
        category: 'fasteners',
        name: 'Šroub M10x30 8.8',
        quantity: 20,
        unit: 'ks',
        unitPrice: 8,
        markupPercent: 25,
        billedPrice: 200, // 20 * 8 * 1.25 = 200
      };
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: item2 });
      expect(state.consumableSlip?.items).toHaveLength(2);
      expect(state.consumableSlip?.totalMaterialCost).toBe(280 + 160); // 440
      expect(state.consumableSlip?.totalBilledAmount).toBe(280 + 200); // 480
    });

    it('1.2 updates item quantities with automatic removal on zero or negative values', () => {
      let state = getCleanFormState();
      const itemA: ConsumableItem = {
        id: 'item-a',
        category: 'cutting_grinding',
        name: 'Kotouč A',
        quantity: 10,
        unit: 'ks',
        unitPrice: 50,
        billedPrice: 500,
      };
      const itemB: ConsumableItem = {
        id: 'item-b',
        category: 'anchors',
        name: 'Kotva B',
        quantity: 4,
        unit: 'ks',
        unitPrice: 100,
        billedPrice: 400,
      };

      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: itemA });
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: itemB });
      expect(state.consumableSlip?.items).toHaveLength(2);

      // 1. Update quantity to positive value
      state = shiftFormReducer(state, { type: 'UPDATE_CONSUMABLE_ITEM_QTY', id: 'item-a', quantity: 20 });
      expect(state.consumableSlip?.items.find(i => i.id === 'item-a')?.quantity).toBe(20);
      expect(state.consumableSlip?.items.find(i => i.id === 'item-a')?.billedPrice).toBe(1000);
      expect(state.consumableSlip?.totalMaterialCost).toBe(1000 + 400);

      // 2. Update quantity to zero -> should remove item-a
      state = shiftFormReducer(state, { type: 'UPDATE_CONSUMABLE_ITEM_QTY', id: 'item-a', quantity: 0 });
      expect(state.consumableSlip?.items).toHaveLength(1);
      expect(state.consumableSlip?.items.find(i => i.id === 'item-a')).toBeUndefined();
      expect(state.consumableSlip?.totalMaterialCost).toBe(400);

      // 3. Update remaining item to negative quantity -> should remove item-b
      state = shiftFormReducer(state, { type: 'UPDATE_CONSUMABLE_ITEM_QTY', id: 'item-b', quantity: -3 });
      expect(state.consumableSlip?.items).toHaveLength(0);
      expect(state.consumableSlip?.totalMaterialCost).toBe(0);
      expect(state.consumableSlip?.totalBilledAmount).toBe(0);

      // 4. Update quantity of non-existent item -> safe no-op
      const stateBefore = state;
      state = shiftFormReducer(state, { type: 'UPDATE_CONSUMABLE_ITEM_QTY', id: 'does-not-exist', quantity: 5 });
      expect(state).toEqual(stateBefore);
    });

    it('1.3 removes items cleanly and handles removal on empty or undefined slips', () => {
      let state = getCleanFormState();
      
      // Removal on undefined slip
      state = shiftFormReducer(state, { type: 'REMOVE_CONSUMABLE_ITEM', id: 'none' });
      expect(state.consumableSlip).toBeUndefined();

      // Add item and remove it
      const item: ConsumableItem = {
        id: 'gas-arg',
        category: 'technical_gases',
        name: 'Argon 4.6',
        quantity: 2,
        unit: 'lahev',
        unitPrice: 650,
        billedPrice: 1300,
      };
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item });
      expect(state.consumableSlip?.items).toHaveLength(1);

      state = shiftFormReducer(state, { type: 'REMOVE_CONSUMABLE_ITEM', id: 'gas-arg' });
      expect(state.consumableSlip?.items).toHaveLength(0);
      expect(state.consumableSlip?.totalMaterialCost).toBe(0);
      expect(state.consumableSlip?.totalBilledAmount).toBe(0);

      // Remove non-existent item from empty list
      state = shiftFormReducer(state, { type: 'REMOVE_CONSUMABLE_ITEM', id: 'ghost' });
      expect(state.consumableSlip?.items).toHaveLength(0);
    });

    it('1.4 adjusts overhead markup and respects item-level markup overrides', () => {
      let state = getCleanFormState();

      // Item 1: inherits overhead markup
      const item1: ConsumableItem = {
        id: 'it-1',
        category: 'fasteners',
        name: 'DIN 933 M12x40',
        quantity: 10,
        unit: 'ks',
        unitPrice: 14,
        billedPrice: 140, // 0% initially
      };

      // Item 2: explicit 30% markup
      const item2: ConsumableItem = {
        id: 'it-2',
        category: 'anchors',
        name: 'Chemická kotva',
        quantity: 2,
        unit: 'kartuše',
        unitPrice: 280,
        markupPercent: 30,
        billedPrice: 728, // 2 * 280 * 1.3 = 728
      };

      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: item1 });
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: item2 });

      // Change overhead markup to 20%
      state = shiftFormReducer(state, { type: 'SET_CONSUMABLE_MARKUP', markupPercent: 20 });
      expect(state.consumableSlip?.overheadMarkupPercent).toBe(20);

      const updatedItem1 = state.consumableSlip?.items.find(i => i.id === 'it-1');
      const updatedItem2 = state.consumableSlip?.items.find(i => i.id === 'it-2');

      // item1 should now be billed at 20% markup: round(10 * 14 * 1.2) = 168
      expect(updatedItem1?.billedPrice).toBe(168);

      // item2 had explicit 30% markup: should NOT be overwritten by overhead 20%
      expect(updatedItem2?.markupPercent).toBe(30);
      expect(updatedItem2?.billedPrice).toBe(728);

      // Total material cost = 140 + 560 = 700
      expect(state.consumableSlip?.totalMaterialCost).toBe(700);
      // Total billed amount = 168 + 728 = 896
      expect(state.consumableSlip?.totalBilledAmount).toBe(896);
    });

    it('1.5 updates fixed overhead fee and guards against negative fees', () => {
      let state = getCleanFormState();
      const item: ConsumableItem = {
        id: 'wire-sg2',
        category: 'welding_consumables',
        name: 'Drát SG2 15kg',
        quantity: 1,
        unit: 'cívka',
        unitPrice: 1100,
        billedPrice: 1100,
      };

      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item });
      expect(state.consumableSlip?.totalBilledAmount).toBe(1100);

      // 1. Add fixed fee 150 Kč
      state = shiftFormReducer(state, { type: 'SET_CONSUMABLE_FIXED_FEE', fee: 150 });
      expect(state.consumableSlip?.fixedOverheadFee).toBe(150);
      expect(state.consumableSlip?.totalBilledAmount).toBe(1250);

      // 2. Change fixed fee to 250 Kč
      state = shiftFormReducer(state, { type: 'SET_CONSUMABLE_FIXED_FEE', fee: 250 });
      expect(state.consumableSlip?.fixedOverheadFee).toBe(250);
      expect(state.consumableSlip?.totalBilledAmount).toBe(1350);

      // 3. Negative fee should be clamped to 0
      state = shiftFormReducer(state, { type: 'SET_CONSUMABLE_FIXED_FEE', fee: -100 });
      expect(state.consumableSlip?.fixedOverheadFee).toBe(0);
      expect(state.consumableSlip?.totalBilledAmount).toBe(1100);

      // 4. Setting fixed fee on fresh state without items
      let freshState = getCleanFormState();
      freshState = shiftFormReducer(freshState, { type: 'SET_CONSUMABLE_FIXED_FEE', fee: 200 });
      expect(freshState.consumableSlip?.fixedOverheadFee).toBe(200);
      expect(freshState.consumableSlip?.totalMaterialCost).toBe(0);
      expect(freshState.consumableSlip?.totalBilledAmount).toBe(200);
    });

    it('1.6 stress-tests activity tag toggling: all 5 on, arbitrary off, duplicate clicks, and order permutations', () => {
      let state = getCleanFormState();
      expect(state.activityTags).toEqual([]);

      const chips: QuickActionTag[] = [
        'Příprava',
        'Svařování',
        'Montáž ve výškách',
        'Broušení/začištění',
        'Kotvení'
      ];

      // 1. Toggle ON all 5 tags sequentially
      for (const chip of chips) {
        state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: chip });
      }
      expect(state.activityTags).toEqual(chips);
      expect(state.activityTags).toHaveLength(5);

      // 2. Duplicate click on an active tag toggles it OFF
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Svařování' });
      expect(state.activityTags).toEqual(['Příprava', 'Montáž ve výškách', 'Broušení/začištění', 'Kotvení']);
      expect(state.activityTags).not.toContain('Svařování');

      // Click again toggles it back ON (appended to end)
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Svařování' });
      expect(state.activityTags).toContain('Svařování');
      expect(state.activityTags).toHaveLength(5);

      // 3. Arbitrary deactivation order: Kotvení, then Příprava, then Broušení/začištění
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Kotvení' });
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Příprava' });
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Broušení/začištění' });
      expect(state.activityTags).toEqual(['Montáž ve výškách', 'Svařování']);

      // 4. Toggle remaining off
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Montáž ve výškách' });
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Svařování' });
      expect(state.activityTags).toEqual([]);

      // 5. Direct standalone toggleActivityChip unit stress test
      let tags: QuickActionTag[] = [];
      // Rapid toggle 100 times
      for (let i = 0; i < 100; i++) {
        tags = toggleActivityChip(tags, 'Svařování');
      }
      // 100 is even, so should be empty
      expect(tags).toEqual([]);

      // 101 times: should contain 'Svařování'
      tags = toggleActivityChip(tags, 'Svařování');
      expect(tags).toEqual(['Svařování']);
    });

    it('1.7 safely handles fallback and migration of legacy entries without consumableSlip or activityTags', () => {
      // Legacy entry simulation: created before M3 without consumableSlip or activityTags
      const legacyEntry: Partial<WorkEntry> = {
        id: 'legacy-shift-1999',
        date: '2026-01-15',
        projectCode: 'OldBridge',
        clientName: 'Metrostav DIZ s.r.o.',
        workType: 'site_assembly',
        weldingMethod: 'MMA',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        totalHours: 8.0,
        // No consumableSlip, no activityTags, no workActionTags
      };

      const state = createInitialState(legacyEntry as WorkEntry, null, {
        clients: mockClients,
        rates: defaultRates,
      });

      expect(state.consumableSlip).toBeUndefined();
      expect(state.activityTags).toEqual([]);

      // Legacy entry with workActionTags but without activityTags
      const legacyEntryWithWorkActionTags: Partial<WorkEntry> = {
        ...legacyEntry,
        id: 'legacy-shift-2000',
        workActionTags: ['Příprava', 'Kotvení'],
      };

      const stateMigrated = createInitialState(legacyEntryWithWorkActionTags as WorkEntry, null, {
        clients: mockClients,
        rates: defaultRates,
      });

      // Should seamlessly fall back and populate activityTags from workActionTags
      expect(stateMigrated.activityTags).toEqual(['Příprava', 'Kotvení']);
    });

    it('1.8 Fuzz test: executes 250 randomized actions while asserting mathematical and state invariants', () => {
      let state = getCleanFormState();
      const categories = ['cutting_grinding', 'technical_gases', 'anchors', 'fasteners', 'welding_consumables'] as const;
      const allChips: QuickActionTag[] = ['Příprava', 'Svařování', 'Montáž ve výškách', 'Broušení/začištění', 'Kotvení'];

      // Deterministic PRNG seed
      let seed = 42;
      function random(): number {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
      }

      for (let step = 0; step < 250; step++) {
        const actionType = Math.floor(random() * 6);

        switch (actionType) {
          case 0: { // ADD_CONSUMABLE_ITEM
            const cat = categories[Math.floor(random() * categories.length)];
            const itemNum = Math.floor(random() * 5) + 1;
            const unitPrice = Math.floor(random() * 300) + 10;
            const quantity = Math.floor(random() * 10) + 1;
            const hasMarkup = random() > 0.5;
            const markupPercent = hasMarkup ? [0, 10, 15, 20, 25][Math.floor(random() * 5)] : undefined;
            const item: ConsumableItem = {
              id: `item-${cat}-${itemNum}`,
              category: cat,
              name: `Material ${cat} #${itemNum}`,
              quantity,
              unit: 'ks',
              unitPrice,
              markupPercent,
              billedPrice: calculateConsumableItemBilledPrice(quantity, unitPrice, markupPercent ?? state.consumableSlip?.overheadMarkupPercent ?? 0),
            };
            state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item });
            break;
          }
          case 1: { // REMOVE_CONSUMABLE_ITEM
            if (state.consumableSlip && state.consumableSlip.items.length > 0) {
              const idx = Math.floor(random() * state.consumableSlip.items.length);
              const targetId = state.consumableSlip.items[idx].id;
              state = shiftFormReducer(state, { type: 'REMOVE_CONSUMABLE_ITEM', id: targetId });
            }
            break;
          }
          case 2: { // UPDATE_CONSUMABLE_ITEM_QTY
            if (state.consumableSlip && state.consumableSlip.items.length > 0) {
              const idx = Math.floor(random() * state.consumableSlip.items.length);
              const targetId = state.consumableSlip.items[idx].id;
              const newQty = Math.floor(random() * 15); // could be 0 (triggering removal)
              state = shiftFormReducer(state, { type: 'UPDATE_CONSUMABLE_ITEM_QTY', id: targetId, quantity: newQty });
            }
            break;
          }
          case 3: { // SET_CONSUMABLE_MARKUP
            const markups = [0, 10, 15, 20, 25];
            const m = markups[Math.floor(random() * markups.length)];
            state = shiftFormReducer(state, { type: 'SET_CONSUMABLE_MARKUP', markupPercent: m });
            break;
          }
          case 4: { // SET_CONSUMABLE_FIXED_FEE
            const fees = [0, 100, 150, 200, 250, -50];
            const fee = fees[Math.floor(random() * fees.length)];
            state = shiftFormReducer(state, { type: 'SET_CONSUMABLE_FIXED_FEE', fee });
            break;
          }
          case 5: { // TOGGLE_ACTIVITY_TAG
            const tag = allChips[Math.floor(random() * allChips.length)];
            state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag });
            break;
          }
        }

        // --- INVARIANT ASSERTIONS ---
        if (state.consumableSlip) {
          const slip = state.consumableSlip;
          // Invariant 1: No NaN in any numeric fields
          expect(Number.isNaN(slip.totalMaterialCost)).toBe(false);
          expect(Number.isNaN(slip.totalBilledAmount)).toBe(false);
          expect(Number.isNaN(slip.fixedOverheadFee)).toBe(false);
          expect(Number.isNaN(slip.overheadMarkupPercent)).toBe(false);

          // Invariant 2: Quantities are all > 0
          for (const it of slip.items) {
            expect(it.quantity).toBeGreaterThan(0);
            expect(it.billedPrice).toBeGreaterThanOrEqual(0);
          }

          // Invariant 3: Material cost matches sum of item purchases
          const expectedCost = slip.items.reduce((sum, i) => sum + Math.round(i.quantity * i.unitPrice), 0);
          expect(slip.totalMaterialCost).toBe(expectedCost);

          // Invariant 4: Fixed fee is non-negative
          expect(slip.fixedOverheadFee).toBeGreaterThanOrEqual(0);
        }

        // Invariant 5: Activity tags have no duplicate items
        const uniqueTags = new Set(state.activityTags);
        expect(state.activityTags.length).toBe(uniqueTags.size);
      }
    });
  });

  // =========================================================================
  // 2. Catalog Completeness & Specifications (consumablesCatalog.ts)
  // =========================================================================
  describe('2. Catalog Completeness & Specification Compliance', () => {
    it('2.1 contains all 4 mandatory categories plus welding consumables', () => {
      const requiredCategories = [
        'cutting_grinding',
        'technical_gases',
        'anchors',
        'fasteners',
        'welding_consumables',
      ];

      const presentCategories = new Set(STANDARD_CONSUMABLES_CATALOG.map(item => item.category));

      for (const cat of requiredCategories) {
        expect(
          presentCategories.has(cat as any),
          `Missing expected category in catalog: ${cat}`
        ).toBe(true);

        const itemsInCat = STANDARD_CONSUMABLES_CATALOG.filter(i => i.category === cat);
        expect(
          itemsInCat.length,
          `Category ${cat} should have at least 3 distinct items`
        ).toBeGreaterThanOrEqual(3);
      }
    });

    it('2.2 provides standard DIN 933 and DIN 934 fasteners with explicit 8.8 strength grade', () => {
      const fasteners = STANDARD_CONSUMABLES_CATALOG.filter(i => i.category === 'fasteners');

      // DIN 933 hexagonal bolts
      const din933Items = fasteners.filter(i => i.name.includes('DIN 933'));
      expect(din933Items.length).toBeGreaterThanOrEqual(3);
      for (const item of din933Items) {
        expect(item.name).toContain('8.8');
        expect(item.unitPrice).toBeGreaterThan(0);
        expect(item.unit).toBe('ks');
      }

      // DIN 934 hexagonal nuts
      const din934Items = fasteners.filter(i => i.name.includes('DIN 934'));
      expect(din934Items.length).toBeGreaterThanOrEqual(1);
      for (const item of din934Items) {
        expect(item.name).toContain('8.8');
        expect(item.unitPrice).toBeGreaterThan(0);
        expect(item.unit).toBe('ks');
      }

      // Additional standard washers / lock nuts
      const din125 = fasteners.some(i => i.name.includes('DIN 125'));
      const din985 = fasteners.some(i => i.name.includes('DIN 985'));
      expect(din125).toBe(true);
      expect(din985).toBe(true);
    });

    it('2.3 provides chemical mortar/resin and steel through-bolt anchors (průvlakové kotvy)', () => {
      const anchors = STANDARD_CONSUMABLES_CATALOG.filter(i => i.category === 'anchors');

      // Chemická kotva
      const chemKotva = anchors.find(i => i.name.toLowerCase().includes('chemická kotva'));
      expect(chemKotva).toBeDefined();
      expect(chemKotva?.unitPrice).toBeGreaterThan(100);
      expect(chemKotva?.unit).toBe('kartuše');

      // Statický směšovač
      const mixer = anchors.find(i => i.name.toLowerCase().includes('směšovač'));
      expect(mixer).toBeDefined();

      // Průvlakové kotvy in multiple dimensions (M10, M12, M16)
      const pruvlakoveKotvy = anchors.filter(i => i.name.toLowerCase().includes('průvlaková'));
      expect(pruvlakoveKotvy.length).toBeGreaterThanOrEqual(3);
      expect(pruvlakoveKotvy.some(i => i.name.includes('M10'))).toBe(true);
      expect(pruvlakoveKotvy.some(i => i.name.includes('M12'))).toBe(true);
      expect(pruvlakoveKotvy.some(i => i.name.includes('M16'))).toBe(true);
    });

    it('2.4 provides technical gases including Argon 4.6, CORGON, and root backing forming gas', () => {
      const gases = STANDARD_CONSUMABLES_CATALOG.filter(i => i.category === 'technical_gases');

      expect(gases.some(i => i.name.includes('Argon 4.6'))).toBe(true);
      expect(gases.some(i => i.name.includes('CORGON'))).toBe(true);
      expect(gases.some(i => i.name.includes('Acetylen'))).toBe(true);
      expect(gases.some(i => i.name.includes('Kyslík'))).toBe(true);
      expect(gases.some(i => i.name.toLowerCase().includes('formovací plyn'))).toBe(true);
    });

    it('2.5 validates category metadata and the 5 mandatory 1-touch activity chips', () => {
      // Category metadata
      expect(CONSUMABLE_CATEGORIES).toHaveLength(6);
      for (const cat of CONSUMABLE_CATEGORIES) {
        expect(cat.key).toBeDefined();
        expect(cat.label.length).toBeGreaterThan(0);
        expect(cat.description.length).toBeGreaterThan(0);
        expect(cat.defaultUnit.length).toBeGreaterThan(0);
      }

      // Mandatory Activity Chips
      expect(MANDATORY_ACTIVITY_CHIPS).toEqual([
        'Příprava',
        'Svařování',
        'Montáž ve výškách',
        'Broušení/začištění',
        'Kotvení'
      ]);
    });
  });

  // =========================================================================
  // 3. Dexie IndexedDB Offline Persistence Stress Tests
  // =========================================================================
  describe('3. Dexie IndexedDB Offline Round-Trip & Deep Persistence', () => {
    it('3.1 creates, writes, reads back, and verifies deep structural integrity of consumableSlip and activityTags', async () => {
      const { instance: isolatedDb, cleanup } = createIsolatedTestDb('ChallengerM3Persistence');

      try {
        const fullConsumableSlip: ConsumableSlip = {
          items: [
            {
              id: 'c-1',
              category: 'cutting_grinding',
              name: 'Řezný kotouč ocel/nerez 125 × 1.0 mm',
              quantity: 10,
              unit: 'ks',
              unitPrice: 35,
              billedPrice: 350,
            },
            {
              id: 'c-2',
              category: 'technical_gases',
              name: 'Argon 4.6 (100% Ar) náplň/podíl',
              quantity: 1,
              unit: 'lahev/den',
              unitPrice: 650,
              markupPercent: 15,
              billedPrice: 748,
            },
            {
              id: 'c-3',
              category: 'anchors',
              name: 'Chemická kotva vinylester 300 ml',
              quantity: 2,
              unit: 'kartuše',
              unitPrice: 280,
              markupPercent: 10,
              billedPrice: 616,
            },
            {
              id: 'c-4',
              category: 'fasteners',
              name: 'Šroub šestihranný DIN 933 M12×40 pozink 8.8',
              quantity: 50,
              unit: 'ks',
              unitPrice: 14,
              markupPercent: 20,
              billedPrice: 840,
            },
            {
              id: 'c-5',
              category: 'welding_consumables',
              name: 'Svařovací drát SG2 1.2 mm cívka 15 kg',
              quantity: 1,
              unit: 'cívka',
              unitPrice: 1100,
              billedPrice: 1100,
            },
          ],
          overheadMarkupPercent: 15,
          fixedOverheadFee: 200,
          totalMaterialCost: 350 + 650 + 560 + 700 + 1100, // 3360
          totalBilledAmount: 350 + 748 + 616 + 840 + 1100 + 200, // 3854
        };

        const activeTags: QuickActionTag[] = [
          'Příprava',
          'Svařování',
          'Montáž ve výškách',
          'Broušení/začištění',
          'Kotvení',
        ];

        const testShift: WorkEntry = {
          id: 'test-shift-dexie-m3',
          date: '2026-09-13',
          projectCode: 'Hala-C-Materials',
          projectName: 'Montáž ocelových nosníků a potrubí',
          clientName: 'Metrostav DIZ s.r.o.',
          workType: 'site_assembly',
          weldingMethod: 'TIG',
          weldingPassport: {
            methodCode: '141',
            methodName: 'TIG',
            baseMaterialGrade: '1.4301',
            materialThickness: '4.0 mm',
            shieldingGas: 'Argon 4.6',
            fillerBatch: 'Böhler ER316L',
            weldInspectionVT: 'passed_B',
          },
          isPdp: true,
          startTime: '07:00',
          endTime: '17:30',
          breakMinutes: 30,
          totalHours: 10.0,
          pricing: {
            baseHourlyRate: 650,
            calculatedHourlyRate: 650,
            complexityMultiplier: 1.0,
            shiftSurcharges: [],
          },
          travel: {
            distanceKm: 40,
            ratePerKm: 11,
            travelTimeHours: 1.0,
            travelHourlyRate: 350,
            dietAllowance: 166,
            dietType: 'band_1',
          },
          extraCosts: [],
          consumableSlip: fullConsumableSlip,
          activityTags: activeTags,
          workActionTags: activeTags,
          notes: 'Montáž v plném rozsahu',
          status: 'draft',
          totalEarnings: 10760, // 6500 (labor) + 440 (km) + 350 (time) + 166 (diet) + 3854 (materials) - rounded
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // 1. Put into Dexie
        await isolatedDb.entries.put(testShift);

        // 2. Read back from Dexie
        const retrieved = await isolatedDb.entries.get('test-shift-dexie-m3');
        expect(retrieved).toBeDefined();
        if (!retrieved) return;

        // 3. Assert consumableSlip deep roundtrip
        expect(retrieved.consumableSlip).toBeDefined();
        expect(retrieved.consumableSlip?.overheadMarkupPercent).toBe(15);
        expect(retrieved.consumableSlip?.fixedOverheadFee).toBe(200);
        expect(retrieved.consumableSlip?.totalMaterialCost).toBe(3360);
        expect(retrieved.consumableSlip?.totalBilledAmount).toBe(3854);
        expect(retrieved.consumableSlip?.items).toHaveLength(5);

        // Verify individual items preserved exactly
        const retrievedItem1 = retrieved.consumableSlip?.items[0];
        expect(retrievedItem1?.name).toBe('Řezný kotouč ocel/nerez 125 × 1.0 mm');
        expect(retrievedItem1?.quantity).toBe(10);
        expect(retrievedItem1?.unitPrice).toBe(35);
        expect(retrievedItem1?.billedPrice).toBe(350);

        const retrievedItem4 = retrieved.consumableSlip?.items[3];
        expect(retrievedItem4?.name).toContain('DIN 933 M12×40');
        expect(retrievedItem4?.quantity).toBe(50);
        expect(retrievedItem4?.markupPercent).toBe(20);
        expect(retrievedItem4?.billedPrice).toBe(840);

        // 4. Assert activityTags and workActionTags preserved intact
        expect(retrieved.activityTags).toEqual(activeTags);
        expect(retrieved.workActionTags).toEqual(activeTags);

        // 5. Offline modification and re-saving
        const modifiedSlip: ConsumableSlip = {
          ...retrieved.consumableSlip!,
          fixedOverheadFee: 300,
          totalBilledAmount: retrieved.consumableSlip!.totalBilledAmount + 100,
        };
        const modifiedTags: QuickActionTag[] = ['Příprava', 'Svařování'];

        await isolatedDb.entries.update('test-shift-dexie-m3', {
          consumableSlip: modifiedSlip,
          activityTags: modifiedTags,
          workActionTags: modifiedTags,
        });

        const afterUpdate = await isolatedDb.entries.get('test-shift-dexie-m3');
        expect(afterUpdate?.consumableSlip?.fixedOverheadFee).toBe(300);
        expect(afterUpdate?.consumableSlip?.totalBilledAmount).toBe(3954);
        expect(afterUpdate?.activityTags).toEqual(['Příprava', 'Svařování']);
        expect(afterUpdate?.workActionTags).toEqual(['Příprava', 'Svařování']);

      } finally {
        await cleanup();
      }
    });

    it('3.2 correctly handles legacy entries and bulk operations in Dexie without corruption', async () => {
      const { instance: isolatedDb, cleanup } = createIsolatedTestDb('ChallengerM3Legacy');

      try {
        const legacy1: WorkEntry = {
          id: 'legacy-entry-01',
          date: '2026-02-01',
          projectCode: 'OldBridge',
          clientName: 'Skanska a.s.',
          workType: 'workshop',
          weldingMethod: 'MIG_MAG',
          startTime: '06:00',
          endTime: '14:30',
          breakMinutes: 30,
          totalHours: 8.0,
          pricing: {
            baseHourlyRate: 500,
            calculatedHourlyRate: 500,
            complexityMultiplier: 1.0,
            shiftSurcharges: [],
          },
          travel: {
            distanceKm: 0,
            ratePerKm: 11,
            travelTimeHours: 0,
            travelHourlyRate: 350,
            dietAllowance: 166,
            dietType: 'band_1',
          },
          extraCosts: [],
          notes: 'Old legacy entry',
          status: 'approved',
          totalEarnings: 4166,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        await isolatedDb.entries.put(legacy1);

        const loaded = await isolatedDb.entries.get('legacy-entry-01');
        expect(loaded).toBeDefined();
        expect(loaded?.consumableSlip).toBeUndefined();
        expect(loaded?.activityTags).toBeUndefined();

        // Migrate by adding materials slip
        const slip: ConsumableSlip = {
          items: [{
            id: 'legacy-mat-1',
            category: 'fasteners',
            name: 'DIN 934 Matice 8.8',
            quantity: 100,
            unit: 'ks',
            unitPrice: 6,
            billedPrice: 600,
          }],
          overheadMarkupPercent: 0,
          fixedOverheadFee: 0,
          totalMaterialCost: 600,
          totalBilledAmount: 600,
        };

        await isolatedDb.entries.update('legacy-entry-01', {
          consumableSlip: slip,
          activityTags: ['Kotvení'],
          workActionTags: ['Kotvení'],
        });

        const migrated = await isolatedDb.entries.get('legacy-entry-01');
        expect(migrated?.consumableSlip?.items).toHaveLength(1);
        expect(migrated?.activityTags).toEqual(['Kotvení']);
      } finally {
        await cleanup();
      }
    });
  });

  // =========================================================================
  // 4. Pricing Engine Materials Slip Helpers & Protocol Formatting
  // =========================================================================
  describe('4. Pricing Engine Helper Verification', () => {
    it('4.1 calculates consumable item billed price and guards against negative inputs', () => {
      // Basic 0% markup
      expect(calculateConsumableItemBilledPrice(5, 100, 0)).toBe(500);
      expect(calculateItemBilledPrice(100, 5, 0)).toBe(500);

      // 15% markup (350 * 1.15 in IEEE 754 evaluates to 402.49999999999994 -> rounds to 402)
      expect(calculateConsumableItemBilledPrice(10, 35, 15)).toBe(402);

      // 20% markup
      expect(calculateConsumableItemBilledPrice(20, 8, 20)).toBe(192); // 160 * 1.2 = 192

      // Negative guards
      expect(calculateConsumableItemBilledPrice(-5, 100, 15)).toBe(0);
      expect(calculateConsumableItemBilledPrice(5, -100, 15)).toBe(0);
      expect(calculateConsumableItemBilledPrice(5, 100, -15)).toBe(500);
    });

    it('4.2 formats activity tags cleanly for protocol print summary', () => {
      expect(formatActivityTagsForProtocol()).toBe('');
      expect(formatActivityTagsForProtocol([])).toBe('');
      expect(formatActivityTagsForProtocol(['Příprava'])).toBe('Příprava');
      expect(formatActivityTagsForProtocol(['Příprava', 'Svařování', 'Kotvení'])).toBe('Příprava, Svařování, Kotvení');
    });

    it('4.3 integrates materials slip into shift grand total while respecting manual total override', () => {
      const baseEntry = {
        totalHours: 8.0,
        pricing: {
          calculatedHourlyRate: 600,
          isManualOverride: false,
          manualTotalOverride: 0,
        },
        travel: {
          distanceKm: 20,
          ratePerKm: 10,
          travelTimeHours: 0,
          travelHourlyRate: 350,
          dietAllowance: 166,
        },
        extraCosts: [],
      };

      // Base without materials: 4800 (labor) + 200 (km) + 166 (diet) = 5166
      expect(calculateGrandTotal(baseEntry)).toBe(5166);

      const entryWithMaterials = {
        ...baseEntry,
        consumableSlip: {
          items: [],
          overheadMarkupPercent: 0,
          fixedOverheadFee: 0,
          totalMaterialCost: 1000,
          totalBilledAmount: 1250,
        },
      };

      // With materials: 5166 + 1250 = 6416
      expect(calculateGrandTotalWithMaterials(entryWithMaterials)).toBe(6416);

      // When isManualOverride is active, manualTotalOverride should override everything
      const entryWithOverride = {
        ...entryWithMaterials,
        pricing: {
          ...entryWithMaterials.pricing,
          isManualOverride: true,
          manualTotalOverride: 7500,
        },
      };

      expect(calculateGrandTotalWithMaterials(entryWithOverride)).toBe(7500);
    });
  });
});
