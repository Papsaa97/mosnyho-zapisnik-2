import { describe, it, expect } from 'vitest';
import {
  WeldingMethodService,
  WeldingMethodInfo,
} from '../../../src/services/weldingPassportService';
import { WeldingMethodCode } from '../../../src/types';

describe('Feature 10: Welding Method ISO 4063 Selector (f10-welding-methods)', () => {
  it('maps all ISO 4063 numeric codes (141, 135, 136, 131, 111, 311) to correct normative terminology', () => {
    const tig = WeldingMethodService.getMethod('141');
    expect(tig).not.toBeNull();
    expect(tig?.shortName).toBe('TIG');
    expect(tig?.isoNumber).toBe(141);
    expect(tig?.fullNameCz).toContain('wolframovou elektrodou v inertním plynu');

    const mag = WeldingMethodService.getMethod('135');
    expect(mag?.shortName).toBe('MAG');
    expect(mag?.isoNumber).toBe(135);

    const magCore = WeldingMethodService.getMethod('136');
    expect(magCore?.shortName).toContain('trubička');
    expect(magCore?.isoNumber).toBe(136);

    const mig = WeldingMethodService.getMethod('131');
    expect(mig?.shortName).toBe('MIG');
    expect(mig?.isoNumber).toBe(131);

    const mma = WeldingMethodService.getMethod('111');
    expect(mma?.shortName).toContain('MMA');
    expect(mma?.isoNumber).toBe(111);

    const autogen = WeldingMethodService.getMethod('311');
    expect(autogen?.shortName).toBe('Autogen');
    expect(autogen?.isoNumber).toBe(311);
  });

  it('supports combined multi-process welding methods (141_135 TIG/MAG and 141_111 TIG/MMA)', () => {
    const tigMag = WeldingMethodService.getMethod('141_135');
    expect(tigMag).not.toBeNull();
    expect(tigMag?.isMultiProcess).toBe(true);
    expect(tigMag?.fullNameCz).toContain('TIG kořen');
    expect(tigMag?.fullNameCz).toContain('MAG výplň');

    const tigMma = WeldingMethodService.getMethod('141_111');
    expect(tigMma?.isMultiProcess).toBe(true);
    expect(tigMma?.fullNameCz).toContain('MMA obalená elektroda');
  });

  it('handles NONE method for non-welding assembly and locksmith shifts', () => {
    const none = WeldingMethodService.getMethod('NONE');
    expect(none).not.toBeNull();
    expect(none?.requiresWeldingPassport).toBe(false);
    expect(none?.shortName).toBe('Bez sváru');
  });

  it('maps legacy welding method strings (TIG, MIG_MAG, MMA, AUTOGEN, COMBINED) to standard ISO 4063 codes', () => {
    expect(WeldingMethodService.normalizeMethodCode('TIG')).toBe('141');
    expect(WeldingMethodService.normalizeMethodCode('MIG_MAG')).toBe('135');
    expect(WeldingMethodService.normalizeMethodCode('MMA')).toBe('111');
    expect(WeldingMethodService.normalizeMethodCode('AUTOGEN')).toBe('311');
    expect(WeldingMethodService.normalizeMethodCode('COMBINED')).toBe('141_135');
    expect(WeldingMethodService.normalizeMethodCode('NONE')).toBe('NONE');
  });

  it('supports slash notation and compound strings for combined processes (141/135, 141 / 135, 141/111, 141 / 111)', () => {
    expect(WeldingMethodService.normalizeMethodCode('141/135')).toBe('141_135');
    expect(WeldingMethodService.normalizeMethodCode('141 / 135')).toBe('141_135');
    expect(WeldingMethodService.normalizeMethodCode('141-135')).toBe('141_135');
    expect(WeldingMethodService.normalizeMethodCode('141/135 TIG+MAG')).toBe('141_135');

    expect(WeldingMethodService.normalizeMethodCode('141/111')).toBe('141_111');
    expect(WeldingMethodService.normalizeMethodCode('141 / 111')).toBe('141_111');
    expect(WeldingMethodService.normalizeMethodCode('141-111')).toBe('141_111');
    expect(WeldingMethodService.normalizeMethodCode('141/111 TIG+MMA')).toBe('141_111');
  });

  it('validates welding method codes and rejects unlisted or malformed codes', () => {
    expect(WeldingMethodService.isValidCode('141')).toBe(true);
    expect(WeldingMethodService.isValidCode('135')).toBe(true);
    expect(WeldingMethodService.isValidCode('NONE')).toBe(true);
    expect(WeldingMethodService.isValidCode('999')).toBe(false);
    expect(WeldingMethodService.isValidCode('LASER')).toBe(false);
    expect(WeldingMethodService.isValidCode('')).toBe(false);
  });

  it('provides all standard methods with passport requirement flags', () => {
    const all = WeldingMethodService.getAllMethods();
    expect(all.length).toBe(9);

    const weldingActiveMethods = all.filter((m) => m.requiresWeldingPassport);
    expect(weldingActiveMethods.length).toBe(8); // All except NONE

    const noneMethod = all.find((m) => m.code === 'NONE');
    expect(noneMethod?.requiresWeldingPassport).toBe(false);
  });
});
