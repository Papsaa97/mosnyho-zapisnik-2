import { describe, it, expect } from 'vitest';
import React, { useReducer, useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { 
  shiftFormReducer, 
  createInitialState, 
  ShiftFormState 
} from '../src/components/form/shiftFormReducer';
import { TravelSection } from '../src/components/form/sections/TravelSection';
import { ProjectSection } from '../src/components/form/sections/ProjectSection';
import { InvoiceReportView } from '../src/components/report/InvoiceReportView';
import { 
  calculateNetHours, 
  estimateDiet, 
  normalizeDietType,
  calculateVatAndTotal, 
  PDP_STATUTORY_CLAUSE 
} from '../src/services/pricingEngine';
import { 
  AppSettings, 
  WorkEntry 
} from '../src/types';
import { DEFAULT_SETTINGS } from '../src/db/seedData';
import { CLIENT_FIXTURES, CLIENT_STANDARD_VAT, CLIENT_PDP_REVERSE_CHARGE, CLIENT_KOVO_NOVAK } from './fixtures/clients.fixture';
import { PRIMARY_CONTRACTOR_FIXTURE } from './fixtures/contractor.fixture';

describe('Milestone M1 Adversarial Verification (Challenger 2)', () => {
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

  // =========================================================================
  // 1. ShiftForm Reducer State Transitions & Invariants
  // =========================================================================
  describe('1. ShiftForm Reducer State Transitions', () => {
    it('initializes state correctly when client has isPdpDefault: true', () => {
      const state = createInitialState(null, { clientName: CLIENT_PDP_REVERSE_CHARGE.name }, testSettings);
      expect(state.clientName).toBe(CLIENT_PDP_REVERSE_CHARGE.name);
      expect(state.isPdp).toBe(true);
    });

    it('initializes state correctly when client has isPdpDefault: false', () => {
      const state = createInitialState(null, { clientName: CLIENT_KOVO_NOVAK.name }, testSettings);
      expect(state.clientName).toBe(CLIENT_KOVO_NOVAK.name);
      expect(state.isPdp).toBe(false);
    });

    it('preserves existing entry isPdp even if conflicting with client isPdpDefault', () => {
      const existingEntry: WorkEntry = {
        id: 'entry-override-pdp',
        date: '2026-04-10',
        projectCode: 'P-01',
        projectName: 'Práce na dílně (standard DPH)',
        clientName: CLIENT_PDP_REVERSE_CHARGE.name, // client defaults to true
        workType: 'workshop_welding',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        totalHours: 8.0,
        pricing: { baseHourlyRate: 500, complexityMultiplier: 1, shiftSurcharges: [], calculatedHourlyRate: 500 },
        travel: { distanceKm: 0, ratePerKm: 11, travelTimeHours: 0, travelHourlyRate: 350, dietAllowance: 166, dietType: 'band_1' },
        extraCosts: [],
        totalEarnings: 4166,
        status: 'draft',
        notes: '',
        createdAt: '2026-04-10',
        updatedAt: '2026-04-10',
        isPdp: false // Explicit override to false
      };

      const state = createInitialState(existingEntry, null, testSettings);
      expect(state.isPdp).toBe(false);
    });

    it('transitions isPdp cleanly via SET_FIELD action', () => {
      const state = createInitialState(null, null, testSettings);
      
      const setTrue = shiftFormReducer(state, { type: 'SET_FIELD', field: 'isPdp', value: true });
      expect(setTrue.isPdp).toBe(true);

      const setFalse = shiftFormReducer(setTrue, { type: 'SET_FIELD', field: 'isPdp', value: false });
      expect(setFalse.isPdp).toBe(false);
    });

    it('transitions dietType and synchronizes dietBandApplied on SET_DIET', () => {
      const state = createInitialState(null, null, testSettings);

      // Transition to Band 1
      const s1 = shiftFormReducer(state, { type: 'SET_DIET', dietType: 'band_1', allowance: 166, isManual: false });
      expect(s1.dietType).toBe('band_1');
      expect(s1.dietAllowance).toBe(166);
      expect(s1.dietBandApplied).toBe('band_1');
      expect(s1.isManualDiet).toBe(false);

      // Transition to Band 2
      const s2 = shiftFormReducer(s1, { type: 'SET_DIET', dietType: 'band_2', allowance: 256, isManual: false });
      expect(s2.dietType).toBe('band_2');
      expect(s2.dietAllowance).toBe(256);
      expect(s2.dietBandApplied).toBe('band_2');

      // Transition to Band 3
      const s3 = shiftFormReducer(s2, { type: 'SET_DIET', dietType: 'band_3', allowance: 398, isManual: false });
      expect(s3.dietType).toBe('band_3');
      expect(s3.dietAllowance).toBe(398);
      expect(s3.dietBandApplied).toBe('band_3');

      // Transition to none
      const sNone = shiftFormReducer(s3, { type: 'SET_DIET', dietType: 'none', allowance: 0, isManual: false });
      expect(sNone.dietType).toBe('none');
      expect(sNone.dietAllowance).toBe(0);
      expect(sNone.dietBandApplied).toBe('none');

      // Legacy support: half_day and full_day
      const sLegacy1 = shiftFormReducer(sNone, { type: 'SET_DIET', dietType: 'half_day', allowance: 166 });
      expect(sLegacy1.dietBandApplied).toBe('band_1');

      const sLegacy2 = shiftFormReducer(sLegacy1, { type: 'SET_DIET', dietType: 'full_day', allowance: 256 });
      expect(sLegacy2.dietBandApplied).toBe('band_2');
    });

    it('handles manual custom diet override and retains customDietRate', () => {
      const state = createInitialState(null, null, testSettings);

      // Set custom diet 140 Kč
      const customState = shiftFormReducer(state, {
        type: 'SET_DIET',
        dietType: 'custom',
        allowance: 140,
        isManual: true
      });

      expect(customState.dietType).toBe('custom');
      expect(customState.dietAllowance).toBe(140);
      expect(customState.isManualDiet).toBe(true);
      expect(customState.customDietRate).toBe(140);
      expect(customState.dietBandApplied).toBe('custom');

      // Disabling manual diet preserves customDietRate for future toggle
      const toggledOff = shiftFormReducer(customState, {
        type: 'SET_FIELD',
        field: 'isManualDiet',
        value: false
      });
      expect(toggledOff.isManualDiet).toBe(false);
      expect(toggledOff.customDietRate).toBe(140);
    });

    it('handles client switching between PDP and non-PDP clients', () => {
      // Simulate client switching logic from ProjectSection
      let state = createInitialState(null, { clientName: CLIENT_KOVO_NOVAK.name }, testSettings);
      expect(state.isPdp).toBe(false);

      // Helper simulating ProjectSection.handleClientChange
      const handleClientChange = (currentState: ShiftFormState, clientName: string, clientList: ClientProfile[] = testSettings.clients): ShiftFormState => {
        let next = shiftFormReducer(currentState, { type: 'SET_FIELD', field: 'clientName', value: clientName });
        const matched = clientList.find(c => c.name.toLowerCase() === clientName.trim().toLowerCase());
        if (matched) {
          next = shiftFormReducer(next, { type: 'SET_FIELD', field: 'isPdp', value: !!matched.isPdpDefault });
        }
        return next;
      };

      // Switch to TechnoMont (PDP default true)
      state = handleClientChange(state, CLIENT_PDP_REVERSE_CHARGE.name);
      expect(state.clientName).toBe(CLIENT_PDP_REVERSE_CHARGE.name);
      expect(state.isPdp).toBe(true);

      // Switch to Novak (PDP default false)
      state = handleClientChange(state, CLIENT_KOVO_NOVAK.name);
      expect(state.clientName).toBe(CLIENT_KOVO_NOVAK.name);
      expect(state.isPdp).toBe(false);

      // Switch to client with undefined isPdpDefault: resets isPdp from true to false
      state = shiftFormReducer(state, { type: 'SET_FIELD', field: 'isPdp', value: true });
      expect(state.isPdp).toBe(true);
      const clientWithUndefinedPdp: ClientProfile = {
        name: 'Zámečnictví Bez PDP s.r.o.',
        ico: '12345678',
        address: 'Dílenská 5'
      };
      state = handleClientChange(state, clientWithUndefinedPdp.name, [...testSettings.clients, clientWithUndefinedPdp]);
      expect(state.clientName).toBe('Zámečnictví Bez PDP s.r.o.');
      expect(state.isPdp).toBe(false);

      // Switch to unknown custom client: should preserve current isPdp without throwing
      state = handleClientChange(state, 'Neznámá firma s.r.o.');
      expect(state.clientName).toBe('Neznámá firma s.r.o.');
      expect(state.isPdp).toBe(false); // Preserved
    });
  });

  // =========================================================================
  // 2. Form Reactivity: Time Changes, Duration & Diet Calculation
  // =========================================================================
  describe('2. Form Reactivity & Automated Diet Calculation', () => {
    function TestReactivityHarness({ 
      initialTotalHours = 4.0,
      initialManualDiet = false,
      initialDietAllowance,
      initialCustomRate = 0
    }: { 
      initialTotalHours?: number;
      initialManualDiet?: boolean;
      initialDietAllowance?: number;
      initialCustomRate?: number;
    }) {
      const [totalHours, setTotalHours] = useState(initialTotalHours);
      const initialEst = estimateDiet(initialTotalHours, testSettings.rates);
      const effectiveAllowance = initialDietAllowance !== undefined 
        ? initialDietAllowance 
        : (initialManualDiet ? 0 : initialEst.allowance);
      const effectiveType = initialManualDiet 
        ? 'custom' 
        : (initialDietAllowance !== undefined 
            ? (initialDietAllowance === 0 ? 'none' : initialEst.type) 
            : initialEst.type);

      const [state, dispatch] = useReducer(shiftFormReducer, {
        ...createInitialState(null, null, testSettings),
        isManualDiet: initialManualDiet,
        dietAllowance: effectiveAllowance,
        customDietRate: initialCustomRate,
        dietType: effectiveType,
        dietBandApplied: effectiveType === 'custom' ? 'custom' : normalizeDietType(effectiveType)
      });

      return (
        <div>
          <span data-testid="total-hours">{totalHours}</span>
          <span data-testid="diet-allowance">{state.dietAllowance}</span>
          <span data-testid="diet-type">{state.dietType}</span>
          <span data-testid="diet-band">{state.dietBandApplied}</span>
          <span data-testid="is-manual-diet">{state.isManualDiet ? 'true' : 'false'}</span>
          <span data-testid="travel-hours">{state.travelTimeHours}</span>

          <button 
            data-testid="set-hours-4" 
            onClick={() => setTotalHours(4.0)}
          >Set 4h</button>
          <button 
            data-testid="set-hours-8" 
            onClick={() => setTotalHours(8.0)}
          >Set 8h</button>
          <button 
            data-testid="set-hours-14" 
            onClick={() => setTotalHours(14.0)}
          >Set 14h</button>
          <button 
            data-testid="set-hours-20" 
            onClick={() => setTotalHours(20.0)}
          >Set 20h</button>

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

    it('reactively sets 0 Kč for shift under 5 hours (4.0h)', () => {
      render(<TestReactivityHarness initialTotalHours={4.0} />);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');
      expect(screen.getByTestId('diet-type').textContent).toBe('none');
    });

    it('reactively updates diet to Band 1 (166 Kč) when shift hours change to 8.0h', () => {
      render(<TestReactivityHarness initialTotalHours={4.0} />);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');

      fireEvent.click(screen.getByTestId('set-hours-8'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');
      expect(screen.getByTestId('diet-band').textContent).toBe('band_1');
    });

    it('reactively updates diet to Band 2 (256 Kč) when shift hours change to 14.0h', () => {
      render(<TestReactivityHarness initialTotalHours={4.0} />);
      fireEvent.click(screen.getByTestId('set-hours-14'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_2');
      expect(screen.getByTestId('diet-band').textContent).toBe('band_2');
    });

    it('reactively updates diet to Band 3 (398 Kč) when shift hours change to 20.0h', () => {
      render(<TestReactivityHarness initialTotalHours={4.0} />);
      fireEvent.click(screen.getByTestId('set-hours-20'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_3');
      expect(screen.getByTestId('diet-band').textContent).toBe('band_3');
    });

    it('combines shift hours and travelTimeHours to reach diet tiers', () => {
      const { container } = render(<TestReactivityHarness initialTotalHours={4.0} />);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');

      // Change travel time input to 1.5h -> 4.0h + 1.5h = 5.5h (Band 1)
      const travelInput = container.querySelector('input[step="0.5"]') as HTMLInputElement;
      expect(travelInput).toBeDefined();
      fireEvent.change(travelInput, { target: { value: '1.5' } });

      expect(screen.getByTestId('travel-hours').textContent).toBe('1.5');
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');

      // Change travel time to 8.5h -> 4.0h + 8.5h = 12.5h (Band 2)
      fireEvent.change(travelInput, { target: { value: '8.5' } });
      expect(screen.getByTestId('diet-allowance').textContent).toBe('256');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_2');

      // Change travel time to 15.0h -> 4.0h + 15.0h = 19.0h (Band 3)
      fireEvent.change(travelInput, { target: { value: '15.0' } });
      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_3');
    });

    it('preserves manual custom diet when shift hours change (Manual Override Immunity)', () => {
      render(
        <TestReactivityHarness 
          initialTotalHours={4.0} 
          initialManualDiet={true} 
          initialDietAllowance={125} 
          initialCustomRate={125} 
        />
      );

      expect(screen.getByTestId('is-manual-diet').textContent).toBe('true');
      expect(screen.getByTestId('diet-allowance').textContent).toBe('125');
      expect(screen.getByTestId('diet-type').textContent).toBe('custom');

      // Change shift hours to 8h, 14h, 20h
      fireEvent.click(screen.getByTestId('set-hours-8'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('125'); // Unchanged!

      fireEvent.click(screen.getByTestId('set-hours-14'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('125'); // Unchanged!

      fireEvent.click(screen.getByTestId('set-hours-20'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('125'); // Unchanged!
    });

    it('resumes automated estimation when manual override is unchecked', () => {
      render(
        <TestReactivityHarness 
          initialTotalHours={8.0} 
          initialManualDiet={true} 
          initialDietAllowance={125} 
          initialCustomRate={125} 
        />
      );

      expect(screen.getByTestId('diet-allowance').textContent).toBe('125');

      // Uncheck manual override checkbox
      const manualCheckbox = screen.getByLabelText(/Ruční úprava stravného/i);
      fireEvent.click(manualCheckbox);

      // Immediately updates to Band 1 (166 Kč) for 8.0 hours
      expect(screen.getByTestId('is-manual-diet').textContent).toBe('false');
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');
    });

    it('reveals custom amount input when manual override is checked and allows custom editing', () => {
      const { container } = render(<TestReactivityHarness initialTotalHours={8.0} />);

      // Initially automated (166 Kč)
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166');

      // Check manual override
      const manualCheckbox = screen.getByLabelText(/Ruční úprava stravného/i);
      fireEvent.click(manualCheckbox);

      expect(screen.getByTestId('is-manual-diet').textContent).toBe('true');
      expect(screen.getByText('Vlastní částka:')).toBeDefined();

      // Find the custom allowance input
      const customInput = container.querySelector('input.text-right') as HTMLInputElement;
      expect(customInput).toBeDefined();
      fireEvent.change(customInput, { target: { value: '95' } });

      expect(screen.getByTestId('diet-allowance').textContent).toBe('95');
      expect(screen.getByTestId('diet-type').textContent).toBe('custom');
    });

    it('allows discrete tier button selection without immediate useEffect clobbering', () => {
      render(<TestReactivityHarness initialTotalHours={4.0} />);

      // At 4h duration, clicking >18h button successfully selects Band 3 (398 Kč) without being reverted
      const band3Button = screen.getByRole('button', { name: />18 h \(398 Kč\)/i });
      fireEvent.click(band3Button);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_3');

      // Clicking "Bez diet (0 Kč)" updates allowance back to 0 Kč
      const zeroButton = screen.getByRole('button', { name: /Bez diet \(0 Kč\)/i });
      fireEvent.click(zeroButton);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('0');
      expect(screen.getByTestId('diet-type').textContent).toBe('none');
    });

    it('automatically updates diets when duration changes if manual override is not engaged', () => {
      render(<TestReactivityHarness initialTotalHours={4.0} />);

      // User manually clicks Band 3 at 4h duration
      const band3Button = screen.getByRole('button', { name: />18 h \(398 Kč\)/i });
      fireEvent.click(band3Button);
      expect(screen.getByTestId('diet-allowance').textContent).toBe('398');

      // User subsequently changes duration to 8.0h -> automatic calculation updates to Band 1 (166 Kč)
      fireEvent.click(screen.getByTestId('set-hours-8'));
      expect(screen.getByTestId('diet-allowance').textContent).toBe('166');
      expect(screen.getByTestId('diet-type').textContent).toBe('band_1');
    });

    it('handles overnight shifts crossing midnight correctly in net hours computation', () => {
      // 22:00 to 06:00 (8h duration) with 30m break = 7.5h net
      const netHours = calculateNetHours('22:00', '06:00', 30);
      expect(netHours).toBe(7.5);

      const est = estimateDiet(netHours, testSettings.rates);
      expect(est.type).toBe('band_1');
      expect(est.allowance).toBe(166);
    });
  });

  // =========================================================================
  // 3. Print & Report Layout: § 92e PDP Clause & 0% VAT
  // =========================================================================
  describe('3. Print & Report Layout & § 92e PDP Verification', () => {
    const samplePdpEntry: WorkEntry = {
      id: 'entry-pdp-01',
      date: '2026-04-15',
      projectCode: 'MOST-SO201',
      projectName: 'Most ev.č. 201 – svařování nosníků',
      clientName: CLIENT_PDP_REVERSE_CHARGE.name,
      workType: 'site_assembly',
      startTime: '07:00',
      endTime: '17:30',
      breakMinutes: 30,
      totalHours: 10.0,
      pricing: {
        baseHourlyRate: 650,
        complexityMultiplier: 1.0,
        shiftSurcharges: [],
        calculatedHourlyRate: 650
      },
      travel: {
        distanceKm: 40,
        ratePerKm: 11,
        travelTimeHours: 1.0,
        travelHourlyRate: 350,
        dietAllowance: 166,
        dietType: 'band_1',
        dietBandApplied: 'band_1'
      },
      extraCosts: [],
      totalEarnings: 10.0 * 650 + 40 * 11 + 350 + 166, // 6500 + 440 + 350 + 166 = 7456
      status: 'submitted',
      notes: 'Montážní a svářečské práce na stavbě mostu',
      createdAt: '2026-04-15T18:00:00Z',
      updatedAt: '2026-04-15T18:00:00Z',
      isPdp: true
    };

    const sampleStandardEntry: WorkEntry = {
      id: 'entry-std-01',
      date: '2026-04-16',
      projectCode: 'DILNA-12',
      projectName: 'Výroba schodiště v dílně',
      clientName: CLIENT_KOVO_NOVAK.name,
      workType: 'workshop_welding',
      startTime: '07:00',
      endTime: '15:30',
      breakMinutes: 30,
      totalHours: 8.0,
      pricing: {
        baseHourlyRate: 500,
        complexityMultiplier: 1.0,
        shiftSurcharges: [],
        calculatedHourlyRate: 500
      },
      travel: {
        distanceKm: 0,
        ratePerKm: 11,
        travelTimeHours: 0,
        travelHourlyRate: 350,
        dietAllowance: 166,
        dietType: 'band_1',
        dietBandApplied: 'band_1'
      },
      extraCosts: [],
      totalEarnings: 8.0 * 500 + 166, // 4000 + 166 = 4166
      status: 'submitted',
      notes: 'Zámečnické práce dílna',
      createdAt: '2026-04-16T16:00:00Z',
      updatedAt: '2026-04-16T16:00:00Z',
      isPdp: false
    };

    it('renders mandatory PDP badge and statutory clause when isPdp is true', () => {
      render(
        <InvoiceReportView 
          entries={[samplePdpEntry]} 
          settings={testSettings} 
        />
      );

      // Header badge
      expect(screen.getByText('§ 92e PDP (PŘENESENÁ DP)')).toBeDefined();

      // Statutory clause box
      const clauseElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('Daň odvede zákazník – režim přenesené daňové povinnosti dle § 92e zákona o DPH') || false;
      });
      expect(clauseElements.length).toBeGreaterThanOrEqual(1);

      expect(screen.getByText(/CZ-CPA 41 až 43/i)).toBeDefined();
    });

    it('does NOT render PDP badge or statutory clause when isPdp is false', () => {
      render(
        <InvoiceReportView 
          entries={[sampleStandardEntry]} 
          settings={testSettings} 
        />
      );

      expect(screen.queryByText('§ 92e PDP (PŘENESENÁ DP)')).toBeNull();
      expect(screen.queryByText(PDP_STATUTORY_CLAUSE)).toBeNull();
      expect(screen.queryByText(/CZ-CPA 41 až 43/i)).toBeNull();
    });

    it('displays 0% VAT breakdown and zero VAT amount in Invoice mode under PDP', () => {
      render(
        <InvoiceReportView 
          entries={[samplePdpEntry]} 
          settings={testSettings} 
        />
      );

      // Switch to Invoice mode
      const modeBtn = screen.getByRole('button', { name: /Režim: Protokol/i });
      fireEvent.click(modeBtn);

      // Check VAT breakdown header
      expect(screen.getByText(/Rekapitulace DPH a celková částka k úhradě/i)).toBeDefined();

      // Check Sazba DPH
      expect(screen.getByText('0 % (přenesená DP)')).toBeDefined();

      // Check Výše DPH is 0 Kč
      const zeroVatElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('0') && element?.textContent?.includes('Kč') || false;
      });
      expect(zeroVatElements.length).toBeGreaterThanOrEqual(1);

      // Check Celkem k úhradě equals tax base (7 456 Kč)
      const totalElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('7') && element?.textContent?.includes('456') && element?.textContent?.includes('Kč') || false;
      });
      expect(totalElements.length).toBeGreaterThanOrEqual(1);

      // PDP statutory notice inside VAT box
      const clauseMatches = screen.getAllByText((content, element) => {
        return element?.textContent?.includes(PDP_STATUTORY_CLAUSE) || false;
      });
      expect(clauseMatches.length).toBeGreaterThanOrEqual(2); // Top notice + VAT box notice
    });

    it('displays standard 21% VAT breakdown in Invoice mode when non-PDP', () => {
      render(
        <InvoiceReportView 
          entries={[sampleStandardEntry]} 
          settings={testSettings} 
        />
      );

      // Switch to Invoice mode
      const modeBtn = screen.getByRole('button', { name: /Režim: Protokol/i });
      fireEvent.click(modeBtn);

      // Sazba DPH: 21 %
      expect(screen.getByText('21 %')).toBeDefined();

      // Grand total 4166 Kč, VAT 21% = Math.round(4166 * 0.21) = 875 Kč, TotalWithVat = 5041 Kč
      const vatRes = calculateVatAndTotal(sampleStandardEntry.totalEarnings, false, 21);
      expect(vatRes.vatAmount).toBe(875);
      expect(vatRes.totalWithVat).toBe(5041);

      // Verify VAT amount (875 Kč) is present in the DOM
      const vatAmountElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('875') && element?.textContent?.includes('Kč') || false;
      });
      expect(vatAmountElements.length).toBeGreaterThanOrEqual(1);

      // Verify Total with VAT (5 041 Kč) is present in the DOM
      const totalElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('5') && element?.textContent?.includes('041') && element?.textContent?.includes('Kč') || false;
      });
      expect(totalElements.length).toBeGreaterThanOrEqual(1);
    });

    it('respects entry explicit isPdp: false even when client has isPdpDefault: true', () => {
      const overrideEntry: WorkEntry = {
        ...samplePdpEntry,
        id: 'entry-override-false',
        clientName: CLIENT_PDP_REVERSE_CHARGE.name, // client defaults to true
        isPdp: false // explicit false
      };

      render(
        <InvoiceReportView 
          entries={[overrideEntry]} 
          settings={testSettings} 
        />
      );

      // Header badge should NOT display PDP
      expect(screen.queryByText('§ 92e PDP (PŘENESENÁ DP)')).toBeNull();

      // Statutory clause should NOT be present
      expect(screen.queryByText(/Daň odvede zákazník/i)).toBeNull();

      // Switch to invoice mode to verify VAT rate
      const modeBtn = screen.getByRole('button', { name: /Režim: Protokol/i });
      fireEvent.click(modeBtn);

      // VAT should show standard 21 %
      expect(screen.getByText('21 %')).toBeDefined();
    });
  });

  // =========================================================================
  // 4. SPAYD QR Consistency: Payment Amount vs Invoice Total
  // =========================================================================
  describe('4. SPAYD QR Consistency & Verification', () => {
    it('generates SPAYD QR string matching invoice total with 0% VAT under PDP', () => {
      const pdpEntry: WorkEntry = {
        id: 'entry-qr-pdp',
        date: '2026-04-20',
        projectCode: 'P-PDP',
        projectName: 'Svařování ocelové haly',
        clientName: CLIENT_PDP_REVERSE_CHARGE.name,
        workType: 'site_assembly',
        startTime: '07:00',
        endTime: '15:00',
        breakMinutes: 0,
        totalHours: 8.0,
        pricing: { baseHourlyRate: 1000, complexityMultiplier: 1, shiftSurcharges: [], calculatedHourlyRate: 1000 },
        travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 0, dietType: 'none' },
        extraCosts: [],
        totalEarnings: 8000,
        status: 'submitted',
        notes: '',
        createdAt: '2026-04-20',
        updatedAt: '2026-04-20',
        isPdp: true
      };

      const { container } = render(
        <InvoiceReportView 
          entries={[pdpEntry]} 
          settings={testSettings} 
        />
      );

      // Switch to Invoice mode
      fireEvent.click(screen.getByRole('button', { name: /Režim: Protokol/i }));

      // Find QR Code SVG element
      const svgEl = container.querySelector('svg');
      expect(svgEl).toBeDefined();

      // Check text in payment box
      expect(screen.getByText(/0 % DPH – Režim přenesené daňové povinnosti/i)).toBeDefined();

      // The amount must be exactly 8 000 Kč (taxBase with 0% VAT)
      const vatRes = calculateVatAndTotal(8000, true);
      expect(vatRes.totalWithVat).toBe(8000);
      expect(vatRes.vatAmount).toBe(0);

      // Verify payment details displays 8 000 Kč
      const displayedAmounts = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('8') && element?.textContent?.includes('000') && element?.textContent?.includes('Kč') || false;
      });
      expect(displayedAmounts.length).toBeGreaterThanOrEqual(1);
    });

    it('generates SPAYD QR string matching invoice total with 21% VAT when not PDP', () => {
      const stdEntry: WorkEntry = {
        id: 'entry-qr-std',
        date: '2026-04-20',
        projectCode: 'P-STD',
        projectName: 'Výroba regálů',
        clientName: CLIENT_KOVO_NOVAK.name,
        workType: 'workshop_welding',
        startTime: '07:00',
        endTime: '15:00',
        breakMinutes: 0,
        totalHours: 8.0,
        pricing: { baseHourlyRate: 1000, complexityMultiplier: 1, shiftSurcharges: [], calculatedHourlyRate: 1000 },
        travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 0, dietType: 'none' },
        extraCosts: [],
        totalEarnings: 8000,
        status: 'submitted',
        notes: '',
        createdAt: '2026-04-20',
        updatedAt: '2026-04-20',
        isPdp: false
      };

      render(
        <InvoiceReportView 
          entries={[stdEntry]} 
          settings={testSettings} 
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Režim: Protokol/i }));

      const vatRes = calculateVatAndTotal(8000, false, 21);
      expect(vatRes.totalWithVat).toBe(9680); // 8000 + 1680 VAT

      const displayedTotal = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('9') && element?.textContent?.includes('680') && element?.textContent?.includes('Kč') || false;
      });
      expect(displayedTotal.length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText(/0 % DPH – Režim přenesené daňové povinnosti/i)).toBeNull();
    });

    it('displays graceful fallback when contractor IBAN is missing', () => {
      const noIbanSettings: AppSettings = {
        ...testSettings,
        contractor: {
          ...testSettings.contractor,
          iban: '' // Empty IBAN
        }
      };

      const entry: WorkEntry = {
        id: 'entry-no-iban',
        date: '2026-04-20',
        projectCode: 'P-01',
        projectName: 'Práce',
        clientName: CLIENT_PDP_REVERSE_CHARGE.name,
        workType: 'site_assembly',
        startTime: '08:00',
        endTime: '16:00',
        breakMinutes: 0,
        totalHours: 8.0,
        pricing: { baseHourlyRate: 500, complexityMultiplier: 1, shiftSurcharges: [], calculatedHourlyRate: 500 },
        travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 0, dietType: 'none' },
        extraCosts: [],
        totalEarnings: 4000,
        status: 'submitted',
        notes: '',
        createdAt: '2026-04-20',
        updatedAt: '2026-04-20',
        isPdp: true
      };

      render(<InvoiceReportView entries={[entry]} settings={noIbanSettings} />);
      fireEvent.click(screen.getByRole('button', { name: /Režim: Protokol/i }));

      expect(screen.getByText(/Pro zobrazení QR kódu doplňte IBAN v nastavení profilu/i)).toBeDefined();
    });
  });

  // =========================================================================
  // 5. Stress Testing Edge Cases: Mixed Shifts, Boundaries & Precisions
  // =========================================================================
  describe('5. Integration Edge Cases & Boundary Stress Tests', () => {
    it('correctly categorizes mixed PDP and non-PDP entries in report as PDP document', () => {
      // In construction practice, if any work on the protocol falls under PDP, the protocol is in PDP regime
      const pdpEntry: WorkEntry = {
        id: 'e1',
        date: '2026-04-01',
        projectCode: 'P1',
        projectName: 'Montáž',
        clientName: CLIENT_PDP_REVERSE_CHARGE.name,
        workType: 'site_assembly',
        startTime: '08:00',
        endTime: '16:00',
        breakMinutes: 0,
        totalHours: 8.0,
        pricing: { baseHourlyRate: 500, complexityMultiplier: 1, shiftSurcharges: [], calculatedHourlyRate: 500 },
        travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 0, dietType: 'none' },
        extraCosts: [],
        totalEarnings: 4000,
        status: 'submitted',
        notes: '',
        createdAt: '2026-04-01',
        updatedAt: '2026-04-01',
        isPdp: true
      };

      const nonPdpEntry: WorkEntry = {
        id: 'e2',
        date: '2026-04-02',
        projectCode: 'P1',
        projectName: 'Dílna',
        clientName: CLIENT_PDP_REVERSE_CHARGE.name,
        workType: 'workshop_welding',
        startTime: '08:00',
        endTime: '16:00',
        breakMinutes: 0,
        totalHours: 8.0,
        pricing: { baseHourlyRate: 500, complexityMultiplier: 1, shiftSurcharges: [], calculatedHourlyRate: 500 },
        travel: { distanceKm: 0, ratePerKm: 0, travelTimeHours: 0, travelHourlyRate: 0, dietAllowance: 0, dietType: 'none' },
        extraCosts: [],
        totalEarnings: 4000,
        status: 'submitted',
        notes: '',
        createdAt: '2026-04-02',
        updatedAt: '2026-04-02',
        isPdp: false
      };

      render(<InvoiceReportView entries={[pdpEntry, nonPdpEntry]} settings={testSettings} />);
      expect(screen.getByText('§ 92e PDP (PŘENESENÁ DP)')).toBeDefined();
      const clauseMatches = screen.getAllByText((content, element) => {
        return element?.textContent?.includes(PDP_STATUTORY_CLAUSE) || false;
      });
      expect(clauseMatches.length).toBeGreaterThanOrEqual(1);
    });

    it('survives floating point boundary stress tests for diet duration', () => {
      // Test epsilon boundaries around 5h, 12h, 18h
      const rates = testSettings.rates;

      // 4.999999h -> 0
      expect(estimateDiet(4.999999, rates).type).toBe('none');
      // 5.000000h -> band_1
      expect(estimateDiet(5.000000, rates).type).toBe('band_1');
      // 12.000000h -> band_1 (<= 12h is Band 1)
      expect(estimateDiet(12.000000, rates).type).toBe('band_1');
      // 12.000001h -> band_2 (> 12h is Band 2)
      expect(estimateDiet(12.000001, rates).type).toBe('band_2');
      // 18.000000h -> band_2 (<= 18h is Band 2)
      expect(estimateDiet(18.000000, rates).type).toBe('band_2');
      // 18.000001h -> band_3 (> 18h is Band 3)
      expect(estimateDiet(18.000001, rates).type).toBe('band_3');
    });

    it('renders empty report cleanly without throwing', () => {
      render(<InvoiceReportView entries={[]} settings={testSettings} />);
      expect(screen.getByText(/PŘEDÁVACÍ PROTOKOL & PODKLAD K FAKTURACI/i)).toBeDefined();
      expect(screen.getAllByText(/0,00\s*h/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // 6. Milestone M1 Iteration 2 Challenger Stress Tests (Adversarial Verifier 2)
  // =========================================================================
  describe('6. Milestone M1 Iteration 2 Challenger Stress Tests (Adversarial Verifier 2)', () => {
    // 6.1 Mixed Entries in InvoiceReportView
    describe('6.1 InvoiceReportView with Mixed PDP Entries', () => {
      const sampleStandardEntry: WorkEntry = {
        id: 'entry-std-template',
        date: '2026-04-16',
        projectCode: 'P-01',
        projectName: 'Zámečnické práce',
        clientName: CLIENT_KOVO_NOVAK.name,
        workType: 'workshop_welding',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        totalHours: 8.0,
        pricing: {
          baseHourlyRate: 500,
          complexityMultiplier: 1.0,
          shiftSurcharges: [],
          calculatedHourlyRate: 500
        },
        travel: {
          distanceKm: 0,
          ratePerKm: 11,
          travelTimeHours: 0,
          travelHourlyRate: 350,
          dietAllowance: 0,
          dietType: 'none',
          dietBandApplied: 'none'
        },
        extraCosts: [],
        totalEarnings: 4000,
        status: 'submitted',
        notes: '',
        createdAt: '2026-04-16T16:00:00Z',
        updatedAt: '2026-04-16T16:00:00Z',
        isPdp: false
      };

      it('all entries isPdp: false with client isPdpDefault: true -> must produce 21% VAT, no PDP clause', () => {
        const clientPdp = CLIENT_PDP_REVERSE_CHARGE; // isPdpDefault: true
        const entry1: WorkEntry = {
          ...sampleStandardEntry,
          id: 'pdp-false-e1',
          date: '2026-04-05',
          clientName: clientPdp.name,
          totalEarnings: 3000,
          isPdp: false // explicit false
        };
        const entry2: WorkEntry = {
          ...sampleStandardEntry,
          id: 'pdp-false-e2',
          date: '2026-04-06',
          clientName: clientPdp.name,
          totalEarnings: 4000,
          isPdp: false // explicit false
        };
        const entry3: WorkEntry = {
          ...sampleStandardEntry,
          id: 'pdp-false-e3',
          date: '2026-04-07',
          clientName: clientPdp.name,
          totalEarnings: 5000,
          isPdp: false // explicit false
        };

        render(
          <InvoiceReportView 
            entries={[entry1, entry2, entry3]} 
            settings={testSettings} 
          />
        );

        // Grand total is 12 000 Kč
        // 1. Header badge § 92e PDP must NOT be present
        expect(screen.queryByText('§ 92e PDP (PŘENESENÁ DP)')).toBeNull();

        // 2. Statutory clause must NOT be present in protocol mode
        expect(screen.queryByText(new RegExp(PDP_STATUTORY_CLAUSE, 'i'))).toBeNull();
        expect(screen.queryByText(/CZ-CPA 41 až 43/i)).toBeNull();

        // 3. Switch to Invoice mode
        fireEvent.click(screen.getByRole('button', { name: /Režim: Protokol/i }));

        // 4. VAT rate must display 21 %, NOT 0 %
        expect(screen.getByText('21 %')).toBeDefined();
        expect(screen.queryByText('0 % (přenesená DP)')).toBeNull();

        // 5. VAT amount: 21% of 12 000 Kč = 2 520 Kč
        const vatCalculation = calculateVatAndTotal(12000, false, 21);
        expect(vatCalculation.vatAmount).toBe(2520);
        expect(vatCalculation.totalWithVat).toBe(14520);

        const vatElements = screen.getAllByText((content, element) => {
          return element?.textContent?.includes('2') && element?.textContent?.includes('520') && element?.textContent?.includes('Kč') || false;
        });
        expect(vatElements.length).toBeGreaterThanOrEqual(1);

        // 6. Total with VAT: 14 520 Kč
        const totalElements = screen.getAllByText((content, element) => {
          return element?.textContent?.includes('14') && element?.textContent?.includes('520') && element?.textContent?.includes('Kč') || false;
        });
        expect(totalElements.length).toBeGreaterThanOrEqual(1);

        // 7. No PDP statutory clause inside VAT box
        expect(screen.queryByText(new RegExp(PDP_STATUTORY_CLAUSE, 'i'))).toBeNull();

        // 8. Payment QR code label should NOT mention 0% PDP
        expect(screen.queryByText(/0 % DPH – Režim přenesené daňové povinnosti/i)).toBeNull();
      });

      it('one entry isPdp: true with client isPdpDefault: false -> must produce 0% VAT, PDP clause attached', () => {
        const clientNonPdp = CLIENT_STANDARD_VAT; // isPdpDefault: false
        const entry1: WorkEntry = {
          ...sampleStandardEntry,
          id: 'pdp-true-e1',
          date: '2026-04-11',
          clientName: clientNonPdp.name,
          totalEarnings: 5000,
          isPdp: true // explicit true (triggers PDP for the whole protocol)
        };
        const entry2: WorkEntry = {
          ...sampleStandardEntry,
          id: 'pdp-true-e2',
          date: '2026-04-12',
          clientName: clientNonPdp.name,
          totalEarnings: 3000,
          isPdp: false // explicit false
        };
        const entry3: WorkEntry = {
          ...sampleStandardEntry,
          id: 'pdp-true-e3',
          date: '2026-04-13',
          clientName: clientNonPdp.name,
          totalEarnings: 2000,
          isPdp: undefined // falls back to client default (false)
        };

        render(
          <InvoiceReportView 
            entries={[entry1, entry2, entry3]} 
            settings={testSettings} 
          />
        );

        // Grand total: 10 000 Kč
        // 1. Header badge § 92e PDP MUST be present
        expect(screen.getByText('§ 92e PDP (PŘENESENÁ DP)')).toBeDefined();

        // 2. Statutory clause MUST be present
        const clauseElements = screen.getAllByText((content, element) => {
          return element?.textContent?.includes(PDP_STATUTORY_CLAUSE) || false;
        });
        expect(clauseElements.length).toBeGreaterThanOrEqual(1);

        // 3. Switch to Invoice mode
        fireEvent.click(screen.getByRole('button', { name: /Režim: Protokol/i }));

        // 4. Sazba DPH must be 0 % (přenesená DP)
        expect(screen.getByText('0 % (přenesená DP)')).toBeDefined();
        expect(screen.queryByText('21 %')).toBeNull();

        // 5. Výše DPH must be 0 Kč
        const vatZeroElements = screen.getAllByText((content, element) => {
          return element?.textContent?.includes('0') && element?.textContent?.includes('Kč') || false;
        });
        expect(vatZeroElements.length).toBeGreaterThanOrEqual(1);

        // 6. Celkem k úhradě must equal tax base: 10 000 Kč
        const totalElements = screen.getAllByText((content, element) => {
          return element?.textContent?.includes('10') && element?.textContent?.includes('000') && element?.textContent?.includes('Kč') || false;
        });
        expect(totalElements.length).toBeGreaterThanOrEqual(1);

        // 7. Payment QR code label mentions 0% PDP
        expect(screen.getByText(/0 % DPH – Režim přenesené daňové povinnosti/i)).toBeDefined();
      });

      it('correctly calculates PDP with dropdown client filter applied', () => {
        const entryA: WorkEntry = {
          ...sampleStandardEntry,
          id: 'pdp-filter-a',
          date: '2026-04-18',
          clientName: CLIENT_PDP_REVERSE_CHARGE.name,
          totalEarnings: 4000,
          isPdp: false // explicit false on PDP client
        };

        render(
          <InvoiceReportView 
            entries={[entryA]} 
            settings={testSettings} 
          />
        );

        // Even when selecting TechnoMont explicitly in the client dropdown
        const selects = screen.getAllByRole('combobox');
        const clientSelect = selects[1];
        fireEvent.change(clientSelect, { target: { value: CLIENT_PDP_REVERSE_CHARGE.name } });

        // Explicit isPdp: false takes precedence -> No PDP
        expect(screen.queryByText('§ 92e PDP (PŘENESENÁ DP)')).toBeNull();
        expect(screen.queryByText(new RegExp(PDP_STATUTORY_CLAUSE, 'i'))).toBeNull();
      });

      it('dynamically switches PDP regime when switching client filter between mixed entries', () => {
        // Entry for Metrostav (non-PDP client, standard work)
        const entryMetrostav: WorkEntry = {
          ...sampleStandardEntry,
          id: 'dyn-filter-metrostav',
          date: '2026-04-20',
          clientName: CLIENT_STANDARD_VAT.name,
          totalEarnings: 10000,
          isPdp: false
        };

        // Entry for TechnoMont (PDP client, reverse charge work)
        const entryTechnoMont: WorkEntry = {
          ...sampleStandardEntry,
          id: 'dyn-filter-technomont',
          date: '2026-04-21',
          clientName: CLIENT_PDP_REVERSE_CHARGE.name,
          totalEarnings: 20000,
          isPdp: true
        };

        render(
          <InvoiceReportView 
            entries={[entryMetrostav, entryTechnoMont]} 
            settings={testSettings} 
          />
        );

        // 1. In 'all' clients view, since one entry is PDP, document is PDP
        expect(screen.getByText('§ 92e PDP (PŘENESENÁ DP)')).toBeDefined();

        // Switch to Invoice mode
        fireEvent.click(screen.getByRole('button', { name: /Režim: Protokol/i }));
        expect(screen.getByText('0 % (přenesená DP)')).toBeDefined();

        // 2. Filter down to Metrostav DIZ s.r.o.
        const selects = screen.getAllByRole('combobox');
        const clientSelect = selects[1];
        fireEvent.change(clientSelect, { target: { value: CLIENT_STANDARD_VAT.name } });

        // Now only Metrostav entry is in scope (isPdp: false, isPdpDefault: false)
        // Document should switch back to 21% VAT
        expect(screen.queryByText('§ 92e PDP (PŘENESENÁ DP)')).toBeNull();
        expect(screen.getByText('21 %')).toBeDefined();
        expect(screen.queryByText('0 % (přenesená DP)')).toBeNull();

        // 3. Filter down to TechnoMont Industrial s.r.o.
        fireEvent.change(clientSelect, { target: { value: CLIENT_PDP_REVERSE_CHARGE.name } });

        // Document should switch back to 0% PDP
        expect(screen.getByText('§ 92e PDP (PŘENESENÁ DP)')).toBeDefined();
        expect(screen.getByText('0 % (přenesená DP)')).toBeDefined();
      });
    });

    // 6.2 ProjectSection Client Switching & PDP Reactivity in the DOM
    describe('6.2 ProjectSection Client Switching and PDP DOM Reactivity', () => {
      function ProjectSectionTestHarness({
        initialClient = CLIENT_STANDARD_VAT.name,
        initialIsPdp = false,
        clients = CLIENT_FIXTURES
      }: {
        initialClient?: string;
        initialIsPdp?: boolean;
        clients?: typeof CLIENT_FIXTURES;
      }) {
        const initialState = {
          ...createInitialState(null, { clientName: initialClient }, testSettings),
          isPdp: initialIsPdp
        };
        const [state, dispatch] = useReducer(shiftFormReducer, initialState);

        return (
          <div>
            <div data-testid="current-pdp-state">{state.isPdp ? 'PDP_ACTIVE' : 'PDP_INACTIVE'}</div>
            <div data-testid="current-client-state">{state.clientName}</div>
            <ProjectSection
              state={state}
              dispatch={dispatch}
              clientSuggestions={clients.map(c => c.name)}
              projectSuggestions={['Hala-C', 'Projekt-X']}
              clients={clients}
            />
          </div>
        );
      }

      it('dynamically switches PDP on and off when selecting clients with different PDP defaults in DOM', () => {
        render(<ProjectSectionTestHarness />);

        const clientInput = screen.getByPlaceholderText('např. Metrostav DIZ');
        const pdpCheckbox = screen.getByRole('checkbox', { name: /Režim přenesené daňové povinnosti/i }) as HTMLInputElement;

        // 1. Initial state: Metrostav DIZ (non-PDP)
        expect(screen.getByTestId('current-client-state').textContent).toBe(CLIENT_STANDARD_VAT.name);
        expect(screen.getByTestId('current-pdp-state').textContent).toBe('PDP_INACTIVE');
        expect(pdpCheckbox.checked).toBe(false);
        expect(screen.queryByText('PDP aktivní (0 % DPH)')).toBeNull();

        // 2. Switch to TechnoMont (isPdpDefault: true)
        fireEvent.change(clientInput, { target: { value: CLIENT_PDP_REVERSE_CHARGE.name } });
        expect(screen.getByTestId('current-client-state').textContent).toBe(CLIENT_PDP_REVERSE_CHARGE.name);
        expect(screen.getByTestId('current-pdp-state').textContent).toBe('PDP_ACTIVE');
        expect(pdpCheckbox.checked).toBe(true);
        expect(screen.getByText('PDP aktivní (0 % DPH)')).toBeDefined();

        // 3. Switch to Kovo Novák (isPdpDefault: false)
        fireEvent.change(clientInput, { target: { value: CLIENT_KOVO_NOVAK.name } });
        expect(screen.getByTestId('current-client-state').textContent).toBe(CLIENT_KOVO_NOVAK.name);
        expect(screen.getByTestId('current-pdp-state').textContent).toBe('PDP_INACTIVE');
        expect(pdpCheckbox.checked).toBe(false);
        expect(screen.queryByText('PDP aktivní (0 % DPH)')).toBeNull();

        // 4. Manually toggle PDP checkbox for Novák to ON
        fireEvent.click(pdpCheckbox);
        expect(screen.getByTestId('current-pdp-state').textContent).toBe('PDP_ACTIVE');
        expect(pdpCheckbox.checked).toBe(true);
        expect(screen.getByText('PDP aktivní (0 % DPH)')).toBeDefined();

        // 5. Switch back to Metrostav (isPdpDefault: false) -> client switch should reset PDP to false
        fireEvent.change(clientInput, { target: { value: CLIENT_STANDARD_VAT.name } });
        expect(screen.getByTestId('current-client-state').textContent).toBe(CLIENT_STANDARD_VAT.name);
        expect(screen.getByTestId('current-pdp-state').textContent).toBe('PDP_INACTIVE');
        expect(pdpCheckbox.checked).toBe(false);
        expect(screen.queryByText('PDP aktivní (0 % DPH)')).toBeNull();
      });

      it('resets PDP to false when switching to client with undefined isPdpDefault in DOM', () => {
        const clientUndefinedPdp = {
          id: 'client_undef',
          name: 'Stavby Bez Defaultu s.r.o.',
          ico: '99887766',
          address: 'Pražská 10'
          // isPdpDefault is omitted (undefined)
        };

        render(
          <ProjectSectionTestHarness 
            initialClient={CLIENT_PDP_REVERSE_CHARGE.name}
            initialIsPdp={true}
            clients={[...CLIENT_FIXTURES, clientUndefinedPdp]}
          />
        );

        const clientInput = screen.getByPlaceholderText('např. Metrostav DIZ');
        const pdpCheckbox = screen.getByRole('checkbox', { name: /Režim přenesené daňové povinnosti/i }) as HTMLInputElement;

        // Initially PDP is active
        expect(screen.getByTestId('current-pdp-state').textContent).toBe('PDP_ACTIVE');
        expect(pdpCheckbox.checked).toBe(true);

        // Switch to client with undefined isPdpDefault
        fireEvent.change(clientInput, { target: { value: 'Stavby Bez Defaultu s.r.o.' } });
        expect(screen.getByTestId('current-pdp-state').textContent).toBe('PDP_INACTIVE');
        expect(pdpCheckbox.checked).toBe(false);
        expect(screen.queryByText('PDP aktivní (0 % DPH)')).toBeNull();
      });

      it('preserves existing PDP state when user types an unknown custom client in DOM', () => {
        render(
          <ProjectSectionTestHarness 
            initialClient={CLIENT_PDP_REVERSE_CHARGE.name}
            initialIsPdp={true}
          />
        );

        const clientInput = screen.getByPlaceholderText('např. Metrostav DIZ');
        const pdpCheckbox = screen.getByRole('checkbox', { name: /Režim přenesené daňové povinnosti/i }) as HTMLInputElement;

        // Active PDP
        expect(pdpCheckbox.checked).toBe(true);

        // Type unknown custom client
        fireEvent.change(clientInput, { target: { value: 'Zbrusu Nová Firma s.r.o.' } });
        expect(screen.getByTestId('current-client-state').textContent).toBe('Zbrusu Nová Firma s.r.o.');
        // isPdp should remain true (not overwritten by unknown client)
        expect(screen.getByTestId('current-pdp-state').textContent).toBe('PDP_ACTIVE');
        expect(pdpCheckbox.checked).toBe(true);
      });

      it('matches client case-insensitively and trims whitespace in DOM', () => {
        render(<ProjectSectionTestHarness />);

        const clientInput = screen.getByPlaceholderText('např. Metrostav DIZ');
        const pdpCheckbox = screen.getByRole('checkbox', { name: /Režim přenesené daňové povinnosti/i }) as HTMLInputElement;

        // Type lowercase with extra whitespace
        fireEvent.change(clientInput, { target: { value: '  technomont industrial s.r.o.  ' } });
        expect(screen.getByTestId('current-pdp-state').textContent).toBe('PDP_ACTIVE');
        expect(pdpCheckbox.checked).toBe(true);
      });

      it('handles undefined and empty clients prop gracefully without throwing in DOM', () => {
        const initialState = createInitialState(null, { clientName: 'Neznámý' }, testSettings);
        const { unmount } = render(
          <ProjectSection
            state={initialState}
            dispatch={() => {}}
            clientSuggestions={[]}
            projectSuggestions={[]}
            clients={undefined}
          />
        );

        const clientInput = screen.getByPlaceholderText('např. Metrostav DIZ');
        expect(() => {
          fireEvent.change(clientInput, { target: { value: 'Nový Klient' } });
        }).not.toThrow();

        unmount();

        render(
          <ProjectSection
            state={initialState}
            dispatch={() => {}}
            clientSuggestions={[]}
            projectSuggestions={[]}
            clients={[]}
          />
        );

        const clientInput2 = screen.getByPlaceholderText('např. Metrostav DIZ');
        expect(() => {
          fireEvent.change(clientInput2, { target: { value: 'Druhý Klient' } });
        }).not.toThrow();
      });
    });
  });
});
