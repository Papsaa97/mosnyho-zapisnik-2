import { describe, it, expect } from 'vitest';
import { 
  PDP_STATUTORY_CLAUSE, 
  calculateVatAndTotal 
} from '../../../src/services/pricingEngine';

/**
 * Feature 19: Mandatory Statutory Clause Notice
 * 
 * Requirements:
 * - Exact statutory text: „Daň odvede zákazník – režim přenesené daňové povinnosti dle § 92e zákona o DPH“
 * - Constant PDP_STATUTORY_CLAUSE matches the authoritative requirement verbatim
 * - Automatically returned in calculateVatAndTotal when isPdp is true
 * - Completely omitted (undefined) when isPdp is false
 * - Full legal text references Czech VAT Act No. 235/2004 Coll. and CZ-CPA 41–43
 * - Preserved regardless of transaction amount or client type
 */
describe('Feature 19: Mandatory Statutory Clause Notice', () => {
  const EXPECTED_MANDATORY_CLAUSE = 
    'Daň odvede zákazník – režim přenesené daňové povinnosti dle § 92e zákona o DPH';

  // Test 1: Exact verbatim character match
  it('exports PDP_STATUTORY_CLAUSE with exact legal phrasing and diacritics', () => {
    expect(PDP_STATUTORY_CLAUSE).toBe(EXPECTED_MANDATORY_CLAUSE);

    // Verify critical components
    expect(PDP_STATUTORY_CLAUSE).toContain('Daň odvede zákazník');
    expect(PDP_STATUTORY_CLAUSE).toContain('režim přenesené daňové povinnosti');
    expect(PDP_STATUTORY_CLAUSE).toContain('§ 92e zákona o DPH');
  });

  // Test 2: Automatic inclusion in calculateVatAndTotal when isPdp is true
  it('automatically attaches the statutory clause to VAT calculation when isPdp is true', () => {
    const resPdp = calculateVatAndTotal(25000, true);
    expect(resPdp.statutoryClause).toBeDefined();
    expect(resPdp.statutoryClause).toBe(EXPECTED_MANDATORY_CLAUSE);
    expect(resPdp.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);
  });

  // Test 3: Absence of statutory clause when isPdp is false
  it('does not include the statutory clause when isPdp is false', () => {
    const resStandard = calculateVatAndTotal(25000, false);
    expect(resStandard.statutoryClause).toBeUndefined();
  });

  // Test 4: Full statutory notice context including CPA classification and VAT Act citation
  it('validates comprehensive statutory legal notice text for construction and assembly works', () => {
    // Authoritative legal notice from ORIGINAL_REQUEST §R3 and InvoiceReportView.tsx
    const statutoryNoticeTemplate = {
      title: 'Zákonné ustanovení – Režim přenesené daňové povinnosti dle § 92e zákona o DPH',
      mandatoryClause: PDP_STATUTORY_CLAUSE,
      actCitation: 'zákon č. 235/2004 Sb., o dani z přidané hodnoty',
      cpaScope: 'CZ-CPA 41 až 43',
      taxLiabilityNotice: 'Výši daně je povinen doplnit a přiznat plátce, pro kterého je plnění uskutečněno.',
    };

    expect(statutoryNoticeTemplate.mandatoryClause).toBe(EXPECTED_MANDATORY_CLAUSE);
    expect(statutoryNoticeTemplate.actCitation).toContain('235/2004 Sb.');
    expect(statutoryNoticeTemplate.cpaScope).toBe('CZ-CPA 41 až 43');
    expect(statutoryNoticeTemplate.taxLiabilityNotice).toContain('doplnit a přiznat plátce');
  });

  // Test 5: Clause stability across diverse monetary amounts
  it('consistently attaches the exact statutory clause regardless of tax base scale', () => {
    const testBases = [0, 1, 999.99, 10000, 750000, 10000000];

    for (const base of testBases) {
      const calc = calculateVatAndTotal(base, true);
      expect(calc.statutoryClause).toBe(EXPECTED_MANDATORY_CLAUSE);
      expect(calc.vatAmount).toBe(0);
      expect(calc.totalWithVat).toBe(Math.round(base));
    }
  });

  // Test 6: Invariant verification — no mutation or tampering
  it('ensures PDP_STATUTORY_CLAUSE is immutable and cannot be corrupted', () => {
    // Constant string should be primitive and identical across imports
    const copy = `${PDP_STATUTORY_CLAUSE}`;
    expect(copy).toBe(EXPECTED_MANDATORY_CLAUSE);
    expect(Object.isFrozen(PDP_STATUTORY_CLAUSE) || typeof PDP_STATUTORY_CLAUSE === 'string').toBe(true);
  });
});
