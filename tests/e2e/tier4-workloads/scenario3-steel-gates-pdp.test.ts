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
  ConsumableItem,
  WeldingPassport,
  QuickActionTag,
} from '../../fixtures/shifts.fixture';
import { generateSpaydString } from '../tier3-cross/spaydHelper';
import { calculateConsumableSlipTotals } from '../tier2-boundaries/markupHelper';
import { createIsolatedTestDb } from '../../helpers/dbHelper';

describe('Tier 4 Workload: Scenario 3 – Locksmith Steel Gates Assembly in § 92e PDP (scenario3-steel-gates-pdp.test.ts)', () => {
  const rates = STANDARD_RATES_FIXTURE;
  const contractor = PRIMARY_CONTRACTOR_FIXTURE;
  const client = CLIENT_PDP_REVERSE_CHARGE; // isPdpDefault: true

  it('executes locksmith assembly of steel gates with method NONE, § 92e PDP, and fixed overhead fee', async () => {
    // 1. Shift Time & Hours Calculation
    // 08:00 to 16:30 with 30 min break = 8.0 net hours
    const netHours = calculateNetHours('08:00', '16:30', 30);
    expect(netHours).toBe(8.0);

    // 2. Pricing & Labor (Standard Site Assembly 620 Kč/h)
    const effectiveHourlyRate = calculateEffectiveHourlyRate(620, 1.0, [], rates.surcharges);
    expect(effectiveHourlyRate).toBe(620);
    const laborEarnings = netHours * effectiveHourlyRate; // 8 * 620 = 4960 Kč
    expect(laborEarnings).toBe(4960);

    // 3. Travel & Statutory Diet (8h work + 0.5h travel = 8.5h -> Band 1: 166 Kč)
    const travelHours = 0.5;
    const distanceKm = 25;
    const totalDuration = netHours + travelHours;
    expect(totalDuration).toBe(8.5);

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
    // 25*11 (275) + 0.5*350 (175) + 166 = 616 Kč
    expect(travelCost).toBe(616);

    // 4. Consumables Sheet: Anchors, Resin Mortar, Fasteners with 10% Markup & 250 Kč Overhead Fee
    const items: ConsumableItem[] = [
      {
        id: 'c-gate-1',
        category: 'anchors',
        name: 'Ocelová průchozí kotva fischer FAZ II 16/50',
        quantity: 4,
        unit: 'ks',
        unitPrice: 180,
        markupPercent: 10,
        billedPrice: Math.round(4 * 180 * 1.1), // 792
      },
      {
        id: 'c-gate-2',
        category: 'anchors',
        name: 'Chemická malta fischer FIS V Plus 300 ml',
        quantity: 1,
        unit: 'kartuše',
        unitPrice: 450,
        markupPercent: 10,
        billedPrice: Math.round(450 * 1.1), // 495
      },
      {
        id: 'c-gate-3',
        category: 'fasteners',
        name: 'Šroub DIN 933 M16x60 pevnost 8.8 Zn',
        quantity: 8,
        unit: 'ks',
        unitPrice: 35,
        markupPercent: 10,
        billedPrice: Math.round(8 * 35 * 1.1), // 308
      },
    ];

    const slipTotals = calculateConsumableSlipTotals(items, 10, 250);
    // Cost: 4*180 (720) + 450 + 8*35 (280) = 1450 Kč
    expect(slipTotals.totalMaterialCost).toBe(1450);
    // Billed: 792 + 495 + 308 = 1595 + 250 fee = 1845 Kč
    expect(slipTotals.totalBilledAmount).toBe(1845);

    // 5. Grand Total Balance
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
      extraCosts: [{ id: 'cons-slip', description: 'Kotevní materiál a spojovací prvky', amount: slipTotals.totalBilledAmount }],
    });
    // 4960 + 616 + 1845 = 7421 Kč
    expect(grandTotal).toBe(7421);

    // 6. § 92e Reverse Charge (PDP) Compliance
    const vatCalc = calculateVatAndTotal(grandTotal, true, 21);
    expect(vatCalc.isPdp).toBe(true);
    expect(vatCalc.vatRatePercent).toBe(0);
    expect(vatCalc.vatAmount).toBe(0);
    expect(vatCalc.totalWithVat).toBe(7421);
    expect(vatCalc.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);

    // 7. Welding Method NONE & Locksmith Technical Passport
    const passport: WeldingPassport = {
      methodCode: 'NONE',
      methodName: 'Zámečnická montáž vrat bez svařování',
      baseMaterialGrade: 'Konstrukční ocel S235JR',
      materialThickness: '6.0 mm (panty a sloupky)',
      shieldingGas: 'Není aplikován',
      fillerBatch: 'Není aplikován',
      rootBackingGas: false,
      weldInspectionVT: 'not_required',
    };
    expect(passport.methodCode).toBe('NONE');
    expect(passport.weldInspectionVT).toBe('not_required');

    // 8. Glove-Friendly Activity Chips (Locksmith Activity: No Svařování chip)
    const activityTags: QuickActionTag[] = ['Příprava', 'Montáž ve výškách', 'Kotvení'];
    expect(activityTags).toContain('Kotvení');
    expect(activityTags).toContain('Příprava');
    expect(activityTags).not.toContain('Svařování');

    // 9. Dual Sign-on-Glass Signatures
    const signatures = {
      contractor: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgo...',
        signerName: 'Jan Novák (Montér)',
        signedAt: '2026-03-05T16:35:00.000Z',
        role: 'contractor' as const,
      },
      client: {
        dataUrl: 'data:image/png;base64,iVBORw0KGgo...',
        signerName: 'Miroslav Beran (Vedoucí výroby TechnoMont)',
        signedAt: '2026-03-05T16:40:00.000Z',
        role: 'client' as const,
      },
    };
    expect(signatures.contractor.role).toBe('contractor');
    expect(signatures.client.role).toBe('client');

    // 10. Domestic SPAYD QR Synthesis
    const spayd = generateSpaydString({
      accountOrIban: contractor.bankAccount,
      amount: vatCalc.totalWithVat,
      variableSymbol: '20260305',
      message: 'Zamecnicka montaz ocelovych vrat PDP',
    });
    expect(spayd).not.toBeNull();
    expect(spayd).toContain('ACC:CZ1801000000000123456789');
    expect(spayd).toContain('AM:7421.00*CC:CZK');
    expect(spayd).toContain('X-VS:20260305');

    // 11. Complete Offline Persistence in Dexie
    const { instance: testDb, cleanup } = createIsolatedTestDb('Scenario3_DB');
    try {
      const fullShiftEntry: ComprehensiveShiftEntry = {
        id: 'shift-scenario-3-e2e',
        date: '2026-03-05',
        projectCode: 'VRATA-TECH-26',
        projectName: 'Montáž dvoukřídlých ocelových vrat do betonových sloupků',
        clientName: client.name,
        workType: 'site_assembly',
        startTime: '08:00',
        endTime: '16:30',
        breakMinutes: 30,
        totalHours: netHours,
        pricing: {
          baseHourlyRate: 620,
          complexityMultiplier: 1.0,
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
        extraCosts: [{ id: 'cons-slip', description: 'Kotevní materiál a spojovací prvky', amount: slipTotals.totalBilledAmount }],
        totalEarnings: grandTotal,
        status: 'submitted',
        notes: 'Zámečnická montáž ocelových vrat, vrtání a chemické kotvení M16 do železobetonových sloupků. Bez svařování.',
        weldingMethod: 'NONE',
        isPdp: true,
        weldingPassport: passport,
        consumableSlip: {
          items,
          overheadMarkupPercent: 10,
          fixedOverheadFee: 250,
          totalMaterialCost: slipTotals.totalMaterialCost,
          totalBilledAmount: slipTotals.totalBilledAmount,
        },
        activityTags,
        signatures: signatures as any,
        createdAt: '2026-03-05T17:00:00.000Z',
        updatedAt: '2026-03-05T17:00:00.000Z',
      };

      await testDb.entries.put(fullShiftEntry as any);
      const retrieved = await testDb.entries.get('shift-scenario-3-e2e');
      expect(retrieved).toBeDefined();
      expect(retrieved?.isPdp).toBe(true);
      expect(retrieved?.weldingMethod).toBe('NONE');
      expect(retrieved?.activityTags).toEqual(['Příprava', 'Montáž ve výškách', 'Kotvení']);
    } finally {
      await cleanup();
    }
  });
});
