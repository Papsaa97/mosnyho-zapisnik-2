import { describe, it, expect } from 'vitest';
import {
  ShieldingGasService,
  ShieldingGasSpec,
  GasRecommendation,
} from '../../../src/services/weldingPassportService';

describe('Feature 12: Shielding & Backing Gas Selector (f12-shielding-gases)', () => {
  it('provides standard ISO 14175 shielding gases (I1 Argon, M21 Corgon 18, C1 CO2)', () => {
    const catalog = ShieldingGasService.getCatalog();
    expect(catalog.length).toBeGreaterThanOrEqual(5);

    const i1 = ShieldingGasService.findByIsoGroup('I1');
    expect(i1).not.toBeNull();
    expect(i1?.tradeName).toContain('Argon');
    expect(i1?.composition).toBe('100% Ar');

    const m21 = ShieldingGasService.findByIsoGroup('M21');
    expect(m21).not.toBeNull();
    expect(m21?.composition).toContain('82% Ar + 18% CO2');

    const c1 = ShieldingGasService.findByIsoGroup('C1');
    expect(c1).not.toBeNull();
    expect(c1?.composition).toBe('100% CO2');
  });

  it('supports root backing gas toggle (formování kořene) for high-spec stainless piping', () => {
    // TIG on 1.4404 stainless pipe -> root backing gas must be recommended
    const recStainless = ShieldingGasService.recommendGas('141', '1.4404 (AISI 316L)');
    expect(recStainless.rootBackingGasRecommended).toBe(true);
    expect(recStainless.notes).toContain('formování kořene');

    // TIG on S355 carbon steel -> root backing gas is not required
    const recCarbon = ShieldingGasService.recommendGas('141', 'S355J2');
    expect(recCarbon.rootBackingGasRecommended).toBe(false);
  });

  it('automatically recommends suitable shielding gas based on welding method and material', () => {
    // MAG 135 on structural steel -> M21
    const magRec = ShieldingGasService.recommendGas('135', 'S355');
    expect(magRec.isoGroup).toBe('ISO 14175-M21');
    expect(magRec.gas).toContain('CORGON 18');

    // MIG 131 on aluminum -> I1 Argon
    const migRec = ShieldingGasService.recommendGas('131', 'AlMg3');
    expect(migRec.isoGroup).toBe('ISO 14175-I1');
    expect(migRec.gas).toContain('Argon');
  });

  it('handles MMA 111 method correctly where external shielding gas is not applicable', () => {
    const mmaRec = ShieldingGasService.recommendGas('111', 'S235JR');
    expect(mmaRec.isoGroup).toBe('N/A');
    expect(mmaRec.gas).toContain('Bez ochranného plynu');
    expect(mmaRec.rootBackingGasRecommended).toBe(false);
  });

  it('supports custom gas mixtures and trade names', () => {
    const formattedWithBacking = ShieldingGasService.formatPassportGasString(
      'Inomaxx Plus (Ar + 2% CO2 + 0.5% H2)',
      true
    );
    expect(formattedWithBacking).toContain('Inomaxx Plus');
    expect(formattedWithBacking).toContain('[vč. formování kořene]');

    const formattedStandard = ShieldingGasService.formatPassportGasString(
      'CORGON 18 (ISO 14175 M21)',
      false
    );
    expect(formattedStandard).toBe('CORGON 18 (ISO 14175 M21)');
    expect(formattedStandard).not.toContain('formování');
  });

  it('recommends Autogen gas mixture for method 311', () => {
    const autogenRec = ShieldingGasService.recommendGas('311', 'S235');
    expect(autogenRec.gas).toContain('Acetylén');
    expect(autogenRec.rootBackingGasRecommended).toBe(false);
  });
});
