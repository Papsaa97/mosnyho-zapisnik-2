import { WorkEntry } from '../../src/types';
import { SAMPLE_ENTRY_PHOTO_FIXTURE, SAMPLE_ENTRY_PHOTO_VT2_FIXTURE } from './photos.fixture';
import { CONTRACTOR_SIGNATURE_FIXTURE, CLIENT_SIGNATURE_FIXTURE } from './signatures.fixture';

export type WeldingMethodCode = 
  | '141' 
  | '135' 
  | '136' 
  | '131' 
  | '111' 
  | '311' 
  | '141_135' 
  | '141_111' 
  | 'NONE';

export interface WeldingPassport {
  methodCode: WeldingMethodCode;
  methodName?: string;
  baseMaterialGrade: string; // e.g. "1.4404 (AISI 316L)", "S355J2"
  materialThickness: string; // e.g. "3.0 mm", "4-10 mm"
  shieldingGas: string;      // e.g. "Argon 100% (ISO 14175 I1)"
  fillerBatch: string;       // e.g. "Böhler ER316L, šarže #742198"
  rootBackingGas?: boolean;
  welderCertNumber?: string;
  weldInspectionVT?: 'passed_B' | 'passed_C' | 'failed' | 'not_required';
}

export interface ConsumableItem {
  id: string;
  category: 'cutting_grinding' | 'technical_gases' | 'anchors' | 'fasteners' | 'welding_consumables' | 'custom';
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  markupPercent?: number;
  billedPrice: number;
}

export interface ConsumableSlip {
  items: ConsumableItem[];
  overheadMarkupPercent: number;
  fixedOverheadFee: number;
  totalMaterialCost: number;
  totalBilledAmount: number;
}

export type QuickActionTag = 
  | 'Příprava' 
  | 'Svařování' 
  | 'Montáž ve výškách' 
  | 'Broušení/začištění' 
  | 'Kotvení';

/** Extended WorkEntry containing new 2.0 features */
export interface ComprehensiveShiftEntry extends WorkEntry {
  weldingPassport?: WeldingPassport;
  consumableSlip?: ConsumableSlip;
  activityTags?: QuickActionTag[];
  signatures?: {
    contractor?: typeof CONTRACTOR_SIGNATURE_FIXTURE;
    client?: typeof CLIENT_SIGNATURE_FIXTURE;
  };
  photos?: typeof SAMPLE_ENTRY_PHOTO_FIXTURE[];
}

/** Sample Welding Passport for TIG stainless piping */
export const SAMPLE_WELDING_PASSPORT_TIG: WeldingPassport = {
  methodCode: '141',
  methodName: 'TIG – Obloukové svařování wolframovou elektrodou v inertním plynu',
  baseMaterialGrade: '1.4404 (AISI 316L nerez)',
  materialThickness: '3.0 mm',
  shieldingGas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
  fillerBatch: 'Böhler Thermanit GE-316L, Ø 2.0 mm, šarže #849102',
  rootBackingGas: true,
  welderCertNumber: 'CZ-9606-1-141-T-BW-FM5-S-s3.0-D50-H-L045',
  weldInspectionVT: 'passed_B',
};

/** Sample Welding Passport for MAG structural steel */
export const SAMPLE_WELDING_PASSPORT_MAG: WeldingPassport = {
  methodCode: '135',
  methodName: 'MAG – Obloukové svařování tavící se elektrodou v aktivním plynu',
  baseMaterialGrade: 'S355J2+N',
  materialThickness: '12.0 mm',
  shieldingGas: 'CORGON 18 (82% Ar + 18% CO2, ISO 14175 M21)',
  fillerBatch: 'ESAB OK Autrod 12.51, Ø 1.2 mm, šarže #E94120',
  rootBackingGas: false,
  welderCertNumber: 'CZ-9606-1-135-P-FW-FM1-S-t12-PB-ml',
  weldInspectionVT: 'passed_B',
};

/** Sample Consumables Slip with markup */
export const SAMPLE_CONSUMABLES_SLIP: ConsumableSlip = {
  overheadMarkupPercent: 15,
  fixedOverheadFee: 150,
  totalMaterialCost: 1910,
  totalBilledAmount: Math.round(1910 * 1.15 + 150), // 2196.5 + 150 = 2347
  items: [
    {
      id: 'cons-1',
      category: 'cutting_grinding',
      name: 'Řezný kotouč Tyrolit 125x1.0 Inox',
      quantity: 5,
      unit: 'ks',
      unitPrice: 38,
      markupPercent: 15,
      billedPrice: Math.round(5 * 38 * 1.15), // 219
    },
    {
      id: 'cons-2',
      category: 'technical_gases',
      name: 'Argon 4.6 lahev (spotřebovaný podíl)',
      quantity: 1,
      unit: 'náplň',
      unitPrice: 850,
      markupPercent: 15,
      billedPrice: Math.round(850 * 1.15), // 978
    },
    {
      id: 'cons-3',
      category: 'anchors',
      name: 'Kotva fischer FAZ II 12/20 A4 nerez',
      quantity: 8,
      unit: 'ks',
      unitPrice: 95,
      markupPercent: 15,
      billedPrice: Math.round(8 * 95 * 1.15), // 874
    },
  ],
};

/**
 * Real-World Scenario 1: Celodenní montáž a TIG svařování mostního zábradlí S355
 * Features: F1-F9, F10-F14, F15-F19, F20-F24, F25-F29
 */
export const SCENARIO_1_BRIDGE_RAILINGS: ComprehensiveShiftEntry = {
  id: 'shift-scenario-1',
  date: '2026-03-02',
  projectCode: 'MOST-SO201/26',
  projectName: 'Most ev.č. 201 – Montáž a TIG dovaření ocelového zábradlí S355',
  clientName: 'Metrostav DIZ s.r.o.',
  workType: 'site_assembly',
  startTime: '06:30',
  endTime: '17:00',
  breakMinutes: 30,
  totalHours: 10.0,
  pricing: {
    baseHourlyRate: 620,
    complexityMultiplier: 1.25, // práce ve výškách na mostovce
    shiftSurcharges: [],
    calculatedHourlyRate: 775,
  },
  travel: {
    distanceKm: 95,
    ratePerKm: 11,
    travelTimeHours: 2.0,
    travelHourlyRate: 350,
    dietAllowance: 256, // 10h práce + 2h cesta = 12.0h -> 12-18h (Pásmo 2: 256 Kč)
    dietBandApplied: 'band_2',
  },
  extraCosts: [],
  totalEarnings: Math.round(10.0 * 775 + (95 * 11 + 2.0 * 350 + 256) + 2347),
  status: 'submitted',
  notes: 'Montáž mostního zábradlí, sesazení dilatačních spojů, TIG provaření kořene. Vizuální zkouška VT2.',
  weldingMethod: 'TIG',
  isPdp: true, // § 92e PDP režim
  weldingPassport: {
    methodCode: '141',
    methodName: 'TIG 141 – Svařování netavící se elektrodou',
    baseMaterialGrade: 'S355J2',
    materialThickness: '8.0 mm',
    shieldingGas: 'Argon 4.6 (100% Ar)',
    fillerBatch: 'Böhler EMK 8, Ø 2.4 mm, šarže #99214',
    rootBackingGas: false,
    welderCertNumber: 'CZ-9606-1-141-T-BW',
    weldInspectionVT: 'passed_B',
  },
  consumableSlip: SAMPLE_CONSUMABLES_SLIP,
  activityTags: ['Příprava', 'Svařování', 'Montáž ve výškách', 'Kotvení'],
  signatures: {
    contractor: CONTRACTOR_SIGNATURE_FIXTURE,
    client: CLIENT_SIGNATURE_FIXTURE,
  },
  photos: [SAMPLE_ENTRY_PHOTO_FIXTURE, SAMPLE_ENTRY_PHOTO_VT2_FIXTURE],
  createdAt: '2026-03-02T17:30:00.000Z',
  updatedAt: '2026-03-02T18:00:00.000Z',
};

/**
 * 20-hour Marathon Shift Fixture (Tier 3 MPSV Diet: 398 Kč)
 */
export const SCENARIO_4_20H_MARATHON_SHIFT: ComprehensiveShiftEntry = {
  id: 'shift-scenario-4-marathon',
  date: '2026-03-08',
  projectCode: 'HALA-EXTREME-20H',
  projectName: 'Hala D – Nepřetržitá výšková montáž střešních vazníků',
  clientName: 'TechnoMont Industrial s.r.o.',
  workType: 'site_assembly',
  startTime: '04:00',
  endTime: '01:00', // ends next day 01:00 (21 elapsed hours - 60 min break = 20h net)
  breakMinutes: 60,
  totalHours: 20.0,
  pricing: {
    baseHourlyRate: 620,
    complexityMultiplier: 1.25,
    shiftSurcharges: ['night', 'weekend'],
    calculatedHourlyRate: 1123.8,
  },
  travel: {
    distanceKm: 50,
    ratePerKm: 11,
    travelTimeHours: 1.0,
    travelHourlyRate: 350,
    dietAllowance: 398, // > 18h (Pásmo 3: 398 Kč)
    dietBandApplied: 'band_3',
  },
  extraCosts: [],
  totalEarnings: Math.round(20.0 * 1123.8 + (50 * 11 + 1.0 * 350 + 398)),
  status: 'submitted',
  notes: 'Nepřetržitá směna montáže ocelové konstrukce vazníků za asistence jeřábu.',
  weldingMethod: '135' as any,
  isPdp: true,
  activityTags: ['Příprava', 'Svařování', 'Montáž ve výškách'],
  createdAt: '2026-03-09T01:30:00.000Z',
  updatedAt: '2026-03-09T01:30:00.000Z',
};
