import { describe, it, expect } from 'vitest';
import {
  calculateNetHours,
  calculateEffectiveHourlyRate,
  calculateTravelTotal,
  calculateGrandTotal,
  estimateDiet,
  calculateVatAndTotal,
} from '../../../src/services/pricingEngine';
import { STANDARD_RATES_FIXTURE } from '../../fixtures/rates.fixture';
import { PRIMARY_CONTRACTOR_FIXTURE } from '../../fixtures/contractor.fixture';
import { CLIENT_STANDARD_VAT } from '../../fixtures/clients.fixture';
import {
  ComprehensiveShiftEntry,
  SAMPLE_WELDING_PASSPORT_TIG,
} from '../../fixtures/shifts.fixture';
import { generateSpaydString } from '../tier3-cross/spaydHelper';
import { generateByteAccurateDataUrl, getByteSizeFromDataUrl, MAX_PHOTO_BYTES } from '../tier2-boundaries/photo-size-boundaries.test';
import { createIsolatedTestDb } from '../../helpers/dbHelper';

describe('Tier 4 Workload: Scenario 2 – Stainless Dairy Piping with Root Backing Gas (scenario2-food-piping-stainless.test.ts)', () => {
  const rates = STANDARD_RATES_FIXTURE;
  const contractor = PRIMARY_CONTRACTOR_FIXTURE;
  const client = CLIENT_STANDARD_VAT; // Non-PDP client with standard 21% VAT

  it('executes food-grade stainless dairy piping TIG 141 workload with root backing gas and EN 10204 3.1 certs', async () => {
    // 1. Shift Time & Hours Calculation
    // 07:00 to 15:30 with 30 min lunch break = 8.0 net hours
    const netHours = calculateNetHours('07:00', '15:30', 30);
    expect(netHours).toBe(8.0);

    // 2. Pricing & Labor Earnings
    // Base 620 Kč/h with 1.15 multiplier for precision stainless food-grade welding
    const effectiveHourlyRate = calculateEffectiveHourlyRate(620, 1.15, [], rates.surcharges);
    expect(effectiveHourlyRate).toBe(713);
    const laborEarnings = netHours * effectiveHourlyRate; // 8 * 713 = 5704 Kč
    expect(laborEarnings).toBe(5704);

    // 3. Travel & MPSV Meal Allowance (8h work + 1h travel = 9.0h -> Band 1: 166 Kč)
    const travelHours = 1.0;
    const distanceKm = 25;
    const totalDuration = netHours + travelHours;
    expect(totalDuration).toBe(9.0);

    const diet = estimateDiet(totalDuration, rates);
    expect(diet.allowance).toBe(166);
    expect(diet.type).toBe('band_1');

    const travelCost = calculateTravelTotal(
      distanceKm,
      rates.defaultRatePerKm,
      travelHours,
      rates.defaultTravelHourlyRate,
      diet.allowance
    );
    // 25*11 (275) + 1*350 (350) + 166 = 791 Kč
    expect(travelCost).toBe(791);

    // 4. Grand Total Calculation
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
      extraCosts: [],
    });
    // 5704 + 791 = 6495 Kč
    expect(grandTotal).toBe(6495);

    // 5. Standard 21% VAT Calculation (Non-PDP Commercial Client)
    const vatCalc = calculateVatAndTotal(grandTotal, false, 21);
    expect(vatCalc.isPdp).toBe(false);
    expect(vatCalc.vatRatePercent).toBe(21);
    // 6495 * 0.21 = 1363.95 -> 1364 Kč VAT
    expect(vatCalc.vatAmount).toBe(1364);
    expect(vatCalc.totalWithVat).toBe(6495 + 1364);
    expect(vatCalc.statutoryClause).toBeUndefined();

    // 6. Svářečský pasport: Stainless Steel 1.4404 (AISI 316L) with Root Backing Gas
    const passport = SAMPLE_WELDING_PASSPORT_TIG;
    expect(passport.methodCode).toBe('141');
    expect(passport.baseMaterialGrade).toContain('1.4404');
    expect(passport.materialThickness).toBe('3.0 mm');
    expect(passport.shieldingGas).toContain('Argon');
    expect(passport.rootBackingGas).toBe(true); // Formovací plyn na kořen aktivní
    expect(passport.fillerBatch).toContain('Thermanit GE-316L');
    expect(passport.welderCertNumber).toContain('CZ-9606-1-141');
    expect(passport.weldInspectionVT).toBe('passed_B');

    // 7. Watermarked Field Photos of Root Pass & Surface VT2
    const photoRoot = generateByteAccurateDataUrl(250 * 1024, 'image/jpeg');
    const photoVT2 = generateByteAccurateDataUrl(290 * 1024, 'image/jpeg');
    const photos = [
      { id: 'ph-root', dataUrl: photoRoot, sizeBytes: getByteSizeFromDataUrl(photoRoot), caption: 'Formovaný kořen TIG' },
      { id: 'ph-vt2', dataUrl: photoVT2, sizeBytes: getByteSizeFromDataUrl(photoVT2), caption: 'VT2 stupeň B bez vad' },
    ];
    for (const p of photos) {
      expect(p.sizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
    }

    // 8. Dual Sign-on-Glass (Welder + Dairy Plant Supervisor)
    const signatures = {
      contractor: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgo...',
        signerName: 'Jan Novák (Svářeč 141)',
        signedAt: '2026-03-04T15:40:00.000Z',
        role: 'contractor' as const,
      },
      client: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgo...',
        signerName: 'Ing. Martin Sýkora (Technolog mlékárny)',
        signedAt: '2026-03-04T15:45:00.000Z',
        role: 'client' as const,
      },
    };
    expect(signatures.contractor.role).toBe('contractor');
    expect(signatures.client.role).toBe('client');

    // 9. Domestic SPAYD QR Synthesis for Standard Invoice
    const spayd = generateSpaydString({
      accountOrIban: contractor.bankAccount,
      amount: vatCalc.totalWithVat,
      variableSymbol: '20260304',
      message: 'Mlekarna nerez potrubi 1.4404 TIG',
    });
    expect(spayd).not.toBeNull();
    expect(spayd).toContain('ACC:CZ1801000000000123456789');
    expect(spayd).toContain('AM:7859.00*CC:CZK');
    expect(spayd).toContain('X-VS:20260304');

    // 10. Dexie Persistence & Clean Retrieval
    const { instance: testDb, cleanup } = createIsolatedTestDb('Scenario2_DB');
    try {
      const fullShiftEntry: ComprehensiveShiftEntry = {
        id: 'shift-scenario-2-e2e',
        date: '2026-03-04',
        projectCode: 'MLEK-DN150/26',
        projectName: 'Mlékárna – Montáž a sváření nerez potrubí 1.4404 s formováním kořene',
        clientName: client.name,
        workType: 'site_assembly',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        totalHours: netHours,
        pricing: {
          baseHourlyRate: 620,
          complexityMultiplier: 1.15,
          shiftSurcharges: [],
          calculatedHourlyRate: effectiveHourlyRate,
        },
        travel: {
          distanceKm,
          ratePerKm: rates.defaultRatePerKm,
          travelTimeHours: travelHours,
          travelHourlyRate: rates.defaultTravelHourlyRate,
          dietAllowance: diet.allowance,
          dietBandApplied: 'band_1',
        },
        extraCosts: [],
        totalEarnings: grandTotal,
        status: 'submitted',
        notes: 'Sváření nerezového potrubí s ochranou kořene formovacím plynem. Vizuální zkouška VT2.',
        weldingMethod: 'TIG',
        isPdp: false,
        weldingPassport: passport,
        signatures: signatures as any,
        photos: photos as any,
        createdAt: '2026-03-04T16:00:00.000Z',
        updatedAt: '2026-03-04T16:00:00.000Z',
      };

      await testDb.entries.put(fullShiftEntry as any);
      const retrieved = await testDb.entries.get('shift-scenario-2-e2e');
      expect(retrieved).toBeDefined();
      expect(retrieved?.isPdp).toBe(false);
      expect(retrieved?.weldingPassport?.rootBackingGas).toBe(true);
      expect(retrieved?.weldingPassport?.baseMaterialGrade).toContain('1.4404');
    } finally {
      await cleanup();
    }
  });
});
