import { describe, it, expect } from 'vitest';
import { 
  estimateDiet, 
  normalizeDietType, 
  calculateVatAndTotal, 
  PDP_STATUTORY_CLAUSE 
} from '../src/services/pricingEngine';
import { RatesConfig, AppSettings, WorkEntry } from '../src/types';
import { shiftFormReducer, createInitialState } from '../src/components/form/shiftFormReducer';
import { DEFAULT_SETTINGS } from '../src/db/seedData';

describe('Milestone M1: Czech Legislation (MPSV Diets & § 92e PDP)', () => {
  const defaultRates: RatesConfig = {
    defaultWorkshopRate: 480,
    defaultSiteAssemblyRate: 620,
    defaultEmergencyRate: 850,
    defaultTravelOnlyRate: 350,
    defaultRatePerKm: 11,
    defaultTravelHourlyRate: 350,
    dietHalfDayRate: 166,
    dietFullDayRate: 256,
    dietOver18Rate: 398,
    surcharges: {
      weekendPercent: 25,
      nightPercent: 20,
      holidayPercent: 50,
      fixedWeekendBonus: 120,
      fixedNightBonus: 100,
      fixedHolidayBonus: 250,
      useFixedBonus: false
    }
  };

  describe('MPSV 3-Tier Meal Allowance Engine (estimateDiet)', () => {
    it('returns 0 Kč for duration under 5.0 hours (boundary: 4.9h)', () => {
      const res = estimateDiet(4.9, defaultRates);
      expect(res.allowance).toBe(0);
      expect(res.type).toBe('none');
      expect(res.description).toContain('< 5 h');
    });

    it('returns Band 1 (166 Kč) at exactly 5.0 hours', () => {
      const res = estimateDiet(5.0, defaultRates);
      expect(res.allowance).toBe(166);
      expect(res.type).toBe('band_1');
      expect(res.description).toContain('Pásmo 1');
    });

    it('returns Band 1 (166 Kč) at upper boundary 12.0 hours', () => {
      const res = estimateDiet(12.0, defaultRates);
      expect(res.allowance).toBe(166);
      expect(res.type).toBe('band_1');
    });

    it('returns Band 2 (256 Kč) just above 12.0 hours (boundary: 12.01h and 12.1h)', () => {
      const res1201 = estimateDiet(12.01, defaultRates);
      expect(res1201.allowance).toBe(256);
      expect(res1201.type).toBe('band_2');

      const res121 = estimateDiet(12.1, defaultRates);
      expect(res121.allowance).toBe(256);
      expect(res121.type).toBe('band_2');
      expect(res121.description).toContain('Pásmo 2');
    });

    it('returns Band 2 (256 Kč) at upper boundary 18.0 hours', () => {
      const res = estimateDiet(18.0, defaultRates);
      expect(res.allowance).toBe(256);
      expect(res.type).toBe('band_2');
    });

    it('returns Band 3 (398 Kč) just above 18.0 hours (boundary: 18.01h and 18.1h)', () => {
      const res1801 = estimateDiet(18.01, defaultRates);
      expect(res1801.allowance).toBe(398);
      expect(res1801.type).toBe('band_3');

      const res181 = estimateDiet(18.1, defaultRates);
      expect(res181.allowance).toBe(398);
      expect(res181.type).toBe('band_3');
      expect(res181.description).toContain('Pásmo 3');
    });

    it('returns Band 3 (398 Kč) for 24h shifts', () => {
      const res = estimateDiet(24.0, defaultRates);
      expect(res.allowance).toBe(398);
      expect(res.type).toBe('band_3');
    });

    it('respects custom band rates override when provided', () => {
      const customRates: RatesConfig = {
        ...defaultRates,
        dietBand1Rate: 180,
        dietBand2Rate: 280,
        dietBand3Rate: 420
      };

      expect(estimateDiet(6, customRates).allowance).toBe(180);
      expect(estimateDiet(14, customRates).allowance).toBe(280);
      expect(estimateDiet(20, customRates).allowance).toBe(420);
    });

    it('handles combined shift and driving duration correctly', () => {
      // 4.0h shift + 1.5h driving = 5.5h -> Band 1
      const res1 = estimateDiet(4.0 + 1.5, defaultRates);
      expect(res1.allowance).toBe(166);
      expect(res1.type).toBe('band_1');

      // 9.5h shift + 3.0h driving = 12.5h -> Band 2
      const res2 = estimateDiet(9.5 + 3.0, defaultRates);
      expect(res2.allowance).toBe(256);
      expect(res2.type).toBe('band_2');

      // 14.0h shift + 4.5h driving = 18.5h -> Band 3
      const res3 = estimateDiet(14.0 + 4.5, defaultRates);
      expect(res3.allowance).toBe(398);
      expect(res3.type).toBe('band_3');
    });

    it('guards against negative, zero, and NaN durations', () => {
      expect(estimateDiet(0, defaultRates).allowance).toBe(0);
      expect(estimateDiet(-5, defaultRates).allowance).toBe(0);
      expect(estimateDiet(NaN, defaultRates).allowance).toBe(0);
    });
  });

  describe('Diet Type Normalization (normalizeDietType)', () => {
    it('maps legacy types to statutory bands', () => {
      expect(normalizeDietType('half_day')).toBe('band_1');
      expect(normalizeDietType('full_day')).toBe('band_2');
    });

    it('preserves modern statutory band codes', () => {
      expect(normalizeDietType('band_1')).toBe('band_1');
      expect(normalizeDietType('band_2')).toBe('band_2');
      expect(normalizeDietType('band_3')).toBe('band_3');
      expect(normalizeDietType('custom')).toBe('custom');
      expect(normalizeDietType('none')).toBe('none');
    });

    it('handles falsy or unknown inputs safely', () => {
      expect(normalizeDietType(undefined)).toBe('none');
      expect(normalizeDietType('')).toBe('none');
      expect(normalizeDietType('invalid_band')).toBe('none');
    });
  });

  describe('§ 92e PDP Reverse Charge Engine (calculateVatAndTotal)', () => {
    it('calculates 0% VAT and attaches statutory clause when isPdp is true', () => {
      const res = calculateVatAndTotal(10000, true);
      expect(res.taxBase).toBe(10000);
      expect(res.vatRatePercent).toBe(0);
      expect(res.vatAmount).toBe(0);
      expect(res.totalWithVat).toBe(10000);
      expect(res.isPdp).toBe(true);
      expect(res.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);
      expect(res.statutoryClause).toBe(
        'Daň odvede zákazník – režim přenesené daňové povinnosti dle § 92e zákona o DPH'
      );
    });

    it('calculates standard 21% VAT when isPdp is false', () => {
      const res = calculateVatAndTotal(10000, false);
      expect(res.taxBase).toBe(10000);
      expect(res.vatRatePercent).toBe(21);
      expect(res.vatAmount).toBe(2100);
      expect(res.totalWithVat).toBe(12100);
      expect(res.isPdp).toBe(false);
      expect(res.statutoryClause).toBeUndefined();
    });

    it('handles rounding on odd amounts correctly for standard VAT', () => {
      // 9537 * 0.21 = 2002.77 -> 2003
      const res = calculateVatAndTotal(9537, false, 21);
      expect(res.taxBase).toBe(9537);
      expect(res.vatAmount).toBe(2003);
      expect(res.totalWithVat).toBe(9537 + 2003);
    });

    it('supports custom standard VAT rate percentages', () => {
      const res = calculateVatAndTotal(50000, false, 12);
      expect(res.vatRatePercent).toBe(12);
      expect(res.vatAmount).toBe(6000);
      expect(res.totalWithVat).toBe(56000);
    });
  });

  describe('Shift Form Reducer & M1 State Management', () => {
    const mockSettings: AppSettings = DEFAULT_SETTINGS;

    it('initializes isPdp from client default profile (Metrostav DIZ isPdpDefault: true)', () => {
      const initialState = createInitialState(null, { clientName: 'Metrostav DIZ s.r.o.' }, mockSettings);
      expect(initialState.isPdp).toBe(true);
    });

    it('initializes isPdp as false when client has no isPdpDefault', () => {
      const initialState = createInitialState(
        null, 
        { clientName: 'KovoVýroba & Zámečnictví Novák s.r.o.' }, 
        mockSettings
      );
      expect(initialState.isPdp).toBe(false);
    });

    it('preserves existing entry isPdp state over client default', () => {
      const mockEntry: WorkEntry = {
        ...mockSettings.clients[0] as any,
        id: 'entry-override',
        date: '2026-03-10',
        projectCode: 'TEST',
        projectName: 'Test',
        clientName: 'Metrostav DIZ s.r.o.',
        workType: 'site_assembly',
        startTime: '08:00',
        endTime: '16:00',
        breakMinutes: 30,
        totalHours: 7.5,
        pricing: { baseHourlyRate: 600, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 600 },
        travel: { distanceKm: 0, ratePerKm: 11, travelTimeHours: 0, travelHourlyRate: 350, dietAllowance: 166, dietType: 'band_1' },
        extraCosts: [],
        totalEarnings: 4500,
        status: 'draft',
        notes: '',
        createdAt: '2026-03-10',
        updatedAt: '2026-03-10',
        isPdp: false // explicitly false even though Metrostav default is true
      };

      const state = createInitialState(mockEntry, null, mockSettings);
      expect(state.isPdp).toBe(false);
    });

    it('updates diet and band tracking via SET_DIET action', () => {
      const state = createInitialState(null, null, mockSettings);
      
      const nextState = shiftFormReducer(state, {
        type: 'SET_DIET',
        dietType: 'band_2',
        allowance: 256,
        isManual: false
      });

      expect(nextState.dietType).toBe('band_2');
      expect(nextState.dietAllowance).toBe(256);
      expect(nextState.dietBandApplied).toBe('band_2');
      expect(nextState.isManualDiet).toBe(false);
    });

    it('handles manual diet override and custom rate in SET_DIET action', () => {
      const state = createInitialState(null, null, mockSettings);
      
      const customState = shiftFormReducer(state, {
        type: 'SET_DIET',
        dietType: 'custom',
        allowance: 120, // e.g. reduced allowance after deduction for lunch
        isManual: true
      });

      expect(customState.dietType).toBe('custom');
      expect(customState.dietAllowance).toBe(120);
      expect(customState.isManualDiet).toBe(true);
      expect(customState.customDietRate).toBe(120);
    });

    it('allows toggling isPdp via SET_FIELD action', () => {
      const state = createInitialState(null, null, mockSettings);
      expect(state.isPdp).toBe(true); // default Metrostav is true

      const toggledOff = shiftFormReducer(state, {
        type: 'SET_FIELD',
        field: 'isPdp',
        value: false
      });
      expect(toggledOff.isPdp).toBe(false);

      const toggledOn = shiftFormReducer(toggledOff, {
        type: 'SET_FIELD',
        field: 'isPdp',
        value: true
      });
      expect(toggledOn.isPdp).toBe(true);
    });

    it('pre-fills statutory diet in createInitialState for brand new shift (07:00-16:00, 30m break = 8.5h -> Band 1)', () => {
      const state = createInitialState(null, null, mockSettings);
      expect(state.dietType).toBe('band_1');
      expect(state.dietAllowance).toBe(166);
      expect(state.dietBandApplied).toBe('band_1');
      expect(state.isManualDiet).toBe(false);
    });

    it('preserves saved entry diet without overriding in createInitialState', () => {
      const savedEntry: WorkEntry = {
        id: 'saved-entry-diet-0',
        date: '2026-03-12',
        projectCode: 'SAVED',
        projectName: 'Saved Project',
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
        createdAt: '2026-03-12',
        updatedAt: '2026-03-12',
        isPdp: true
      };

      const state = createInitialState(savedEntry, null, mockSettings);
      expect(state.dietType).toBe('none');
      expect(state.dietAllowance).toBe(0);
      expect(state.dietBandApplied).toBe('none');
      expect(state.isManualDiet).toBe(false);
    });
  });
});
