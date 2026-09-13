import { describe, it, expect } from 'vitest';
import {
  BaseMaterialService,
  BaseMaterialSpec,
} from '../../../src/services/weldingPassportService';

describe('Feature 11: Base Material & Thickness (f11-base-materials)', () => {
  it('provides standard structural steel grades (S235JR, S355J2) with normative descriptions', () => {
    const s235 = BaseMaterialService.getPreset('S235JR');
    expect(s235).not.toBeNull();
    expect(s235?.category).toBe('carbon_steel');
    expect(s235?.materialGroup).toBe('Skupina 1.1');
    expect(s235?.standard).toContain('10025-2');

    const s355 = BaseMaterialService.getPreset('S355J2');
    expect(s355).not.toBeNull();
    expect(s355?.tradeName).toContain('Jemnozrnná');
    expect(s355?.materialGroup).toBe('Skupina 1.2');
  });

  it('resolves material presets with delivery condition suffixes (e.g. S355J2+N, S355J2+AR, S235JR+N)', () => {
    const s355plusN = BaseMaterialService.getPreset('S355J2+N');
    expect(s355plusN).not.toBeNull();
    expect(s355plusN?.gradeCode).toBe('S355J2');
    expect(s355plusN?.materialGroup).toBe('Skupina 1.2');

    const s355spaced = BaseMaterialService.getPreset('S355J2 + N');
    expect(s355spaced).not.toBeNull();
    expect(s355spaced?.gradeCode).toBe('S355J2');

    const s355AR = BaseMaterialService.getPreset('S355J2+AR');
    expect(s355AR).not.toBeNull();
    expect(s355AR?.gradeCode).toBe('S355J2');

    const s235N = BaseMaterialService.getPreset('S235JR+N');
    expect(s235N).not.toBeNull();
    expect(s235N?.gradeCode).toBe('S235JR');

    // resolveMaterial correctly maps to preset rather than generic custom
    const resolved = BaseMaterialService.resolveMaterial('S355J2+N');
    expect(resolved.gradeCode).toBe('S355J2');
    expect(resolved.materialGroup).toBe('Skupina 1.2');
    expect(resolved.category).toBe('carbon_steel');
    expect(resolved.isCustom).toBeUndefined();
  });

  it('provides stainless steel grades (1.4301, 1.4404) and aluminum alloys (AlMg3)', () => {
    const ss304 = BaseMaterialService.getPreset('1.4301');
    expect(ss304?.category).toBe('stainless_steel');
    expect(ss304?.materialGroup).toBe('Skupina 8.1');

    const ss316 = BaseMaterialService.getPreset('1.4404');
    expect(ss316?.category).toBe('stainless_steel');
    expect(ss316?.tradeName).toContain('316L');

    const al = BaseMaterialService.getPreset('AlMg3');
    expect(al?.category).toBe('aluminum');
    expect(al?.materialGroup).toBe('Skupina 22');
  });

  it('normalizes and formats material thickness strings (single value, range, pipe dimension)', () => {
    // Single number
    expect(BaseMaterialService.formatThickness(3)).toBe('3.0 mm');
    expect(BaseMaterialService.formatThickness(8.5)).toBe('8.5 mm');
    expect(BaseMaterialService.formatThickness('12')).toBe('12.0 mm');
    expect(BaseMaterialService.formatThickness('4.0 mm')).toBe('4.0 mm');

    // Range
    expect(BaseMaterialService.formatThickness('3-6')).toBe('3–6 mm');
    expect(BaseMaterialService.formatThickness('4 – 10 mm')).toBe('4–10 mm');

    // Pipe dimension
    expect(BaseMaterialService.formatThickness('Ø 76.1 x 3.6')).toBe('Ø 76.1 x 3.6 mm');
  });

  it('supports arbitrary custom material grades and non-standard steel designations', () => {
    const hardox = BaseMaterialService.resolveMaterial('Hardox 450');
    expect(hardox.gradeCode).toBe('Hardox 450');
    expect(hardox.isCustom).toBe(true);

    const customStainless = BaseMaterialService.resolveMaterial('1.4571 (AISI 316Ti)');
    expect(customStainless.category).toBe('stainless_steel');
    expect(customStainless.materialGroup).toBe('Skupina 8.1');
  });

  it('validates thickness boundaries strictly rejecting zero, negative, and invalid formats', () => {
    expect(BaseMaterialService.validateThickness(5.0)).toBe(true);
    expect(BaseMaterialService.validateThickness('6-12 mm')).toBe(true);

    // Negative or zero numbers
    expect(BaseMaterialService.validateThickness(0)).toBe(false);
    expect(BaseMaterialService.validateThickness(-2.5)).toBe(false);

    // Negative string values (must be strictly rejected)
    expect(BaseMaterialService.validateThickness('-2.5')).toBe(false);
    expect(BaseMaterialService.validateThickness('-2.5 mm')).toBe(false);
    expect(BaseMaterialService.validateThickness('- 2.5 mm')).toBe(false);
    expect(BaseMaterialService.validateThickness('Ø 76.1 x -3.6')).toBe(false);

    expect(() => BaseMaterialService.formatThickness('-2.5')).toThrow();
    expect(() => BaseMaterialService.formatThickness('-2.5 mm')).toThrow();
    expect(() => BaseMaterialService.formatThickness(-2.5)).toThrow();

    // Invalid string formats
    expect(BaseMaterialService.validateThickness('')).toBe(false);
    expect(BaseMaterialService.validateThickness('invalid')).toBe(false);
    expect(BaseMaterialService.validateThickness('10-5')).toBe(false); // Inverted range
  });

  it('preserves material catalog integrity for all 6 core presets', () => {
    const all = BaseMaterialService.getAllPresets();
    expect(all.length).toBe(6);

    const categories = all.map((m) => m.category);
    expect(categories).toContain('carbon_steel');
    expect(categories).toContain('stainless_steel');
    expect(categories).toContain('aluminum');
    expect(categories).toContain('alloy_steel');
  });
});
