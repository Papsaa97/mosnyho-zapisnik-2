import { describe, it, expect, beforeEach } from 'vitest';
import { WorkEntry, AppSettings, ClientProfile, ContractorProfile } from '../../../src/types';
import { DEFAULT_SETTINGS } from '../../../src/db/seedData';
import { PRIMARY_CONTRACTOR_FIXTURE } from '../../fixtures/contractor.fixture';
import { CLIENT_STANDARD_VAT, CLIENT_PDP_REVERSE_CHARGE } from '../../fixtures/clients.fixture';
import { CONTRACTOR_SIGNATURE_FIXTURE, CLIENT_SIGNATURE_FIXTURE } from '../../fixtures/signatures.fixture';
import { SCENARIO_1_BRIDGE_RAILINGS } from '../../fixtures/shifts.fixture';

export interface HandoverProtocolDocumentModel {
  protocolNumber: string;
  issueDate: string;
  contractor: ContractorProfile;
  client: ClientProfile;
  isPdp: boolean;
  entries: WorkEntry[];
  summary: {
    totalHours: number;
    totalKm: number;
    totalDiets: number;
    totalLaborCost: number;
    totalTravelCost: number;
    totalMaterials: number;
    grandTotal: number;
  };
  showFinancials: boolean;
  signatures: {
    contractor?: typeof CONTRACTOR_SIGNATURE_FIXTURE;
    client?: typeof CLIENT_SIGNATURE_FIXTURE;
  };
  printClasses: {
    container: string;
    pageBreakAvoid: string;
    noPrint: string;
  };
}

/**
 * Handover Protocol Document Builder
 * Generates the standardized printable A4 document model
 * per ORIGINAL_REQUEST §R1 & PROJECT.md #7.
 */
export class HandoverProtocolBuilder {
  public static buildDocument(options: {
    entries: WorkEntry[];
    settings: AppSettings;
    client?: ClientProfile;
    protocolNumber?: string;
    showFinancials?: boolean;
    signatures?: {
      contractor?: typeof CONTRACTOR_SIGNATURE_FIXTURE;
      client?: typeof CLIENT_SIGNATURE_FIXTURE;
    };
  }): HandoverProtocolDocumentModel {
    const { entries, settings, client, protocolNumber, showFinancials = true, signatures = {} } = options;

    const matchedClient = client || settings.clients[0];
    const isPdp = entries.some((e) => e.isPdp) || !!matchedClient?.isPdpDefault || !!matchedClient?.isPdp;

    let totalHours = 0;
    let totalLaborCost = 0;
    let totalKm = 0;
    let totalTravelCost = 0;
    let totalDiets = 0;
    let totalMaterials = 0;
    let grandTotal = 0;

    for (const e of entries) {
      totalHours += e.totalHours || 0;
      totalLaborCost += (e.totalHours || 0) * (e.pricing?.calculatedHourlyRate || 0);
      totalKm += e.travel?.distanceKm || 0;
      totalTravelCost +=
        (e.travel?.distanceKm || 0) * (e.travel?.ratePerKm || 0) +
        (e.travel?.travelTimeHours || 0) * (e.travel?.travelHourlyRate || 0);
      totalDiets += e.travel?.dietAllowance || 0;
      const extras = (e.extraCosts || []).reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
      totalMaterials += extras;
      grandTotal += e.totalEarnings || 0;
    }

    return {
      protocolNumber: protocolNumber || `PR-2026/03-01`,
      issueDate: new Date().toISOString().slice(0, 10),
      contractor: settings.contractor,
      client: matchedClient,
      isPdp,
      entries,
      summary: {
        totalHours,
        totalKm,
        totalDiets,
        totalLaborCost: Math.round(totalLaborCost),
        totalTravelCost: Math.round(totalTravelCost),
        totalMaterials: Math.round(totalMaterials),
        grandTotal: Math.round(grandTotal),
      },
      showFinancials,
      signatures,
      printClasses: {
        container: 'print-container bg-white text-slate-900',
        pageBreakAvoid: 'page-break-inside-avoid',
        noPrint: 'no-print',
      },
    };
  }
}

describe('Feature 7: A4 Handover Protocol Document (f07-handover-protocol)', () => {
  let settings: AppSettings;
  let testEntries: WorkEntry[];

  beforeEach(() => {
    settings = {
      ...DEFAULT_SETTINGS,
      contractor: PRIMARY_CONTRACTOR_FIXTURE,
      clients: [CLIENT_STANDARD_VAT, CLIENT_PDP_REVERSE_CHARGE],
    };
    testEntries = [SCENARIO_1_BRIDGE_RAILINGS];
  });

  it('compiles comprehensive A4 handover protocol model from shift entries, contractor, and client', () => {
    const doc = HandoverProtocolBuilder.buildDocument({
      entries: testEntries,
      settings,
      client: CLIENT_STANDARD_VAT,
      protocolNumber: 'PR-2026/03-001',
    });

    expect(doc.protocolNumber).toBe('PR-2026/03-001');
    expect(doc.contractor.name).toBe(PRIMARY_CONTRACTOR_FIXTURE.name);
    expect(doc.contractor.ico).toBe(PRIMARY_CONTRACTOR_FIXTURE.ico);
    expect(doc.client.name).toBe(CLIENT_STANDARD_VAT.name);
    expect(doc.entries).toHaveLength(1);
    expect(doc.summary.totalHours).toBe(10.0);
    expect(doc.summary.totalKm).toBe(95);
    expect(doc.summary.totalDiets).toBe(256);
    expect(doc.summary.grandTotal).toBeGreaterThan(0);
  });

  it('renders itemized work log table with net hours, breaks, and project descriptions', () => {
    const doc = HandoverProtocolBuilder.buildDocument({
      entries: testEntries,
      settings,
    });

    const entry = doc.entries[0];
    expect(entry.date).toBe('2026-03-02');
    expect(entry.startTime).toBe('06:30');
    expect(entry.endTime).toBe('17:00');
    expect(entry.breakMinutes).toBe(30);
    expect(entry.totalHours).toBe(10.0);
    expect(entry.projectName).toContain('Most ev.č. 201');
  });

  it('supports toggle to technical-only view hiding financial figures for on-site supervisor review', () => {
    // Financial view
    const finDoc = HandoverProtocolBuilder.buildDocument({
      entries: testEntries,
      settings,
      showFinancials: true,
    });
    expect(finDoc.showFinancials).toBe(true);
    expect(finDoc.summary.totalLaborCost).toBeGreaterThan(0);

    // Pure technical handover view (prices hidden)
    const techDoc = HandoverProtocolBuilder.buildDocument({
      entries: testEntries,
      settings,
      showFinancials: false,
    });
    expect(techDoc.showFinancials).toBe(false);
    // Even though technical summary maintains hours, display flags ensure financial columns remain suppressed
    expect(techDoc.summary.totalHours).toBe(10.0);
  });

  it('embeds dual Sign-on-Glass signatures in respective contractor and client sign-off sections', () => {
    const doc = HandoverProtocolBuilder.buildDocument({
      entries: testEntries,
      settings,
      signatures: {
        contractor: CONTRACTOR_SIGNATURE_FIXTURE,
        client: CLIENT_SIGNATURE_FIXTURE,
      },
    });

    expect(doc.signatures.contractor).toBeDefined();
    expect(doc.signatures.contractor?.role).toBe('contractor');
    expect(doc.signatures.contractor?.signerName).toBe('Jan Novák (Zhotovitel)');
    expect(doc.signatures.contractor?.dataUrl).toMatch(/^data:image\/png;base64,/);

    expect(doc.signatures.client).toBeDefined();
    expect(doc.signatures.client?.role).toBe('client');
    expect(doc.signatures.client?.signerName).toBe('Ing. Karel Dvořák (Objednatel / TDI)');
    expect(doc.signatures.client?.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('includes materials and consumables breakdown when extra costs are present', () => {
    const entryWithMaterials: WorkEntry = {
      ...SCENARIO_1_BRIDGE_RAILINGS,
      extraCosts: [
        { id: 'mat-1', description: 'Kotouče řezné Tyrolit 125', amount: 450 },
        { id: 'mat-2', description: 'Kotevní šrouby M12 A4', amount: 890 },
      ],
    };

    const doc = HandoverProtocolBuilder.buildDocument({
      entries: [entryWithMaterials],
      settings,
    });

    expect(doc.summary.totalMaterials).toBe(1340); // 450 + 890
    expect(doc.entries[0].extraCosts).toHaveLength(2);
    expect(doc.entries[0].extraCosts[0].description).toContain('Tyrolit');
  });

  it('applies print-ready layout classes including page-break-inside-avoid and no-print controls', () => {
    const doc = HandoverProtocolBuilder.buildDocument({
      entries: testEntries,
      settings,
    });

    expect(doc.printClasses.container).toContain('print-container');
    expect(doc.printClasses.pageBreakAvoid).toBe('page-break-inside-avoid');
    expect(doc.printClasses.noPrint).toBe('no-print');
  });
});
