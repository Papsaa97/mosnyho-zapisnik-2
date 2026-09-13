import { describe, it, expect } from 'vitest';
import {
  WeldingMethodService,
  BaseMaterialService,
  ShieldingGasService,
  FillerBatchService,
  TechnicalPassportService,
  FillerMaterialBatch,
} from '../src/services/weldingPassportService';
import { WeldingPassport, WeldingMethodCode } from '../src/types';

describe('Milestone M2 Adversarial Challenger Suite (Domain Services Stress Testing)', () => {
  // =========================================================================
  // 1. WeldingMethodService Adversarial Tests
  // =========================================================================
  describe('WeldingMethodService Adversarial Robustness', () => {
    it('handles empty, nullish, and extreme whitespace inputs safely returning NONE', () => {
      expect(WeldingMethodService.normalizeMethodCode('')).toBe('NONE');
      // @ts-expect-error testing runtime JS null/undefined
      expect(WeldingMethodService.normalizeMethodCode(null)).toBe('NONE');
      // @ts-expect-error testing runtime JS null/undefined
      expect(WeldingMethodService.normalizeMethodCode(undefined)).toBe('NONE');
      expect(WeldingMethodService.normalizeMethodCode('   ')).toBe('NONE');
      expect(WeldingMethodService.normalizeMethodCode('\t\n\r  ')).toBe('NONE');
    });

    it('normalizes all standard ISO 4063 numeric codes with varying whitespace and casing', () => {
      const standardCodes: Array<{ input: string; expected: WeldingMethodCode }> = [
        { input: '141', expected: '141' },
        { input: '  141  ', expected: '141' },
        { input: '135', expected: '135' },
        { input: '136', expected: '136' },
        { input: '131', expected: '131' },
        { input: '111', expected: '111' },
        { input: '311', expected: '311' },
        { input: 'NONE', expected: 'NONE' },
      ];

      for (const { input, expected } of standardCodes) {
        expect(WeldingMethodService.normalizeMethodCode(input)).toBe(expected);
        const method = WeldingMethodService.getMethod(input);
        expect(method).not.toBeNull();
        expect(method?.code).toBe(expected);
      }
    });

    it('resolves diverse combined multi-process notation (slash, hyphen, underscore, plus, text)', () => {
      // 141 + 135 variants
      const tigMagVariants = [
        '141_135',
        '141/135',
        '141 / 135',
        '141-135',
        '141 - 135',
        '141+135',
        '141 + 135',
        '  141  /  135  ',
        'TIG/MAG',
        'tig/mag',
        'TIG / MAG',
        'TIG-MAG',
        'TIG - MAG',
        'TIG+MAG',
        'TIG + MAG',
        'tig_mag',
        '141/135 TIG+MAG',
        'COMBINED',
        'combined',
        'KOMBINACE',
        'kombinace',
      ];

      for (const variant of tigMagVariants) {
        expect(
          WeldingMethodService.normalizeMethodCode(variant),
          `Failed for variant: "${variant}"`
        ).toBe('141_135');
      }

      // 141 + 111 variants
      const tigMmaVariants = [
        '141_111',
        '141/111',
        '141 / 111',
        '141-111',
        '141 - 111',
        '141+111',
        '141 + 111',
        '  141  /  111  ',
        'TIG/MMA',
        'tig/mma',
        'TIG / MMA',
        'TIG-MMA',
        'TIG - MMA',
        'TIG+MMA',
        'TIG + MMA',
        'tig_mma',
        '141/111 TIG+MMA',
      ];

      for (const variant of tigMmaVariants) {
        expect(
          WeldingMethodService.normalizeMethodCode(variant),
          `Failed for variant: "${variant}"`
        ).toBe('141_111');
      }
    });

    it('normalizes vernacular Czech and trade names to canonical ISO codes', () => {
      expect(WeldingMethodService.normalizeMethodCode('elektroda')).toBe('111');
      expect(WeldingMethodService.normalizeMethodCode('ELEKTRODA')).toBe('111');
      expect(WeldingMethodService.normalizeMethodCode('plamen')).toBe('311');
      expect(WeldingMethodService.normalizeMethodCode('PLAMEN')).toBe('311');
      expect(WeldingMethodService.normalizeMethodCode('fcaw')).toBe('136');
      expect(WeldingMethodService.normalizeMethodCode('FCAW')).toBe('136');
      expect(WeldingMethodService.normalizeMethodCode('mig_mag')).toBe('135');
      expect(WeldingMethodService.normalizeMethodCode('MIG_MAG')).toBe('135');
      expect(WeldingMethodService.normalizeMethodCode('bez sváru')).toBe('NONE');
      expect(WeldingMethodService.normalizeMethodCode('BEZ SVÁRU')).toBe('NONE');
      expect(WeldingMethodService.normalizeMethodCode('bez svaru')).toBe('NONE');
      expect(WeldingMethodService.normalizeMethodCode('BEZ SVARU')).toBe('NONE');
    });

    it('gracefully falls back to NONE for unlisted, exotic, or adversarial strings', () => {
      const adversarialStrings = [
        '999',
        '000',
        '141_999',
        '135_141', // reverse not defined
        'LASER_BEAM',
        'ROBOTIC_SPOT',
        'DROP TABLE entries;',
        '<script>alert(1)</script>',
        '${process.env.SECRET}',
        '???',
        '-- 141 --',
      ];

      for (const input of adversarialStrings) {
        expect(WeldingMethodService.normalizeMethodCode(input)).toBe('NONE');
      }
    });

    it('strictly checks canonical codes with isValidCode', () => {
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

      for (const code of validCodes) {
        expect(WeldingMethodService.isValidCode(code)).toBe(true);
      }

      // Non-canonical representations must return false before normalization
      expect(WeldingMethodService.isValidCode('141/135')).toBe(false);
      expect(WeldingMethodService.isValidCode('TIG')).toBe(false);
      expect(WeldingMethodService.isValidCode('MAG')).toBe(false);
      expect(WeldingMethodService.isValidCode('unknown')).toBe(false);
      expect(WeldingMethodService.isValidCode('')).toBe(false);
    });

    it('getAllMethods contains exactly 9 entries with correct passport requirements', () => {
      const methods = WeldingMethodService.getAllMethods();
      expect(methods).toHaveLength(9);
      const noneMethod = methods.find((m) => m.code === 'NONE');
      expect(noneMethod?.requiresWeldingPassport).toBe(false);

      const activeMethods = methods.filter((m) => m.requiresWeldingPassport);
      expect(activeMethods).toHaveLength(8);
      for (const m of activeMethods) {
        expect(m.code).not.toBe('NONE');
      }
    });
  });

  // =========================================================================
  // 2. BaseMaterialService Adversarial Tests
  // =========================================================================
  describe('BaseMaterialService Adversarial Robustness', () => {
    it('strips all standard heat treatment and delivery condition suffixes (+N, +M, +AR, +QT, +CR, +SR)', () => {
      const suffixTests = [
        { input: 'S355J2+N', expectedPreset: 'S355J2' },
        { input: 'S355J2 + N', expectedPreset: 'S355J2' },
        { input: 'S355J2+n', expectedPreset: 'S355J2' },
        { input: 'S355J2+M', expectedPreset: 'S355J2' },
        { input: 'S355J2 + M', expectedPreset: 'S355J2' },
        { input: 'S355J2+AR', expectedPreset: 'S355J2' },
        { input: 'S355J2 + AR', expectedPreset: 'S355J2' },
        { input: 'S235JR+N', expectedPreset: 'S235JR' },
        { input: 'S235JR + N', expectedPreset: 'S235JR' },
        { input: '1.4301+CR', expectedPreset: '1.4301' },
        { input: '1.4301 + CR', expectedPreset: '1.4301' },
        { input: '16Mo3+QT', expectedPreset: '16Mo3' },
        { input: '16Mo3 + QT', expectedPreset: '16Mo3' },
      ];

      for (const { input, expectedPreset } of suffixTests) {
        const preset = BaseMaterialService.getPreset(input);
        expect(preset, `Failed to resolve preset for: ${input}`).not.toBeNull();
        expect(preset?.gradeCode).toBe(expectedPreset);

        const resolved = BaseMaterialService.resolveMaterial(input);
        expect(resolved.gradeCode).toBe(expectedPreset);
        expect(resolved.isCustom).toBeUndefined();
      }
    });

    it('rejects empty or whitespace-only material strings with clear error', () => {
      expect(() => BaseMaterialService.resolveMaterial('')).toThrow(
        'Base material grade cannot be empty.'
      );
      expect(() => BaseMaterialService.resolveMaterial('   ')).toThrow(
        'Base material grade cannot be empty.'
      );
      // @ts-expect-error testing null runtime
      expect(() => BaseMaterialService.resolveMaterial(null)).toThrow();
      // @ts-expect-error testing undefined runtime
      expect(() => BaseMaterialService.resolveMaterial(undefined)).toThrow();
    });

    it('correctly categorizes arbitrary custom grades per metallurgical heuristic', () => {
      // Stainless steel heuristics
      const stainlessInputs = [
        '1.4571',
        '1.4841 (žáruvzdorná nerez)',
        'AISI 304L',
        'AISI 316Ti',
        'NEREZ DIN 1.4307',
        'Inox sanitární ocel',
      ];
      for (const input of stainlessInputs) {
        const res = BaseMaterialService.resolveMaterial(input);
        expect(res.category).toBe('stainless_steel');
        expect(res.materialGroup).toBe('Skupina 8.1');
        expect(res.isCustom).toBe(true);
      }

      // Aluminum heuristics
      const aluInputs = [
        'AlMg4.5Mn',
        'AlSi10Mg',
        'Hliník AW-6060',
        'hliníkový plech 5754',
      ];
      for (const input of aluInputs) {
        const res = BaseMaterialService.resolveMaterial(input);
        expect(res.category).toBe('aluminum');
        expect(res.materialGroup).toBe('Skupina 22');
        expect(res.isCustom).toBe(true);
      }

      // Carbon steel heuristics
      const carbonInputs = ['S275JR', 'S460ML', 'S690QL', 's355nl'];
      for (const input of carbonInputs) {
        const res = BaseMaterialService.resolveMaterial(input);
        expect(res.category).toBe('carbon_steel');
        expect(res.materialGroup).toBe('Skupina 1');
        expect(res.isCustom).toBe(true);
      }

      // Truly exotic custom grades
      const exoticInputs = ['Hardox 450', 'Strenx 700', 'Titanium Gr. 2', 'Hastelloy C-22'];
      for (const input of exoticInputs) {
        const res = BaseMaterialService.resolveMaterial(input);
        expect(res.category).toBe('custom');
        expect(res.materialGroup).toBe('Skupina 1');
        expect(res.isCustom).toBe(true);
      }
    });

    it('handles numeric thicknesses and validates boundaries strictly', () => {
      // Valid numeric
      expect(BaseMaterialService.formatThickness(0.8)).toBe('0.8 mm');
      expect(BaseMaterialService.formatThickness(2)).toBe('2.0 mm');
      expect(BaseMaterialService.formatThickness(15.75)).toBe('15.8 mm');
      expect(BaseMaterialService.validateThickness(0.8)).toBe(true);
      expect(BaseMaterialService.validateThickness(15.75)).toBe(true);

      // Invalid numeric (zero, negative, NaN)
      expect(() => BaseMaterialService.formatThickness(0)).toThrow();
      expect(() => BaseMaterialService.formatThickness(-0)).toThrow();
      expect(() => BaseMaterialService.formatThickness(-3.5)).toThrow();
      expect(() => BaseMaterialService.formatThickness(NaN)).toThrow();

      expect(BaseMaterialService.validateThickness(0)).toBe(false);
      expect(BaseMaterialService.validateThickness(-0.01)).toBe(false);
      expect(BaseMaterialService.validateThickness(-10)).toBe(false);
      expect(BaseMaterialService.validateThickness(NaN)).toBe(false);
    });

    it('strictly rejects negative thickness in strings (single, range, and pipe formats)', () => {
      const negativeTestVectors = [
        '-3',
        '-3.0',
        '-3 mm',
        '- 3.0 mm',
        '–5 mm', // en-dash
        '—5 mm', // em-dash
        '-2.5',
        '-0.5 mm',
        '-10--5',
        'Ø 60.3 x -2.0',
        'Ø 60.3 x -2.0 mm',
        'Ø 76.1 x -3.6',
        'DN 50 x -2.6 mm',
        'trubka 42.4 x -3.2 mm',
        'Plech -4 mm',
      ];

      for (const vector of negativeTestVectors) {
        expect(
          BaseMaterialService.validateThickness(vector),
          `Vector "${vector}" should be invalid`
        ).toBe(false);
        expect(
          () => BaseMaterialService.formatThickness(vector),
          `Vector "${vector}" should throw on format`
        ).toThrow();
      }
    });

    it('validates and formats thickness ranges rejecting inverted or zero ranges', () => {
      // Valid ranges
      expect(BaseMaterialService.formatThickness('3-6')).toBe('3–6 mm');
      expect(BaseMaterialService.formatThickness('3 - 6 mm')).toBe('3–6 mm');
      expect(BaseMaterialService.formatThickness('3–6')).toBe('3–6 mm'); // en-dash
      expect(BaseMaterialService.formatThickness('0.8 - 2.5 mm')).toBe('0.8–2.5 mm');

      // Invalid / inverted ranges
      const invalidRanges = [
        '20-10', // inverted min > max
        '10-5 mm',
        '5-5', // min == max
        '3–3 mm',
        '0-5', // min is 0
        '0 - 10 mm',
        '-2-5', // negative min
      ];

      for (const range of invalidRanges) {
        expect(
          BaseMaterialService.validateThickness(range),
          `Range "${range}" should be rejected`
        ).toBe(false);
        expect(
          () => BaseMaterialService.formatThickness(range),
          `Range "${range}" should throw on format`
        ).toThrow();
      }
    });

    it('formats composite and pipe wall thickness strings while appending mm when missing', () => {
      expect(BaseMaterialService.formatThickness('Ø 60.3 x 2.0')).toBe('Ø 60.3 x 2.0 mm');
      expect(BaseMaterialService.formatThickness('Ø 60.3 x 2.0 mm')).toBe('Ø 60.3 x 2.0 mm');
      expect(BaseMaterialService.formatThickness('DN 50 / tl. 3.2')).toBe('DN 50 / tl. 3.2 mm');
      expect(BaseMaterialService.formatThickness('Plech 150x150 tl. 10 mm')).toBe(
        'Plech 150x150 tl. 10 mm'
      );
    });

    it('rejects strings devoid of numbers or purely empty whitespace', () => {
      const nonNumeric = ['', '   ', 'mm', 'tloustka', 'invalid string', '---'];
      for (const str of nonNumeric) {
        expect(BaseMaterialService.validateThickness(str)).toBe(false);
        expect(() => BaseMaterialService.formatThickness(str)).toThrow();
      }
    });
  });

  // =========================================================================
  // 3. ShieldingGasService Adversarial Tests
  // =========================================================================
  describe('ShieldingGasService Adversarial Robustness', () => {
    it('recommends MMA flux coating without gas for method 111 across all materials', () => {
      const materials = ['S235JR', 'S355J2', '1.4404', 'AlMg3', 'Titanium'];
      for (const mat of materials) {
        const rec = ShieldingGasService.recommendGas('111', mat);
        expect(rec.gas).toContain('Bez ochranného plynu');
        expect(rec.isoGroup).toBe('N/A');
        expect(rec.rootBackingGasRecommended).toBe(false);
      }
    });

    it('mandates root backing gas for TIG (141, 141_135, 141_111) on stainless steels', () => {
      const stainlessGrades = [
        '1.4301',
        '1.4404 (AISI 316L)',
        'AISI 304',
        'NEREZ',
        'inox 316',
        '1.4571',
      ];

      for (const grade of stainlessGrades) {
        const recTig = ShieldingGasService.recommendGas('141', grade);
        expect(recTig.rootBackingGasRecommended, `Failed for TIG 141 with ${grade}`).toBe(true);
        expect(recTig.isoGroup).toBe('ISO 14175-I1');
        expect(recTig.gas).toContain('Argon');

        const recTigMag = ShieldingGasService.recommendGas('141_135', grade);
        expect(recTigMag.rootBackingGasRecommended).toBe(true);

        const recTigMma = ShieldingGasService.recommendGas('141_111', grade);
        expect(recTigMma.rootBackingGasRecommended).toBe(true);
      }
    });

    it('does not require root backing gas for TIG on carbon steel or aluminum', () => {
      const nonStainless = ['S235JR', 'S355J2+N', 'AlMg3', '16Mo3', 'Hardox 450'];
      for (const grade of nonStainless) {
        const rec = ShieldingGasService.recommendGas('141', grade);
        expect(rec.rootBackingGasRecommended, `Backing unexpectedly true for ${grade}`).toBe(false);
        expect(rec.isoGroup).toBe('ISO 14175-I1');
      }
    });

    it('correctly maps MAG (135, 136) to CORGON 18 and MIG (131) to Argon', () => {
      const magRec135 = ShieldingGasService.recommendGas('135', 'S355J2');
      expect(magRec135.isoGroup).toBe('ISO 14175-M21');
      expect(magRec135.gas).toContain('CORGON 18');

      const magRec136 = ShieldingGasService.recommendGas('136', 'S355J2');
      expect(magRec136.isoGroup).toBe('ISO 14175-M21');

      const migRec131 = ShieldingGasService.recommendGas('131', 'AlMg3');
      expect(migRec131.isoGroup).toBe('ISO 14175-I1');
      expect(migRec131.gas).toContain('Argon');
    });

    it('handles Autogen method 311 with oxy-acetylene recommendation', () => {
      const autogen = ShieldingGasService.recommendGas('311', 'S235');
      expect(autogen.gas).toBe('Kyslík + Acetylén');
      expect(autogen.isoGroup).toBe('Plamen');
      expect(autogen.rootBackingGasRecommended).toBe(false);
    });

    it('formats passport gas strings with root backing indicators cleanly', () => {
      expect(
        ShieldingGasService.formatPassportGasString('Argon 4.6 (100% Ar)', true)
      ).toBe('Argon 4.6 (100% Ar) [vč. formování kořene]');

      expect(
        ShieldingGasService.formatPassportGasString('Argon 4.6 (100% Ar)', false)
      ).toBe('Argon 4.6 (100% Ar)');

      expect(
        ShieldingGasService.formatPassportGasString('  CORGON 18  ', true)
      ).toBe('CORGON 18 [vč. formování kořene]');
    });

    it('finds catalog gas specifications by ISO group case-insensitively', () => {
      expect(ShieldingGasService.findByIsoGroup('I1')?.composition).toBe('100% Ar');
      expect(ShieldingGasService.findByIsoGroup('i1')?.code).toBe('I1_AR_100');
      expect(ShieldingGasService.findByIsoGroup('M21')?.composition).toContain('82% Ar');
      expect(ShieldingGasService.findByIsoGroup('C1')?.composition).toBe('100% CO2');
      expect(ShieldingGasService.findByIsoGroup('N5')?.composition).toContain('90% N2');
      expect(ShieldingGasService.findByIsoGroup('UNKNOWN_GROUP')).toBeNull();
    });
  });

  // =========================================================================
  // 4. FillerBatchService Adversarial Tests
  // =========================================================================
  describe('FillerBatchService Adversarial Robustness', () => {
    it('formats batch string without duplicate prefix when input already has šarže or sarze', () => {
      const b1: FillerMaterialBatch = {
        manufacturer: 'Böhler',
        tradeName: 'Thermanit GE-316L',
        diameterMm: 2.0,
        batchNumber: '#849102',
      };
      expect(FillerBatchService.formatBatchString(b1)).toBe(
        'Böhler Thermanit GE-316L, Ø 2.0 mm, šarže #849102'
      );

      const b2: FillerMaterialBatch = {
        manufacturer: 'ESAB',
        tradeName: 'OK 12.51',
        diameterMm: 1.2,
        batchNumber: 'šarže #9941',
      };
      // Must NOT produce "šarže šarže #9941"
      expect(FillerBatchService.formatBatchString(b2)).toBe(
        'ESAB OK 12.51, Ø 1.2 mm, šarže #9941'
      );

      const b3: FillerMaterialBatch = {
        manufacturer: 'Kowax',
        tradeName: 'G3Si1',
        diameterMm: 0.8,
        batchNumber: 'sarze 5521',
      };
      expect(FillerBatchService.formatBatchString(b3)).toBe(
        'Kowax G3Si1, Ø 0.8 mm, sarze 5521'
      );
    });

    it('parses composite filler strings with varied diameter and batch formats', () => {
      const testCases = [
        {
          raw: 'ESAB OK Autrod 12.51, Ø 1.2 mm, šarže #E94120',
          expectedMfr: 'ESAB',
          expectedDia: 1.2,
          expectedBatch: '#E94120',
        },
        {
          raw: 'Böhler Fox EV 50, Ø2.5mm, tavba 48819',
          expectedMfr: 'Böhler',
          expectedDia: 2.5,
          expectedBatch: '#48819',
        },
        {
          raw: 'Bohler Thermanit, Ø 2.0, heat #H-778',
          expectedMfr: 'Böhler', // Normalized from Bohler
          expectedDia: 2.0,
          expectedBatch: '#H-778',
        },
        {
          raw: 'Lincoln Electric Innershield, průměr 1.6 mm, batch LE-991',
          expectedMfr: 'Lincoln Electric',
          expectedDia: 1.6,
          expectedBatch: '#LE-991',
        },
        {
          raw: 'Kowax SpeedArc, prumer 0.8, sarze #K100',
          expectedMfr: 'Kowax',
          expectedDia: 0.8,
          expectedBatch: '#K100',
        },
        {
          raw: 'Oerlikon Fluxofil 19, 1.2 mm, šarže: OE-55',
          expectedMfr: 'Oerlikon',
          expectedDia: 1.2,
          expectedBatch: '#OE-55',
        },
      ];

      for (const tc of testCases) {
        const parsed = FillerBatchService.parseBatchString(tc.raw);
        expect(parsed.manufacturer, `Mfr mismatch for ${tc.raw}`).toBe(tc.expectedMfr);
        expect(parsed.diameterMm, `Dia mismatch for ${tc.raw}`).toBe(tc.expectedDia);
        expect(parsed.batchNumber, `Batch mismatch for ${tc.raw}`).toBe(tc.expectedBatch);
      }
    });

    it('handles garbage or empty strings in parseBatchString gracefully without crashing', () => {
      expect(FillerBatchService.parseBatchString('')).toEqual({});
      // @ts-expect-error testing runtime falsy
      expect(FillerBatchService.parseBatchString(null)).toEqual({});
      // @ts-expect-error testing runtime falsy
      expect(FillerBatchService.parseBatchString(undefined)).toEqual({});
      expect(FillerBatchService.parseBatchString('just some random text without data')).toEqual({});
    });

    it('enforces strict EN 1090 validation rules for wire/rod batches', () => {
      const baseValid: FillerMaterialBatch = {
        manufacturer: 'ESAB',
        tradeName: 'OK Autrod 12.51',
        diameterMm: 1.2,
        batchNumber: '#123456',
      };

      // 1. Valid case
      expect(FillerBatchService.validateForEn1090(baseValid).valid).toBe(true);

      // 2. Missing manufacturer
      const noMfr = { ...baseValid, manufacturer: '' };
      const resNoMfr = FillerBatchService.validateForEn1090(noMfr);
      expect(resNoMfr.valid).toBe(false);
      expect(resNoMfr.errors.some((e) => e.includes('Výrobce'))).toBe(true);

      // 3. Missing trade name
      const noTrade = { ...baseValid, tradeName: '  ' };
      const resNoTrade = FillerBatchService.validateForEn1090(noTrade);
      expect(resNoTrade.valid).toBe(false);
      expect(resNoTrade.errors.some((e) => e.includes('Obchodní název'))).toBe(true);

      // 4. Missing batch number (critical EN 10204 3.1 requirement)
      const noBatch = { ...baseValid, batchNumber: '' };
      const resNoBatch = FillerBatchService.validateForEn1090(noBatch);
      expect(resNoBatch.valid).toBe(false);
      expect(resNoBatch.errors.some((e) => e.includes('Číslo šarže'))).toBe(true);

      // 5. Diameter boundaries: allowed [0.6, 6.0] mm
      expect(FillerBatchService.validateForEn1090({ ...baseValid, diameterMm: 0.6 }).valid).toBe(true);
      expect(FillerBatchService.validateForEn1090({ ...baseValid, diameterMm: 6.0 }).valid).toBe(true);
      expect(FillerBatchService.validateForEn1090({ ...baseValid, diameterMm: 0.5 }).valid).toBe(false);
      expect(FillerBatchService.validateForEn1090({ ...baseValid, diameterMm: 6.1 }).valid).toBe(false);
      expect(FillerBatchService.validateForEn1090({ ...baseValid, diameterMm: -1.0 }).valid).toBe(false);
      expect(FillerBatchService.validateForEn1090({ ...baseValid, diameterMm: 0 }).valid).toBe(false);
    });
  });

  // =========================================================================
  // 5. TechnicalPassportService Adversarial Tests
  // =========================================================================
  describe('TechnicalPassportService Adversarial Robustness', () => {
    it('evaluates all VT visual inspection levels per EN ISO 5817 correctly', () => {
      // Level B (Strict)
      const vtB = TechnicalPassportService.formatVtInspection('passed_B');
      expect(vtB.isCompliant).toBe(true);
      expect(vtB.qualityLevel).toBe('B');
      expect(vtB.labelCz).toContain('stupeň jakosti B');

      // Level C (Moderate)
      const vtC = TechnicalPassportService.formatVtInspection('passed_C');
      expect(vtC.isCompliant).toBe(true);
      expect(vtC.qualityLevel).toBe('C');
      expect(vtC.labelCz).toContain('stupeň jakosti C');

      // Failed
      const vtFailed = TechnicalPassportService.formatVtInspection('failed');
      expect(vtFailed.isCompliant).toBe(false);
      expect(vtFailed.qualityLevel).toContain('nevyhovuje');
      expect(vtFailed.labelCz).toContain('NEVYHOVUJE');

      // Not required / default
      const vtNotReq = TechnicalPassportService.formatVtInspection('not_required');
      expect(vtNotReq.isCompliant).toBe(true);
      expect(vtNotReq.qualityLevel).toBe('N/A');

      // Undefined fallback
      const vtUndef = TechnicalPassportService.formatVtInspection(undefined);
      expect(vtUndef.isCompliant).toBe(true);
      expect(vtUndef.qualityLevel).toBe('N/A');
    });

    it('controls passport block rendering through shouldRenderPassport', () => {
      expect(TechnicalPassportService.shouldRenderPassport(null)).toBe(false);
      expect(TechnicalPassportService.shouldRenderPassport(undefined)).toBe(false);

      const nonePassport: WeldingPassport = {
        methodCode: 'NONE',
        baseMaterialGrade: 'S355',
        materialThickness: '5 mm',
        shieldingGas: 'None',
        fillerBatch: 'None',
      };
      expect(TechnicalPassportService.shouldRenderPassport(nonePassport)).toBe(false);

      const activePassport: WeldingPassport = {
        methodCode: '141',
        baseMaterialGrade: '1.4404',
        materialThickness: '3.0 mm',
        shieldingGas: 'Argon',
        fillerBatch: 'Böhler #123',
      };
      expect(TechnicalPassportService.shouldRenderPassport(activePassport)).toBe(true);
    });

    it('evaluates TDI compliance strictly requiring all mandatory fields and passing VT', () => {
      const fullyCompliant: WeldingPassport = {
        methodCode: '141',
        methodName: 'TIG nerez',
        baseMaterialGrade: '1.4404 (AISI 316L)',
        materialThickness: '3.0 mm',
        shieldingGas: 'Argon 4.6',
        fillerBatch: 'Böhler Thermanit GE-316L, Ø 2.0 mm, šarže #849102',
        rootBackingGas: true,
        welderCertNumber: 'CZ-9606-1-141-T-BW-FM5-S-s3.0-D50-H-L045',
        weldInspectionVT: 'passed_B',
      };

      const block = TechnicalPassportService.formatPassportBlock(fullyCompliant);
      expect(block.isCompliantForTdi).toBe(true);
      expect(block.methodDisplay).toBe('TIG nerez');
      expect(block.materialDisplay).toBe('1.4404 (AISI 316L), tl. 3.0 mm');
      expect(block.gasDisplay).toContain('(vč. formování kořene)');
      expect(block.welderCertDisplay).toBe('CZ-9606-1-141-T-BW-FM5-S-s3.0-D50-H-L045');
      expect(block.vtInspection.qualityLevel).toBe('B');

      // Failure cases for TDI compliance:
      // 1. Missing base material
      expect(
        TechnicalPassportService.formatPassportBlock({
          ...fullyCompliant,
          baseMaterialGrade: '',
        }).isCompliantForTdi
      ).toBe(false);

      // 2. Missing material thickness
      expect(
        TechnicalPassportService.formatPassportBlock({
          ...fullyCompliant,
          materialThickness: '',
        }).isCompliantForTdi
      ).toBe(false);

      // 3. Missing filler batch
      expect(
        TechnicalPassportService.formatPassportBlock({
          ...fullyCompliant,
          fillerBatch: '',
        }).isCompliantForTdi
      ).toBe(false);

      // 4. Method is NONE
      expect(
        TechnicalPassportService.formatPassportBlock({
          ...fullyCompliant,
          methodCode: 'NONE',
        }).isCompliantForTdi
      ).toBe(false);

      // 5. VT inspection failed
      expect(
        TechnicalPassportService.formatPassportBlock({
          ...fullyCompliant,
          weldInspectionVT: 'failed',
        }).isCompliantForTdi
      ).toBe(false);
    });

    it('provides fallback text for missing optional welder qualification certificate', () => {
      const passportNoCert: WeldingPassport = {
        methodCode: '135',
        baseMaterialGrade: 'S355J2',
        materialThickness: '10 mm',
        shieldingGas: 'CORGON 18',
        fillerBatch: 'ESAB OK 12.51, šarže #991',
        weldInspectionVT: 'passed_C',
      };

      const block = TechnicalPassportService.formatPassportBlock(passportNoCert);
      expect(block.welderCertDisplay).toBe('Dle platného svářečského průkazu');
      expect(block.methodDisplay).toBe('Metoda ISO 4063: 135');
      expect(block.gasDisplay).toBe('CORGON 18');
      expect(block.isCompliantForTdi).toBe(true);
    });
  });

  // =========================================================================
  // 6. Generative Fuzzing & Property Stress Harness
  // =========================================================================
  describe('Generative Fuzzing & Stress Harness', () => {
    it('fuzzes WeldingMethodService.normalizeMethodCode with 1,000 pseudo-random inputs without throwing', () => {
      const seeds = [
        '141', '135', '136', '131', '111', '311', 'TIG', 'MAG', 'MIG', 'MMA',
        'NONE', 'COMBINED', 'kombinace', 'elektroda', 'plamen', 'fcaw',
        '', ' ', '\t', '\n', '\r', '\u00A0', '\u2003',
        '/', '-', '_', '+', '#', '@', '!', '$', '%', '^', '&', '*',
        'null', 'undefined', 'NaN', '0', '999', '-141', '141/135', '141-111',
      ];

      const validCodesSet = new Set([
        '141', '135', '136', '131', '111', '311', '141_135', '141_111', 'NONE',
      ]);

      for (let i = 0; i < 1000; i++) {
        // Construct pseudo-random permutation
        const len = (i % 4) + 1;
        const parts: string[] = [];
        for (let j = 0; j < len; j++) {
          const idx = (i * 31 + j * 17) % seeds.length;
          parts.push(seeds[idx]);
        }
        const fuzzString = parts.join(i % 2 === 0 ? ' ' : (i % 3 === 0 ? '/' : '-'));

        const result = WeldingMethodService.normalizeMethodCode(fuzzString);
        expect(
          validCodesSet.has(result),
          `Fuzzed output "${result}" is not a valid WeldingMethodCode for input "${fuzzString}"`
        ).toBe(true);
      }
    });

    it('fuzzes BaseMaterialService.validateThickness with 500 pseudo-random numeric and range strings', () => {
      const separators = ['-', '–', '—', ' - ', ' – ', ' — ', 'x', ' x ', '/', ' / ', ' to '];
      const units = ['', 'mm', ' mm', 'MM', ' cm', 'm', 'kg'];

      for (let i = 0; i < 500; i++) {
        const val1 = ((i * 13) % 100) - 20; // range -20 to 79
        const val2 = ((i * 29) % 100) - 20;
        const sep = separators[i % separators.length];
        const unit = units[i % units.length];

        const candidateString = `${val1}${sep}${val2}${unit}`;
        const isValid = BaseMaterialService.validateThickness(candidateString);
        expect(typeof isValid).toBe('boolean');

        if (isValid) {
          // If valid, formatThickness must succeed and return non-empty string ending in mm
          const formatted = BaseMaterialService.formatThickness(candidateString);
          expect(typeof formatted).toBe('string');
          expect(formatted.endsWith('mm')).toBe(true);
          // And cannot start with a negative sign
          expect(formatted).not.toMatch(/^[-–—]/);
        } else {
          // If invalid, formatThickness must throw
          expect(() => BaseMaterialService.formatThickness(candidateString)).toThrow();
        }
      }
    });

    it('fuzzes FillerBatchService.parseBatchString with 500 compound trade strings without throwing', () => {
      const brands = ['ESAB', 'Böhler', 'Bohler', 'Lincoln Electric', 'Kowax', 'Oerlikon', 'Magmaweld', 'UnknownCo'];
      const diaPrefixes = ['Ø', 'Ø ', 'průměr ', 'prumer ', ''];
      const dias = ['0.8', '1.0', '1.2', '1.6', '2.0', '2.4', '3.2', '4.0', '5.0', '10.5'];
      const batchPrefixes = ['šarže #', 'sarze #', 'tavba ', 'heat ', 'batch #', 'lot '];
      const batchIds = ['12345', 'E99-41', 'AB_992', 'XYZ-2026', '000'];

      for (let i = 0; i < 500; i++) {
        const brand = brands[i % brands.length];
        const diaPfx = diaPrefixes[(i * 3) % diaPrefixes.length];
        const dia = dias[(i * 7) % dias.length];
        const batchPfx = batchPrefixes[(i * 5) % batchPrefixes.length];
        const batchId = batchIds[(i * 11) % batchIds.length];

        const raw = `${brand} Fox, ${diaPfx}${dia} mm, ${batchPfx}${batchId}`;
        const parsed = FillerBatchService.parseBatchString(raw);
        expect(typeof parsed).toBe('object');
        if (parsed.diameterMm !== undefined) {
          expect(parsed.diameterMm).toBeGreaterThan(0);
        }
      }
    });

    it('exhaustively evaluates all cartesian products of methods and materials in ShieldingGasService', () => {
      const allMethods: WeldingMethodCode[] = [
        '141', '135', '136', '131', '111', '311', '141_135', '141_111', 'NONE',
      ];
      const allMaterials = [
        'S235JR', 'S355J2', 'S355J2+N', '1.4301', '1.4404', '1.4571',
        'AlMg3', 'EN AW-5754', '16Mo3', 'Hardox 450', 'Custom Steel Grade',
      ];

      for (const m of allMethods) {
        for (const mat of allMaterials) {
          const rec = ShieldingGasService.recommendGas(m, mat);
          expect(rec).toBeDefined();
          expect(typeof rec.gas).toBe('string');
          expect(rec.gas.length).toBeGreaterThan(0);
          expect(typeof rec.isoGroup).toBe('string');
          expect(typeof rec.rootBackingGasRecommended).toBe('boolean');
          expect(typeof rec.notes).toBe('string');
        }
      }
    });
  });
});
