import { describe, it, expect } from 'vitest';
import React, { useReducer, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  shiftFormReducer, 
  createInitialState 
} from '../src/components/form/shiftFormReducer';
import { TravelSection } from '../src/components/form/sections/TravelSection';
import { 
  estimateDiet, 
  normalizeDietType 
} from '../src/services/pricingEngine';
import { 
  AppSettings, 
  WorkEntry 
} from '../src/types';
import { DEFAULT_SETTINGS } from '../src/db/seedData';
import { CLIENT_FIXTURES } from './fixtures/clients.fixture';
import { PRIMARY_CONTRACTOR_FIXTURE } from './fixtures/contractor.fixture';

describe('Milestone M1 Adversarial Verification Suite (Challenger M1-3)', () => {
  const testSettings: AppSettings = {
    ...DEFAULT_SETTINGS,
    contractor: {
      ...PRIMARY_CONTRACTOR_FIXTURE,
      bankAccount: '123456789/0800',
      iban: 'CZ6508000000000123456789'
    },
    clients: CLIENT_FIXTURES,
    rates: {
      ...DEFAULT_SETTINGS.rates,
      dietHalfDayRate: 166,
      dietFullDayRate: 256,
      dietOver18Rate: 398,
      dietBand1Rate: 166,
      dietBand2Rate: 256,
      dietBand3Rate: 398
    }
  };

  // Comprehensive test harness supporting re-renders, prop mutations, and discrete controls
  function ComprehensiveHarness({
    initialTotalHours = 4.0,
    initialTravelHours = 0,
    initialDistanceKm = 0,
    initialRatePerKm = 11,
    initialManualDiet = false,
    initialDietAllowance,
    initialDietType,
    initialCustomRate = 0
  }: {
    initialTotalHours?: number;
    initialTravelHours?: number;
    initialDistanceKm?: number;
    initialRatePerKm?: number;
    initialManualDiet?: boolean;
    initialDietAllowance?: number;
    initialDietType?: any;
    initialCustomRate?: number;
  }) {
    const [totalHours, setTotalHours] = useState(initialTotalHours);
    const [rerenderCount, setRerenderCount] = useState(0);

    const initialEst = estimateDiet(initialTotalHours + initialTravelHours, testSettings.rates);
    const effectiveAllowance = initialDietAllowance !== undefined 
      ? initialDietAllowance 
      : (initialManualDiet ? initialCustomRate : initialEst.allowance);
    const effectiveType = initialDietType !== undefined
      ? initialDietType
      : (initialManualDiet ? 'custom' : initialEst.type);

    const [state, dispatch] = useReducer(shiftFormReducer, {
      ...createInitialState(null, null, testSettings),
      travelTimeHours: initialTravelHours,
      distanceKm: initialDistanceKm,
      ratePerKm: initialRatePerKm,
      isManualDiet: initialManualDiet,
      dietAllowance: effectiveAllowance,
      customDietRate: initialCustomRate,
      dietType: effectiveType,
      dietBandApplied: effectiveType === 'custom' ? 'custom' : normalizeDietType(effectiveType)
    });

    return (
      <div>
        <div data-testid="rerender-count">{rerenderCount}</div>
        <div data-testid="total-hours">{totalHours}</div>
        <div data-testid="travel-hours">{state.travelTimeHours}</div>
        <div data-testid="distance-km">{state.distanceKm}</div>
        <div data-testid="rate-per-km">{state.ratePerKm}</div>
        <div data-testid="diet-allowance">{state.dietAllowance}</div>
        <div data-testid="diet-type">{state.dietType}</div>
        <div data-testid="diet-band">{state.dietBandApplied}</div>
        <div data-testid="is-manual-diet">{state.isManualDiet ? 'true' : 'false'}</div>

        {/* Buttons to trigger state/prop updates */}
        <button data-testid="btn-force-rerender" onClick={() => setRerenderCount(c => c + 1)}>
          Force Re-render
        </button>
        <button data-testid="btn-change-distance" onClick={() => dispatch({ type: 'SET_FIELD', field: 'distanceKm', value: 75 })}>
          Set Distance 75km
        </button>
        <button data-testid="btn-change-rate-km" onClick={() => dispatch({ type: 'SET_FIELD', field: 'ratePerKm', value: 15 })}>
          Set RatePerKm 15
        </button>
        <button data-testid="btn-set-hours-2" onClick={() => setTotalHours(2.0)}>
          Set 2h
        </button>
        <button data-testid="btn-set-hours-4" onClick={() => setTotalHours(4.0)}>
          Set 4h
        </button>
        <button data-testid="btn-set-hours-8" onClick={() => setTotalHours(8.0)}>
          Set 8h
        </button>
        <button data-testid="btn-set-hours-14" onClick={() => setTotalHours(14.0)}>
          Set 14h
        </button>
        <button data-testid="btn-set-hours-20" onClick={() => setTotalHours(20.0)}>
          Set 20h
        </button>

        <TravelSection 
          state={state} 
          dispatch={dispatch} 
          travelTotal={state.dietAllowance} 
          totalHours={totalHours} 
          settings={testSettings} 
        />
      </div>
    );
  }

  // =========================================================================
  // 1. Stress-Test: TravelSection Button Reactivity & Persistence
  // =========================================================================
  describe('1. TravelSection discrete button reactivity & persistence across re-renders', () => {
    it('persists Band 1 (166 Kč) discrete selection at 4.0h duration across unrelated re-renders', () => {
      render(<ComprehensiveHarness initialTotalHours={4.0} />);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');
      expect(screen.getByTestId('diet-type').textContent).toBe('none');

      // Click 5–12 h (166 Kč) button
      const band1Btn = screen.getByRole('button', { name: /5–12 h \(166 Kč\)/i });
      fireEvent.click(band1Btn);

      expect(screen.getByTestId('diet-allowance').textContent).toBe('166');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');

      // Trigger unrelated parent/component re-render
      fireEvent.click(screen.getByTestId('btn-force-rerender'));
      expect(screen.getByTestId('rerender-count').textContent).toBe('1');
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166'); // MUST persist
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');

      // Trigger change in distanceKm
      fireEvent.click(screen.getByTestId('btn-change-distance'));
      expect(screen.getByTestId('distance-km').textContent).toBe('75');
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166'); // MUST persist
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');

      // Trigger change in ratePerKm
      fireEvent.click(screen.getByTestId('btn-change-rate-km'));
      expect(screen.getByTestId('rate-per-km').textContent).toBe('15');
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166'); // MUST persist
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');
    });

    it('persists Band 2 (256 Kč) discrete selection at 4.0h duration across unrelated re-renders', () => {
      render(<ComprehensiveHarness initialTotalHours={4.0} />);

      const band2Btn = screen.getByRole('button', { name: /12–18 h \(256 Kč\)/i });
      fireEvent.click(band2Btn);

      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_2');

      // Multiple re-renders
      fireEvent.click(screen.getByTestId('btn-force-rerender'));
      fireEvent.click(screen.getByTestId('btn-force-rerender'));
      fireEvent.click(screen.getByTestId('btn-change-distance'));

      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_2');
    });

    it('persists Band 3 (398 Kč) discrete selection at 4.0h duration across unrelated re-renders', () => {
      render(<ComprehensiveHarness initialTotalHours={4.0} />);

      const band3Btn = screen.getByRole('button', { name: />18 h \(398 Kč\)/i });
      fireEvent.click(band3Btn);

      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_3');

      // Unrelated prop updates
      fireEvent.click(screen.getByTestId('btn-change-distance'));
      fireEvent.click(screen.getByTestId('btn-force-rerender'));

      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_3');
    });

    it('persists "Bez diet (0 Kč)" discrete selection at 14.0h duration across unrelated re-renders', () => {
      render(<ComprehensiveHarness initialTotalHours={14.0} />);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');

      // Click "Bez diet (0 Kč)"
      const zeroBtn = screen.getByRole('button', { name: /Bez diet \(0 Kč\)/i });
      fireEvent.click(zeroBtn);

      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');
      expect(screen.getByTestId('diet-type').textContent).toBe('none');

      // Unrelated re-renders
      fireEvent.click(screen.getByTestId('btn-force-rerender'));
      fireEvent.click(screen.getByTestId('btn-change-distance'));

      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');
      expect(screen.getByTestId('diet-type').textContent).toBe('none');
    });

    it('clicking "Auto-doporučit" recalculates to the statutory tier from discrete manual choice', () => {
      render(<ComprehensiveHarness initialTotalHours={14.0} />);

      // User chooses Bez diet (0 Kč)
      fireEvent.click(screen.getByRole('button', { name: /Bez diet \(0 Kč\)/i }));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');

      // User clicks Auto-doporučit
      const autoBtn = screen.getByRole('button', { name: /Auto-doporučit/i });
      fireEvent.click(autoBtn);

      // 14h -> Band 2 (256 Kč)
      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_2');
    });
  });

  // =========================================================================
  // 2. Stress-Test: Duration Changes Reactivity & Auto-Recalculation
  // =========================================================================
  describe('2. Duration changes triggering auto-recalculation when manual override is NOT ticked', () => {
    it('recalculates on totalHours change through all MPSV tiers', () => {
      render(<ComprehensiveHarness initialTotalHours={4.0} />);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');

      // 4h -> 8h (Band 1: 166 Kč)
      fireEvent.click(screen.getByTestId('btn-set-hours-8'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');

      // 8h -> 14h (Band 2: 256 Kč)
      fireEvent.click(screen.getByTestId('btn-set-hours-14'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_2');

      // 14h -> 20h (Band 3: 398 Kč)
      fireEvent.click(screen.getByTestId('btn-set-hours-20'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_3');

      // 20h -> 2h (None: 0 Kč)
      fireEvent.click(screen.getByTestId('btn-set-hours-2'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');
      expect(screen.getByTestId('diet-type').textContent).toBe('none');
    });

    it('overrides previous discrete tier button click when totalHours changes', () => {
      render(<ComprehensiveHarness initialTotalHours={4.0} />);

      // Discrete click Band 3 at 4h
      fireEvent.click(screen.getByRole('button', { name: />18 h \(398 Kč\)/i }));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');

      // Now user changes duration to 8h -> MUST auto-recalculate to 166 Kč
      fireEvent.click(screen.getByTestId('btn-set-hours-8'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');
    });

    it('recalculates when driving hours (travelTimeHours) change', () => {
      const { container } = render(<ComprehensiveHarness initialTotalHours={4.0} initialTravelHours={0} />);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');

      const travelInput = container.querySelector('input[step="0.5"]') as HTMLInputElement;
      expect(travelInput).toBeDefined();

      // 4h shift + 2.0h driving = 6.0h -> Band 1 (166 Kč)
      fireEvent.change(travelInput, { target: { value: '2' } });
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');

      // 4h shift + 9.0h driving = 13.0h -> Band 2 (256 Kč)
      fireEvent.change(travelInput, { target: { value: '9' } });
      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_2');

      // 4h shift + 15.0h driving = 19.0h -> Band 3 (398 Kč)
      fireEvent.change(travelInput, { target: { value: '15' } });
      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_3');

      // Reduce back to 0.5h driving = 4.5h -> 0 Kč
      fireEvent.change(travelInput, { target: { value: '0.5' } });
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');
      expect(screen.getByTestId('diet-type').textContent).toBe('none');
    });

    it('does NOT recalculate when manual override IS ticked, even under extreme duration changes', () => {
      const { container } = render(
        <ComprehensiveHarness 
          initialTotalHours={8.0} 
          initialManualDiet={true} 
          initialDietAllowance={77} 
          initialCustomRate={77} 
        />
      );

      expect(screen.getByTestId('is-manual-diet').textContent).toBe('true');
      expect(screen.getByTestId('diet-allowance').textContent).toBe('77');

      // Extreme duration changes: 8h -> 20h -> 2h -> 14h
      fireEvent.click(screen.getByTestId('btn-set-hours-20'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('77');

      fireEvent.click(screen.getByTestId('btn-set-hours-2'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('77');

      fireEvent.click(screen.getByTestId('btn-set-hours-14'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('77');

      // Also change driving time
      const travelInput = container.querySelector('input[step="0.5"]') as HTMLInputElement;
      fireEvent.change(travelInput, { target: { value: '5' } });
      expect(screen.getByTestId('diet-allowance').textContent).toBe('77');

      // Unticking manual override immediately restores statutory calculation for current duration (14 + 5 = 19h -> Band 3: 398 Kč)
      const manualCheckbox = screen.getByLabelText(/Ruční úprava stravného/i);
      fireEvent.click(manualCheckbox);

      expect(screen.getByTestId('is-manual-diet').textContent).toBe('false');
      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_3');
    });
  });

  // =========================================================================
  // 3. Stress-Test: Initial Mount & Saved Entries Preservation
  // =========================================================================
  describe('3. Initial mount: loading existing saved entries does NOT alter their saved diet values', () => {
    it('preserves saved entry with 0 Kč / none at 8.5h shift upon initial mount', () => {
      const savedEntry: WorkEntry = {
        id: 'saved-entry-01',
        date: '2026-04-10',
        projectCode: 'SAVE-1',
        projectName: 'Uložená směna bez diet',
        clientName: 'Metrostav DIZ s.r.o.',
        workType: 'site_assembly',
        startTime: '07:00',
        endTime: '16:00',
        breakMinutes: 30,
        totalHours: 8.5,
        pricing: { baseHourlyRate: 600, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 600 },
        travel: {
          distanceKm: 0,
          ratePerKm: 11,
          travelTimeHours: 0,
          travelHourlyRate: 350,
          dietAllowance: 0,
          dietType: 'none',
          dietBandApplied: 'none',
          isManualDiet: false
        },
        extraCosts: [],
        totalEarnings: 5100,
        status: 'submitted',
        notes: '',
        createdAt: '2026-04-10',
        updatedAt: '2026-04-10',
        isPdp: true
      };

      // Step A: verify reducer initialization preserves it
      const initialState = createInitialState(savedEntry, null, testSettings);
      expect(initialState.dietAllowance).toBe(0);
      expect(initialState.dietType).toBe('none');
      expect(initialState.dietBandApplied).toBe('none');
      expect(initialState.isManualDiet).toBe(false);

      // Step B: verify TravelSection mounting preserves it without auto-mutation
      function SavedEntryWrapper() {
        const [state, dispatch] = useReducer(shiftFormReducer, initialState);
        return (
          <div>
            <div data-testid="saved-allowance">{state.dietAllowance}</div>
            <div data-testid="saved-type">{state.dietType}</div>
            <TravelSection 
              state={state} 
              dispatch={dispatch} 
              travelTotal={state.dietAllowance} 
              totalHours={savedEntry.totalHours} 
              settings={testSettings} 
            />
          </div>
        );
      }

      render(<SavedEntryWrapper />);
      // Critical check: allowance must remain 0, NOT mutated to 166
      expect(screen.getByTestId('saved-allowance').textContent).toBe('0');
      expect(screen.getByTestId('saved-type').textContent).toBe('none');
    });

    it('preserves saved entry with Band 1 (166 Kč) at 16.0h shift upon initial mount', () => {
      const savedEntry: WorkEntry = {
        id: 'saved-entry-02',
        date: '2026-04-11',
        projectCode: 'SAVE-2',
        projectName: 'Uložená směna s nižším stravným',
        clientName: 'Metrostav DIZ s.r.o.',
        workType: 'site_assembly',
        startTime: '06:00',
        endTime: '22:30',
        breakMinutes: 30,
        totalHours: 16.0,
        pricing: { baseHourlyRate: 600, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 600 },
        travel: {
          distanceKm: 0,
          ratePerKm: 11,
          travelTimeHours: 0,
          travelHourlyRate: 350,
          dietAllowance: 166,
          dietType: 'band_1',
          dietBandApplied: 'band_1',
          isManualDiet: false
        },
        extraCosts: [],
        totalEarnings: 9766,
        status: 'submitted',
        notes: '',
        createdAt: '2026-04-11',
        updatedAt: '2026-04-11',
        isPdp: true
      };

      const initialState = createInitialState(savedEntry, null, testSettings);
      expect(initialState.dietAllowance).toBe(166);
      expect(initialState.dietType).toBe('band_1');

      function SavedEntryWrapper() {
        const [state, dispatch] = useReducer(shiftFormReducer, initialState);
        return (
          <div>
            <div data-testid="saved-allowance">{state.dietAllowance}</div>
            <div data-testid="saved-type">{state.dietType}</div>
            <TravelSection 
              state={state} 
              dispatch={dispatch} 
              travelTotal={state.dietAllowance} 
              totalHours={savedEntry.totalHours} 
              settings={testSettings} 
            />
          </div>
        );
      }

      render(<SavedEntryWrapper />);
      // Critical check: allowance must remain 166, NOT mutated to 256
      expect(screen.getByTestId('saved-allowance').textContent).toBe('166');
      expect(screen.getByTestId('saved-type').textContent).toBe('band_1');
    });

    it('preserves saved entry with custom manual override (110 Kč) upon initial mount', () => {
      const savedEntry: WorkEntry = {
        id: 'saved-entry-03',
        date: '2026-04-12',
        projectCode: 'SAVE-3',
        projectName: 'Uložená směna s kráceným stravným',
        clientName: 'Metrostav DIZ s.r.o.',
        workType: 'site_assembly',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        totalHours: 8.0,
        pricing: { baseHourlyRate: 600, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 600 },
        travel: {
          distanceKm: 0,
          ratePerKm: 11,
          travelTimeHours: 0,
          travelHourlyRate: 350,
          dietAllowance: 110,
          dietType: 'custom',
          dietBandApplied: 'custom',
          isManualDiet: true,
          customDietRate: 110
        },
        extraCosts: [],
        totalEarnings: 4910,
        status: 'submitted',
        notes: '',
        createdAt: '2026-04-12',
        updatedAt: '2026-04-12',
        isPdp: true
      };

      const initialState = createInitialState(savedEntry, null, testSettings);
      expect(initialState.dietAllowance).toBe(110);
      expect(initialState.isManualDiet).toBe(true);
      expect(initialState.dietType).toBe('custom');

      function SavedEntryWrapper() {
        const [state, dispatch] = useReducer(shiftFormReducer, initialState);
        return (
          <div>
            <div data-testid="saved-allowance">{state.dietAllowance}</div>
            <div data-testid="saved-manual">{state.isManualDiet ? 'true' : 'false'}</div>
            <TravelSection 
              state={state} 
              dispatch={dispatch} 
              travelTotal={state.dietAllowance} 
              totalHours={savedEntry.totalHours} 
              settings={testSettings} 
            />
          </div>
        );
      }

      render(<SavedEntryWrapper />);
      expect(screen.getByTestId('saved-allowance').textContent).toBe('110');
      expect(screen.getByTestId('saved-manual').textContent).toBe('true');
    });

    it('pre-fills Band 1 (166 Kč) for brand new shifts without altering user defaults', () => {
      const freshState = createInitialState(null, null, testSettings);
      expect(freshState.dietAllowance).toBe(166);
      expect(freshState.dietType).toBe('band_1');
      expect(freshState.isManualDiet).toBe(false);

      function FreshShiftWrapper() {
        const [state, dispatch] = useReducer(shiftFormReducer, freshState);
        return (
          <div>
            <div data-testid="fresh-allowance">{state.dietAllowance}</div>
            <TravelSection 
              state={state} 
              dispatch={dispatch} 
              travelTotal={state.dietAllowance} 
              totalHours={8.5} 
              settings={testSettings} 
            />
          </div>
        );
      }

      render(<FreshShiftWrapper />);
      expect(screen.getByTestId('fresh-allowance').textContent).toBe('166');
    });
  });

  // =========================================================================
  // 4. Stress-Test: Rapid Interaction Sequence & Button Toggling
  // =========================================================================
  describe('4. Rapid complex interaction sequences', () => {
    it('survives rapid multi-stage interaction sequence without inconsistent state', () => {
      const { container } = render(<ComprehensiveHarness initialTotalHours={4.0} />);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');

      // Step 1: User clicks Band 2 (256 Kč)
      fireEvent.click(screen.getByRole('button', { name: /12–18 h \(256 Kč\)/i }));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');

      // Step 2: User changes distance to 50 km (unrelated prop)
      fireEvent.click(screen.getByTestId('btn-change-distance'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');

      // Step 3: User clicks Band 3 (398 Kč)
      fireEvent.click(screen.getByRole('button', { name: />18 h \(398 Kč\)/i }));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');

      // Step 4: User engages manual override
      fireEvent.click(screen.getByLabelText(/Ruční úprava stravného/i));
      expect(screen.getByTestId('is-manual-diet').textContent).toBe('true');

      // Step 5: User edits custom allowance to 150 Kč
      const customInput = container.querySelector('input.text-right') as HTMLInputElement;
      fireEvent.change(customInput, { target: { value: '150' } });
      expect(screen.getByTestId('diet-allowance').textContent).toBe('150');

      // Step 6: User changes shift duration to 14.0h -> allowance stays 150 Kč
      fireEvent.click(screen.getByTestId('btn-set-hours-14'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('150');

      // Step 7: User disengages manual override -> auto-recalculates to 256 Kč for 14.0h
      fireEvent.click(screen.getByLabelText(/Ruční úprava stravného/i));
      expect(screen.getByTestId('is-manual-diet').textContent).toBe('false');
      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_2');

      // Step 8: User clicks "Bez diet (0 Kč)"
      fireEvent.click(screen.getByRole('button', { name: /Bez diet \(0 Kč\)/i }));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');

      // Step 9: User changes duration to 20h -> auto-recalculates to Band 3 (398 Kč)
      fireEvent.click(screen.getByTestId('btn-set-hours-20'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_3');
    });
  });
});
