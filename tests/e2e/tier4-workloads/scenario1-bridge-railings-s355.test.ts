import { describe, it, expect } from 'vitest';
import {
  calculateNetHours,
  calculateEffectiveHourlyRate,
  calculateTravelTotal,
  calculateGrandTotal,
  estimateDiet,
  calculateVatAndTotal,
  PDP_STATUTORY_CLAUSE,
} from '../../../src/services/pricingEngine';
import { STANDARD_RATES_FIXTURE } from '../../fixtures/rates.fixture';
import { PRIMARY_CONTRACTOR_FIXTURE } from '../../fixtures/contractor.fixture';
import { CLIENT_PDP_REVERSE_CHARGE } from '../../fixtures/clients.fixture';
import {
  ComprehensiveShiftEntry,
  SCENARIO_1_BRIDGE_RAILINGS,
  SAMPLE_CONSUMABLES_SLIP,
} from '../../fixtures/shifts.fixture';
import { generateSpaydString } from '../tier3-cross/spaydHelper';
import { calculateConsumableSlipTotals } from '../tier2-boundaries/markupHelper';
import { getByteSizeFromDataUrl, MAX_PHOTO_BYTES } from '../tier2-boundaries/photo-size-boundaries.test';
import { createIsolatedTestDb } from '../../helpers/dbHelper';
import { generateMockImageDataUrl } from '../../fixtures/photos.fixture';

describe('Tier 4 Workload: Scenario 1 – S355 Bridge Railings Full Day (scenario1-bridge-railings-s355.test.ts)', () => {
  const rates = STANDARD_RATES_FIXTURE;
  const contractor = PRIMARY_CONTRACTOR_FIXTURE;
  const client = CLIENT_PDP_REVERSE_CHARGE;

  it('executes end-to-end full day S355 bridge railing assembly and TIG welding workload', async () => {
    expect(client.isPdpDefault).toBe(true);
    // 1. Shift Time & Hours Calculation
    // 06:30 to 17:00 with 30 min break = 10.0 net hours
    const netHours = calculateNetHours('06:30', '17:00', 30);
    expect(netHours).toBe(10.0);

    // 2. Pricing & Labor Earnings
    // Base 620 Kč/h with 1.25 complexity multiplier (high-altitude bridge superstructure)
    const effectiveHourlyRate = calculateEffectiveHourlyRate(620, 1.25, [], rates.surcharges);
    expect(effectiveHourlyRate).toBe(775);
    const laborEarnings = netHours * effectiveHourlyRate;
    expect(laborEarnings).toBe(7750);

    // 3. Travel & Statutory Diet Boundary (10h work + 2h travel = 12.0h -> Band 1: 166 Kč)
    const travelHours = 2.0;
    const distanceKm = 95;
    const totalDuration = netHours + travelHours;
    expect(totalDuration).toBe(12.0);

    const diet = estimateDiet(totalDuration, rates);
    expect(diet.allowance).toBe(166);
    expect(diet.type).toBe('band_1');

    const travelCost = calculateTravelTotal(distanceKm, rates.defaultRatePerKm, travelHours, rates.defaultTravelHourlyRate, diet.allowance);
    // 95*11 (1045) + 2*350 (700) + 166 (diet) = 1911 Kč
    expect(travelCost).toBe(1911);

    // 4. Consumables Slip with 15% Markup and 150 Kč Overhead Fee
    const slip = SAMPLE_CONSUMABLES_SLIP;
    const slipTotals = calculateConsumableSlipTotals(slip.items, slip.overheadMarkupPercent, slip.fixedOverheadFee);
    expect(slipTotals.totalMaterialCost).toBe(1800);
    expect(slipTotals.totalBilledAmount).toBe(2221);

    // 5. Grand Total Calculation
    const grandTotal = calculateGrandTotal({
      totalHours: netHours,
      pricing: { calculatedHourlyRate: effectiveHourlyRate },
      travel: {
        distanceKm,
        ratePerKm: rates.defaultRatePerKm,
        travelTimeHours: travelHours,
        travelHourlyRate: rates.defaultTravelHourlyRate,
        dietAllowance: diet.allowance,
      },
      extraCosts: [{ id: 'mat-slip', description: 'Materiálový lístek', amount: slipTotals.totalBilledAmount }],
    });
    // 7750 + 1911 + 2221 = 11882 Kč
    expect(grandTotal).toBe(11882);

    // 6. § 92e PDP Reverse Charge Compliance (0% VAT + Mandatory Legal Notice)
    const vatCalc = calculateVatAndTotal(grandTotal, true, 21);
    expect(vatCalc.isPdp).toBe(true);
    expect(vatCalc.vatRatePercent).toBe(0);
    expect(vatCalc.vatAmount).toBe(0);
    expect(vatCalc.totalWithVat).toBe(11882);
    expect(vatCalc.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);

    // 7. Svářečský pasport EN 1090 Specification Verification
    const passport = SCENARIO_1_BRIDGE_RAILINGS.weldingPassport!;
    expect(passport.methodCode).toBe('141');
    expect(passport.baseMaterialGrade).toBe('S355J2');
    expect(passport.materialThickness).toBe('8.0 mm');
    expect(passport.shieldingGas).toContain('Argon');
    expect(passport.fillerBatch).toContain('Böhler EMK 8');
    expect(passport.rootBackingGas).toBe(false);
    expect(passport.weldInspectionVT).toBe('passed_B');

    // 8. 3 Watermarked Field Photos (< 500 KB each)
    const photo1 = generateMockImageDataUrl(280 * 1024, 'image/jpeg');
    const photo2 = generateMockImageDataUrl(320 * 1024, 'image/jpeg');
    const photo3 = generateMockImageDataUrl(450 * 1024, 'image/jpeg');
    const photos = [
      { id: 'p1', dataUrl: photo1, sizeBytes: getByteSizeFromDataUrl(photo1), caption: 'Sesazení zábradlí' },
      { id: 'p2', dataUrl: photo2, sizeBytes: getByteSizeFromDataUrl(photo2), caption: 'TIG svár kořene' },
      { id: 'p3', dataUrl: photo3, sizeBytes: getByteSizeFromDataUrl(photo3), caption: 'VT2 kontrola' },
    ];
    for (const p of photos) {
      expect(p.sizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
    }
    expect(photos).toHaveLength(3);

    // 9. Dual Sign-on-Glass (Contractor & Client)
    const signatures = SCENARIO_1_BRIDGE_RAILINGS.signatures!;
    expect(signatures.contractor?.role).toBe('contractor');
    expect(signatures.client?.role).toBe('client');
    expect(signatures.contractor?.signerName).toContain('Jan Novák');
    expect(signatures.client?.signerName).toContain('Ing. Karel Dvořák');

    // 10. Domestic SPAYD QR Synthesis with MOD-97 IBAN
    const spayd = generateSpaydString({
      accountOrIban: contractor.bankAccount,
      amount: vatCalc.totalWithVat,
      variableSymbol: '20260201',
      message: 'Most SO201 montaz svarecske prace',
    });
    expect(spayd).not.toBeNull();
    expect(spayd).toContain('ACC:CZ1801000000000123456789');
    expect(spayd).toContain('AM:11882.00*CC:CZK');
    expect(spayd).toContain('X-VS:20260201');

    // 11. Complete Offline Dexie Persistence & Clean Retrieval
    const { instance: testDb, cleanup } = createIsolatedTestDb('Scenario1_DB');
    try {
      const fullShiftEntry: ComprehensiveShiftEntry = {
        ...SCENARIO_1_BRIDGE_RAILINGS,
        id: 'shift-scenario-1-e2e',
        totalEarnings: grandTotal,
        photos: photos as any,
      };

      await testDb.entries.put(fullShiftEntry as any);
      const retrieved = await testDb.entries.get('shift-scenario-1-e2e');
      expect(retrieved).toBeDefined();
      expect(retrieved?.totalEarnings).toBe(11882);
      expect(retrieved?.isPdp).toBe(true);
      expect(retrieved?.weldingPassport?.methodCode).toBe('141');
      expect(retrieved?.signatures?.contractor?.role).toBe('contractor');
    } finally {
      await cleanup();
    }
  });
});
