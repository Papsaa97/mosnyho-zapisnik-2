import { describe, it, expect } from 'vitest';
import {
  calculateNetHours,
  calculateTravelTotal,
  calculateGrandTotal,
  calculateVatAndTotal,
} from '../../../src/services/pricingEngine';
import { STANDARD_RATES_FIXTURE } from '../../fixtures/rates.fixture';
import { PRIMARY_CONTRACTOR_FIXTURE } from '../../fixtures/contractor.fixture';
import { CLIENT_KOVO_NOVAK } from '../../fixtures/clients.fixture';
import {
  ComprehensiveShiftEntry,
  WeldingPassport,
  ConsumableItem,
} from '../../fixtures/shifts.fixture';
import { generateSpaydString } from '../tier3-cross/spaydHelper';
import { calculateConsumableSlipTotals } from '../tier2-boundaries/markupHelper';
import { generateByteAccurateDataUrl, getByteSizeFromDataUrl, MAX_PHOTO_BYTES } from '../tier2-boundaries/photo-size-boundaries.test';
import { createIsolatedTestDb } from '../../helpers/dbHelper';

describe('Tier 4 Workload: Scenario 5 – Emergency Excavator Frame Repair (scenario5-excavator-frame-repair.test.ts)', () => {
  const rates = STANDARD_RATES_FIXTURE;
  const contractor = PRIMARY_CONTRACTOR_FIXTURE;
  const client = CLIENT_KOVO_NOVAK;

  it('executes emergency field excavator frame repair MMA 111 with manual diet override and repair photos', async () => {
    // 1. Shift Hours (14:00 to 20:30 with 30m break = 6.0 net hours)
    const netHours = calculateNetHours('14:00', '20:30', 30);
    expect(netHours).toBe(6.0);

    // 2. Emergency Hourly Rate (850 Kč/h defaultEmergencyRate)
    const emergencyRate = rates.defaultEmergencyRate;
    expect(emergencyRate).toBe(850);
    const laborEarnings = netHours * emergencyRate; // 6 * 850 = 5100 Kč
    expect(laborEarnings).toBe(5100);

    // 3. Travel with Manual Diet Override (Flat-rate 300 Kč emergency compensation)
    const travelHours = 1.5;
    const distanceKm = 60;
    const manualDiet = 300; // Flat-rate emergency meal allowance

    const travelCost = calculateTravelTotal(
      distanceKm,
      rates.defaultRatePerKm,
      travelHours,
      rates.defaultTravelHourlyRate,
      manualDiet
    );
    // 60*11 (660) + 1.5*350 (525) + 300 = 1485 Kč
    expect(travelCost).toBe(1485);

    // 4. Consumables: Basic Electrodes & Gouging Rods with 15% Markup
    const items: ConsumableItem[] = [
      {
        id: 'c-mma-1',
        category: 'welding_consumables',
        name: 'Bazické elektrody Böhler FOX EV 50 Ø 3.2 mm',
        quantity: 2,
        unit: 'bal',
        unitPrice: 480,
        markupPercent: 15,
        billedPrice: Math.round(2 * 480 * 1.15), // 1104
      },
      {
        id: 'c-mma-2',
        category: 'cutting_grinding',
        name: 'Uhlíková drážkovací elektroda Ø 6.5 mm',
        quantity: 5,
        unit: 'ks',
        unitPrice: 40,
        markupPercent: 15,
        billedPrice: Math.round(5 * 40 * 1.15), // 230
      },
    ];

    const slipTotals = calculateConsumableSlipTotals(items, 15, 0);
    // Cost: 2*480 (960) + 200 = 1160 Kč
    expect(slipTotals.totalMaterialCost).toBe(1160);
    // Billed: 1104 + 230 = 1334 Kč
    expect(slipTotals.totalBilledAmount).toBe(1334);

    // 5. Grand Total Balance
    const grandTotal = calculateGrandTotal({
      totalHours: netHours,
      pricing: { calculatedHourlyRate: emergencyRate },
      travel: {
        distanceKm,
        ratePerKm: rates.defaultRatePerKm,
        travelTimeHours: travelHours,
        travelHourlyRate: rates.defaultTravelHourlyRate,
        dietAllowance: manualDiet,
      },
      extraCosts: [{ id: 'cons-slip', description: 'Elektrody a drážkovací materiál', amount: slipTotals.totalBilledAmount }],
    });
    // 5100 + 1485 + 1334 = 7919 Kč
    expect(grandTotal).toBe(7919);

    // 6. Standard 21% Commercial VAT Calculation
    const vatCalc = calculateVatAndTotal(grandTotal, false, 21);
    expect(vatCalc.isPdp).toBe(false);
    expect(vatCalc.vatRatePercent).toBe(21);
    // 7919 * 0.21 = 1662.99 -> 1663 Kč
    expect(vatCalc.vatAmount).toBe(1663);
    expect(vatCalc.totalWithVat).toBe(7919 + 1663); // 9582 Kč

    // 7. Welding Passport: MMA 111, Hardox 450, Basic Electrode Batch
    const passport: WeldingPassport = {
      methodCode: '111',
      methodName: 'MMA 111 – Ruční obloukové svařování obalenou elektrodou',
      baseMaterialGrade: 'HARDOX 450 / S355J2G3',
      materialThickness: '20.0 mm (rám bagru)',
      shieldingGas: 'Ochrana struskou (bez ochranného plynu)',
      fillerBatch: 'Böhler FOX EV 50 (E 7018-1), šarže #H58201',
      rootBackingGas: false,
      welderCertNumber: 'CZ-9606-1-111-P-BW-FM2-B-t20-PA',
      weldInspectionVT: 'passed_C',
    };
    expect(passport.methodCode).toBe('111');
    expect(passport.baseMaterialGrade).toContain('HARDOX 450');
    expect(passport.weldInspectionVT).toBe('passed_C');

    // 8. Damaged Weld Repair Field Photos (< 500 KB each)
    const photoBefore = generateByteAccurateDataUrl(310 * 1024, 'image/jpeg');
    const photoGouged = generateByteAccurateDataUrl(275 * 1024, 'image/jpeg');
    const photoAfter = generateByteAccurateDataUrl(330 * 1024, 'image/jpeg');

    const photos = [
      { id: 'ph-rep-1', dataUrl: photoBefore, sizeBytes: getByteSizeFromDataUrl(photoBefore), caption: 'Prasklina podvozkového nosníku' },
      { id: 'ph-rep-2', dataUrl: photoGouged, sizeBytes: getByteSizeFromDataUrl(photoGouged), caption: 'Vydrážkovaná a předehřátá spára' },
      { id: 'ph-rep-3', dataUrl: photoAfter, sizeBytes: getByteSizeFromDataUrl(photoAfter), caption: 'Zavařený spoj MMA 111 po kontrole' },
    ];
    for (const p of photos) {
      expect(p.sizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
    }
    expect(photos).toHaveLength(3);

    // 9. Dual Signatures (Emergency Service Welder & Equipment Supervisor)
    const signatures = {
      contractor: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgo...',
        signerName: 'Jan Novák (Pohotovostní svářeč)',
        signedAt: '2026-03-07T20:45:00.000Z',
        role: 'contractor' as const,
      },
      client: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgo...',
        signerName: 'Petr Novák (Vedoucí zemních prací KovoVýroba)',
        signedAt: '2026-03-07T20:50:00.000Z',
        role: 'client' as const,
      },
    };
    expect(signatures.contractor.role).toBe('contractor');
    expect(signatures.client.role).toBe('client');

    // 10. Domestic SPAYD QR Synthesis
    const spayd = generateSpaydString({
      accountOrIban: contractor.bankAccount,
      amount: vatCalc.totalWithVat,
      variableSymbol: '20260307',
      message: 'Havarijni oprava ramu rypadla CAT 320',
    });
    expect(spayd).not.toBeNull();
    expect(spayd).toContain('ACC:CZ1801000000000123456789');
    expect(spayd).toContain('AM:9582.00*CC:CZK');
    expect(spayd).toContain('X-VS:20260307');

    // 11. Complete Offline Dexie Persistence & Retrieval
    const { instance: testDb, cleanup } = createIsolatedTestDb('Scenario5_DB');
    try {
      const fullShiftEntry: ComprehensiveShiftEntry = {
        id: 'shift-scenario-5-e2e',
        date: '2026-03-07',
        projectCode: 'SERVIS-BAGR-CAT/26',
        projectName: 'Havarijní oprava prasklého rámu pásového rypadla CAT 320',
        clientName: client.name,
        workType: 'service_emergency',
        startTime: '14:00',
        endTime: '20:30',
        breakMinutes: 30,
        totalHours: netHours,
        pricing: {
          baseHourlyRate: 850,
          complexityMultiplier: 1.0,
          shiftSurcharges: [],
          calculatedHourlyRate: emergencyRate,
        },
        travel: {
          distanceKm,
          ratePerKm: rates.defaultRatePerKm,
          travelTimeHours: travelHours,
          travelHourlyRate: rates.defaultTravelHourlyRate,
          dietAllowance: manualDiet,
          isManualDiet: true,
          dietType: 'custom',
        },
        extraCosts: [{ id: 'cons-slip', description: 'Elektrody a drážkovací materiál', amount: slipTotals.totalBilledAmount }],
        totalEarnings: grandTotal,
        status: 'submitted',
        notes: 'Havarijní výjezd do lomu. Vyřezání praskliny uhlíkovou elektrodou, předehřev na 180°C, provaření elektrodami FOX EV 50.',
        weldingMethod: 'MMA',
        isPdp: false,
        weldingPassport: passport,
        signatures: signatures as any,
        photos: photos as any,
        createdAt: '2026-03-07T21:00:00.000Z',
        updatedAt: '2026-03-07T21:00:00.000Z',
      };

      await testDb.entries.put(fullShiftEntry as any);
      const retrieved = await testDb.entries.get('shift-scenario-5-e2e');
      expect(retrieved).toBeDefined();
      expect(retrieved?.workType).toBe('service_emergency');
      expect(retrieved?.travel.isManualDiet).toBe(true);
      expect(retrieved?.travel.dietAllowance).toBe(300);
      expect(retrieved?.weldingPassport?.methodCode).toBe('111');
      expect(retrieved?.weldingPassport?.weldInspectionVT).toBe('passed_C');
    } finally {
      await cleanup();
    }
  });
});
