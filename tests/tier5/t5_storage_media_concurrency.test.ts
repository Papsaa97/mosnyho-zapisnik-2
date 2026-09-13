import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { render, fireEvent } from '@testing-library/react';
import Dexie from 'dexie';

import {
  db,
  AppDatabase,
  addPhoto,
  getPhotosByEntryId,
  updatePhotoCaption,
  deletePhoto,
  deletePhotosByEntryId,
  updateEntrySignatures,
  checkStorageQuota,
  getDatabaseStorageEstimate,
  initializeDatabase,
  resetToDemoData,
} from '../../src/db';
import { DEFAULT_SETTINGS, DEFAULT_PRESETS, INITIAL_MOCK_ENTRIES } from '../../src/db/seedData';
import {
  MAX_PHOTO_BYTES,
  MAX_WIDTH,
  MAX_HEIGHT,
  MAX_DIMENSION,
  THUMB_WIDTH,
  THUMB_HEIGHT,
  validateImageFile,
  calculateTargetDimensions,
  calculateDownscaledDimensions,
  getByteSizeFromDataUrl,
  generateByteAccurateDataUrl,
  stampPhotoWatermark,
  compressImageToUnder500KB,
  processFieldPhoto,
  preparePhotosForProtocol,
} from '../../src/services/imageCompressionService';
import {
  SignaturePad,
  SignaturePadHandle,
  validateSignatureStrokes,
  MIN_SIGNATURE_POINTS,
} from '../../src/components/signature/SignaturePad';
import { SignaturePadModal } from '../../src/components/signature/SignaturePadModal';
import {
  shiftFormReducer,
  createInitialState,
  ShiftFormState,
  ShiftFormAction,
} from '../../src/components/form/shiftFormReducer';
import {
  EntryPhoto,
  WorkEntry,
  DualSignaturesRecord,
  ProtocolSignature,
  ConsumableItem,
  ConsumableSlip,
  SignatureStroke,
  QuickActionTag,
} from '../../src/types';
import { attachCanvasSpy } from '../helpers/canvasSpy';

describe('Phase 2 Tier 5: Adversarial Storage, Media & Concurrency Stress Test Suite', () => {

  // =========================================================================
  // SECTION 1: Offline Data Layer & Persistence (Dexie, Schema, Migrations, Quota & Concurrency)
  // =========================================================================
  describe('1. Offline Data Layer & Persistence', () => {
    beforeEach(async () => {
      if (!db.isOpen()) {
        await db.open();
      }
      await db.transaction('rw', db.entries, db.presets, db.settings, db.photos, async () => {
        await db.entries.clear();
        await db.presets.clear();
        await db.settings.clear();
        await db.photos.clear();
      });
    });

    afterEach(async () => {
      if (db.isOpen()) {
        await db.transaction('rw', db.entries, db.presets, db.settings, db.photos, async () => {
          await db.entries.clear();
          await db.presets.clear();
          await db.settings.clear();
          await db.photos.clear();
        });
      }
      vi.restoreAllMocks();
    });

    it('T1.1: Dexie schema exposes correct stores and indexing across version 1 and 2', () => {
      expect(db.name).toBe('MontazniZapisnikDB');
      expect(db.verno).toBe(2);

      const tableNames = db.tables.map(t => t.name);
      expect(tableNames).toContain('entries');
      expect(tableNames).toContain('presets');
      expect(tableNames).toContain('settings');
      expect(tableNames).toContain('photos');

      // Check photos store primary key and indexes
      const photosSchema = db.photos.schema;
      expect(photosSchema.primKey.name).toBe('id');
      const photoIndexes = photosSchema.indexes.map(idx => idx.name);
      expect(photoIndexes).toContain('entryId');
      expect(photoIndexes).toContain('createdAt');

      // Check entries store indexes
      const entriesSchema = db.entries.schema;
      expect(entriesSchema.primKey.name).toBe('id');
      const entryIndexes = entriesSchema.indexes.map(idx => idx.name);
      expect(entryIndexes).toContain('date');
      expect(entryIndexes).toContain('clientName');
      expect(entryIndexes).toContain('projectCode');
      expect(entryIndexes).toContain('status');
      expect(entryIndexes).toContain('workType');
      expect(entryIndexes).toContain('createdAt');
    });

    it('T1.2: Legacy migration from MosnyZapisnikDB migrates data, sanitizes contractor, and deletes legacy database', async () => {
      // 1. Setup legacy database
      const legacyDb = new Dexie('MosnyZapisnikDB');
      legacyDb.version(1).stores({
        entries: 'id, date, clientName, projectCode, status, workType, createdAt',
        presets: 'id, name, workType, isDefault',
        settings: 'id',
      });
      await legacyDb.open();

      const legacyEntry: WorkEntry = {
        id: 'legacy-entry-001',
        date: '2026-03-01',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        workType: 'workshop',
        weldingMethod: 'TIG',
        clientName: 'Legacy Client a.s.',
        projectCode: 'LEG-99',
        projectName: 'Legacy Project',
        status: 'completed',
        createdAt: '2026-03-01T07:00:00.000Z',
        updatedAt: '2026-03-01T15:30:00.000Z',
      };

      const legacyPreset = {
        id: 'legacy-preset-001',
        name: 'Legacy Preset',
        workType: 'site_assembly' as const,
        isDefault: false,
      };

      const legacySettings = {
        id: 'global_settings',
        contractor: {
          name: 'Michal Mošný - Svářečské práce',
          ico: '99999999',
          dic: 'CZ99999999',
          phone: '+420 777 000 000',
          email: 'michal.mosny@example.com',
          bankAccount: '123456789/0100',
        },
        rates: {
          ...DEFAULT_SETTINGS.rates,
          dietOver18Rate: undefined as any, // Simulate missing dietOver18Rate
        },
        clients: [],
      };

      await (legacyDb.table('entries') as any).put(legacyEntry);
      await (legacyDb.table('presets') as any).put(legacyPreset);
      await (legacyDb.table('settings') as any).put(legacySettings);
      legacyDb.close();

      // Verify legacy DB exists
      expect(await Dexie.exists('MosnyZapisnikDB')).toBe(true);

      // 2. Trigger initializeDatabase
      await initializeDatabase();

      // 3. Verify migrated entries & presets in db
      const migratedEntry = await db.entries.get('legacy-entry-001');
      expect(migratedEntry).toBeDefined();
      expect(migratedEntry?.clientName).toBe('Legacy Client a.s.');

      const migratedPreset = await db.presets.get('legacy-preset-001');
      expect(migratedPreset).toBeDefined();
      expect(migratedPreset?.name).toBe('Legacy Preset');

      // 4. Verify contractor data sanitization and dietOver18Rate backfilling
      const migratedSettings = await db.settings.get('global_settings');
      expect(migratedSettings).toBeDefined();
      expect(migratedSettings?.contractor.name).toBe(DEFAULT_SETTINGS.contractor.name);
      expect(migratedSettings?.contractor.name).not.toContain('Mošný');
      expect(migratedSettings?.rates.dietOver18Rate).toBe(DEFAULT_SETTINGS.rates.dietOver18Rate);

      // 5. Verify legacy database was deleted
      expect(await Dexie.exists('MosnyZapisnikDB')).toBe(false);
    });

    it('T1.3: initializeDatabase is idempotent and handles rapid sequential and concurrent invocations', async () => {
      // First initialization
      await initializeDatabase();
      const initialEntryCount = await db.entries.count();
      const initialPresetCount = await db.presets.count();
      const initialSettingsCount = await db.settings.count();

      expect(initialEntryCount).toBeGreaterThan(0);
      expect(initialPresetCount).toBeGreaterThan(0);
      expect(initialSettingsCount).toBe(1);

      // Rapid concurrent invocations
      await Promise.all([
        initializeDatabase(),
        initializeDatabase(),
        initializeDatabase(),
      ]);

      // Counts should not have duplicated
      expect(await db.entries.count()).toBe(initialEntryCount);
      expect(await db.presets.count()).toBe(initialPresetCount);
      expect(await db.settings.count()).toBe(initialSettingsCount);
    });

    it('T1.4: checkStorageQuota correctly warns at >80% quota usage and handles navigator.storage absence or errors', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      try {
        // 1. High quota scenario (> 80%)
        const mockEstimateHigh = vi.fn().mockResolvedValue({
          usage: 85 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
        });
        Object.defineProperty(navigator, 'storage', {
          value: { estimate: mockEstimateHigh, persist: vi.fn().mockResolvedValue(true) },
          configurable: true,
        });

        await checkStorageQuota();
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Storage nearly full: 85.0 MB / 100 MB (85%)'));
        const estimateResult = await getDatabaseStorageEstimate();
        expect(estimateResult).toEqual({
          usage: 85 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
          usedPercent: 85,
        });

        // 2. Normal quota scenario (< 80%)
        const mockEstimateNormal = vi.fn().mockResolvedValue({
          usage: 10 * 1024 * 1024,
          quota: 100 * 1024 * 1024,
        });
        Object.defineProperty(navigator, 'storage', {
          value: { estimate: mockEstimateNormal, persist: vi.fn().mockResolvedValue(true) },
          configurable: true,
        });

        await checkStorageQuota();
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Storage OK: 10.0 MB / 100 MB used'));

        // 3. Rejected promise / error in estimate
        const mockEstimateError = vi.fn().mockRejectedValue(new Error('Storage access denied'));
        Object.defineProperty(navigator, 'storage', {
          value: { estimate: mockEstimateError, persist: vi.fn().mockResolvedValue(true) },
          configurable: true,
        });

        await expect(checkStorageQuota()).resolves.not.toThrow();

        // 4. navigator.storage undefined
        Object.defineProperty(navigator, 'storage', {
          value: undefined,
          configurable: true,
        });
        await expect(checkStorageQuota()).resolves.not.toThrow();
        const estimateUndef = await getDatabaseStorageEstimate();
        expect(estimateUndef).toBeNull();
      } finally {
        Object.defineProperty(navigator, 'storage', {
          value: {
            persist: vi.fn().mockResolvedValue(true),
            estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 100 * 1024 * 1024 }),
          },
          configurable: true,
        });
      }
    });

    it('T1.5: QuotaExceededError in initializeDatabase dispatches db-quota-error event', async () => {
      const quotaError = new Error('Disk quota exceeded');
      quotaError.name = 'QuotaExceededError';

      vi.spyOn(console, 'error').mockImplementation(() => {});

      // Mock db.settings.count to throw QuotaExceededError
      vi.spyOn(db.settings, 'count').mockRejectedValueOnce(quotaError);

      let eventFired = false;
      let eventDetail: any = null;
      const listener = (e: Event) => {
        eventFired = true;
        eventDetail = (e as CustomEvent).detail;
      };
      window.addEventListener('db-quota-error', listener);

      try {
        await initializeDatabase();
        expect(eventFired).toBe(true);
        expect(eventDetail?.message).toContain('Paměť zařízení je plná');
      } finally {
        window.removeEventListener('db-quota-error', listener);
      }
    });

    it('T1.6: Cascade deletions: deletePhotosByEntryId deletes only associated photos and preserves other entries photos', async () => {
      const entryIdTarget = 'entry-target-123';
      const entryIdOther = 'entry-other-456';

      // Create 15 photos for target entry
      const targetPhotos: EntryPhoto[] = Array.from({ length: 15 }, (_, i) => ({
        id: `photo-target-${i + 1}`,
        entryId: entryIdTarget,
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        thumbnailUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        sizeBytes: 15000,
        width: 1920,
        height: 1080,
        caption: `Target photo ${i + 1}`,
      }));

      // Create 10 photos for other entry
      const otherPhotos: EntryPhoto[] = Array.from({ length: 10 }, (_, i) => ({
        id: `photo-other-${i + 1}`,
        entryId: entryIdOther,
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
        dataUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        thumbnailUrl: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        sizeBytes: 15000,
        width: 1920,
        height: 1080,
        caption: `Other photo ${i + 1}`,
      }));

      await db.photos.bulkPut([...targetPhotos, ...otherPhotos]);
      expect(await db.photos.count()).toBe(25);

      // Perform cascade deletion of target entry photos
      const deletedCount = await deletePhotosByEntryId(entryIdTarget);
      expect(deletedCount).toBe(15);

      // Verify target photos are 0
      const remainingTargetPhotos = await getPhotosByEntryId(entryIdTarget);
      expect(remainingTargetPhotos).toHaveLength(0);

      // Verify other photos remain intact
      const remainingOtherPhotos = await getPhotosByEntryId(entryIdOther);
      expect(remainingOtherPhotos).toHaveLength(10);
      expect(await db.photos.count()).toBe(10);
    });

    it('T1.7: Individual photo operations: deletePhoto, updatePhotoCaption, and non-existent delete', async () => {
      const photo: EntryPhoto = {
        id: 'photo-single-001',
        entryId: 'entry-single',
        createdAt: '2026-09-13T10:00:00.000Z',
        dataUrl: 'data:image/jpeg;base64,/9j/test',
        thumbnailUrl: 'data:image/jpeg;base64,/9j/thumb',
        sizeBytes: 2048,
        width: 1920,
        height: 1080,
        caption: 'Původní popisek',
      };

      await addPhoto(photo);
      expect(await db.photos.get('photo-single-001')).toBeDefined();

      // Update caption
      const updated = await updatePhotoCaption('photo-single-001', 'Nový aktualizovaný popisek');
      expect(updated).toBe(1);
      const retrieved = await db.photos.get('photo-single-001');
      expect(retrieved?.caption).toBe('Nový aktualizovaný popisek');
      expect(retrieved?.dataUrl).toBe(photo.dataUrl);

      // Delete photo
      await deletePhoto('photo-single-001');
      expect(await db.photos.get('photo-single-001')).toBeUndefined();

      // Deleting non-existent entry photos returns 0 without error
      const zeroDeleted = await deletePhotosByEntryId('non-existent-entry');
      expect(zeroDeleted).toBe(0);
    });

    it('T1.8: resetToDemoData executes in an atomic transaction clearing and restoring seed data', async () => {
      // Add custom dirty records
      await db.entries.put({ id: 'dirty-entry-1', date: '2026-09-13', clientName: 'Dirty Client' } as any);
      await db.photos.put({ id: 'dirty-photo-1', entryId: 'dirty-entry-1' } as any);

      expect(await db.entries.count()).toBeGreaterThan(0);
      expect(await db.photos.count()).toBe(1);

      await resetToDemoData();

      // Dirty records cleared
      expect(await db.photos.count()).toBe(0);
      expect(await db.entries.get('dirty-entry-1')).toBeUndefined();

      // Defaults reseeded
      expect(await db.entries.count()).toBe(INITIAL_MOCK_ENTRIES.length);
      expect(await db.presets.count()).toBe(DEFAULT_PRESETS.length);
      const settings = await db.settings.get('global_settings');
      expect(settings).toBeDefined();
      expect(settings?.contractor.ico).toBe(DEFAULT_SETTINGS.contractor.ico);
    });

    it('T1.9: High-concurrency writes: 50 simultaneous addPhoto calls across multiple entries persist without race corruption', async () => {
      const totalPhotos = 50;
      const entries = ['ent-A', 'ent-B', 'ent-C', 'ent-D', 'ent-E'];

      const photos: EntryPhoto[] = Array.from({ length: totalPhotos }, (_, idx) => {
        const entryId = entries[idx % entries.length];
        return {
          id: `concurrent-photo-${idx + 1}`,
          entryId,
          createdAt: new Date(1700000000000 + idx * 1000).toISOString(),
          dataUrl: `data:image/jpeg;base64,payload${idx}`,
          thumbnailUrl: `data:image/jpeg;base64,thumb${idx}`,
          sizeBytes: 10000 + idx,
          width: 1920,
          height: 1080,
          caption: `Photo ${idx + 1}`,
        };
      });

      // Fire 50 simultaneous asynchronous writes
      await Promise.all(photos.map(p => addPhoto(p)));

      // Assert all 50 photos persisted
      expect(await db.photos.count()).toBe(50);

      // Verify each entry has exactly 10 photos
      for (const entryId of entries) {
        const entryPhotos = await getPhotosByEntryId(entryId);
        expect(entryPhotos).toHaveLength(10);
      }
    });

    it('T1.10: Concurrent updateEntrySignatures calls maintain data integrity', async () => {
      const entryId = 'entry-sig-test';
      await db.entries.put({
        id: entryId,
        date: '2026-09-13',
        clientName: 'Signature Test Client',
        signatures: undefined,
      } as any);

      const roles = ['contractor', 'client'] as const;
      const updates = Array.from({ length: 20 }, (_, idx) => {
        const sigRole = roles[idx % 2];
        const record: DualSignaturesRecord = {
          [sigRole]: {
            dataUrl: `data:image/png;base64,sig_${idx}`,
            signerName: `Signer ${idx}`,
            signedAt: new Date(1700000000000 + idx * 1000).toISOString(),
            role: sigRole,
          },
        };
        return updateEntrySignatures(entryId, record);
      });

      const results = await Promise.all(updates);
      expect(results.every(r => r === 1)).toBe(true);

      const finalEntry = await db.entries.get(entryId);
      expect(finalEntry).toBeDefined();
      expect(finalEntry?.signatures).toBeDefined();
    });

    it('T1.11: Large batch operations: 300+ entry bulkPut and multi-index query performance', async () => {
      const batchSize = 300;
      const testEntries: WorkEntry[] = Array.from({ length: batchSize }, (_, idx) => ({
        id: `bulk-entry-${idx + 1}`,
        date: `2026-0${1 + (idx % 9)}-${String(1 + (idx % 28)).padStart(2, '0')}`,
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        workType: (idx % 2 === 0 ? 'workshop' : 'site_assembly') as any,
        weldingMethod: (idx % 3 === 0 ? 'TIG' : idx % 3 === 1 ? 'MIG_MAG' : 'MMA') as any,
        clientName: idx % 4 === 0 ? 'Metrostav DIZ s.r.o.' : 'STRABAG a.s.',
        projectCode: `PRJ-${idx % 10}`,
        projectName: `Project ${idx}`,
        status: idx % 5 === 0 ? 'invoiced' : idx % 5 === 1 ? 'approved' : 'draft',
        createdAt: new Date(1700000000000 + idx * 60000).toISOString(),
        updatedAt: new Date(1700000000000 + idx * 60000).toISOString(),
      }));

      // Bulk write
      await db.entries.bulkPut(testEntries);
      expect(await db.entries.count()).toBe(batchSize);

      // Indexed queries
      const invoicedEntries = await db.entries.where('status').equals('invoiced').toArray();
      expect(invoicedEntries.length).toBe(Math.ceil(batchSize / 5));

      const metrostavEntries = await db.entries.where('clientName').equals('Metrostav DIZ s.r.o.').toArray();
      expect(metrostavEntries.length).toBe(Math.ceil(batchSize / 4));

      // Range query on date
      const marchEntries = await db.entries.where('date').between('2026-03-01', '2026-03-31', true, true).toArray();
      expect(marchEntries.length).toBeGreaterThan(0);
    });

    it('T1.12: Interleaved concurrent photo adds and batch deletions run without index deadlocks', async () => {
      const entryId = 'interleaved-entry';
      const initialPhotos: EntryPhoto[] = Array.from({ length: 20 }, (_, idx) => ({
        id: `inter-p-${idx}`,
        entryId,
        createdAt: new Date().toISOString(),
        dataUrl: 'data:image/jpeg;base64,data',
        thumbnailUrl: 'data:image/jpeg;base64,thumb',
        sizeBytes: 1000,
        width: 100,
        height: 100,
      }));
      await db.photos.bulkPut(initialPhotos);

      // Run concurrent additions and deletions simultaneously
      const newPhoto: EntryPhoto = {
        id: 'inter-new-1',
        entryId,
        createdAt: new Date().toISOString(),
        dataUrl: 'data:image/jpeg;base64,new',
        thumbnailUrl: 'data:image/jpeg;base64,new',
        sizeBytes: 1000,
        width: 100,
        height: 100,
      };

      await Promise.all([
        addPhoto(newPhoto),
        deletePhoto('inter-p-5'),
        deletePhoto('inter-p-10'),
        updatePhotoCaption('inter-p-1', 'Updated'),
      ]);

      const remaining = await getPhotosByEntryId(entryId);
      expect(remaining.find(p => p.id === 'inter-new-1')).toBeDefined();
      expect(remaining.find(p => p.id === 'inter-p-5')).toBeUndefined();
      expect(remaining.find(p => p.id === 'inter-p-10')).toBeUndefined();
      expect(remaining.find(p => p.id === 'inter-p-1')?.caption).toBe('Updated');
    });
  });

  // =========================================================================
  // SECTION 2: Media Processing, Canvas Resizing, Titration & Base64 Hardening
  // =========================================================================
  describe('2. Media Processing & Canvas Resizing Adversarial Suite', () => {

    it('T2.1: calculateDownscaledDimensions handles extreme aspect ratios (50:1, 1:50, huge square)', () => {
      // Panoramic 50:1 (25,000 x 500)
      const panorama = calculateDownscaledDimensions(25000, 500, MAX_DIMENSION);
      expect(panorama.width).toBe(MAX_DIMENSION); // 1920
      expect(panorama.height).toBe(Math.round(500 * (1920 / 25000))); // 38
      expect(panorama.width).toBeLessThanOrEqual(MAX_DIMENSION);
      expect(panorama.height).toBeLessThanOrEqual(MAX_DIMENSION);

      // Vertical 1:50 (500 x 25,000)
      const vertical = calculateDownscaledDimensions(500, 25000, MAX_DIMENSION);
      expect(vertical.height).toBe(MAX_DIMENSION); // 1920
      expect(vertical.width).toBe(Math.round(500 * (1920 / 25000))); // 38

      // Huge square (30,000 x 30,000)
      const square = calculateDownscaledDimensions(30000, 30000, MAX_DIMENSION);
      expect(square.width).toBe(MAX_DIMENSION);
      expect(square.height).toBe(MAX_DIMENSION);

      // 1x1 micro image
      const micro = calculateDownscaledDimensions(1, 1, MAX_DIMENSION);
      expect(micro.width).toBe(1);
      expect(micro.height).toBe(1);

      // Under max bounds image (800 x 600)
      const underMax = calculateDownscaledDimensions(800, 600, MAX_DIMENSION);
      expect(underMax.width).toBe(800);
      expect(underMax.height).toBe(600);
    });

    it('T2.2: calculateDownscaledDimensions rejects zero and negative dimensions with descriptive error', () => {
      expect(() => calculateDownscaledDimensions(0, 100)).toThrow('Invalid image dimensions');
      expect(() => calculateDownscaledDimensions(100, 0)).toThrow('Invalid image dimensions');
      expect(() => calculateDownscaledDimensions(-10, 100)).toThrow('Invalid image dimensions');
      expect(() => calculateDownscaledDimensions(100, -50)).toThrow('Invalid image dimensions');
    });

    it('T2.3: calculateTargetDimensions performs bounding box clamping with aspect ratio preservation', () => {
      // Exceeding both width and height
      const res1 = calculateTargetDimensions(3840, 2160, MAX_WIDTH, MAX_HEIGHT);
      expect(res1.width).toBe(1920);
      expect(res1.height).toBe(1080);

      // Extreme wide
      const resWide = calculateTargetDimensions(10000, 100, MAX_WIDTH, MAX_HEIGHT);
      expect(resWide.width).toBe(1920);
      expect(resWide.height).toBe(19);

      // Extreme tall
      const resTall = calculateTargetDimensions(100, 10000, MAX_WIDTH, MAX_HEIGHT);
      expect(resTall.width).toBe(11);
      expect(resTall.height).toBe(1080);

      // Within bounding box
      const resWithin = calculateTargetDimensions(1280, 720, MAX_WIDTH, MAX_HEIGHT);
      expect(resWithin.width).toBe(1280);
      expect(resWithin.height).toBe(720);
    });

    it('T2.4: compressImageToUnder500KB titration behavior and limits across boundary inputs', () => {
      // 1. Sub-500KB initial size (300 KB) -> immediate return without quality degradation
      const sub500 = compressImageToUnder500KB(300 * 1024);
      expect(sub500.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
      expect(sub500.iterations).toBe(1);
      expect(sub500.qualityApplied).toBe(0.82);

      // 2. Exactly at MAX_PHOTO_BYTES (512,000 bytes) boundary -> successfully titrated < 500 KB
      const exactBound = compressImageToUnder500KB(MAX_PHOTO_BYTES);
      expect(exactBound.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);

      // 3. Just over boundary (512,001 bytes) -> successfully titrated < 500 KB
      const justOver = compressImageToUnder500KB(MAX_PHOTO_BYTES + 1);
      expect(justOver.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);

      // 4. 1.2 MB photo (1,200 * 1024 = 1,228,800 bytes) -> fits within standard titration threshold (< 1.29 MB)
      const photo1200KB = compressImageToUnder500KB(1200 * 1024);
      expect(photo1200KB.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);

      // 5. HARDENED TITRATION: Inputs > 1.29 MB (e.g. 2 MB or 20 MB)
      // compressImageToUnder500KB applies iterative scaling until final size is strictly < MAX_PHOTO_BYTES
      const photo2MB = compressImageToUnder500KB(2 * 1024 * 1024);
      expect(photo2MB.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
      expect(photo2MB.iterations).toBeGreaterThanOrEqual(5);

      const photo20MB = compressImageToUnder500KB(20 * 1024 * 1024);
      expect(photo20MB.finalSizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
    });

    it('T2.5: getByteSizeFromDataUrl & generateByteAccurateDataUrl produce exact round-trip byte sizes', () => {
      const testSizes = [0, 1, 2, 3, 4, 10, 100, 1024, 250000, 511999, 512000, 512001];

      for (const expectedBytes of testSizes) {
        const dataUrl = generateByteAccurateDataUrl(expectedBytes);
        const actualBytes = getByteSizeFromDataUrl(dataUrl);
        expect(actualBytes).toBe(expectedBytes);
      }
    });

    it('T2.6: getByteSizeFromDataUrl handles base64 padding and throws on corrupted/malformed inputs', () => {
      // Valid data URLs with different paddings
      const url0Pad = 'data:image/png;base64,AAAA'; // 3 bytes
      const url1Pad = 'data:image/png;base64,AAA='; // 2 bytes
      const url2Pad = 'data:image/png;base64,AA=='; // 1 byte

      expect(getByteSizeFromDataUrl(url0Pad)).toBe(3);
      expect(getByteSizeFromDataUrl(url1Pad)).toBe(2);
      expect(getByteSizeFromDataUrl(url2Pad)).toBe(1);

      // Empty payload
      expect(getByteSizeFromDataUrl('data:image/jpeg;base64,')).toBe(0);

      // Malformed inputs
      expect(() => getByteSizeFromDataUrl('')).toThrow('Invalid data URL format');
      expect(() => getByteSizeFromDataUrl(null as any)).toThrow('Invalid data URL format');
      expect(() => getByteSizeFromDataUrl('http://example.com/photo.jpg')).toThrow('Invalid data URL format');
      expect(() => getByteSizeFromDataUrl('data:image/png;base64noCommaHere')).toThrow('Malformed data URL: missing payload');
    });

    it('T2.7: stampPhotoWatermark renders high-contrast watermark pill with full and minimal options', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const spy = attachCanvasSpy(canvas);

      // Full options
      stampPhotoWatermark(canvas, {
        projectCode: 'Hala-C',
        projectName: 'Montáž ocelových nosníků',
        welderName: 'Jan Novák',
        activityCaption: 'Kořenový svár TIG 141',
        timestamp: '2026-09-13T14:30:00.000Z',
      });

      expect(spy.getCalls('fillRect').length).toBeGreaterThanOrEqual(2); // dark pill + amber accent bar
      expect(spy.hasRenderedText('Hala-C • Montáž ocelových nosníků')).toBe(true);
      expect(spy.hasRenderedText('Jan Novák')).toBe(true);
      expect(spy.hasRenderedText('Kořenový svár TIG 141')).toBe(true);

      // Minimal options (missing optional fields)
      spy.reset();
      stampPhotoWatermark(canvas, {
        projectCode: '',
        projectName: '',
        welderName: '',
        activityCaption: '',
      });

      expect(spy.getCalls('fillRect').length).toBeGreaterThanOrEqual(2);
      expect(spy.getCalls('fillText').length).toBe(2);
    });

    it('T2.8: stampPhotoWatermark adapts to extreme canvas scales without out-of-bounds positioning', () => {
      // Tiny thumbnail canvas (150x100)
      const tinyCanvas = document.createElement('canvas');
      tinyCanvas.width = 150;
      tinyCanvas.height = 100;
      const tinySpy = attachCanvasSpy(tinyCanvas);

      expect(() => {
        stampPhotoWatermark(tinyCanvas, {
          projectCode: 'TINY',
          projectName: 'Mini Test',
          welderName: 'Welder',
        });
      }).not.toThrow();
      expect(tinySpy.getCalls('fillRect').length).toBeGreaterThanOrEqual(2);

      // Huge 4K canvas (3840x2160)
      const bigCanvas = document.createElement('canvas');
      bigCanvas.width = 3840;
      bigCanvas.height = 2160;
      const bigSpy = attachCanvasSpy(bigCanvas);

      expect(() => {
        stampPhotoWatermark(bigCanvas, {
          projectCode: '4K-PRJ',
          projectName: 'Massive Resolution',
          welderName: 'Welder',
        });
      }).not.toThrow();
      expect(bigSpy.getCalls('fillRect').length).toBeGreaterThanOrEqual(2);
    });

    it('T2.9: validateImageFile validates formats case-insensitively and enforces 50 MB threshold', () => {
      // Valid formats
      expect(validateImageFile({ type: 'image/jpeg', size: 1024 }).valid).toBe(true);
      expect(validateImageFile({ type: 'IMAGE/PNG', size: 2048 }).valid).toBe(true);
      expect(validateImageFile({ type: 'image/webp', size: 4096 }).valid).toBe(true);
      expect(validateImageFile({ type: 'image/heic', size: 8192 }).valid).toBe(true);
      expect(validateImageFile({ type: 'image/heif', size: 16384 }).valid).toBe(true);

      // Invalid formats
      expect(validateImageFile({ type: 'image/gif', size: 1024 }).valid).toBe(false);
      expect(validateImageFile({ type: 'application/pdf', size: 1024 }).valid).toBe(false);
      expect(validateImageFile({ type: '', size: 1024 }).valid).toBe(false);

      // 50 MB boundary
      const maxAllowed = 50 * 1024 * 1024;
      expect(validateImageFile({ type: 'image/jpeg', size: maxAllowed }).valid).toBe(true);
      const overAllowed = maxAllowed + 1;
      const resOver = validateImageFile({ type: 'image/jpeg', size: overAllowed });
      expect(resOver.valid).toBe(false);
      expect(resOver.error).toContain('50 MB');
    });

    it('T2.10: preparePhotosForProtocol safely transforms photos and provides fallback captions', () => {
      expect(preparePhotosForProtocol(undefined)).toEqual([]);
      expect(preparePhotosForProtocol([])).toEqual([]);

      const samplePhotos: EntryPhoto[] = [
        {
          id: 'p1',
          entryId: 'e1',
          createdAt: '2026-09-13T14:30:00.000Z',
          dataUrl: 'data:image/jpeg;base64,data1',
          thumbnailUrl: 'data:image/jpeg;base64,thumb1',
          sizeBytes: 12000,
          width: 800,
          height: 600,
          caption: 'Koutový svár',
        },
        {
          id: 'p2',
          entryId: 'e1',
          createdAt: '2026-09-13T16:45:00.000Z',
          dataUrl: 'data:image/jpeg;base64,data2',
          thumbnailUrl: 'data:image/jpeg;base64,thumb2',
          sizeBytes: 14000,
          width: 800,
          height: 600,
          caption: '', // empty caption should fallback
        },
      ];

      const prepared = preparePhotosForProtocol(samplePhotos);
      expect(prepared).toHaveLength(2);
      expect(prepared[0].id).toBe('p1');
      expect(prepared[0].caption).toBe('Koutový svár');
      expect(prepared[0].dateStr).toMatch(/\d{2}\.\s*\d{2}\.\s*\d{4}/);
      expect(prepared[0].timeStr).toMatch(/\d{2}:\d{2}/);

      expect(prepared[1].caption).toBe('Bez popisu');
    });

    it('T2.11: processFieldPhoto pipeline downscales, stamps watermark, generates thumbnail, and titrates output', async () => {
      const origCreateImageBitmap = (globalThis as any).createImageBitmap;
      (globalThis as any).createImageBitmap = vi.fn().mockResolvedValue({
        width: 1920,
        height: 1080,
        close: vi.fn(),
      });

      try {
        const dummyFile = new File(['fake-raw-jpeg-bytes'], 'weld_sample.jpg', { type: 'image/jpeg' });
        const result = await processFieldPhoto({
          file: dummyFile,
          projectCode: 'PIPE-01',
          projectName: 'Stainless Piping',
          welderName: 'Petr Svoboda',
          caption: 'TIG svár potrubí',
        });

        expect(result).toBeDefined();
        expect(result.fullDataUrl).toMatch(/^data:image\/jpeg;base64,/);
        expect(result.thumbnailDataUrl).toMatch(/^data:image\/jpeg;base64,/);
        expect(result.sizeBytes).toBeLessThan(MAX_PHOTO_BYTES);
        expect(result.width).toBeLessThanOrEqual(MAX_DIMENSION);
        expect(result.height).toBeLessThanOrEqual(MAX_HEIGHT);
      } finally {
        (globalThis as any).createImageBitmap = origCreateImageBitmap;
      }
    });
  });

  // =========================================================================
  // SECTION 3: High-DPI Canvas Buffer, Pointer Events, Churn & Palm Rejection
  // =========================================================================
  describe('3. High-DPI Canvas Buffer, Pointer Events & Churn', () => {
    let originalDpr: number;

    beforeEach(() => {
      originalDpr = window.devicePixelRatio;
    });

    afterEach(() => {
      Object.defineProperty(window, 'devicePixelRatio', { value: originalDpr, configurable: true });
    });

    it('T3.1: High DPR scaling accurately calculates backing buffer dimensions for fractional and integer DPRs', () => {
      const dprs = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
      const cssW = 400;
      const cssH = 200;

      for (const dpr of dprs) {
        Object.defineProperty(window, 'devicePixelRatio', { value: dpr, configurable: true });
        const padRef = React.createRef<SignaturePadHandle>();
        const { container, unmount } = render(React.createElement(SignaturePad, { ref: padRef, width: cssW, height: cssH }));
        const canvas = container.querySelector('canvas')!;

        // DPR >= 1 clamped in component: Math.max(dpr, 1)
        const effectiveDpr = Math.max(dpr, 1);
        expect(canvas.width).toBe(Math.round(cssW * effectiveDpr));
        expect(canvas.height).toBe(Math.round(cssH * effectiveDpr));
        expect(canvas.style.width).toBe(`${cssW}px`);
        expect(canvas.style.height).toBe(`${cssH}px`);

        unmount();
      }
    });

    it('T3.2: Redraw resets transform to identity to clear full physical backing buffer without clip artifacts', () => {
      Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(React.createElement(SignaturePad, { ref: padRef, width: 400, height: 200 }));
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d') as any;

      // Draw a stroke
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 20, clientY: 20, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 50 });
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      // Assert setTransform(1, 0, 0, 1, 0, 0) was called to reset before clearRect
      expect(ctx.setTransform).toHaveBeenCalledWith(1, 0, 0, 1, 0, 0);
      expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, canvas.width, canvas.height);
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('T3.3: Rapid pointerdown -> pointercancel burst (50 cycles) leaves stroke history empty', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(React.createElement(SignaturePad, { ref: padRef, width: 400, height: 200 }));
      const canvas = container.querySelector('canvas')!;

      canvas.setPointerCapture = vi.fn();
      canvas.releasePointerCapture = vi.fn();
      canvas.hasPointerCapture = vi.fn().mockReturnValue(true);

      for (let i = 0; i < 50; i++) {
        act(() => {
          fireEvent.pointerDown(canvas, { pointerId: i + 1, clientX: 50 + i, clientY: 50 + i, isPrimary: true });
          fireEvent.pointerMove(canvas, { pointerId: i + 1, clientX: 60 + i, clientY: 60 + i });
          fireEvent.pointerCancel(canvas, { pointerId: i + 1 });
        });
      }

      expect(padRef.current?.getStrokes()).toHaveLength(0);
      expect(padRef.current?.isEmpty()).toBe(true);
      expect(padRef.current?.canUndo()).toBe(false);
      expect(canvas.releasePointerCapture).toHaveBeenCalledTimes(50);
    });

    it('T3.4: Palm rejection filters out secondary pointers and allows primary drawing to complete', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(React.createElement(SignaturePad, { ref: padRef, width: 400, height: 200 }));
      const canvas = container.querySelector('canvas')!;

      canvas.setPointerCapture = vi.fn();
      canvas.releasePointerCapture = vi.fn();

      // Stylus starts drawing (pointerId: 10)
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 10, clientX: 50, clientY: 50, isPrimary: true });
      });

      // Palm contacts (pointerId: 20, isPrimary: false)
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 20, clientX: 200, clientY: 150, isPrimary: false });
        fireEvent.pointerMove(canvas, { pointerId: 20, clientX: 210, clientY: 160, isPrimary: false });
        fireEvent.pointerUp(canvas, { pointerId: 20, isPrimary: false });
      });

      // Stylus finishes stroke
      act(() => {
        fireEvent.pointerMove(canvas, { pointerId: 10, clientX: 70, clientY: 70, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 10, clientX: 90, clientY: 90, isPrimary: true });
        fireEvent.pointerUp(canvas, { pointerId: 10, isPrimary: true });
      });

      const strokes = padRef.current?.getStrokes();
      expect(strokes).toHaveLength(1);
      expect(strokes![0].points).toHaveLength(3);
      expect(strokes![0].points.map(p => p.x)).toEqual([50, 70, 90]);
    });

    it('T3.5: Accidental tap / micro-stroke validation engine rejects static taps and zero movement', () => {
      // 0 strokes
      expect(validateSignatureStrokes([]).isValid).toBe(false);

      // Single tap
      const tap1 = [{ points: [{ x: 50, y: 50 }] }];
      const resTap1 = validateSignatureStrokes(tap1);
      expect(resTap1.isValid).toBe(false);
      expect(resTap1.reason).toContain('too short');

      // 2 points
      const tap2 = [{ points: [{ x: 50, y: 50 }, { x: 51, y: 50 }] }];
      const resTap2 = validateSignatureStrokes(tap2);
      expect(resTap2.isValid).toBe(false);

      // 10 points at exact same pixel (width < 2 && height < 2)
      const staticTap = [{
        points: Array.from({ length: 10 }, () => ({ x: 100, y: 100 })),
      }];
      const resStatic = validateSignatureStrokes(staticTap);
      expect(resStatic.isValid).toBe(false);
      expect(resStatic.reason).toContain('zero movement area');

      // Valid cursive signature
      const validSig = [{
        points: [{ x: 50, y: 50 }, { x: 80, y: 100 }, { x: 120, y: 70 }],
      }];
      const resValid = validateSignatureStrokes(validSig);
      expect(resValid.isValid).toBe(true);
      expect(resValid.totalPoints).toBe(3);
      expect(resValid.boundingBox?.width).toBe(70);
      expect(resValid.boundingBox?.height).toBe(50);
    });

    it('T3.6: Bounding box trimming handles boundary coordinates safely and returns null for blank canvas', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(React.createElement(SignaturePad, { ref: padRef, width: 400, height: 200 }));
      const canvas = container.querySelector('canvas')!;
      const ctx = canvas.getContext('2d')!;

      // 1. Completely blank canvas with no strokes returns null
      expect(padRef.current?.getTrimmedDataUrl()).toBeNull();

      // 2. Stroke present but canvas transparent
      act(() => {
        fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 10, clientY: 10, isPrimary: true });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 30, clientY: 30 });
        fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 50, clientY: 50 });
        fireEvent.pointerUp(canvas, { pointerId: 1 });
      });

      // Override getImageData to simulate transparent buffer
      const transparentBuffer = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      ctx.getImageData = vi.fn(() => ({
        width: canvas.width,
        height: canvas.height,
        data: transparentBuffer,
        colorSpace: 'srgb' as PredefinedColorSpace,
      }));

      expect(padRef.current?.getTrimmedDataUrl()).toBeNull();

      // 3. Pixel at origin (0, 0) with padding clamps without negative coordinates
      const originBuffer = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      originBuffer[3] = 255; // Alpha at (0, 0)
      ctx.getImageData = vi.fn(() => ({
        width: canvas.width,
        height: canvas.height,
        data: originBuffer,
        colorSpace: 'srgb' as PredefinedColorSpace,
      }));

      const trimmedOrigin = padRef.current?.getTrimmedDataUrl(16, 0);
      expect(trimmedOrigin).not.toBeNull();
      expect(trimmedOrigin).toMatch(/^data:image\/png;base64,/);
    });

    it('T3.7: Signature history stack: undo/redo alternating stress, over-undo/over-redo resilience, and redo stack invalidation on new stroke', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      const { container } = render(React.createElement(SignaturePad, { ref: padRef, width: 400, height: 200 }));
      const canvas = container.querySelector('canvas')!;

      const drawStroke = (x: number, y: number, id: number) => {
        act(() => {
          fireEvent.pointerDown(canvas, { pointerId: id, clientX: x, clientY: y, isPrimary: true });
          fireEvent.pointerMove(canvas, { pointerId: id, clientX: x + 10, clientY: y + 10 });
          fireEvent.pointerMove(canvas, { pointerId: id, clientX: x + 20, clientY: y + 20 });
          fireEvent.pointerUp(canvas, { pointerId: id });
        });
      };

      drawStroke(10, 10, 1);
      drawStroke(40, 40, 2);
      drawStroke(80, 80, 3);
      expect(padRef.current?.getStrokes()).toHaveLength(3);
      expect(padRef.current?.canUndo()).toBe(true);
      expect(padRef.current?.canRedo()).toBe(false);

      // Undo 1 stroke
      act(() => {
        expect(padRef.current?.undo()).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(2);
      expect(padRef.current?.canRedo()).toBe(true);

      // Draw brand new stroke -> redo stack MUST be cleared
      drawStroke(120, 120, 4);
      expect(padRef.current?.getStrokes()).toHaveLength(3);
      expect(padRef.current?.canRedo()).toBe(false);
      act(() => {
        expect(padRef.current?.redo()).toBe(false);
      });

      // Undo all 3 strokes down to empty
      act(() => {
        expect(padRef.current?.undo()).toBe(true);
      });
      act(() => {
        expect(padRef.current?.undo()).toBe(true);
      });
      act(() => {
        expect(padRef.current?.undo()).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(0);
      expect(padRef.current?.isEmpty()).toBe(true);
      expect(padRef.current?.canUndo()).toBe(false);

      // Over-undoing on empty history returns false safely
      act(() => {
        expect(padRef.current?.undo()).toBe(false);
      });

      // Redo all 3 strokes back
      act(() => {
        expect(padRef.current?.redo()).toBe(true);
      });
      act(() => {
        expect(padRef.current?.redo()).toBe(true);
      });
      act(() => {
        expect(padRef.current?.redo()).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(3);
      expect(padRef.current?.canRedo()).toBe(false);

      // Over-redoing returns false safely
      act(() => {
        expect(padRef.current?.redo()).toBe(false);
      });

      // Clear operation resets strokes, redo stack, and emptiness
      act(() => {
        padRef.current?.clear();
      });
      expect(padRef.current?.getStrokes()).toHaveLength(0);
      expect(padRef.current?.isEmpty()).toBe(true);
      expect(padRef.current?.canUndo()).toBe(false);
      expect(padRef.current?.canRedo()).toBe(false);
    });

    it('T3.8: Multi-undo in a single synchronous tick pops successive strokes deterministically', () => {
      const padRef = React.createRef<SignaturePadHandle>();
      render(React.createElement(SignaturePad, { ref: padRef, width: 400, height: 200 }));

      const canvas = document.querySelector('canvas')!;
      const drawStroke = (startX: number, startY: number, id: number) => {
        fireEvent.pointerDown(canvas, { pointerId: id, isPrimary: true, clientX: startX, clientY: startY, pressure: 0.5 });
        fireEvent.pointerMove(canvas, { pointerId: id, isPrimary: true, clientX: startX + 10, clientY: startY + 10, pressure: 0.5 });
        fireEvent.pointerUp(canvas, { pointerId: id, isPrimary: true, clientX: startX + 20, clientY: startY + 20, pressure: 0.5 });
      };

      drawStroke(10, 10, 1);
      drawStroke(50, 50, 2);
      drawStroke(90, 90, 3);
      expect(padRef.current?.getStrokes()).toHaveLength(3);

      // Multiple synchronous undos in the exact same tick
      act(() => {
        expect(padRef.current?.undo()).toBe(true);
        expect(padRef.current?.undo()).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(1);

      act(() => {
        expect(padRef.current?.undo()).toBe(true);
      });
      expect(padRef.current?.getStrokes()).toHaveLength(0);
      expect(padRef.current?.undo()).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 4: UI Lifecycle, Reducer Stress & State Integration
  // =========================================================================
  describe('4. UI Lifecycle, Reducer Stress & State Integration', () => {
    let initialState: ShiftFormState;

    beforeEach(() => {
      initialState = createInitialState(null, null, {
        clients: DEFAULT_SETTINGS.clients,
        rates: DEFAULT_SETTINGS.rates,
      });
    });

    it('T4.1: shiftFormReducer executes 15-step action pipeline without mutating state in-place', () => {
      let state = initialState;
      const history: ShiftFormState[] = [state];

      const actions: ShiftFormAction[] = [
        { type: 'SET_FIELD', field: 'projectCode', value: 'ADV-STRESS-01' },
        { type: 'SET_FIELD', field: 'projectName', value: 'Most přes Labe' },
        { type: 'TOGGLE_SURCHARGE', surcharge: 'weekend' },
        { type: 'TOGGLE_SURCHARGE', surcharge: 'night' },
        { type: 'TOGGLE_SURCHARGE', surcharge: 'weekend' }, // toggle off weekend
        { type: 'ADD_EXTRA', item: { id: 'extra-1', description: 'Kotouče', cost: 450, category: 'materials' } },
        { type: 'APPEND_NOTE_TAG', tag: 'Svar proveden v ochranné atmosféře' },
        { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Svařování' },
        { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Montáž ve výškách' },
        {
          type: 'ADD_CONSUMABLE_ITEM',
          item: {
            id: 'cons-1',
            category: 'cutting_grinding',
            name: 'Řezný kotouč 125x1.0',
            quantity: 10,
            unit: 'ks',
            unitPrice: 35,
            billedPrice: 350,
          },
        },
        { type: 'UPDATE_CONSUMABLE_ITEM_QTY', id: 'cons-1', quantity: 20 },
        { type: 'SET_CONSUMABLE_MARKUP', markupPercent: 15 },
        { type: 'SET_CONSUMABLE_FIXED_FEE', fee: 100 },
        { type: 'SET_DIET', dietType: 'band_2', allowance: 256 },
        { type: 'SET_FIELD', field: 'isPdp', value: true },
      ];

      for (const action of actions) {
        const nextState = shiftFormReducer(state, action);
        // Verify immutability: reference must change
        expect(nextState).not.toBe(state);
        state = nextState;
        history.push(state);
      }

      // Final state assertions
      expect(state.projectCode).toBe('ADV-STRESS-01');
      expect(state.projectName).toBe('Most přes Labe');
      expect(state.shiftSurcharges).toEqual(['night']);
      expect(state.extraCosts).toHaveLength(1);
      expect(state.notes).toContain('Svar proveden');
      expect(state.activityTags).toEqual(['Svařování', 'Montáž ve výškách']);
      expect(state.consumableSlip?.items).toHaveLength(1);
      expect(state.consumableSlip?.items[0].quantity).toBe(20);
      expect(state.consumableSlip?.overheadMarkupPercent).toBe(15);
      expect(state.consumableSlip?.fixedOverheadFee).toBe(100);
      expect(state.dietType).toBe('band_2');
      expect(state.isPdp).toBe(true);

      // Verify that earlier states in history remain untouched
      expect(history[0].projectCode).not.toBe('ADV-STRESS-01');
      expect(history[0].extraCosts).toHaveLength(0);
    });

    it('T4.2: Consumables slip operations: quantity merging, removal on zero, and fixed fee clamping', () => {
      let state = initialState;

      const itemA: ConsumableItem = {
        id: 'item-A',
        category: 'cutting_grinding',
        name: 'Brusný kotouč 125',
        quantity: 5,
        unit: 'ks',
        unitPrice: 50,
        billedPrice: 250,
      };

      // Add item A
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: itemA });
      expect(state.consumableSlip?.items).toHaveLength(1);
      expect(state.consumableSlip?.totalMaterialCost).toBe(250);

      // Add identical item A -> quantities should merge (5 + 3 = 8)
      const itemADuplicate: ConsumableItem = { ...itemA, quantity: 3 };
      state = shiftFormReducer(state, { type: 'ADD_CONSUMABLE_ITEM', item: itemADuplicate });
      expect(state.consumableSlip?.items).toHaveLength(1);
      expect(state.consumableSlip?.items[0].quantity).toBe(8);
      expect(state.consumableSlip?.totalMaterialCost).toBe(400);

      // Update quantity to 0 -> item should be removed
      state = shiftFormReducer(state, { type: 'UPDATE_CONSUMABLE_ITEM_QTY', id: 'item-A', quantity: 0 });
      expect(state.consumableSlip?.items).toHaveLength(0);
      expect(state.consumableSlip?.totalMaterialCost).toBe(0);

      // Set negative fixed fee -> clamped to 0
      state = shiftFormReducer(state, { type: 'SET_CONSUMABLE_FIXED_FEE', fee: -200 });
      expect(state.consumableSlip?.fixedOverheadFee).toBe(0);

      // Set NaN fixed fee -> clamped to 0
      state = shiftFormReducer(state, { type: 'SET_CONSUMABLE_FIXED_FEE', fee: NaN });
      expect(state.consumableSlip?.fixedOverheadFee).toBe(0);
    });

    it('T4.3: Photos reducer operations: ADD, UPDATE_CAPTION, REMOVE, and SET_PHOTOS', () => {
      let state = initialState;

      const photo1: EntryPhoto = {
        id: 'p-red-1',
        entryId: 'e-red',
        createdAt: '2026-09-13T12:00:00.000Z',
        dataUrl: 'data:img1',
        thumbnailUrl: 'thumb1',
        sizeBytes: 1000,
        width: 100,
        height: 100,
        caption: 'Původní',
      };

      const photo2: EntryPhoto = {
        id: 'p-red-2',
        entryId: 'e-red',
        createdAt: '2026-09-13T12:01:00.000Z',
        dataUrl: 'data:img2',
        thumbnailUrl: 'thumb2',
        sizeBytes: 2000,
        width: 200,
        height: 200,
        caption: 'Druhá',
      };

      // Add photos
      state = shiftFormReducer(state, { type: 'ADD_PHOTO', photo: photo1 });
      state = shiftFormReducer(state, { type: 'ADD_PHOTO', photo: photo2 });
      expect(state.photos).toHaveLength(2);

      // Update caption
      state = shiftFormReducer(state, { type: 'UPDATE_PHOTO_CAPTION', id: 'p-red-1', caption: 'Aktualizovaný' });
      expect(state.photos.find(p => p.id === 'p-red-1')?.caption).toBe('Aktualizovaný');
      expect(state.photos.find(p => p.id === 'p-red-2')?.caption).toBe('Druhá');

      // Remove photo
      state = shiftFormReducer(state, { type: 'REMOVE_PHOTO', id: 'p-red-1' });
      expect(state.photos).toHaveLength(1);
      expect(state.photos[0].id).toBe('p-red-2');

      // Set photos
      state = shiftFormReducer(state, { type: 'SET_PHOTOS', photos: [] });
      expect(state.photos).toHaveLength(0);
    });

    it('T4.4: Diet reducer handling: custom rate and standard bands', () => {
      let state = initialState;

      // Custom diet
      state = shiftFormReducer(state, { type: 'SET_DIET', dietType: 'custom', allowance: 450, isManual: true });
      expect(state.dietType).toBe('custom');
      expect(state.dietAllowance).toBe(450);
      expect(state.customDietRate).toBe(450);
      expect(state.isManualDiet).toBe(true);

      // Standard band_3
      state = shiftFormReducer(state, { type: 'SET_DIET', dietType: 'band_3', allowance: 398, isManual: false });
      expect(state.dietType).toBe('band_3');
      expect(state.dietAllowance).toBe(398);
      expect(state.dietBandApplied).toBe('band_3');
      expect(state.isManualDiet).toBe(false);
    });

    it('T4.5: Reducer defensively returns state on unknown action type', () => {
      const state = initialState;
      const unknownAction = { type: 'NON_EXISTENT_ACTION' } as any;
      const result = shiftFormReducer(state, unknownAction);
      expect(result).toBe(state);
    });

    it('T4.6: createInitialState handles null, undefined, and pre-populated entries', () => {
      // 1. Fresh state
      const fresh = createInitialState(null, null, {
        clients: DEFAULT_SETTINGS.clients,
        rates: DEFAULT_SETTINGS.rates,
      });
      expect(fresh.clientName).toBe(DEFAULT_SETTINGS.clients[0].name);
      expect(fresh.startTime).toBe('07:00');
      expect(fresh.endTime).toBe('16:00');
      expect(fresh.breakMinutes).toBe(30);
      // 8.5h shift automatically estimates band_1 (166 Kč)
      expect(fresh.dietAllowance).toBe(166);
      expect(fresh.dietType).toBe('band_1');
      expect(fresh.weldingPassport?.methodCode).toBe('141');

      // 2. Pre-populated editingEntry
      const existingEntry: WorkEntry = {
        id: 'edit-123',
        date: '2026-05-15',
        startTime: '06:00',
        endTime: '19:00',
        breakMinutes: 60,
        workType: 'workshop',
        weldingMethod: 'MIG_MAG',
        clientName: 'STRABAG a.s.',
        projectCode: 'STR-01',
        projectName: 'Mostní těleso',
        status: 'approved',
        isPdp: true,
        travel: {
          distanceKm: 45,
          ratePerKm: 12,
          travelTimeHours: 1.5,
          travelHourlyRate: 350,
          dietType: 'band_2',
          dietAllowance: 256,
          isManualDiet: true,
        },
        weldingPassport: {
          methodCode: '135',
          baseMaterialGrade: 'S355',
          materialThickness: '12 mm',
          shieldingGas: 'M21',
          fillerBatch: 'BATCH-99',
        },
        createdAt: '2026-05-15T06:00:00.000Z',
        updatedAt: '2026-05-15T19:00:00.000Z',
      };

      const editingState = createInitialState(existingEntry, null, {
        clients: DEFAULT_SETTINGS.clients,
        rates: DEFAULT_SETTINGS.rates,
      });

      expect(editingState.projectCode).toBe('STR-01');
      expect(editingState.clientName).toBe('STRABAG a.s.');
      expect(editingState.isPdp).toBe(true);
      expect(editingState.distanceKm).toBe(45);
      expect(editingState.dietType).toBe('band_2');
      expect(editingState.dietAllowance).toBe(256);
      expect(editingState.weldingPassport?.methodCode).toBe('135');
      expect(editingState.weldingPassport?.fillerBatch).toBe('BATCH-99');
    });

    it('T4.7: SignaturePadModal validates required signer name and non-empty canvas before submission', () => {
      const onSaveMock = vi.fn();
      const onCloseMock = vi.fn();

      const { getByText, getByPlaceholderText, rerender } = render(
        React.createElement(SignaturePadModal, {
          isOpen: true,
          onClose: onCloseMock,
          onSave: onSaveMock,
          role: 'contractor',
          defaultSignerName: '',
        })
      );

      const confirmBtn = getByText('Potvrdit podpis');

      // 1. Click without name -> blocked
      act(() => {
        fireEvent.click(confirmBtn);
      });
      expect(onSaveMock).not.toHaveBeenCalled();
      expect(onCloseMock).not.toHaveBeenCalled();

      // 2. Fill name but empty canvas -> blocked
      const input = getByPlaceholderText(/Jan Novák/i);
      act(() => {
        fireEvent.change(input, { target: { value: 'Karel Novák' } });
      });

      act(() => {
        fireEvent.click(confirmBtn);
      });
      expect(onSaveMock).not.toHaveBeenCalled();

      // 3. Modal closed -> unrenders cleanly
      rerender(
        React.createElement(SignaturePadModal, {
          isOpen: false,
          onClose: onCloseMock,
          onSave: onSaveMock,
          role: 'contractor',
        })
      );
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it('T4.8: Reducer edge cases: REMOVE_EXTRA on empty, APPLY_PRESET partial updates, and RESET', () => {
      let state = initialState;

      // REMOVE_EXTRA on non-existent extra ID
      state = shiftFormReducer(state, { type: 'REMOVE_EXTRA', id: 'non-existent-id' });
      expect(state.extraCosts).toHaveLength(0);

      // APPLY_PRESET
      state = shiftFormReducer(state, {
        type: 'APPLY_PRESET',
        preset: {
          projectCode: 'PRESET-PRJ',
          workType: 'emergency',
          baseHourlyRate: 850,
        },
      });
      expect(state.projectCode).toBe('PRESET-PRJ');
      expect(state.workType).toBe('emergency');
      expect(state.baseHourlyRate).toBe(850);

      // RESET
      const resetTarget = createInitialState(null, null, {
        clients: DEFAULT_SETTINGS.clients,
        rates: DEFAULT_SETTINGS.rates,
      });
      state = shiftFormReducer(state, { type: 'RESET', state: resetTarget });
      expect(state.projectCode).toBe(resetTarget.projectCode);
      expect(state.workType).toBe(resetTarget.workType);
    });

    it('T4.9: Activity tags: toggling all 5 mandatory chips and cycling states', () => {
      let state = initialState;
      const allTags: QuickActionTag[] = [
        'Příprava',
        'Svařování',
        'Montáž ve výškách',
        'Broušení/začištění',
        'Kotvení',
      ];

      // Turn all 5 on
      for (const tag of allTags) {
        state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag });
      }
      expect(state.activityTags).toEqual(allTags);

      // Toggle off 'Svařování' and 'Kotvení'
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Svařování' });
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Kotvení' });
      expect(state.activityTags).toEqual(['Příprava', 'Montáž ve výškách', 'Broušení/začištění']);

      // Toggle 'Svařování' back on
      state = shiftFormReducer(state, { type: 'TOGGLE_ACTIVITY_TAG', tag: 'Svařování' });
      expect(state.activityTags).toContain('Svařování');
    });
  });
});

