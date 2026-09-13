import { describe, it, expect } from 'vitest';
import { 
  calculateGrandTotal, 
  calculateTravelTotal, 
  estimateDiet 
} from '../../../src/services/pricingEngine';
import { shiftFormReducer, createInitialState } from '../../../src/components/form/shiftFormReducer';
import { DEFAULT_SETTINGS } from '../../../src/db/seedData';
import { WorkEntry } from '../../../src/types';

/**
 * Feature 17: Manual Diet Override
 * 
 * Requirements:
 * - Manual override checkbox to decouple meal allowance from automatic MPSV bands
 * - Custom allowance amount input (e.g. reduced for provided meals or increased for foreign allowance)
 * - Override persistence: form state retains custom allowance when shift duration changes
 * - Reset mechanism: unchecking manual override reverts to automatic statutory band calculation
 * - Total earnings calculation integrates the overridden diet amount accurately
 * - Preserves manual override state when loading existing entries
 */
describe('Feature 17: Manual Diet Override', () => {
  const settings = DEFAULT_SETTINGS;

  // Test 1: Manual override activation and custom rate setting
  it('activates manual override and stores custom allowance amount in state', () => {
    const initialState = createInitialState(null, null, settings);
    expect(initialState.isManualDiet).toBe(false);

    // Set custom diet of 120 Kč (e.g. standard 166 Kč reduced by 46 Kč for provided lunch)
    const customState = shiftFormReducer(initialState, {
      type: 'SET_DIET',
      dietType: 'custom',
      allowance: 120,
      isManual: true,
    });

    expect(customState.isManualDiet).toBe(true);
    expect(customState.dietType).toBe('custom');
    expect(customState.dietAllowance).toBe(120);
    expect(customState.customDietRate).toBe(120);
    expect(customState.dietBandApplied).toBe('custom');
  });

  // Test 2: Override persistence against duration changes
  it('preserves custom diet allowance when shift hours or travel hours change while isManualDiet is true', () => {
    const initialState = createInitialState(null, null, settings);

    // Enable manual override with custom rate 150 Kč
    const customState = shiftFormReducer(initialState, {
      type: 'SET_DIET',
      dietType: 'custom',
      allowance: 150,
      isManual: true,
    });

    // Simulate user changing end time from 16:00 to 22:00 (elongating shift to 14.5h)
    const updatedShift = shiftFormReducer(customState, {
      type: 'SET_FIELD',
      field: 'endTime',
      value: '22:00',
    });

    // When isManualDiet is true, automatic calculation should NOT overwrite custom allowance
    expect(updatedShift.isManualDiet).toBe(true);
    expect(updatedShift.dietAllowance).toBe(150);
    expect(updatedShift.dietType).toBe('custom');

    // Simulate user adding 4h driving
    const updatedTravel = shiftFormReducer(updatedShift, {
      type: 'SET_FIELD',
      field: 'travelTimeHours',
      value: 4.0,
    });

    expect(updatedTravel.isManualDiet).toBe(true);
    expect(updatedTravel.dietAllowance).toBe(150);
  });

  // Test 3: Reset to automatic calculation
  it('reverts to automatic statutory band when manual override is toggled off', () => {
    const initialState = createInitialState(null, null, settings);

    // Set manual override
    const manualState = shiftFormReducer(initialState, {
      type: 'SET_DIET',
      dietType: 'custom',
      allowance: 80,
      isManual: true,
    });
    expect(manualState.isManualDiet).toBe(true);
    expect(manualState.dietAllowance).toBe(80);

    // Toggle off manual override via SET_FIELD
    const toggledOff = shiftFormReducer(manualState, {
      type: 'SET_FIELD',
      field: 'isManualDiet',
      value: false,
    });
    expect(toggledOff.isManualDiet).toBe(false);

    // Simulate auto-recommendation: 8h shift + 0h travel -> Band 1 (166 Kč)
    const autoEstimate = estimateDiet(8.0, settings.rates);
    const restoredState = shiftFormReducer(toggledOff, {
      type: 'SET_DIET',
      dietType: autoEstimate.type,
      allowance: autoEstimate.allowance,
      isManual: false,
    });

    expect(restoredState.isManualDiet).toBe(false);
    expect(restoredState.dietAllowance).toBe(166);
    expect(restoredState.dietType).toBe('band_1');
    expect(restoredState.dietBandApplied).toBe('band_1');
  });

  // Test 4: Integration with travel total and grand total earnings
  it('accurately incorporates custom overridden diet allowance into grand total calculations', () => {
    const travelCost = calculateTravelTotal(
      100, // distanceKm
      11,  // ratePerKm -> 1100 Kč
      2.0, // travelTimeHours
      350, // travelHourlyRate -> 700 Kč
      140  // manual overridden diet allowance
    );
    // 1100 + 700 + 140 = 1940 Kč
    expect(travelCost).toBe(1940);

    const grandTotal = calculateGrandTotal({
      totalHours: 8.0,
      pricing: {
        calculatedHourlyRate: 600, // 4800 Kč labor
      },
      travel: {
        distanceKm: 100,
        ratePerKm: 11,
        travelTimeHours: 2.0,
        travelHourlyRate: 350,
        dietAllowance: 140, // manual override
      },
      extraCosts: [
        { id: 'ext-1', description: 'Parkovné', amount: 200 },
      ],
    });

    // 4800 labor + 1940 travel + 200 extra = 6940 Kč
    expect(grandTotal).toBe(6940);
  });

  // Test 5: Complete zeroing of diet allowance via manual override
  it('allows setting manual diet to exactly 0 Kč even on 12-hour shifts (e.g. company provided all meals)', () => {
    const initialState = createInitialState(null, null, settings);

    // Set 0 Kč manual override on 12-hour shift
    const zeroDietState = shiftFormReducer(initialState, {
      type: 'SET_DIET',
      dietType: 'custom',
      allowance: 0,
      isManual: true,
    });

    expect(zeroDietState.isManualDiet).toBe(true);
    expect(zeroDietState.dietAllowance).toBe(0);
    expect(zeroDietState.dietType).toBe('custom');

    const travelTotal = calculateTravelTotal(0, 11, 0, 350, zeroDietState.dietAllowance);
    expect(travelTotal).toBe(0);
  });

  // Test 6: Preserves manual override state when loading existing entry
  it('initializes form state correctly from an existing entry with manual diet override', () => {
    const existingEntry: WorkEntry = {
      id: 'entry-manual-diet',
      date: '2026-03-05',
      projectCode: 'MOST-SO201',
      projectName: 'Most S355',
      clientName: 'Metrostav DIZ s.r.o.',
      workType: 'site_assembly',
      startTime: '07:00',
      endTime: '17:00',
      breakMinutes: 30,
      totalHours: 9.5,
      pricing: {
        baseHourlyRate: 620,
        complexityMultiplier: 1.0,
        shiftSurcharges: [],
        calculatedHourlyRate: 620,
      },
      travel: {
        distanceKm: 40,
        ratePerKm: 11,
        travelTimeHours: 1.0,
        travelHourlyRate: 350,
        dietAllowance: 120, // manually reduced
        dietType: 'custom',
        isManualDiet: true,
        customDietRate: 120,
        dietBandApplied: 'custom',
      },
      extraCosts: [],
      totalEarnings: 9.5 * 620 + (40 * 11 + 350 + 120),
      status: 'submitted',
      notes: 'Zkouška svárů',
      createdAt: '2026-03-05',
      updatedAt: '2026-03-05',
    };

    const state = createInitialState(existingEntry, null, settings);
    expect(state.isManualDiet).toBe(true);
    expect(state.dietAllowance).toBe(120);
    expect(state.dietType).toBe('custom');
    expect(state.customDietRate).toBe(120);
    expect(state.dietBandApplied).toBe('custom');
  });
});
