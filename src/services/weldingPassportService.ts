import { WeldingMethodCode, WeldingPassport } from '../types';

export interface WeldingMethodInfo {
  code: WeldingMethodCode;
  isoNumber: number | null;
  shortName: string;
  fullNameCz: string;
  standard: string;
  isMultiProcess: boolean;
  requiresWeldingPassport: boolean;
}

/**
 * ISO 4063 Welding Methods Service
 * Encapsulates standard designations, normative titles, and mappings
 * per ČSN EN ISO 4063.
 */
export class WeldingMethodService {
  private static readonly METHODS: Record<WeldingMethodCode, WeldingMethodInfo> = {
    '141': {
      code: '141',
      isoNumber: 141,
      shortName: 'TIG',
      fullNameCz: 'Obloukové svařování wolframovou elektrodou v inertním plynu (TIG / WIG)',
      standard: 'ČSN EN ISO 4063: 141',
      isMultiProcess: false,
      requiresWeldingPassport: true,
    },
    '135': {
      code: '135',
      isoNumber: 135,
      shortName: 'MAG',
      fullNameCz: 'Obloukové svařování tavící se elektrodou v aktivním plynu (MAG)',
      standard: 'ČSN EN ISO 4063: 135',
      isMultiProcess: false,
      requiresWeldingPassport: true,
    },
    '136': {
      code: '136',
      isoNumber: 136,
      shortName: 'MAG trubička',
      fullNameCz: 'Obloukové svařování plněnou elektrodou v aktivním plynu (FCAW-G)',
      standard: 'ČSN EN ISO 4063: 136',
      isMultiProcess: false,
      requiresWeldingPassport: true,
    },
    '131': {
      code: '131',
      isoNumber: 131,
      shortName: 'MIG',
      fullNameCz: 'Obloukové svařování tavící se elektrodou v inertním plynu (MIG – hliník/nerez)',
      standard: 'ČSN EN ISO 4063: 131',
      isMultiProcess: false,
      requiresWeldingPassport: true,
    },
    '111': {
      code: '111',
      isoNumber: 111,
      shortName: 'MMA (Elektroda)',
      fullNameCz: 'Ruční obloukové svařování obalenou elektrodou (MMA / SMAW)',
      standard: 'ČSN EN ISO 4063: 111',
      isMultiProcess: false,
      requiresWeldingPassport: true,
    },
    '311': {
      code: '311',
      isoNumber: 311,
      shortName: 'Autogen',
      fullNameCz: 'Kyslíko-acetylénové plamenové svařování',
      standard: 'ČSN EN ISO 4063: 311',
      isMultiProcess: false,
      requiresWeldingPassport: true,
    },
    '141_135': {
      code: '141_135',
      isoNumber: null,
      shortName: 'Kombinace TIG+MAG',
      fullNameCz: 'Kombinovaný proces: TIG kořen (141) + MAG výplň a krycí vrstva (135)',
      standard: 'ČSN EN ISO 4063: 141 / 135',
      isMultiProcess: true,
      requiresWeldingPassport: true,
    },
    '141_111': {
      code: '141_111',
      isoNumber: null,
      shortName: 'Kombinace TIG+MMA',
      fullNameCz: 'Kombinovaný proces: TIG kořen (141) + MMA obalená elektroda (111)',
      standard: 'ČSN EN ISO 4063: 141 / 111',
      isMultiProcess: true,
      requiresWeldingPassport: true,
    },
    'NONE': {
      code: 'NONE',
      isoNumber: null,
      shortName: 'Bez sváru',
      fullNameCz: 'Bez svařování – čistá zámečnická montáž / kotvení',
      standard: 'N/A',
      isMultiProcess: false,
      requiresWeldingPassport: false,
    },
  };

  public static getMethod(code: string): WeldingMethodInfo | null {
    const normalized = this.normalizeMethodCode(code);
    return this.METHODS[normalized] || null;
  }

  public static normalizeMethodCode(input: string): WeldingMethodCode {
    if (!input) return 'NONE';
    const trimmed = input.trim().toUpperCase();

    // Combined multi-process methods (including slash, plus, hyphen, and underscore notation)
    if (
      trimmed === '141_135' ||
      trimmed === 'COMBINED' ||
      trimmed === 'KOMBINACE' ||
      /^141\s*[/_\-+]\s*135$/.test(trimmed) ||
      /^TIG\s*[/_\-+]\s*MAG$/.test(trimmed) ||
      trimmed === '141/135 TIG+MAG'
    ) {
      return '141_135';
    }

    if (
      trimmed === '141_111' ||
      /^141\s*[/_\-+]\s*111$/.test(trimmed) ||
      /^TIG\s*[/_\-+]\s*MMA$/.test(trimmed) ||
      trimmed === '141/111 TIG+MMA'
    ) {
      return '141_111';
    }

    if (trimmed === 'TIG' || trimmed === '141') return '141';
    if (trimmed === 'MAG' || trimmed === 'MIG_MAG' || trimmed === '135') return '135';
    if (trimmed === '136' || trimmed === 'FCAW') return '136';
    if (trimmed === 'MIG' || trimmed === '131') return '131';
    if (trimmed === 'MMA' || trimmed === '111' || trimmed === 'ELEKTRODA') return '111';
    if (trimmed === 'AUTOGEN' || trimmed === '311' || trimmed === 'PLAMEN') return '311';
    if (trimmed === 'NONE' || trimmed === 'BEZ SVÁRU' || trimmed === 'BEZ SVARU') return 'NONE';

    return 'NONE';
  }

  public static isValidCode(code: string): boolean {
    const validCodes: WeldingMethodCode[] = [
      '141',
      '135',
      '136',
      '131',
      '111',
      '311',
      '141_135',
      '141_111',
      'NONE',
    ];
    return validCodes.includes(code as WeldingMethodCode);
  }

  public static getAllMethods(): WeldingMethodInfo[] {
    return Object.values(this.METHODS);
  }
}

export interface BaseMaterialSpec {
  gradeCode: string;
  tradeName: string;
  materialGroup: string; // ISO/TR 15608 material group (1, 8, 22, etc.)
  standard: string;
  category: 'carbon_steel' | 'stainless_steel' | 'aluminum' | 'alloy_steel' | 'custom';
  isCustom?: boolean;
}

/**
 * Base Material & Thickness Specification Engine
 * Manages standard welding metallurgy grades, thickness normalization, and validation
 * per ČSN EN 10025 / 10088 / ISO 15608.
 */
export class BaseMaterialService {
  private static readonly PRESETS: BaseMaterialSpec[] = [
    {
      gradeCode: 'S235JR',
      tradeName: 'S235JR (Konstrukční černá ocel)',
      materialGroup: 'Skupina 1.1',
      standard: 'ČSN EN 10025-2',
      category: 'carbon_steel',
    },
    {
      gradeCode: 'S355J2',
      tradeName: 'S355J2+N (Jemnozrnná ocel s vyšší mezí kluzu)',
      materialGroup: 'Skupina 1.2',
      standard: 'ČSN EN 10025-2',
      category: 'carbon_steel',
    },
    {
      gradeCode: '1.4301',
      tradeName: '1.4301 / AISI 304 (Potravinářská nerezová ocel)',
      materialGroup: 'Skupina 8.1',
      standard: 'ČSN EN 10088-3',
      category: 'stainless_steel',
    },
    {
      gradeCode: '1.4404',
      tradeName: '1.4404 / AISI 316L (Kyselinovzdorná nerezová ocel)',
      materialGroup: 'Skupina 8.1',
      standard: 'ČSN EN 10088-3',
      category: 'stainless_steel',
    },
    {
      gradeCode: 'AlMg3',
      tradeName: 'EN AW-5754 / AlMg3 (Svařitelná hliníková slitina)',
      materialGroup: 'Skupina 22',
      standard: 'ČSN EN 573-3',
      category: 'aluminum',
    },
    {
      gradeCode: '16Mo3',
      tradeName: '16Mo3 (Kotlová žáropevná ocel)',
      materialGroup: 'Skupina 1.2',
      standard: 'ČSN EN 10028-2',
      category: 'alloy_steel',
    },
  ];

  public static getPreset(gradeCode: string): BaseMaterialSpec | null {
    if (!gradeCode) return null;
    const trimmed = gradeCode.trim();
    const lower = trimmed.toLowerCase();

    // 1. Exact match
    const match = this.PRESETS.find(
      (p) => p.gradeCode.toLowerCase() === lower
    );
    if (match) return match;

    // 2. Strip delivery condition suffix (e.g. "+N", "+M", "+AR", "+QT")
    const baseCode = trimmed.replace(/\s*\+\s*[A-Za-z0-9]+$/i, '').trim();
    if (baseCode && baseCode.toLowerCase() !== lower) {
      const baseMatch = this.PRESETS.find(
        (p) => p.gradeCode.toLowerCase() === baseCode.toLowerCase()
      );
      if (baseMatch) return baseMatch;
    }

    return null;
  }

  public static resolveMaterial(inputGrade: string): BaseMaterialSpec {
    if (!inputGrade || inputGrade.trim().length === 0) {
      throw new Error('Base material grade cannot be empty.');
    }

    const trimmed = inputGrade.trim();
    const preset = this.getPreset(trimmed);
    if (preset) return preset;

    let category: BaseMaterialSpec['category'] = 'custom';
    let materialGroup = 'Skupina 1';

    if (/^1\.4\d{3}/i.test(trimmed) || /304|316|inox|nerez/i.test(trimmed)) {
      category = 'stainless_steel';
      materialGroup = 'Skupina 8.1';
    } else if (/(?:^al|\bal\b|hliník|en[\s_-]*aw)/i.test(trimmed)) {
      category = 'aluminum';
      materialGroup = 'Skupina 22';
    } else if (/^s\d{3}/i.test(trimmed)) {
      category = 'carbon_steel';
      materialGroup = 'Skupina 1';
    }

    return {
      gradeCode: trimmed,
      tradeName: trimmed,
      materialGroup,
      standard: 'Uživatelská jakost',
      category,
      isCustom: true,
    };
  }

  public static formatThickness(val: number | string): string {
    if (typeof val === 'number') {
      if (val <= 0 || isNaN(val)) {
        throw new Error(`Invalid thickness value: ${val}`);
      }
      return `${val.toFixed(1)} mm`;
    }

    const trimmed = String(val).trim();
    if (!trimmed) {
      throw new Error('Thickness string cannot be empty.');
    }

    // Strictly reject negative values
    if (/^[-–—]/.test(trimmed)) {
      throw new Error(`Thickness must be positive: ${trimmed}`);
    }

    // Normalize Czech decimal comma into dot
    const normalized = trimmed.replace(/,/g, '.');

    // Number with optional mm (and optional leading +)
    const numMatch = normalized.match(/^(\+?\d+(?:\.\d+)?)\s*(?:mm)?$/i);
    if (numMatch) {
      const parsed = parseFloat(numMatch[1]);
      if (parsed <= 0) {
        throw new Error(`Thickness must be positive: ${parsed}`);
      }
      return `${parsed.toFixed(1)} mm`;
    }

    // Range e.g. "3-6", "3–6 mm"
    const rangeMatch = normalized.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)\s*(?:mm)?$/i);
    if (rangeMatch) {
      const min = parseFloat(rangeMatch[1]);
      const max = parseFloat(rangeMatch[2]);
      if (min <= 0 || max <= min) {
        throw new Error(`Invalid thickness range: ${trimmed}`);
      }
      return `${min}–${max} mm`;
    }

    // Must contain at least one digit
    if (!/\d/.test(normalized)) {
      throw new Error(`Thickness string '${trimmed}' must contain a numeric value.`);
    }

    // Strictly reject negative dimensions in custom composite/pipe wall strings (e.g. "Ø 60.3 x -3.2")
    if (/[-–—]\s*\d/.test(normalized)) {
      throw new Error(`Thickness must be positive: ${trimmed}`);
    }

    // Custom pipe wall or composite e.g. "Ø 60.3 x 3.2 mm"
    return trimmed.endsWith('mm') ? trimmed : `${trimmed} mm`;
  }

  public static validateThickness(val: number | string): boolean {
    try {
      this.formatThickness(val);
      return true;
    } catch {
      return false;
    }
  }

  public static getAllPresets(): BaseMaterialSpec[] {
    return [...this.PRESETS];
  }
}

export interface ShieldingGasSpec {
  code: string;
  isoGroup: string; // ISO 14175 group (I1, M21, M20, C1, N5, etc.)
  tradeName: string;
  composition: string;
  standard: string;
  recommendedMethods: string[];
}

export interface GasRecommendation {
  gas: string;
  isoGroup: string;
  rootBackingGasRecommended: boolean;
  notes: string;
}

/**
 * Shielding & Root Backing Gas Selector Engine
 * Manages ISO 14175 gas classifications, root backing gas logic, and automatic recommendations
 * per ČSN EN ISO 14175.
 */
export class ShieldingGasService {
  private static readonly GAS_CATALOG: ShieldingGasSpec[] = [
    {
      code: 'I1_AR_100',
      isoGroup: 'ISO 14175-I1',
      tradeName: 'Argon 4.6 (100% Ar)',
      composition: '100% Ar',
      standard: 'ČSN EN ISO 14175: I1',
      recommendedMethods: ['141', '131'],
    },
    {
      code: 'M21_CORGON_18',
      isoGroup: 'ISO 14175-M21',
      tradeName: 'CORGON 18 / Ferromix (82% Ar + 18% CO2)',
      composition: '82% Ar + 18% CO2',
      standard: 'ČSN EN ISO 14175: M21',
      recommendedMethods: ['135', '136'],
    },
    {
      code: 'M20_CORGON_8',
      isoGroup: 'ISO 14175-M20',
      tradeName: 'CORGON 8 (92% Ar + 8% CO2)',
      composition: '92% Ar + 8% CO2',
      standard: 'ČSN EN ISO 14175: M20',
      recommendedMethods: ['135'],
    },
    {
      code: 'C1_CO2_100',
      isoGroup: 'ISO 14175-C1',
      tradeName: 'Kysličník uhličitý (100% CO2)',
      composition: '100% CO2',
      standard: 'ČSN EN ISO 14175: C1',
      recommendedMethods: ['135'],
    },
    {
      code: 'N5_FORMIER_10',
      isoGroup: 'ISO 14175-N5',
      tradeName: 'Formovací plyn (90% N2 + 10% H2)',
      composition: '90% N2 + 10% H2',
      standard: 'ČSN EN ISO 14175: N5',
      recommendedMethods: ['141'], // Backing gas
    },
  ];

  public static getCatalog(): ShieldingGasSpec[] {
    return [...this.GAS_CATALOG];
  }

  public static findByIsoGroup(group: string): ShieldingGasSpec | null {
    const cleanGroup = group.trim().toUpperCase();
    return this.GAS_CATALOG.find((g) => g.isoGroup.toUpperCase().includes(cleanGroup)) || null;
  }

  /**
   * Recommends optimal shielding gas and backing gas based on welding method and material grade.
   */
  public static recommendGas(methodCode: string, materialGrade: string): GasRecommendation {
    const cleanMethod = methodCode.trim();
    const cleanMat = materialGrade.trim().toLowerCase();

    // 1. MMA 111 does not use shielding gas
    if (cleanMethod === '111') {
      return {
        gas: 'Bez ochranného plynu (tavidlo obalu elektrody)',
        isoGroup: 'N/A',
        rootBackingGasRecommended: false,
        notes: 'MMA elektroda vytváří vlastní plynovou ochranu odtavováním obalu.',
      };
    }

    // 2. TIG 141
    if (cleanMethod === '141' || cleanMethod === '141_135' || cleanMethod === '141_111') {
      const isStainless = /1\.4|304|316|nerez|inox/i.test(cleanMat);
      return {
        gas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
        isoGroup: 'ISO 14175-I1',
        rootBackingGasRecommended: isStainless,
        notes: isStainless
          ? 'U korozivzdorných ocelí je vyžadováno formování kořene (ochranný plyn Formiergas / Ar) pro zamezení tvorby oxidů (propalu).'
          : 'Standardní inertní plynová ochrana argonem.',
      };
    }

    // 3. MIG 131 (aluminum/stainless)
    if (cleanMethod === '131') {
      return {
        gas: 'Argon 4.6 (100% Ar, ISO 14175 I1)',
        isoGroup: 'ISO 14175-I1',
        rootBackingGasRecommended: false,
        notes: 'Inertní plyn pro svařování lehkých kovů a slitin.',
      };
    }

    // 4. MAG 135 / 136 (carbon steel)
    if (cleanMethod === '135' || cleanMethod === '136') {
      return {
        gas: 'CORGON 18 (82% Ar + 18% CO2, ISO 14175 M21)',
        isoGroup: 'ISO 14175-M21',
        rootBackingGasRecommended: false,
        notes: 'Optimální směsný plyn pro stabilní oblouk s minimálním rozstřikem.',
      };
    }

    // 5. Autogen 311
    if (cleanMethod === '311') {
      return {
        gas: 'Kyslík + Acetylén',
        isoGroup: 'Plamen',
        rootBackingGasRecommended: false,
        notes: 'Plamenové svařování s redukčním nebo neutrálním plamenem.',
      };
    }

    // Default fallback
    return {
      gas: 'Argon 100% (ISO 14175 I1)',
      isoGroup: 'ISO 14175-I1',
      rootBackingGasRecommended: false,
      notes: 'Univerzální ochranný plyn.',
    };
  }

  /**
   * Formats shielding and root backing gas details for technical passport.
   */
  public static formatPassportGasString(gasName: string, rootBackingGas?: boolean): string {
    const base = gasName.trim();
    if (rootBackingGas) {
      return `${base} [vč. formování kořene]`;
    }
    return base;
  }
}

export interface FillerMaterialBatch {
  manufacturer: string;
  tradeName: string;
  diameterMm: number;
  batchNumber: string;
  classification?: string;
  hasCert31?: boolean;
}

/**
 * Filler Material Batch Tracking Engine
 * Manages welding filler wire and electrode heat/batch traceability
 * per ČSN EN 1090-2 / EN 10204 3.1.
 */
export class FillerBatchService {
  public static readonly STANDARD_DIAMETERS: number[] = [0.8, 1.0, 1.2, 1.6, 2.0, 2.4, 3.2, 4.0];

  public static formatBatchString(batch: FillerMaterialBatch): string {
    const parts: string[] = [];
    const brand = `${batch.manufacturer.trim()} ${batch.tradeName.trim()}`.trim();
    if (brand) parts.push(brand);

    if (batch.diameterMm > 0) {
      parts.push(`Ø ${batch.diameterMm.toFixed(1)} mm`);
    }

    if (batch.batchNumber) {
      const cleanBatch = batch.batchNumber.trim();
      const prefix = cleanBatch.toLowerCase().startsWith('šarže') || cleanBatch.toLowerCase().startsWith('sarze')
        ? cleanBatch
        : `šarže ${cleanBatch}`;
      parts.push(prefix);
    }

    return parts.join(', ');
  }

  public static parseBatchString(input: string): Partial<FillerMaterialBatch> {
    if (!input || typeof input !== 'string') return {};

    const result: Partial<FillerMaterialBatch> = {};

    // Match diameter e.g. "Ø 2.4 mm", "Ø2.0", "Ø 2.0", "průměr 1.2 mm", "1.2 mm"
    const diaMatch = input.match(/(?:(?:Ø|průměr|prumer)\s*(\d+(?:\.\d+)?)(?:\s*mm)?|\b(\d+(?:\.\d+)?)\s*mm)/i);
    if (diaMatch) {
      const valStr = diaMatch[1] || diaMatch[2];
      if (valStr) {
        result.diameterMm = parseFloat(valStr);
      }
    }

    // Match batch / heat number e.g. "šarže #849102", "šarže: E94120", "tavba 12345"
    const batchMatch = input.match(/(?:šarže|sarze|tavba|heat|batch)[\s:#]+([A-Za-z0-9_-]+)/i);
    if (batchMatch) {
      result.batchNumber = batchMatch[1].startsWith('#') ? batchMatch[1] : `#${batchMatch[1]}`;
    }

    // Match well-known manufacturers
    const knownMfrs = ['Böhler', 'Bohler', 'ESAB', 'Lincoln Electric', 'Kowax', 'Oerlikon', 'Magmaweld'];
    for (const mfr of knownMfrs) {
      if (new RegExp(`\\b${mfr}\\b`, 'i').test(input)) {
        result.manufacturer = mfr.replace('Bohler', 'Böhler');
        break;
      }
    }

    return result;
  }

  public static validateForEn1090(batch: FillerMaterialBatch): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!batch.manufacturer || batch.manufacturer.trim().length === 0) {
      errors.push('Výrobce přídavného materiálu musí být uveden.');
    }

    if (!batch.tradeName || batch.tradeName.trim().length === 0) {
      errors.push('Obchodní název drátu / elektrody musí být uveden.');
    }

    if (!batch.diameterMm || batch.diameterMm < 0.6 || batch.diameterMm > 6.0) {
      errors.push(`Průměr přídavného materiálu (${batch.diameterMm} mm) musí být v rozsahu 0.6–6.0 mm.`);
    }

    if (!batch.batchNumber || batch.batchNumber.trim().length === 0) {
      errors.push('Číslo šarže / tavby je povinné pro shodu s EN 1090 a atestem EN 10204 3.1.');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export interface VtInspectionResult {
  code: 'passed_B' | 'passed_C' | 'failed' | 'not_required';
  labelCz: string;
  isCompliant: boolean;
  qualityLevel: string;
}

export interface FormattedPassportBlock {
  title: string;
  standardReference: string;
  methodDisplay: string;
  materialDisplay: string;
  gasDisplay: string;
  fillerDisplay: string;
  welderCertDisplay: string;
  vtInspection: VtInspectionResult;
  isCompliantForTdi: boolean;
}

/**
 * Technical Passport Protocol Block Generator
 * Generates the normative welding passport block for TDI, supervisors, and investors
 * per ČSN EN 1090-2 / ISO 9606-1 / ISO 5817.
 */
export class TechnicalPassportService {
  public static formatVtInspection(
    vt: WeldingPassport['weldInspectionVT'] = 'not_required'
  ): VtInspectionResult {
    switch (vt) {
      case 'passed_B':
        return {
          code: 'passed_B',
          labelCz: 'Vyhovuje – stupeň jakosti B dle ČSN EN ISO 5817 (přísné požadavky)',
          isCompliant: true,
          qualityLevel: 'B',
        };
      case 'passed_C':
        return {
          code: 'passed_C',
          labelCz: 'Vyhovuje – stupeň jakosti C dle ČSN EN ISO 5817 (střední požadavky)',
          isCompliant: true,
          qualityLevel: 'C',
        };
      case 'failed':
        return {
          code: 'failed',
          labelCz: 'NEVYHOVUJE – zjištěny nepřípustné povrchové vady svaru (nutná oprava)',
          isCompliant: false,
          qualityLevel: 'D (nevyhovuje)',
        };
      case 'not_required':
      default:
        return {
          code: 'not_required',
          labelCz: 'Vizuální kontrola VT2 nebyla předepsána',
          isCompliant: true,
          qualityLevel: 'N/A',
        };
    }
  }

  public static shouldRenderPassport(passport?: WeldingPassport | null): boolean {
    if (!passport) return false;
    return passport.methodCode !== 'NONE';
  }

  public static formatPassportBlock(passport: WeldingPassport): FormattedPassportBlock {
    const vt = this.formatVtInspection(passport.weldInspectionVT);
    const gasDisplay = passport.rootBackingGas
      ? `${passport.shieldingGas} (vč. formování kořene)`
      : passport.shieldingGas;

    const isCompliantForTdi =
      passport.methodCode !== 'NONE' &&
      !!passport.baseMaterialGrade &&
      !!passport.materialThickness &&
      !!passport.fillerBatch &&
      vt.isCompliant;

    return {
      title: 'SVÁŘEČSKÝ & TECHNICKÝ PASPORT ZAKÁZKY',
      standardReference: 'ČSN EN 1090-2 (EXC2/EXC3) / ČSN EN ISO 9606-1 / ČSN EN ISO 5817',
      methodDisplay: passport.methodName || `Metoda ISO 4063: ${passport.methodCode}`,
      materialDisplay: `${passport.baseMaterialGrade}, tl. ${passport.materialThickness}`,
      gasDisplay,
      fillerDisplay: passport.fillerBatch,
      welderCertDisplay: passport.welderCertNumber || 'Dle platného svářečského průkazu',
      vtInspection: vt,
      isCompliantForTdi,
    };
  }
}
