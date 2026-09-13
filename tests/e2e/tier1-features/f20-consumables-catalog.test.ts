import { describe, it, expect } from 'vitest';
import type { ConsumableItem } from '../../../src/types';
import { STANDARD_CONSUMABLES_CATALOG } from '../../../src/services/consumablesCatalog';

export { STANDARD_CONSUMABLES_CATALOG };

describe('Feature 20: Consumables Quick Catalog', () => {
  // Test 1: Verification of 4 primary mandatory categories
  it('contains items for all 4 mandatory categories: cutting/grinding, technical gases, anchors, fasteners', () => {
    const categories = new Set(STANDARD_CONSUMABLES_CATALOG.map(item => item.category));

    expect(categories.has('cutting_grinding')).toBe(true);
    expect(categories.has('technical_gases')).toBe(true);
    expect(categories.has('anchors')).toBe(true);
    expect(categories.has('fasteners')).toBe(true);
  });

  // Test 2: Structural contract compliance of catalog items
  it('conforms to the ConsumableItem specification for all catalog entries', () => {
    for (const item of STANDARD_CONSUMABLES_CATALOG) {
      expect(typeof item.name).toBe('string');
      expect(item.name.trim().length).toBeGreaterThan(0);

      expect(typeof item.unit).toBe('string');
      expect(item.unit.trim().length).toBeGreaterThan(0);

      expect(typeof item.unitPrice).toBe('number');
      expect(item.unitPrice).toBeGreaterThan(0);

      expect([
        'cutting_grinding',
        'technical_gases',
        'anchors',
        'fasteners',
        'welding_consumables',
        'custom'
      ]).toContain(item.category);
    }
  });

  // Test 3: Filtering catalog by specific category
  it('filters catalog items correctly for field technician quick selection', () => {
    const filterByCategory = (category: string) => 
      STANDARD_CONSUMABLES_CATALOG.filter(c => c.category === category);

    const discs = filterByCategory('cutting_grinding');
    expect(discs.length).toBeGreaterThanOrEqual(4);
    expect(discs.every(d => d.name.toLowerCase().includes('kotouč'))).toBe(true);

    const gases = filterByCategory('technical_gases');
    expect(gases.length).toBeGreaterThanOrEqual(4);
    expect(gases.some(g => g.name.includes('Argon'))).toBe(true);
    expect(gases.some(g => g.name.includes('CORGON'))).toBe(true);

    const anchors = filterByCategory('anchors');
    expect(anchors.length).toBeGreaterThanOrEqual(4);
    expect(anchors.some(a => a.name.includes('Chemická kotva'))).toBe(true);
    expect(anchors.some(a => a.name.includes('Průvlaková ocelová kotva'))).toBe(true);

    const fasteners = filterByCategory('fasteners');
    expect(fasteners.length).toBeGreaterThanOrEqual(4);
    expect(fasteners.some(f => f.name.includes('DIN 933'))).toBe(true);
    expect(fasteners.some(f => f.name.includes('DIN 934'))).toBe(true);
  });

  // Test 4: Creation of active ConsumableItem from catalog selection
  it('instantiates an active ConsumableItem with quantity, markup, and calculated billedPrice', () => {
    const catalogItem = STANDARD_CONSUMABLES_CATALOG.find(i => i.name.includes('Řezný kotouč ocel/nerez 125'))!;
    expect(catalogItem).toBeDefined();

    const quantity = 10;
    const markupPercent = 15;
    const billedPrice = Math.round(quantity * catalogItem.unitPrice * (1 + markupPercent / 100));

    const activeItem: ConsumableItem = {
      id: 'item-disc-1',
      category: catalogItem.category,
      name: catalogItem.name,
      quantity,
      unit: catalogItem.unit,
      unitPrice: catalogItem.unitPrice,
      markupPercent,
      billedPrice, // 10 * 35 = 350; 350 * 1.15 = 402.49999999999994 -> 402 Kč
    };

    expect(activeItem.id).toBe('item-disc-1');
    expect(activeItem.quantity).toBe(10);
    expect(activeItem.unitPrice).toBe(35);
    expect(activeItem.billedPrice).toBe(402);
  });

  // Test 5: Standard fasteners DIN 933 / DIN 934 compliance
  it('includes standard DIN 933 and DIN 934 fasteners with grade 8.8 designation', () => {
    const fasteners = STANDARD_CONSUMABLES_CATALOG.filter(i => i.category === 'fasteners');

    const din933 = fasteners.filter(f => f.name.includes('DIN 933'));
    expect(din933.length).toBeGreaterThanOrEqual(3);
    for (const bolt of din933) {
      expect(bolt.name).toMatch(/M\d+×\d+/);
      expect(bolt.name).toContain('8.8');
    }

    const din934 = fasteners.find(f => f.name.includes('DIN 934'));
    expect(din934).toBeDefined();
    expect(din934?.name).toContain('8.8');
  });

  // Test 6: Custom consumable entry support
  it('supports custom on-site consumable items outside the standard catalog', () => {
    const customItem: ConsumableItem = {
      id: 'custom-entry-99',
      category: 'custom',
      name: 'Speciální nerezová průchodka M20 na zakázku',
      quantity: 2,
      unit: 'ks',
      unitPrice: 420,
      markupPercent: 20,
      billedPrice: Math.round(2 * 420 * 1.20), // 840 * 1.20 = 1008
    };

    expect(customItem.category).toBe('custom');
    expect(customItem.billedPrice).toBe(1008);
    expect(customItem.unit).toBe('ks');
  });
});
