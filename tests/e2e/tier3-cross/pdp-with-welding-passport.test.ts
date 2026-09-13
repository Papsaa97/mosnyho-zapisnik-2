import { describe, it, expect } from 'vitest';
import {
  calculateVatAndTotal,
  PDP_STATUTORY_CLAUSE,
} from '../../../src/services/pricingEngine';
import {
  CLIENT_PDP_REVERSE_CHARGE,
  CLIENT_STANDARD_VAT,
} from '../../fixtures/clients.fixture';
import {
  WeldingPassport,
  SAMPLE_WELDING_PASSPORT_TIG,
  SAMPLE_WELDING_PASSPORT_MAG,
  SCENARIO_1_BRIDGE_RAILINGS,
} from '../../fixtures/shifts.fixture';

describe('Tier 3 Cross-Feature: § 92e PDP with Welding Passport (pdp-with-welding-passport.test.ts)', () => {
  // 1. Svářečský pasport EN 1090 with § 92e PDP Active
  it('combines technical EN 1090 welding passport with § 92e PDP reverse charge mode', () => {
    const shift = SCENARIO_1_BRIDGE_RAILINGS;
    expect(shift.isPdp).toBe(true);
    expect(shift.weldingPassport).toBeDefined();

    // Verify welding passport compliance
    const passport: WeldingPassport = shift.weldingPassport!;
    expect(passport.methodCode).toBe('141');
    expect(passport.baseMaterialGrade).toContain('S355');
    expect(passport.shieldingGas).toContain('Argon');
    expect(passport.fillerBatch).toContain('Böhler');
    expect(passport.weldInspectionVT).toBe('passed_B');

    // Verify PDP financial calculation
    const vatCalc = calculateVatAndTotal(shift.totalEarnings, shift.isPdp, 21);
    expect(vatCalc.isPdp).toBe(true);
    expect(vatCalc.vatRatePercent).toBe(0);
    expect(vatCalc.vatAmount).toBe(0);
    expect(vatCalc.totalWithVat).toBe(vatCalc.taxBase);
    expect(vatCalc.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);
    expect(vatCalc.statutoryClause).toContain('režim přenesené daňové povinnosti dle § 92e');
  });

  // 2. Technical Welding Passport with Standard 21% VAT (Non-PDP)
  it('verifies welding passport under standard commercial client (21% VAT, non-PDP)', () => {
    const passport: WeldingPassport = SAMPLE_WELDING_PASSPORT_MAG;
    const client = CLIENT_STANDARD_VAT; // isPdp: false
    const laborAmount = 15000;

    const vatCalc = calculateVatAndTotal(laborAmount, client.isPdp, 21);
    expect(vatCalc.isPdp).toBe(false);
    expect(vatCalc.vatRatePercent).toBe(21);
    expect(vatCalc.vatAmount).toBe(3150); // 15000 * 0.21
    expect(vatCalc.totalWithVat).toBe(18150);
    expect(vatCalc.statutoryClause).toBeUndefined();

    // Verify MAG technical parameters remain intact
    expect(passport.methodCode).toBe('135');
    expect(passport.shieldingGas).toContain('CORGON');
    expect(passport.baseMaterialGrade).toBe('S355J2+N');
  });

  // 3. Locksmith Assembly without Welding (methodCode: 'NONE') on PDP Client
  it('handles locksmith work with method NONE while preserving § 92e PDP reverse charge', () => {
    const passport: WeldingPassport = {
      methodCode: 'NONE',
      methodName: 'Zámečnická montáž bez svařování',
      baseMaterialGrade: 'Konstrukční ocel S235JR',
      materialThickness: '5.0 mm',
      shieldingGas: 'Není požadován',
      fillerBatch: 'Není požadován',
      rootBackingGas: false,
      weldInspectionVT: 'not_required',
    };

    const client = CLIENT_PDP_REVERSE_CHARGE;
    const billedAmount = 8500;

    const vatCalc = calculateVatAndTotal(billedAmount, client.isPdp, 21);
    expect(vatCalc.isPdp).toBe(true);
    expect(vatCalc.vatAmount).toBe(0);
    expect(vatCalc.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);
    expect(passport.methodCode).toBe('NONE');
    expect(passport.weldInspectionVT).toBe('not_required');
  });

  // 4. Dynamic PDP Toggle Preservation
  it('verifies that toggling PDP recalculates taxes while preserving technical passport data completely', () => {
    const passport: WeldingPassport = SAMPLE_WELDING_PASSPORT_TIG;
    const taxBase = 20000;

    // Initially PDP is false
    const nonPdp = calculateVatAndTotal(taxBase, false, 21);
    expect(nonPdp.vatAmount).toBe(4200);
    expect(nonPdp.totalWithVat).toBe(24200);

    // Toggle PDP to true
    const pdp = calculateVatAndTotal(taxBase, true, 21);
    expect(pdp.vatAmount).toBe(0);
    expect(pdp.totalWithVat).toBe(20000);
    expect(pdp.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);

    // Passport data remains unchanged
    expect(passport.methodCode).toBe('141');
    expect(passport.rootBackingGas).toBe(true);
    expect(passport.welderCertNumber).toContain('141');
  });
});
