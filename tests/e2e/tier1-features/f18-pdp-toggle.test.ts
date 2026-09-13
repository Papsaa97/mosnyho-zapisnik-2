import { describe, it, expect } from 'vitest';
import { 
  calculateVatAndTotal, 
  VatCalculationResult 
} from '../../../src/services/pricingEngine';
import { shiftFormReducer, createInitialState } from '../../../src/components/form/shiftFormReducer';
import { DEFAULT_SETTINGS } from '../../../src/db/seedData';
import { 
  CLIENT_STANDARD_VAT, 
  CLIENT_PDP_REVERSE_CHARGE 
} from '../../fixtures/clients.fixture';
import { WorkEntry, AppSettings } from '../../../src/types';

/**
 * Feature 18: § 92e PDP Toggle
 * 
 * Requirements:
 * - Toggle reverse charge mode (přenesená daňová povinnost) per client, shift, and protocol
 * - Computation of 0% VAT (0 Kč) when PDP is active, preserving tax base as total
 * - Standard VAT calculation (21% default) when PDP is inactive
 * - Client profile default inheritance (isPdpDefault: true triggers isPdp: true on new shifts)
 * - Explicit entry override takes precedence over client default
 * - Shift form reducer toggles isPdp seamlessly via SET_FIELD action
 * - Document-level resolution for combined handover protocols / invoices
 */
describe('Feature 18: § 92e PDP Toggle', () => {
  const settings: AppSettings = DEFAULT_SETTINGS;

  // Test 1: Zero VAT computation when isPdp is true
  it('computes 0% VAT and total equal to tax base when isPdp is active', () => {
    const amounts = [1000, 8500, 15340, 125000];

    for (const amount of amounts) {
      const result: VatCalculationResult = calculateVatAndTotal(amount, true);
      expect(result.isPdp).toBe(true);
      expect(result.taxBase).toBe(amount);
      expect(result.vatRatePercent).toBe(0);
      expect(result.vatAmount).toBe(0);
      expect(result.totalWithVat).toBe(amount);
    }
  });

  // Test 2: Standard VAT computation when isPdp is false
  it('computes standard 21% VAT and adds it to total when isPdp is inactive', () => {
    const base10k = 10000;
    const res10k = calculateVatAndTotal(base10k, false, 21);
    expect(res10k.isPdp).toBe(false);
    expect(res10k.taxBase).toBe(10000);
    expect(res10k.vatRatePercent).toBe(21);
    expect(res10k.vatAmount).toBe(2100);
    expect(res10k.totalWithVat).toBe(12100);

    // Test rounding on uneven amount: 9537 * 0.21 = 2002.77 -> 2003
    const baseUneven = 9537;
    const resUneven = calculateVatAndTotal(baseUneven, false, 21);
    expect(resUneven.vatAmount).toBe(2003);
    expect(resUneven.totalWithVat).toBe(9537 + 2003);
  });

  // Test 3: Inheritance of isPdpDefault from client profile
  it('initializes isPdp: true for clients configured with isPdpDefault: true', () => {
    // Metrostav DIZ is defined with isPdpDefault: true in DEFAULT_SETTINGS
    const stateMetrostav = createInitialState(
      null, 
      { clientName: 'Metrostav DIZ s.r.o.' }, 
      settings
    );
    expect(stateMetrostav.isPdp).toBe(true);

    // KovoVýroba Novák is defined with isPdpDefault: false
    const stateNovak = createInitialState(
      null, 
      { clientName: 'KovoVýroba & Zámečnictví Novák s.r.o.' }, 
      settings
    );
    expect(stateNovak.isPdp).toBe(false);
  });

  // Test 4: Explicit entry value overrides client default
  it('preserves existing entry isPdp state even if it differs from client default', () => {
    // Existing entry has isPdp: false for Metrostav DIZ (which normally defaults to true)
    const existingEntryFalse: WorkEntry = {
      id: 'entry-pdp-false',
      date: '2026-03-01',
      projectCode: 'TEST',
      projectName: 'Test',
      clientName: 'Metrostav DIZ s.r.o.',
      workType: 'workshop_welding',
      startTime: '08:00',
      endTime: '16:00',
      breakMinutes: 30,
      totalHours: 7.5,
      pricing: { baseHourlyRate: 500, complexityMultiplier: 1.0, shiftSurcharges: [], calculatedHourlyRate: 500 },
      travel: { distanceKm: 0, ratePerKm: 11, travelTimeHours: 0, travelHourlyRate: 350, dietAllowance: 166 },
      extraCosts: [],
      totalEarnings: 3750,
      status: 'draft',
      notes: '',
      isPdp: false, // explicitly false
      createdAt: '2026-03-01',
      updatedAt: '2026-03-01',
    };

    const state = createInitialState(existingEntryFalse, null, settings);
    expect(state.isPdp).toBe(false);

    // Existing entry has isPdp: true for non-PDP client
    const existingEntryTrue: WorkEntry = {
      ...existingEntryFalse,
      id: 'entry-pdp-true',
      clientName: 'KovoVýroba & Zámečnictví Novák s.r.o.',
      isPdp: true,
    };
    const stateTrue = createInitialState(existingEntryTrue, null, settings);
    expect(stateTrue.isPdp).toBe(true);
  });

  // Test 5: Dynamic toggle in shift form reducer
  it('allows toggling isPdp state dynamically via SET_FIELD action', () => {
    const state = createInitialState(null, { clientName: 'Metrostav DIZ s.r.o.' }, settings);
    expect(state.isPdp).toBe(true);

    const toggledOff = shiftFormReducer(state, {
      type: 'SET_FIELD',
      field: 'isPdp',
      value: false,
    });
    expect(toggledOff.isPdp).toBe(false);

    const toggledOn = shiftFormReducer(toggledOff, {
      type: 'SET_FIELD',
      field: 'isPdp',
      value: true,
    });
    expect(toggledOn.isPdp).toBe(true);
  });

  // Test 6: Document-level PDP resolution logic
  it('resolves document as PDP if any entry or client specifies PDP reverse charge', () => {
    const entryStandard: Partial<WorkEntry> = { isPdp: false, totalEarnings: 5000 };
    const entryPdp: Partial<WorkEntry> = { isPdp: true, totalEarnings: 7500 };

    // Helper simulating InvoiceReportView resolution logic
    const resolveDocumentPdp = (
      entries: Partial<WorkEntry>[], 
      client?: { isPdp?: boolean; isPdpDefault?: boolean }
    ): boolean => {
      return entries.some(e => e.isPdp) || !!client?.isPdpDefault || !!client?.isPdp;
    };

    // Both entries standard, client standard -> false
    expect(resolveDocumentPdp([entryStandard], CLIENT_STANDARD_VAT)).toBe(false);

    // One PDP entry -> true
    expect(resolveDocumentPdp([entryStandard, entryPdp], CLIENT_STANDARD_VAT)).toBe(true);

    // All standard entries, but client has PDP default -> true
    expect(resolveDocumentPdp([entryStandard], CLIENT_PDP_REVERSE_CHARGE)).toBe(true);
  });
});
