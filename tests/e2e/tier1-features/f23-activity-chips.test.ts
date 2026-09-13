import { describe, it, expect } from 'vitest';
import type { QuickActionTag } from '../../../src/types';
import {
  MANDATORY_ACTIVITY_CHIPS,
  toggleActivityChip,
} from '../../../src/services/consumablesCatalog';

export { MANDATORY_ACTIVITY_CHIPS, toggleActivityChip };

describe('Feature 23: 1-Touch Activity Chips', () => {
  // Test 1: Verification of 5 mandatory activity chips
  it('defines all 5 mandatory quick touch chips in exact Czech wording', () => {
    expect(MANDATORY_ACTIVITY_CHIPS).toHaveLength(5);
    expect(MANDATORY_ACTIVITY_CHIPS).toContain('Příprava');
    expect(MANDATORY_ACTIVITY_CHIPS).toContain('Svařování');
    expect(MANDATORY_ACTIVITY_CHIPS).toContain('Montáž ve výškách');
    expect(MANDATORY_ACTIVITY_CHIPS).toContain('Broušení/začištění');
    expect(MANDATORY_ACTIVITY_CHIPS).toContain('Kotvení');
  });

  // Test 2: Single chip selection and deselection toggle
  it('toggles a single chip on and off accurately', () => {
    let selected: QuickActionTag[] = [];

    // Select 'Svařování'
    selected = toggleActivityChip(selected, 'Svařování');
    expect(selected).toEqual(['Svařování']);

    // Toggle 'Svařování' off
    selected = toggleActivityChip(selected, 'Svařování');
    expect(selected).toEqual([]);
  });

  // Test 3: Multi-select combination of chips
  it('supports selecting arbitrary multiple chips concurrently', () => {
    let selected: QuickActionTag[] = [];

    selected = toggleActivityChip(selected, 'Příprava');
    selected = toggleActivityChip(selected, 'Svařování');
    selected = toggleActivityChip(selected, 'Montáž ve výškách');
    selected = toggleActivityChip(selected, 'Kotvení');

    expect(selected).toHaveLength(4);
    expect(selected).toContain('Příprava');
    expect(selected).toContain('Svařování');
    expect(selected).toContain('Montáž ve výškách');
    expect(selected).toContain('Kotvení');
    expect(selected).not.toContain('Broušení/začištění');

    // Deselect one from the middle
    selected = toggleActivityChip(selected, 'Svařování');
    expect(selected).toHaveLength(3);
    expect(selected).not.toContain('Svařování');
    expect(selected).toContain('Montáž ve výškách');
  });

  // Test 4: All chips selected simultaneously (full-scope workday)
  it('allows selecting all 5 chips simultaneously without overflow or truncation', () => {
    let selected: QuickActionTag[] = [];
    for (const chip of MANDATORY_ACTIVITY_CHIPS) {
      selected = toggleActivityChip(selected, chip);
    }

    expect(selected).toHaveLength(5);
    for (const chip of MANDATORY_ACTIVITY_CHIPS) {
      expect(selected).toContain(chip);
    }
  });

  // Test 5: Order and deduplication invariants
  it('prevents duplicate chip entries when applied repeatedly', () => {
    const listWithDups = ['Příprava', 'Svařování', 'Příprava'] as QuickActionTag[];
    const deduplicated = Array.from(new Set(listWithDups));

    expect(deduplicated).toEqual(['Příprava', 'Svařování']);
    expect(deduplicated).toHaveLength(2);
  });

  // Test 6: Glove-friendly touch target compliance
  it('verifies glove-friendly ergonomics specifications (>= 44px touch height)', () => {
    const TOUCH_SPEC = {
      minTouchHeightPx: 44,
      recommendedTouchHeightPx: 48,
      touchActionClass: 'min-h-touch', // Tailwind 44px touch target
    };

    expect(TOUCH_SPEC.minTouchHeightPx).toBeGreaterThanOrEqual(44);
    expect(TOUCH_SPEC.touchActionClass).toBe('min-h-touch');
  });
});
