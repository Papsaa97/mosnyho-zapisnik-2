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
  SCENARIO_4_20H_MARATHON_SHIFT,
  QuickActionTag,
} from '../../fixtures/shifts.fixture';
import { generateSpaydString } from '../tier3-cross/spaydHelper';
import { generateByteAccurateDataUrl, getByteSizeFromDataUrl, MAX_PHOTO_BYTES } from '../tier2-boundaries/photo-size-boundaries.test';
import { createIsolatedTestDb } from '../../helpers/dbHelper';

describe('Tier 4 Workload: Scenario 4 – High-Altitude Assembly Marathon 20h Shift (scenario4-high-altitude-hall-20h.test.ts)', () => {
  const rates = STANDARD_RATES_FIXTURE;
  const contractor = PRIMARY_CONTRACTOR_FIXTURE;
  const client = CLIENT_PDP_REVERSE_CHARGE;

  it('executes 20h high-altitude hall assembly shift with Tier 3 MPSV diet (398 Kč) and night/weekend surcharges', async () => {
    expect(client.isPdpDefault).toBe(true);
    // 1. Shift Time & Net Hours Calculation (04:00 to 01:00 Next Day with 60m break)
    // 21 elapsed hours - 60 min break = 20.0 net hours
    const netHours = calculateNetHours('04:00', '01:00', 60);
    expect(netHours).toBe(20.0);

    // 2. High-Altitude Surcharges (Base 620 * 1.25 multiplier + 20% night + 25% weekend)
    const effectiveRate = calculateEffectiveHourlyRate(
      620,
      1.25,
      ['night', 'weekend'],
      rates.surcharges
    );
    // 620 * 1.25 = 775 * 1.45 = 1123.75 -> rounded to 1123.8
    expect(effectiveRate).toBe(1123.8);

    const laborEarnings = Math.round(netHours * effectiveRate); // 20 * 1123.8 = 22476 Kč
    expect(laborEarnings).toBe(22476);

    // 3. Travel & Automatic Tier 3 MPSV Diet (20h work + 1h travel = 21h > 18h -> 398 Kč)
    const travelHours = 1.0;
    const distanceKm = 50;
    const totalDuration = netHours + travelHours;
    expect(totalDuration).toBe(21.0);

    const diet = estimateDiet(totalDuration, rates);
    expect(diet.allowance).toBe(398);
    expect(diet.type).toBe('band_3');
    expect(diet.description).toContain('nad 18 h (Pásmo 3)');

    const travelCost = calculateTravelTotal(
      distanceKm,
      rates.defaultRatePerKm,
      travelHours,
      rates.defaultTravelHourlyRate,
      diet.allowance
    );
    // 50*11 (550) + 1*350 (350) + 398 (diet) = 1298 Kč
    expect(travelCost).toBe(1298);

    // 4. Grand Total Earnings Calculation
    const grandTotal = calculateGrandTotal({
      totalHours: netHours,
      pricing: { calculatedHourlyRate: effectiveRate },
      travel: {
        distanceKm,
        ratePerKm: rates.defaultRatePerKm,
        travelTimeHours: travelHours,
        travelHourlyRate: rates.defaultTravelHourlyRate,
        dietAllowance: diet.allowance,
      },
      extraCosts: [],
    });
    // 22476 + 1298 = 23774 Kč
    expect(grandTotal).toBe(23774);

    // 5. § 92e Reverse Charge (PDP) Verification
    const vatCalc = calculateVatAndTotal(grandTotal, true, 21);
    expect(vatCalc.isPdp).toBe(true);
    expect(vatCalc.vatRatePercent).toBe(0);
    expect(vatCalc.vatAmount).toBe(0);
    expect(vatCalc.totalWithVat).toBe(23774);
    expect(vatCalc.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);

    // 6. Glove-Friendly Activity Chips
    const activityTags: QuickActionTag[] = ['Příprava', 'Svařování', 'Montáž ve výškách', 'Kotvení'];
    expect(activityTags).toContain('Montáž ve výškách');
    expect(activityTags).toContain('Kotvení');

    // 7. Watermarked High-Altitude Photo Documentation
    const photoHighAltitude = generateByteAccurateDataUrl(340 * 1024, 'image/jpeg');
    const photoJoint = generateByteAccurateDataUrl(295 * 1024, 'image/jpeg');
    const photos = [
      { id: 'ph-alt-1', dataUrl: photoHighAltitude, sizeBytes: getByteSizeFromDataUrl(photoHighAltitude), caption: 'Kotvení střešního vazníku v +18m' },
      { id: 'ph-alt-2', dataUrl: photoJoint, sizeBytes: getByteSizeFromDataUrl(photoJoint), caption: 'Svařovaný přípoj vazníku MAG 135' },
    ];
    for (const p of photos) {
      expect(p.sizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
    }

    // 8. Dual Signatures with Overnight Signing
    const signatures = {
      contractor: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgo...',
        signerName: 'Jan Novák (Montážní vedoucí)',
        signedAt: '2026-03-09T01:15:00.000Z',
        role: 'contractor' as const,
      },
      client: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgo...',
        signerName: 'Miroslav Beran (TDI / Stavbyvedoucí TechnoMont)',
        signedAt: '2026-03-09T01:20:00.000Z',
        role: 'client' as const,
      },
    };
    expect(signatures.contractor.role).toBe('contractor');
    expect(signatures.client.role).toBe('client');

    // 9. Domestic SPAYD QR Synthesis
    const spayd = generateSpaydString({
      accountOrIban: contractor.bankAccount,
      amount: vatCalc.totalWithVat,
      variableSymbol: '20260309',
      message: 'Hala D nepretrzita montaz vazniku 20h',
    });
    expect(spayd).not.toBeNull();
    expect(spayd).toContain('ACC:CZ1801000000000123456789');
    expect(spayd).toContain('AM:23774.00*CC:CZK');
    expect(spayd).toContain('X-VS:20260309');

    // 10. Dexie Persistence & Deep Structure Retrieval
    const { instance: testDb, cleanup } = createIsolatedTestDb('Scenario4_DB');
    try {
      const fullShiftEntry: ComprehensiveShiftEntry = {
        ...SCENARIO_4_20H_MARATHON_SHIFT,
        id: 'shift-scenario-4-e2e',
        totalEarnings: grandTotal,
        signatures: signatures as any,
        photos: photos as any,
      };

      await testDb.entries.put(fullShiftEntry as any);
      const retrieved = await testDb.entries.get('shift-scenario-4-e2e');
      expect(retrieved).toBeDefined();
      expect(retrieved?.totalHours).toBe(20.0);
      expect(retrieved?.totalEarnings).toBe(23774);
      expect(retrieved?.travel.dietAllowance).toBe(398);
      expect(retrieved?.travel.dietBandApplied).toBe('band_3');
      expect(retrieved?.activityTags).toContain('Montáž ve výškách');
    } finally {
      await cleanup();
    }
  });
});
