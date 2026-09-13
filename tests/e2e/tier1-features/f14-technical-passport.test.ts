import { describe, it, expect, beforeEach } from 'vitest';
import { clearTestDatabase } from '../../helpers/dbHelper';
import { db } from '../../../src/db';
import { WorkEntry, WeldingPassport } from '../../../src/types';
import {
  SAMPLE_WELDING_PASSPORT_TIG,
  SAMPLE_WELDING_PASSPORT_MAG,
  SCENARIO_1_BRIDGE_RAILINGS,
} from '../../fixtures/shifts.fixture';
import {
  TechnicalPassportService,
  VtInspectionResult,
  FormattedPassportBlock,
} from '../../../src/services/weldingPassportService';

describe('Feature 14: Technical Passport Protocol Block (f14-technical-passport)', () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it('assembles complete WeldingPassport block meeting ČSN EN 1090-2 and ISO 9606-1 specifications', () => {
    const block = TechnicalPassportService.formatPassportBlock(SAMPLE_WELDING_PASSPORT_TIG);

    expect(block.title).toContain('SVÁŘEČSKÝ & TECHNICKÝ PASPORT');
    expect(block.standardReference).toContain('ČSN EN 1090-2');
    expect(block.methodDisplay).toContain('TIG');
    expect(block.materialDisplay).toContain('1.4404 (AISI 316L nerez), tl. 3.0 mm');
    expect(block.gasDisplay).toContain('Argon 4.6');
    expect(block.gasDisplay).toContain('(vč. formování kořene)');
    expect(block.fillerDisplay).toContain('Böhler Thermanit GE-316L');
    expect(block.welderCertDisplay).toBe(SAMPLE_WELDING_PASSPORT_TIG.welderCertNumber);
    expect(block.isCompliantForTdi).toBe(true);
  });

  it('formats VT visual inspection status per EN ISO 5817 quality levels (B, C, failed)', () => {
    // Quality Level B
    const vtB = TechnicalPassportService.formatVtInspection('passed_B');
    expect(vtB.isCompliant).toBe(true);
    expect(vtB.qualityLevel).toBe('B');
    expect(vtB.labelCz).toContain('stupeň jakosti B');

    // Quality Level C
    const vtC = TechnicalPassportService.formatVtInspection('passed_C');
    expect(vtC.isCompliant).toBe(true);
    expect(vtC.qualityLevel).toBe('C');

    // Failed
    const vtFailed = TechnicalPassportService.formatVtInspection('failed');
    expect(vtFailed.isCompliant).toBe(false);
    expect(vtFailed.labelCz).toContain('NEVYHOVUJE');

    // Not required
    const vtNone = TechnicalPassportService.formatVtInspection('not_required');
    expect(vtNone.isCompliant).toBe(true);
  });

  it('renders technical passport block conditionally (visible for welding methods, omitted for NONE)', () => {
    // Active TIG passport -> Render
    expect(TechnicalPassportService.shouldRenderPassport(SAMPLE_WELDING_PASSPORT_TIG)).toBe(true);

    // Active MAG passport -> Render
    expect(TechnicalPassportService.shouldRenderPassport(SAMPLE_WELDING_PASSPORT_MAG)).toBe(true);

    // Method NONE -> Omit
    const nonWeldingPassport: WeldingPassport = {
      methodCode: 'NONE',
      baseMaterialGrade: 'N/A',
      materialThickness: 'N/A',
      shieldingGas: 'N/A',
      fillerBatch: 'N/A',
    };
    expect(TechnicalPassportService.shouldRenderPassport(nonWeldingPassport)).toBe(false);

    // Null passport -> Omit
    expect(TechnicalPassportService.shouldRenderPassport(null)).toBe(false);
  });

  it('includes welder qualification certificate number and filler batch for TDI traceability', () => {
    const block = TechnicalPassportService.formatPassportBlock(SAMPLE_WELDING_PASSPORT_MAG);

    expect(block.welderCertDisplay).toBe('CZ-9606-1-135-P-FW-FM1-S-t12-PB-ml');
    expect(block.fillerDisplay).toContain('ESAB OK Autrod 12.51');
    expect(block.fillerDisplay).toContain('šarže #E94120');
  });

  it('persists welding passport block in Dexie database attached to work entry', async () => {
    const entryWithPassport: WorkEntry & { weldingPassport: WeldingPassport } = {
      ...SCENARIO_1_BRIDGE_RAILINGS,
      id: 'entry-passport-test',
      weldingPassport: SAMPLE_WELDING_PASSPORT_TIG,
    };

    await db.entries.put(entryWithPassport as any);

    const retrieved = (await db.entries.get('entry-passport-test')) as any;
    expect(retrieved).toBeDefined();
    expect(retrieved.weldingPassport).toBeDefined();
    expect(retrieved.weldingPassport.methodCode).toBe('141');
    expect(retrieved.weldingPassport.baseMaterialGrade).toContain('1.4404');
    expect(retrieved.weldingPassport.shieldingGas).toContain('Argon 4.6');
    expect(retrieved.weldingPassport.weldInspectionVT).toBe('passed_B');
  });

  it('detects non-compliance when mandatory welding fields are missing or inspection failed', () => {
    const incompletePassport: WeldingPassport = {
      methodCode: '141',
      baseMaterialGrade: '', // Missing!
      materialThickness: '3.0 mm',
      shieldingGas: 'Argon 100%',
      fillerBatch: '', // Missing!
      weldInspectionVT: 'failed',
    };

    const block = TechnicalPassportService.formatPassportBlock(incompletePassport);
    expect(block.isCompliantForTdi).toBe(false);
    expect(block.vtInspection.isCompliant).toBe(false);
  });
});
