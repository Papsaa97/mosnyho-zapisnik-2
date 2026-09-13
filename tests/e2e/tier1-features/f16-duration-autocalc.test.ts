import { describe, it, expect } from 'vitest';
import { 
  calculateNetHours, 
  estimateDiet 
} from '../../../src/services/pricingEngine';
import { shiftFormReducer, createInitialState } from '../../../src/components/form/shiftFormReducer';
import { STANDARD_RATES_FIXTURE } from '../../fixtures/rates.fixture';
import { DEFAULT_SETTINGS } from '../../../src/db/seedData';

/**
 * Feature 16: Automatic Duration Calculation
 * 
 * Requirements:
 * - Net shift duration calculation from startTime, endTime, and breakMinutes
 * - Overnight shift handling across midnight (e.g. 22:00 to 06:00)
 * - Summation of net shift hours and travelTimeHours for total legal travel duration
 * - Reactive update of diet tier and allowance when shift hours or travel time change
 * - Boundary threshold crossing (e.g., 4.5h work + 0.5h travel = 5.0h -> triggers Band 1)
 */
describe('Feature 16: Automatic Duration Calculation', () => {
  const rates = STANDARD_RATES_FIXTURE;

  // Test 1: Standard daytime net hours calculation
  it('accurately calculates net shift hours deducting break minutes', () => {
    // 07:00 to 15:30 (8.5h elapsed) - 30 min break = 8.0h net
    expect(calculateNetHours('07:00', '15:30', 30)).toBe(8.0);

    // 06:00 to 18:00 (12h elapsed) - 60 min break = 11.0h net
    expect(calculateNetHours('06:00', '18:00', 60)).toBe(11.0);

    // Zero break
    expect(calculateNetHours('08:00', '16:00', 0)).toBe(8.0);

    // Partial hour breaks (e.g. 15 min = 0.25h, 45 min = 0.75h)
    expect(calculateNetHours('07:00', '15:15', 15)).toBe(8.0);
    expect(calculateNetHours('07:00', '15:45', 45)).toBe(8.0);
  });

  // Test 2: Overnight shift duration calculation across midnight
  it('handles overnight shifts crossing midnight correctly', () => {
    // 22:00 to 06:00 (8.0h elapsed) - 30 min break = 7.5h net
    const net1 = calculateNetHours('22:00', '06:00', 30);
    expect(net1).toBe(7.5);

    // 20:00 to 04:00 (8.0h elapsed) - 60 min break = 7.0h net
    const net2 = calculateNetHours('20:00', '04:00', 60);
    expect(net2).toBe(7.0);

    // Late start: 23:30 to 07:30 (8.0h elapsed) - 30 min break = 7.5h net
    const net3 = calculateNetHours('23:30', '07:30', 30);
    expect(net3).toBe(7.5);

    // Combined with 1.0h travel time -> 8.5h total duration -> Band 1 (166 Kč)
    const diet = estimateDiet(net1 + 1.0, rates);
    expect(diet.type).toBe('band_1');
    expect(diet.allowance).toBe(166);
  });

  // Test 3: Summation of work hours and travel hours for statutory diet tiers
  it('combines shift net hours and driving time to determine legal MPSV diet tier', () => {
    // 4.0h work + 1.5h driving = 5.5h total -> Band 1 (166 Kč)
    const totalDuration1 = 4.0 + 1.5;
    const diet1 = estimateDiet(totalDuration1, rates);
    expect(diet1.type).toBe('band_1');
    expect(diet1.allowance).toBe(166);

    // 9.5h work + 3.0h driving = 12.5h total -> Band 2 (256 Kč)
    const totalDuration2 = 9.5 + 3.0;
    const diet2 = estimateDiet(totalDuration2, rates);
    expect(diet2.type).toBe('band_2');
    expect(diet2.allowance).toBe(256);

    // 15.0h work + 3.5h driving = 18.5h total -> Band 3 (398 Kč)
    const totalDuration3 = 15.0 + 3.5;
    const diet3 = estimateDiet(totalDuration3, rates);
    expect(diet3.type).toBe('band_3');
    expect(diet3.allowance).toBe(398);
  });

  // Test 4: Boundary crossing: travel time elevates shift into a higher diet tier
  it('triggers tier progression when travel time elevates duration past statutory thresholds', () => {
    // 4.5h work + 0.4h driving = 4.9h -> None (0 Kč)
    expect(estimateDiet(4.5 + 0.4, rates).allowance).toBe(0);

    // 4.5h work + 0.5h driving = 5.0h -> Exactly Band 1 (166 Kč)
    const atTier1 = estimateDiet(4.5 + 0.5, rates);
    expect(atTier1.allowance).toBe(166);
    expect(atTier1.type).toBe('band_1');

    // 10.0h work + 2.0h driving = 12.0h -> Upper limit of Band 1 (166 Kč)
    const atUpperTier1 = estimateDiet(10.0 + 2.0, rates);
    expect(atUpperTier1.allowance).toBe(166);
    expect(atUpperTier1.type).toBe('band_1');

    // 10.0h work + 2.1h driving = 12.1h -> Crosses into Band 2 (256 Kč)
    const intoTier2 = estimateDiet(10.0 + 2.1, rates);
    expect(intoTier2.allowance).toBe(256);
    expect(intoTier2.type).toBe('band_2');

    // 16.0h work + 2.0h driving = 18.0h -> Upper limit of Band 2 (256 Kč)
    const atUpperTier2 = estimateDiet(16.0 + 2.0, rates);
    expect(atUpperTier2.allowance).toBe(256);
    expect(atUpperTier2.type).toBe('band_2');

    // 16.0h work + 2.1h driving = 18.1h -> Crosses into Band 3 (398 Kč)
    const intoTier3 = estimateDiet(16.0 + 2.1, rates);
    expect(intoTier3.allowance).toBe(398);
    expect(intoTier3.type).toBe('band_3');
  });

  // Test 5: Guard against excessive break minutes and invalid times
  it('guards against breaks exceeding shift duration and invalid time inputs', () => {
    // Break longer than shift: capped so net hours cannot be negative
    expect(calculateNetHours('08:00', '12:00', 300)).toBe(0);

    // Negative break minutes guarded
    expect(calculateNetHours('08:00', '16:00', -30)).toBe(8.0);

    // Missing or invalid time strings return 0
    expect(calculateNetHours('', '16:00', 30)).toBe(0);
    expect(calculateNetHours('08:00', '', 30)).toBe(0);
    expect(calculateNetHours('invalid', '16:00', 30)).toBe(0);
  });

  // Test 6: Reactive simulation in ShiftFormState
  it('updates form state diet allowance automatically when SET_DIET is dispatched', () => {
    const initialState = createInitialState(null, null, DEFAULT_SETTINGS);

    // Simulate work duration calculation: 7.5h work + 1.0h travel = 8.5h -> Band 1
    const netHours = calculateNetHours(initialState.startTime, initialState.endTime, initialState.breakMinutes);
    const est1 = estimateDiet(netHours + initialState.travelTimeHours, DEFAULT_SETTINGS.rates);

    const state1 = shiftFormReducer(initialState, {
      type: 'SET_DIET',
      dietType: est1.type,
      allowance: est1.allowance,
      isManual: false
    });

    expect(state1.dietAllowance).toBe(166);
    expect(state1.dietType).toBe('band_1');
    expect(state1.dietBandApplied).toBe('band_1');

    // Simulate extension of travel time to 4.5h (total 13.0h -> Band 2)
    const stateWithMoreTravel = shiftFormReducer(state1, {
      type: 'SET_FIELD',
      field: 'travelTimeHours',
      value: 4.5
    });
    const est2 = estimateDiet(netHours + stateWithMoreTravel.travelTimeHours, DEFAULT_SETTINGS.rates);

    const state2 = shiftFormReducer(stateWithMoreTravel, {
      type: 'SET_DIET',
      dietType: est2.type,
      allowance: est2.allowance,
      isManual: false
    });

    expect(state2.dietAllowance).toBe(256);
    expect(state2.dietType).toBe('band_2');
    expect(state2.dietBandApplied).toBe('band_2');
  });
});
