import { describe, it, expect } from 'vitest';
import { 
  estimateDiet, 
  calculateVatAndTotal, 
  calculateTravelTotal,
  calculateGrandTotal,
  PDP_STATUTORY_CLAUSE,
  formatCurrency,
  formatHours
} from '../src/services/pricingEngine';
import { RatesConfig, AppSettings, WorkEntry } from '../src/types';
import { shiftFormReducer, createInitialState } from '../src/components/form/shiftFormReducer';
import { DEFAULT_SETTINGS } from '../src/db/seedData';
import fs from 'fs';
import path from 'path';

describe('Milestone M1 Adversarial Stress Test Suite', () => {
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

  describe('1. Diet Boundaries & Floating-Point Precision', () => {
    it('tests sub-millisecond and epsilon boundary around 5.0h', () => {
      // Just below 5.0h
      expect(estimateDiet(4.999, defaultRates).allowance).toBe(0);
      expect(estimateDiet(4.999, defaultRates).type).toBe('none');
      expect(estimateDiet(4.9999999999999, defaultRates).allowance).toBe(0);
      expect(estimateDiet(4.9999999999999, defaultRates).type).toBe('none');

      // Exactly 5.0h
      expect(estimateDiet(5.0, defaultRates).allowance).toBe(166);
      expect(estimateDiet(5.0, defaultRates).type).toBe('band_1');

      // Just above 5.0h
      expect(estimateDiet(5.0000000000001, defaultRates).allowance).toBe(166);
      expect(estimateDiet(5.0000000000001, defaultRates).type).toBe('band_1');
      expect(estimateDiet(5.001, defaultRates).allowance).toBe(166);
      expect(estimateDiet(5.001, defaultRates).type).toBe('band_1');
    });

    it('tests sub-millisecond and epsilon boundary around 12.0h', () => {
      // Just below 12.0h
      expect(estimateDiet(11.999, defaultRates).allowance).toBe(166);
      expect(estimateDiet(11.999, defaultRates).type).toBe('band_1');
      expect(estimateDiet(11.9999999999999, defaultRates).allowance).toBe(166);
      expect(estimateDiet(11.9999999999999, defaultRates).type).toBe('band_1');

      // Exactly 12.0h (statutory band 1: up to 12.0h inclusive)
      expect(estimateDiet(12.0, defaultRates).allowance).toBe(166);
      expect(estimateDiet(12.0, defaultRates).type).toBe('band_1');

      // Just above 12.0h (statutory band 2: > 12.0h)
      expect(estimateDiet(12.0000000000001, defaultRates).allowance).toBe(256);
      expect(estimateDiet(12.0000000000001, defaultRates).type).toBe('band_2');
      expect(estimateDiet(12.001, defaultRates).allowance).toBe(256);
      expect(estimateDiet(12.001, defaultRates).type).toBe('band_2');
    });

    it('tests sub-millisecond and epsilon boundary around 18.0h', () => {
      // Just below 18.0h
      expect(estimateDiet(17.999, defaultRates).allowance).toBe(256);
      expect(estimateDiet(17.999, defaultRates).type).toBe('band_2');
      expect(estimateDiet(17.9999999999999, defaultRates).allowance).toBe(256);
      expect(estimateDiet(17.9999999999999, defaultRates).type).toBe('band_2');

      // Exactly 18.0h (statutory band 2: up to 18.0h inclusive)
      expect(estimateDiet(18.0, defaultRates).allowance).toBe(256);
      expect(estimateDiet(18.0, defaultRates).type).toBe('band_2');

      // Just above 18.0h (statutory band 3: > 18.0h)
      expect(estimateDiet(18.0000000000001, defaultRates).allowance).toBe(398);
      expect(estimateDiet(18.0000000000001, defaultRates).type).toBe('band_3');
      expect(estimateDiet(18.001, defaultRates).allowance).toBe(398);
      expect(estimateDiet(18.001, defaultRates).type).toBe('band_3');
    });

    it('handles extreme, zero, and negative durations without throwing or NaN', () => {
      expect(estimateDiet(0, defaultRates)).toEqual({ allowance: 0, type: 'none', description: 'Bez nároku (< 5 h)' });
      expect(estimateDiet(-0.0001, defaultRates)).toEqual({ allowance: 0, type: 'none', description: 'Bez nároku (< 5 h)' });
      expect(estimateDiet(-5, defaultRates)).toEqual({ allowance: 0, type: 'none', description: 'Bez nároku (< 5 h)' });
      expect(estimateDiet(-1000, defaultRates)).toEqual({ allowance: 0, type: 'none', description: 'Bez nároku (< 5 h)' });
      expect(estimateDiet(100, defaultRates)).toEqual({ allowance: 398, type: 'band_3', description: 'nad 18 h (Pásmo 3)' });
      expect(estimateDiet(9999, defaultRates)).toEqual({ allowance: 398, type: 'band_3', description: 'nad 18 h (Pásmo 3)' });
      expect(estimateDiet(NaN, defaultRates)).toEqual({ allowance: 0, type: 'none', description: 'Bez nároku (< 5 h)' });
      expect(estimateDiet(Infinity, defaultRates).type).toBe('band_3');
      expect(estimateDiet(-Infinity, defaultRates).type).toBe('none');
    });
  });

  describe('2. Rate Combinations, Fallback Precedence & Zero Rates', () => {
    it('prioritizes dietBandXRate over legacy dietHalfDayRate/dietFullDayRate/dietOver18Rate', () => {
      const mixedRates: RatesConfig = {
        ...defaultRates,
        dietBand1Rate: 199,
        dietHalfDayRate: 166,
        dietBand2Rate: 299,
        dietFullDayRate: 256,
        dietBand3Rate: 499,
        dietOver18Rate: 398
      };

      expect(estimateDiet(6, mixedRates).allowance).toBe(199);
      expect(estimateDiet(13, mixedRates).allowance).toBe(299);
      expect(estimateDiet(20, mixedRates).allowance).toBe(499);
    });

    it('falls back to legacy rates when dietBandXRate is undefined', () => {
      const legacyRates: RatesConfig = {
        ...defaultRates,
        dietBand1Rate: undefined,
        dietHalfDayRate: 175,
        dietBand2Rate: undefined,
        dietFullDayRate: 275,
        dietBand3Rate: undefined,
        dietOver18Rate: 415
      };

      expect(estimateDiet(6, legacyRates).allowance).toBe(175);
      expect(estimateDiet(13, legacyRates).allowance).toBe(275);
      expect(estimateDiet(20, legacyRates).allowance).toBe(415);
    });

    it('falls back to statutory defaults (166, 256, 398) when all rate fields are undefined', () => {
      const strippedRates = { surcharges: defaultRates.surcharges } as unknown as RatesConfig;

      expect(estimateDiet(6, strippedRates).allowance).toBe(166);
      expect(estimateDiet(13, strippedRates).allowance).toBe(256);
      expect(estimateDiet(20, strippedRates).allowance).toBe(398);
    });

    it('preserves explicit 0 Kč rates without falling back to defaults (nullish coalescing check)', () => {
      const zeroRates: RatesConfig = {
        ...defaultRates,
        dietBand1Rate: 0,
        dietBand2Rate: 0,
        dietBand3Rate: 0
      };

      // In JS, 0 ?? 166 evaluates to 0
      expect(estimateDiet(6, zeroRates).allowance).toBe(0);
      expect(estimateDiet(13, zeroRates).allowance).toBe(0);
      expect(estimateDiet(20, zeroRates).allowance).toBe(0);
    });
  });

  describe('3. Diet Manual Override & State Transitions', () => {
    const mockSettings: AppSettings = DEFAULT_SETTINGS;

    it('allows setting custom rate to 0 Kč in manual override mode', () => {
      const state = createInitialState(null, null, mockSettings);
      
      const manualZeroState = shiftFormReducer(state, {
        type: 'SET_DIET',
        dietType: 'custom',
        allowance: 0,
        isManual: true
      });

      expect(manualZeroState.dietType).toBe('custom');
      expect(manualZeroState.dietAllowance).toBe(0);
      expect(manualZeroState.customDietRate).toBe(0);
      expect(manualZeroState.isManualDiet).toBe(true);
      expect(manualZeroState.dietBandApplied).toBe('custom');
    });

    it('handles negative custom allowance gracefully in reducer and calculation', () => {
      const state = createInitialState(null, null, mockSettings);
      
      const negativeState = shiftFormReducer(state, {
        type: 'SET_DIET',
        dietType: 'custom',
        allowance: -50,
        isManual: true
      });

      expect(negativeState.dietAllowance).toBe(-50);
      
      // Check travel total computation with negative diet (e.g. deduction)
      const travelTotal = calculateTravelTotal(0, 11, 0, 350, negativeState.dietAllowance);
      expect(travelTotal).toBe(-50);
    });

    it('preserves custom rate when toggled on, and resets when toggling band button', () => {
      let state = createInitialState(null, null, mockSettings);
      
      // Step 1: User sets custom rate of 120 Kč (lunch deducted)
      state = shiftFormReducer(state, {
        type: 'SET_DIET',
        dietType: 'custom',
        allowance: 120,
        isManual: true
      });
      expect(state.isManualDiet).toBe(true);
      expect(state.customDietRate).toBe(120);

      // Step 2: User manually clicks Band 3 button (should clear isManualDiet)
      state = shiftFormReducer(state, {
        type: 'SET_DIET',
        dietType: 'band_3',
        allowance: 398,
        isManual: false
      });
      expect(state.isManualDiet).toBe(false);
      expect(state.dietType).toBe('band_3');
      expect(state.dietAllowance).toBe(398);
      expect(state.dietBandApplied).toBe('band_3');
    });

    it('initializes correctly from existing entry with legacy dietType "full_day"', () => {
      const mockEntry: WorkEntry = {
        id: 'legacy-entry',
        date: '2026-02-01',
        projectCode: 'LEGACY',
        projectName: 'Legacy Project',
        clientName: 'Metrostav DIZ s.r.o.',
        workType: 'workshop_welding',
        startTime: '06:00',
        endTime: '19:00',
        breakMinutes: 30,
        totalHours: 12.5,
        pricing: { baseHourlyRate: 480, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 480 },
        travel: {
          distanceKm: 0,
          ratePerKm: 11,
          travelTimeHours: 0,
          travelHourlyRate: 350,
          dietAllowance: 256,
          dietType: 'full_day' as any // legacy value
        },
        extraCosts: [],
        totalEarnings: 6000,
        status: 'draft',
        notes: '',
        createdAt: '2026-02-01',
        updatedAt: '2026-02-01'
      };

      const state = createInitialState(mockEntry, null, mockSettings);
      expect(state.dietType).toBe('full_day');
      expect(state.dietAllowance).toBe(256);
      expect(state.dietBandApplied).toBe('band_2'); // normalized from full_day
      expect(state.isManualDiet).toBe(false);
    });
  });

  describe('4. § 92e PDP Calculations, Rounding & Statutory Text', () => {
    it('verifies exact statutory clause text against ORIGINAL_REQUEST.md', () => {
      const originalReqPath = path.resolve(__dirname, '../ORIGINAL_REQUEST.md');
      const originalReqContent = fs.readFileSync(originalReqPath, 'utf8');

      // Expect original request to contain the exact statutory formulation
      expect(originalReqContent).toContain(PDP_STATUTORY_CLAUSE);

      // Verify character codes of statutory clause (specifically the en-dash U+2013)
      const expectedText = "Daň odvede zákazník – režim přenesené daňové povinnosti dle § 92e zákona o DPH";
      expect(PDP_STATUTORY_CLAUSE).toBe(expectedText);
      expect(PDP_STATUTORY_CLAUSE.charCodeAt(20)).toBe(8211); // en-dash U+2013
    });

    it('calculates zero base correctly in PDP mode', () => {
      const res = calculateVatAndTotal(0, true);
      expect(res.taxBase).toBe(0);
      expect(res.vatRatePercent).toBe(0);
      expect(res.vatAmount).toBe(0);
      expect(res.totalWithVat).toBe(0);
      expect(res.isPdp).toBe(true);
      expect(res.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);
    });

    it('calculates large amounts without precision loss in PDP mode', () => {
      const largeBase = 25_000_000;
      const res = calculateVatAndTotal(largeBase, true);
      expect(res.taxBase).toBe(largeBase);
      expect(res.vatRatePercent).toBe(0);
      expect(res.vatAmount).toBe(0);
      expect(res.totalWithVat).toBe(largeBase);
      expect(res.isPdp).toBe(true);
    });

    it('handles decimal amounts with correct rounding', () => {
      // When tax base is fractional, it rounds to nearest integer
      const resPdp = calculateVatAndTotal(12345.67, true);
      expect(resPdp.taxBase).toBe(12346);
      expect(resPdp.totalWithVat).toBe(12346);
      expect(resPdp.vatAmount).toBe(0);

      const resStd = calculateVatAndTotal(12345.67, false, 21);
      expect(resStd.taxBase).toBe(12346);
      // 12346 * 0.21 = 2592.66 -> 2593
      expect(resStd.vatAmount).toBe(2593);
      expect(resStd.totalWithVat).toBe(12346 + 2593);
    });

    it('stress tests calculateVatAndTotal across 1,000 randomized tax bases', () => {
      for (let i = 0; i < 1000; i++) {
        const randomAmount = Math.random() * 1000000;
        const roundedBase = Math.round(randomAmount);
        
        // PDP Mode
        const pdpRes = calculateVatAndTotal(randomAmount, true);
        expect(pdpRes.taxBase).toBe(roundedBase);
        expect(pdpRes.vatRatePercent).toBe(0);
        expect(pdpRes.vatAmount).toBe(0);
        expect(pdpRes.totalWithVat).toBe(roundedBase);
        expect(pdpRes.isPdp).toBe(true);
        expect(pdpRes.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);

        // Standard Mode
        const stdRes = calculateVatAndTotal(randomAmount, false, 21);
        expect(stdRes.taxBase).toBe(roundedBase);
        expect(stdRes.vatRatePercent).toBe(21);
        expect(stdRes.vatAmount).toBe(Math.round(roundedBase * 0.21));
        expect(stdRes.totalWithVat).toBe(roundedBase + Math.round(roundedBase * 0.21));
        expect(stdRes.isPdp).toBe(false);
      }
    }, 15000);
  });

  describe('5. Integration with Grand Total and Travel Total', () => {
    it('correctly incorporates 3-tier diets into travel total and grand total', () => {
      const travelTotalBand1 = calculateTravelTotal(100, 10, 2, 300, 166);
      // 100 * 10 + 2 * 300 + 166 = 1000 + 600 + 166 = 1766
      expect(travelTotalBand1).toBe(1766);

      const travelTotalBand3 = calculateTravelTotal(100, 10, 2, 300, 398);
      // 100 * 10 + 2 * 300 + 398 = 1000 + 600 + 398 = 1998
      expect(travelTotalBand3).toBe(1998);

      const entry = {
        totalHours: 10,
        pricing: { calculatedHourlyRate: 500 },
        travel: {
          distanceKm: 100,
          ratePerKm: 10,
          travelTimeHours: 2,
          travelHourlyRate: 300,
          dietAllowance: 398
        },
        extraCosts: []
      };

      // Grand total = 10 * 500 + 1998 = 5000 + 1998 = 6998
      expect(calculateGrandTotal(entry)).toBe(6998);
    });

    it('verifies formatCurrency and formatHours helpers', () => {
      expect(formatHours(8.5)).toBe('8,5 h');
      expect(formatHours(12)).toBe('12,0 h');
      expect(formatHours(0)).toBe('0,0 h');

      const formatted = formatCurrency(12450);
      expect(formatted).toContain('12');
      expect(formatted).toContain('450');
      expect(formatted).toContain('Kč');
    });
  });
});
