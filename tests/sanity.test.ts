import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../src/db';
import { clearTestDatabase, resetTestDatabase, populateTestDatabase } from './helpers/dbHelper';
import { attachCanvasSpy } from './helpers/canvasSpy';
import {
  STANDARD_RATES_FIXTURE,
  MPSV_LEGAL_RATES_2026,
} from './fixtures/rates.fixture';
import { CLIENT_STANDARD_VAT, CLIENT_PDP_REVERSE_CHARGE } from './fixtures/clients.fixture';
import { PRIMARY_CONTRACTOR_FIXTURE } from './fixtures/contractor.fixture';
import { CONTRACTOR_SIGNATURE_FIXTURE, CLIENT_SIGNATURE_FIXTURE } from './fixtures/signatures.fixture';
import { SAMPLE_ENTRY_PHOTO_FIXTURE } from './fixtures/photos.fixture';
import { SCENARIO_1_BRIDGE_RAILINGS } from './fixtures/shifts.fixture';
import {
  estimateDiet,
  calculateVatAndTotal,
  PDP_STATUTORY_CLAUSE,
} from '../src/services/pricingEngine';

describe('Test Infrastructure Sanity & Environment Verification', () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  describe('Vitest & JavaScript Environment', () => {
    it('executes basic assertions successfully', () => {
      expect(1 + 1).toBe(2);
      expect(true).toBe(true);
    });

    it('handles asynchronous promises cleanly', async () => {
      const result = await Promise.resolve('pwa-ready');
      expect(result).toBe('pwa-ready');
    });
  });

  describe('fake-indexeddb & Dexie Database Simulation', () => {
    it('provides global indexedDB via fake-indexeddb', () => {
      expect(globalThis.indexedDB).toBeDefined();
      expect(typeof globalThis.indexedDB.open).toBe('function');
    });

    it('resets and seeds the Dexie test database', async () => {
      await resetTestDatabase();

      const entriesCount = await db.entries.count();
      const presetsCount = await db.presets.count();
      const settings = await db.settings.get('global_settings');

      expect(entriesCount).toBeGreaterThan(0);
      expect(presetsCount).toBeGreaterThan(0);
      expect(settings).toBeDefined();
      expect(settings?.id).toBe('global_settings');
    });

    it('populates and clears entries via dbHelper', async () => {
      await populateTestDatabase({
        entries: [SCENARIO_1_BRIDGE_RAILINGS],
      });

      const countBefore = await db.entries.count();
      expect(countBefore).toBe(1);

      const found = await db.entries.get(SCENARIO_1_BRIDGE_RAILINGS.id);
      expect(found?.projectCode).toBe('MOST-SO201/26');

      await clearTestDatabase();
      const countAfter = await db.entries.count();
      expect(countAfter).toBe(0);
    });
  });

  describe('Canvas 2D Mock & CanvasSpy', () => {
    it('creates canvas and returns mock 2D context', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 200;

      const ctx = canvas.getContext('2d');
      expect(ctx).toBeDefined();
      expect(typeof ctx?.beginPath).toBe('function');
      expect(typeof ctx?.stroke).toBe('function');
      expect(typeof ctx?.fillText).toBe('function');
    });

    it('generates valid base64 data URLs for PNG and JPEG', () => {
      const canvas = document.createElement('canvas');
      const pngUrl = canvas.toDataURL('image/png');
      expect(pngUrl).toMatch(/^data:image\/png;base64,/);

      const jpegUrl = canvas.toDataURL('image/jpeg', 0.5);
      expect(jpegUrl).toMatch(/^data:image\/jpeg;base64,/);
      expect(jpegUrl.length).toBeGreaterThan(500);
    });

    it('spies on drawing operations using canvasSpy', () => {
      const canvas = document.createElement('canvas');
      const spy = attachCanvasSpy(canvas);
      const ctx = canvas.getContext('2d')!;

      ctx.beginPath();
      ctx.moveTo(10, 10);
      ctx.lineTo(50, 50);
      ctx.stroke();
      ctx.fillText('Montáž zábradlí S355', 20, 30);

      expect(spy.hasDrawnPath()).toBe(true);
      expect(spy.hasRenderedText('Montáž zábradlí')).toBe(true);
      expect(spy.getCalls('moveTo').length).toBe(1);
      expect(spy.getCalls('lineTo').length).toBe(1);

      const coords = spy.getStrokeCoordinates();
      expect(coords).toHaveLength(2);
      expect(coords[0]).toEqual({ type: 'moveTo', x: 10, y: 10 });
      expect(coords[1]).toEqual({ type: 'lineTo', x: 50, y: 50 });

      spy.restore();
    });
  });

  describe('URL and matchMedia Polyfills', () => {
    it('provides functional URL.createObjectURL and URL.revokeObjectURL', () => {
      const blob = new Blob(['test-data'], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      expect(typeof url).toBe('string');
      expect(url).toContain('blob:');

      expect(() => URL.revokeObjectURL(url)).not.toThrow();
    });

    it('provides window.matchMedia polyfill', () => {
      const mql = window.matchMedia('(prefers-color-scheme: dark)');
      expect(mql).toBeDefined();
      expect(typeof mql.addListener).toBe('function');
      expect(typeof mql.removeListener).toBe('function');
    });
  });

  describe('Fixtures Integrity & Interface Validation', () => {
    it('validates rates fixture against MPSV legal bands', () => {
      expect(STANDARD_RATES_FIXTURE.dietBand1Rate).toBe(MPSV_LEGAL_RATES_2026.tier1_5_to_12h);
      expect(STANDARD_RATES_FIXTURE.dietBand2Rate).toBe(MPSV_LEGAL_RATES_2026.tier2_12_to_18h);
      expect(STANDARD_RATES_FIXTURE.dietBand3Rate).toBe(MPSV_LEGAL_RATES_2026.tier3_over_18h);

      // Verify estimateDiet calculations against legal bands
      const dietUnder5 = estimateDiet(4.5, STANDARD_RATES_FIXTURE);
      expect(dietUnder5.allowance).toBe(0);
      expect(dietUnder5.type).toBe('none');

      const dietBand1 = estimateDiet(8.0, STANDARD_RATES_FIXTURE);
      expect(dietBand1.allowance).toBe(166);
      expect(dietBand1.type).toBe('band_1');

      const dietBand2 = estimateDiet(14.0, STANDARD_RATES_FIXTURE);
      expect(dietBand2.allowance).toBe(256);
      expect(dietBand2.type).toBe('band_2');

      const dietBand3 = estimateDiet(20.0, STANDARD_RATES_FIXTURE);
      expect(dietBand3.allowance).toBe(398);
      expect(dietBand3.type).toBe('band_3');
    });

    it('validates clients fixtures and PDP calculations', () => {
      expect(CLIENT_STANDARD_VAT.isPdp).toBe(false);
      expect(CLIENT_PDP_REVERSE_CHARGE.isPdp).toBe(true);

      const standardVat = calculateVatAndTotal(10000, false);
      expect(standardVat.vatRatePercent).toBe(21);
      expect(standardVat.vatAmount).toBe(2100);
      expect(standardVat.totalWithVat).toBe(12100);

      const pdpVat = calculateVatAndTotal(10000, true);
      expect(pdpVat.vatRatePercent).toBe(0);
      expect(pdpVat.vatAmount).toBe(0);
      expect(pdpVat.totalWithVat).toBe(10000);
      expect(pdpVat.statutoryClause).toBe(PDP_STATUTORY_CLAUSE);
    });

    it('validates contractor, signatures, photos, and shift fixtures', () => {
      expect(PRIMARY_CONTRACTOR_FIXTURE.ico).toBe('12345678');
      expect(CONTRACTOR_SIGNATURE_FIXTURE.role).toBe('contractor');
      expect(CLIENT_SIGNATURE_FIXTURE.role).toBe('client');
      expect(SAMPLE_ENTRY_PHOTO_FIXTURE.sizeBytes).toBeLessThan(500 * 1024);
      expect(SCENARIO_1_BRIDGE_RAILINGS.weldingPassport?.methodCode).toBe('141');
      expect(SCENARIO_1_BRIDGE_RAILINGS.consumableSlip?.items.length).toBeGreaterThan(0);
    });
  });
});
