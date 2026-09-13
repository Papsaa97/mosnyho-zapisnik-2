import { describe, it, expect } from 'vitest';
import { shiftFormReducer, createInitialState } from '../../../src/components/form/shiftFormReducer';
import { DEFAULT_SETTINGS } from '../../../src/db/seedData';
import { 
  SCENARIO_1_BRIDGE_RAILINGS, 
  QuickActionTag,
  ComprehensiveShiftEntry 
} from '../../fixtures/shifts.fixture';

/**
 * Feature 24: Activity Tags in Protocol
 * 
 * Authoritative Sources:
 * - ORIGINAL_REQUEST.md §R4 (Zvolené štítky se propisují do souhrnu prací v protokolu)
 * - PROJECT.md §3 (Consumable Materials & Tags)
 * 
 * Requirements:
 * - Selected activity tags automatically populated in protocol work summary
 * - Form reducer APPEND_NOTE_TAG action appends tag to notes with clean delimiter
 * - Protocol work summary display formats multiple tags (badges, comma-separated or pipe-separated)
 * - Harmonious coexistence between quick tags and detailed custom welder notes
 * - Preservation of activityTags in ComprehensiveShiftEntry across save/load cycles
 */

import { formatActivityTagsForProtocol } from '../../../src/services/pricingEngine';
export { formatActivityTagsForProtocol };

describe('Feature 24: Activity Tags in Protocol', () => {
  const settings = DEFAULT_SETTINGS;

  // Test 1: Appending tag to empty notes in shiftFormReducer
  it('populates notes directly when APPEND_NOTE_TAG is dispatched on empty notes', () => {
    const initialState = createInitialState(null, { notes: '' }, settings);
    expect(initialState.notes).toBe('');

    const nextState = shiftFormReducer(initialState, {
      type: 'APPEND_NOTE_TAG',
      tag: 'Svařování',
    });

    expect(nextState.notes).toBe('Svařování');
  });

  // Test 2: Appending multiple tags sequentially with clean pipe delimiter
  it('appends multiple tags sequentially using pipe delimiter in shiftFormReducer', () => {
    const initialState = createInitialState(null, { notes: '' }, settings);

    let state = shiftFormReducer(initialState, { type: 'APPEND_NOTE_TAG', tag: 'Příprava' });
    state = shiftFormReducer(state, { type: 'APPEND_NOTE_TAG', tag: 'Svařování' });
    state = shiftFormReducer(state, { type: 'APPEND_NOTE_TAG', tag: 'Montáž ve výškách' });

    expect(state.notes).toBe('Příprava | Svařování | Montáž ve výškách');
  });

  // Test 3: Appending tag to pre-existing manual notes without clobbering
  it('appends tags to pre-existing custom notes without overwriting welder text', () => {
    const initialState = createInitialState(
      null, 
      { notes: 'Svařování mostního nosníku HEB 300' }, 
      settings
    );

    const stateWithTag = shiftFormReducer(initialState, {
      type: 'APPEND_NOTE_TAG',
      tag: 'VT2 zkouška OK',
    });

    expect(stateWithTag.notes).toBe('Svařování mostního nosníku HEB 300 | VT2 zkouška OK');
  });

  // Test 4: Serialization of activity tags for printed A4 protocol work summary
  it('formats activity tags as a clean comma-separated list for protocol header summary', () => {
    const tags: QuickActionTag[] = ['Příprava', 'Svařování', 'Montáž ve výškách', 'Kotvení'];
    const formatted = formatActivityTagsForProtocol(tags);

    expect(formatted).toBe('Příprava, Svařování, Montáž ve výškách, Kotvení');
  });

  // Test 5: Scenario 1 Bridge Railings activity tags verification
  it('verifies activity tags structure in SCENARIO_1_BRIDGE_RAILINGS fixture', () => {
    const shift: ComprehensiveShiftEntry = SCENARIO_1_BRIDGE_RAILINGS;

    expect(shift.activityTags).toBeDefined();
    expect(shift.activityTags).toEqual([
      'Příprava',
      'Svařování',
      'Montáž ve výškách',
      'Kotvení'
    ]);

    expect(shift.notes).toContain('Montáž mostního zábradlí');
    expect(shift.notes).toContain('Vizuální zkouška VT2');
  });

  // Test 6: Handling empty or undefined activity tags in protocol
  it('gracefully handles empty or undefined tags without displaying broken text', () => {
    expect(formatActivityTagsForProtocol([])).toBe('');
    expect(formatActivityTagsForProtocol(undefined as any)).toBe('');
  });
});
