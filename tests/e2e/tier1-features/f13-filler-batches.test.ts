import { describe, it, expect } from 'vitest';
import {
  FillerBatchService,
  FillerMaterialBatch,
} from '../../../src/services/weldingPassportService';

describe('Feature 13: Filler Material Batch Tracking (f13-filler-batches)', () => {
  it('formats structured filler material record with manufacturer, diameter, and batch number', () => {
    const batch: FillerMaterialBatch = {
      manufacturer: 'Böhler',
      tradeName: 'Thermanit GE-316L',
      diameterMm: 2.0,
      batchNumber: '#849102',
    };

    const formatted = FillerBatchService.formatBatchString(batch);
    expect(formatted).toBe('Böhler Thermanit GE-316L, Ø 2.0 mm, šarže #849102');
  });

  it('parses composite filler material batch strings into structured components', () => {
    const raw = 'ESAB OK Autrod 12.51, Ø 1.2 mm, šarže #E94120';
    const parsed = FillerBatchService.parseBatchString(raw);

    expect(parsed.manufacturer).toBe('ESAB');
    expect(parsed.diameterMm).toBe(1.2);
    expect(parsed.batchNumber).toBe('#E94120');
  });

  it('parses filler diameters without trailing mm unit (e.g. Ø2.0 or Ø 2.0)', () => {
    const parsed1 = FillerBatchService.parseBatchString('Böhler Ø2.0 šarže 123');
    expect(parsed1.manufacturer).toBe('Böhler');
    expect(parsed1.diameterMm).toBe(2.0);
    expect(parsed1.batchNumber).toBe('#123');

    const parsed2 = FillerBatchService.parseBatchString('Böhler Ø 2.0 šarže 123');
    expect(parsed2.manufacturer).toBe('Böhler');
    expect(parsed2.diameterMm).toBe(2.0);
    expect(parsed2.batchNumber).toBe('#123');

    const parsed3 = FillerBatchService.parseBatchString('Kowax průměr 0.8 šarže K-99');
    expect(parsed3.manufacturer).toBe('Kowax');
    expect(parsed3.diameterMm).toBe(0.8);
    expect(parsed3.batchNumber).toBe('#K-99');
  });

  it('validates presence of batch/heat number for EN 10204 3.1 certificate traceability', () => {
    // Valid batch
    const validBatch: FillerMaterialBatch = {
      manufacturer: 'ESAB',
      tradeName: 'OK 48.00',
      diameterMm: 2.5,
      batchNumber: '#ES-49120',
      hasCert31: true,
    };
    const validCheck = FillerBatchService.validateForEn1090(validBatch);
    expect(validCheck.valid).toBe(true);
    expect(validCheck.errors).toHaveLength(0);

    // Missing batch number
    const invalidBatch: FillerMaterialBatch = {
      manufacturer: 'ESAB',
      tradeName: 'OK 48.00',
      diameterMm: 2.5,
      batchNumber: '', // Missing
    };
    const invalidCheck = FillerBatchService.validateForEn1090(invalidBatch);
    expect(invalidCheck.valid).toBe(false);
    expect(invalidCheck.errors.some((e) => e.includes('Číslo šarže'))).toBe(true);
  });

  it('supports standard wire and electrode diameters from 0.8 mm to 4.0 mm', () => {
    const standardDiameters = FillerBatchService.STANDARD_DIAMETERS;
    expect(standardDiameters).toContain(0.8);
    expect(standardDiameters).toContain(1.2);
    expect(standardDiameters).toContain(2.4);
    expect(standardDiameters).toContain(3.2);

    for (const dia of standardDiameters) {
      const check = FillerBatchService.validateForEn1090({
        manufacturer: 'Lincoln Electric',
        tradeName: 'UltraCore 71A85',
        diameterMm: dia,
        batchNumber: '#L-9012',
      });
      expect(check.valid).toBe(true);
    }
  });

  it('handles multi-process filler tracking (e.g. TIG root rod + MAG filling wire)', () => {
    const rootFiller: FillerMaterialBatch = {
      manufacturer: 'Böhler',
      tradeName: 'EMK 6',
      diameterMm: 2.0,
      batchNumber: '#ROOT-881',
    };

    const fillFiller: FillerMaterialBatch = {
      manufacturer: 'ESAB',
      tradeName: 'OK Autrod 12.51',
      diameterMm: 1.2,
      batchNumber: '#FILL-992',
    };

    const strRoot = FillerBatchService.formatBatchString(rootFiller);
    const strFill = FillerBatchService.formatBatchString(fillFiller);

    expect(strRoot).toContain('Böhler EMK 6');
    expect(strRoot).toContain('Ø 2.0 mm');
    expect(strFill).toContain('ESAB OK Autrod 12.51');
    expect(strFill).toContain('Ø 1.2 mm');
  });

  it('preserves manufacturer traceability data for TDI audit inspections', () => {
    const batch: FillerMaterialBatch = {
      manufacturer: 'Lincoln Electric',
      tradeName: 'Innershield NR-211-MP',
      diameterMm: 1.1,
      batchNumber: '#LE-7741',
      classification: 'AWS A5.20: E71T-11',
      hasCert31: true,
    };

    expect(batch.classification).toBe('AWS A5.20: E71T-11');
    expect(batch.hasCert31).toBe(true);

    const check = FillerBatchService.validateForEn1090(batch);
    expect(check.valid).toBe(true);
  });
});
