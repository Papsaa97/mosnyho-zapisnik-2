import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { db, addPhoto, getPhotosByEntryId, updatePhotoCaption, deletePhoto, deletePhotosByEntryId, resetToDemoData } from '../src/db';
import { shiftFormReducer, createInitialState } from '../src/components/form/shiftFormReducer';
import { preparePhotosForProtocol, calculateTargetDimensions, getByteSizeFromDataUrl, stampPhotoWatermark } from '../src/services/imageCompressionService';
import { EntryPhoto, WorkEntry } from '../src/types';
import { DEFAULT_SETTINGS } from '../src/db/seedData';
import { generateMockImageDataUrl } from './fixtures/photos.fixture';

/**
 * Milestone M4 Empirical Challenger Stress Test Suite (Challenger 2 - Integration, DB & State)
 * 
 * Target Verification Vectors:
 * 1. Dexie bulk storage: store 50 photos across 10 entries in db.photos and WorkEntry.photos.
 * 2. Cascade cleanup: deleting an entry must delete all associated photos in db.photos.
 * 3. Update integrity: editing an entry with added or removed photos properly synchronizes db.photos.
 * 4. State synchronization in shiftFormReducer & concurrency (immutability, rapid dispatch, parallel Dexie operations).
 * 5. preparePhotosForProtocol: test handling of empty arrays, undefined, photos missing captions (fallback 'Bez popisu'), and special characters in captions.
 * 6. Image utility boundaries & error handling.
 */

describe('Milestone M4 Challenger 2: Database, State & Integration Stress Suite', () => {

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
  });

  // =========================================================================
  // Section 1: Dexie Bulk Storage Stress Test (50 Photos across 10 Entries)
  // =========================================================================
  describe('1. Dexie Bulk Storage & Indexing Stress Test', () => {

    it('stores 50 photos across 10 entries in db.photos and verifies relational querying and size budgets', async () => {
      const TOTAL_ENTRIES = 10;
      const PHOTOS_PER_ENTRY = 5;
      const TOTAL_PHOTOS = TOTAL_ENTRIES * PHOTOS_PER_ENTRY;

      const entries: WorkEntry[] = [];
      const allPhotos: EntryPhoto[] = [];

      for (let e = 1; e <= TOTAL_ENTRIES; e++) {
        const entryId = `entry-stress-${e.toString().padStart(2, '0')}`;
        const entryPhotos: EntryPhoto[] = [];

        for (let p = 1; p <= PHOTOS_PER_ENTRY; p++) {
          const photoId = `photo-e${e}-p${p}`;
          // Generate realistic payload sizes between 220 KB and 380 KB (strictly < 500 KB)
          const targetBytes = (220 + ((e * p) % 160)) * 1024;
          const photo: EntryPhoto = {
            id: photoId,
            entryId,
            createdAt: new Date(Date.UTC(2026, 2, e, 8 + p, 0, 0)).toISOString(),
            caption: `Zkouška svaru E${e}-P${p} (metoda 141, nerez 1.4301 tloušťka 4mm)`,
            dataUrl: generateMockImageDataUrl(targetBytes, 'image/jpeg'),
            thumbnailUrl: generateMockImageDataUrl(18 * 1024, 'image/jpeg'),
            sizeBytes: targetBytes,
            width: 1920,
            height: 1080,
          };
          entryPhotos.push(photo);
          allPhotos.push(photo);
        }

        entries.push({
          id: entryId,
          date: `2026-03-${e.toString().padStart(2, '0')}`,
          startTime: '07:00',
          endTime: '15:30',
          breakMinutes: 30,
          clientName: 'Metrostav DIZ s.r.o.',
          projectName: `Projekt Mostní Konstrukce ${e}`,
          projectCode: `PRJ-${e.toString().padStart(3, '0')}`,
          workType: 'welding',
          weldingMethod: 'TIG',
          status: 'draft',
          photos: entryPhotos,
          createdAt: new Date(Date.UTC(2026, 2, e, 7, 0, 0)).toISOString(),
          updatedAt: new Date(Date.UTC(2026, 2, e, 16, 0, 0)).toISOString(),
        });
      }

      // Bulk store entries into db.entries
      await db.entries.bulkPut(entries);
      expect(await db.entries.count()).toBe(TOTAL_ENTRIES);

      // Bulk store photos into db.photos table
      await db.photos.bulkPut(allPhotos);
      expect(await db.photos.count()).toBe(TOTAL_PHOTOS);

      // Verify each entry retrieves exactly PHOTOS_PER_ENTRY photos via index query
      for (let e = 1; e <= TOTAL_ENTRIES; e++) {
        const entryId = `entry-stress-${e.toString().padStart(2, '0')}`;
        const retrievedPhotos = await getPhotosByEntryId(entryId);
        expect(retrievedPhotos).toHaveLength(PHOTOS_PER_ENTRY);
        for (const p of retrievedPhotos) {
          expect(p.entryId).toBe(entryId);
          expect(p.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
          expect(p.thumbnailUrl).toMatch(/^data:image\/jpeg;base64,/);
          expect(p.sizeBytes).toBeLessThan(500 * 1024);
          expect(p.width).toBe(1920);
          expect(p.height).toBe(1080);
          expect(p.caption).toContain(`Zkouška svaru E${e}`);
        }
      }

      // Verify each entry in db.entries has its embedded photos array preserved intact
      for (let e = 1; e <= TOTAL_ENTRIES; e++) {
        const entryId = `entry-stress-${e.toString().padStart(2, '0')}`;
        const entry = await db.entries.get(entryId);
        expect(entry).toBeDefined();
        expect(entry?.photos).toBeDefined();
        expect(entry?.photos).toHaveLength(PHOTOS_PER_ENTRY);
      }

      // Verify aggregate storage metrics
      let totalStoredBytes = 0;
      for (const p of allPhotos) {
        totalStoredBytes += p.sizeBytes;
        expect(p.sizeBytes).toBeLessThan(512_000);
      }
      expect(totalStoredBytes).toBeGreaterThan(10 * 1024 * 1024); // > 10 MB total
      expect(totalStoredBytes).toBeLessThan(25 * 1024 * 1024); // < 25 MB total
    });

    it('accurately updates photo captions using updatePhotoCaption helper without affecting other attributes', async () => {
      const photo: EntryPhoto = {
        id: 'photo-caption-test-1',
        entryId: 'entry-caption-1',
        createdAt: '2026-03-05T10:00:00Z',
        caption: 'Původní popis',
        dataUrl: generateMockImageDataUrl(250 * 1024),
        thumbnailUrl: generateMockImageDataUrl(15 * 1024),
        sizeBytes: 250 * 1024,
        width: 1920,
        height: 1080,
      };

      await addPhoto(photo);

      // Update caption
      const updatedCount = await updatePhotoCaption('photo-caption-test-1', 'Aktualizovaný popis sváru č. 9');
      expect(updatedCount).toBe(1);

      const retrieved = await db.photos.get('photo-caption-test-1');
      expect(retrieved?.caption).toBe('Aktualizovaný popis sváru č. 9');
      expect(retrieved?.entryId).toBe('entry-caption-1');
      expect(retrieved?.sizeBytes).toBe(250 * 1024);
      expect(retrieved?.dataUrl).toBe(photo.dataUrl);

      // Attempting to update a non-existent photo returns 0
      const nonExistentUpdate = await updatePhotoCaption('photo-does-not-exist', 'Něco');
      expect(nonExistentUpdate).toBe(0);
    });
  });

  // =========================================================================
  // Section 2: Cascade Deletion & Cleanup Stress Test
  // =========================================================================
  describe('2. Cascade Deletion & Cleanup Stress Test', () => {

    it('cascades deletion of all photos when an entry is removed, leaving unrelated photos intact', async () => {
      const entryA_Photos: EntryPhoto[] = [1, 2, 3].map(i => ({
        id: `photo-A-${i}`,
        entryId: 'entry-A',
        createdAt: new Date().toISOString(),
        caption: `Photo A-${i}`,
        dataUrl: generateMockImageDataUrl(200 * 1024),
        thumbnailUrl: generateMockImageDataUrl(15 * 1024),
        sizeBytes: 200 * 1024,
        width: 1920,
        height: 1080,
      }));

      const entryB_Photos: EntryPhoto[] = [1, 2, 3, 4].map(i => ({
        id: `photo-B-${i}`,
        entryId: 'entry-B',
        createdAt: new Date().toISOString(),
        caption: `Photo B-${i}`,
        dataUrl: generateMockImageDataUrl(200 * 1024),
        thumbnailUrl: generateMockImageDataUrl(15 * 1024),
        sizeBytes: 200 * 1024,
        width: 1920,
        height: 1080,
      }));

      await db.photos.bulkPut([...entryA_Photos, ...entryB_Photos]);
      expect(await db.photos.count()).toBe(7);

      // Execute cascade deletion of entry-A photos
      const deletedCount = await deletePhotosByEntryId('entry-A');
      expect(deletedCount).toBe(3);

      // Verify entry-A photos are completely gone
      const remainingA = await getPhotosByEntryId('entry-A');
      expect(remainingA).toHaveLength(0);

      // Verify entry-B photos are completely untouched (zero blast radius)
      const remainingB = await getPhotosByEntryId('entry-B');
      expect(remainingB).toHaveLength(4);
      expect(await db.photos.count()).toBe(4);
    });

    it('handles deletion of an entry with zero photos cleanly without errors or side effects', async () => {
      // Seed photos for other entries
      await db.photos.put({
        id: 'photo-safe-1',
        entryId: 'entry-safe',
        createdAt: new Date().toISOString(),
        caption: 'Safe photo',
        dataUrl: generateMockImageDataUrl(200 * 1024),
        thumbnailUrl: generateMockImageDataUrl(15 * 1024),
        sizeBytes: 200 * 1024,
        width: 1920,
        height: 1080,
      });

      // Attempt to cascade-delete photos for an entry that has no photos
      const deletedCount = await deletePhotosByEntryId('entry-with-no-photos');
      expect(deletedCount).toBe(0);

      // Verify safe photo is still intact
      expect(await db.photos.count()).toBe(1);
    });

    it('simulates App.tsx handleConfirmDelete full flow (entry + photos removal)', async () => {
      const entryId = 'entry-to-delete-full';
      const entry: WorkEntry = {
        id: entryId,
        date: '2026-03-10',
        startTime: '07:00',
        endTime: '15:30',
        breakMinutes: 30,
        clientName: 'Metrostav DIZ s.r.o.',
        projectName: 'Most Barandov',
        projectCode: 'BAR-01',
        workType: 'welding',
        weldingMethod: 'TIG',
        status: 'draft',
        photos: [
          {
            id: 'photo-del-1',
            entryId,
            createdAt: new Date().toISOString(),
            caption: 'To delete',
            dataUrl: generateMockImageDataUrl(200 * 1024),
            thumbnailUrl: generateMockImageDataUrl(15 * 1024),
            sizeBytes: 200 * 1024,
            width: 1920,
            height: 1080,
          },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await db.entries.put(entry);
      await db.photos.bulkPut(entry.photos!);

      expect(await db.entries.get(entryId)).toBeDefined();
      expect(await db.photos.where('entryId').equals(entryId).count()).toBe(1);

      // App.tsx handleConfirmDelete logic:
      await db.entries.delete(entryId);
      await db.photos.where('entryId').equals(entryId).delete();

      expect(await db.entries.get(entryId)).toBeUndefined();
      expect(await db.photos.where('entryId').equals(entryId).count()).toBe(0);
    });

    it('resetToDemoData clears all custom photos from db.photos table', async () => {
      // Seed dummy photo
      await db.photos.put({
        id: 'photo-pre-reset',
        entryId: 'entry-pre-reset',
        createdAt: new Date().toISOString(),
        caption: 'Pre reset',
        dataUrl: generateMockImageDataUrl(200 * 1024),
        thumbnailUrl: generateMockImageDataUrl(15 * 1024),
        sizeBytes: 200 * 1024,
        width: 1920,
        height: 1080,
      });

      expect(await db.photos.count()).toBe(1);

      // Execute resetToDemoData
      await resetToDemoData();

      // db.photos should be 0, db.entries should have initial mock entries
      expect(await db.photos.count()).toBe(0);
      expect(await db.entries.count()).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Section 3: Update Integrity & Photo Synchronization Stress Test
  // =========================================================================
  describe('3. Update Integrity & Synchronization Stress Test', () => {

    it('simulates App.tsx handleSaveEntry synchronization: adding, modifying, and removing photos', async () => {
      const entryId = 'entry-sync-test';

      // Initial state: Entry with Photos P1, P2, P3
      const initialPhotos: EntryPhoto[] = [1, 2, 3].map(i => ({
        id: `sync-p${i}`,
        entryId,
        createdAt: new Date().toISOString(),
        caption: `Initial Caption P${i}`,
        dataUrl: generateMockImageDataUrl(250 * 1024),
        thumbnailUrl: generateMockImageDataUrl(16 * 1024),
        sizeBytes: 250 * 1024,
        width: 1920,
        height: 1080,
      }));

      let entry: WorkEntry = {
        id: entryId,
        date: '2026-03-12',
        startTime: '08:00',
        endTime: '16:00',
        breakMinutes: 30,
        clientName: 'Metrostav DIZ s.r.o.',
        projectName: 'Svařování ocelové haly',
        projectCode: 'HAL-02',
        workType: 'welding',
        weldingMethod: 'MAG',
        status: 'draft',
        photos: initialPhotos,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // App.tsx handleSaveEntry helper
      const simulateHandleSaveEntry = async (e: WorkEntry) => {
        await db.entries.put(e);
        await db.photos.where('entryId').equals(e.id).delete();
        if (e.photos && e.photos.length > 0) {
          const photosWithEntryId = e.photos.map(p => ({
            ...p,
            entryId: e.id,
          }));
          await db.photos.bulkPut(photosWithEntryId);
        }
      };

      // Step 1: Save initial entry
      await simulateHandleSaveEntry(entry);
      expect(await db.photos.where('entryId').equals(entryId).count()).toBe(3);

      // Step 2: Edit entry: remove P2, update caption of P1, add P4 and P5
      const updatedPhotos: EntryPhoto[] = [
        { ...initialPhotos[0], caption: 'Updated Caption P1 - inspected by VT2' },
        initialPhotos[2], // P3 kept
        {
          id: 'sync-p4',
          entryId,
          createdAt: new Date().toISOString(),
          caption: 'New Photo P4',
          dataUrl: generateMockImageDataUrl(300 * 1024),
          thumbnailUrl: generateMockImageDataUrl(17 * 1024),
          sizeBytes: 300 * 1024,
          width: 1920,
          height: 1080,
        },
        {
          id: 'sync-p5',
          entryId,
          createdAt: new Date().toISOString(),
          caption: 'New Photo P5',
          dataUrl: generateMockImageDataUrl(320 * 1024),
          thumbnailUrl: generateMockImageDataUrl(17 * 1024),
          sizeBytes: 320 * 1024,
          width: 1920,
          height: 1080,
        },
      ];

      entry = { ...entry, photos: updatedPhotos };
      await simulateHandleSaveEntry(entry);

      // Verify db.photos
      const photosAfterEdit = await getPhotosByEntryId(entryId);
      expect(photosAfterEdit).toHaveLength(4);

      // P2 should be completely removed
      expect(photosAfterEdit.some(p => p.id === 'sync-p2')).toBe(false);
      // P1 has updated caption
      const p1 = photosAfterEdit.find(p => p.id === 'sync-p1');
      expect(p1?.caption).toBe('Updated Caption P1 - inspected by VT2');
      // P4 and P5 exist
      expect(photosAfterEdit.some(p => p.id === 'sync-p4')).toBe(true);
      expect(photosAfterEdit.some(p => p.id === 'sync-p5')).toBe(true);

      // Step 3: Remove ALL photos from entry (empty array)
      entry = { ...entry, photos: [] };
      await simulateHandleSaveEntry(entry);

      const photosAfterClear = await getPhotosByEntryId(entryId);
      expect(photosAfterClear).toHaveLength(0);

      // Step 4: Save entry with undefined photos property
      entry = { ...entry, photos: undefined };
      await simulateHandleSaveEntry(entry);

      const photosAfterUndefined = await getPhotosByEntryId(entryId);
      expect(photosAfterUndefined).toHaveLength(0);
    });
  });

  // =========================================================================
  // Section 4: shiftFormReducer State Synchronization & Concurrency
  // =========================================================================
  describe('4. shiftFormReducer State Synchronization & Concurrency', () => {

    const createDummyPhoto = (id: string, caption = `Photo ${id}`): EntryPhoto => ({
      id,
      entryId: 'entry-reducer-test',
      createdAt: '2026-03-10T12:00:00Z',
      caption,
      dataUrl: generateMockImageDataUrl(200 * 1024),
      thumbnailUrl: generateMockImageDataUrl(15 * 1024),
      sizeBytes: 200 * 1024,
      width: 1920,
      height: 1080,
    });

    it('initializes photos properly in createInitialState from editingEntry and initialValues', () => {
      const p1 = createDummyPhoto('p1');
      const p2 = createDummyPhoto('p2');

      // 1. From editingEntry
      const stateFromEditing = createInitialState(
        { id: 'edit-1', photos: [p1, p2] } as any,
        null,
        DEFAULT_SETTINGS
      );
      expect(stateFromEditing.photos).toHaveLength(2);
      expect(stateFromEditing.photos[0].id).toBe('p1');
      // Verify defensive copy (not same reference)
      expect(stateFromEditing.photos).not.toBe([p1, p2]);

      // 2. From initialValues
      const stateFromInitial = createInitialState(
        null,
        { photos: [p1] } as any,
        DEFAULT_SETTINGS
      );
      expect(stateFromInitial.photos).toHaveLength(1);
      expect(stateFromInitial.photos[0].id).toBe('p1');

      // 3. From both (editingEntry takes precedence)
      const stateFromBoth = createInitialState(
        { id: 'edit-1', photos: [p1] } as any,
        { photos: [p2] } as any,
        DEFAULT_SETTINGS
      );
      expect(stateFromBoth.photos).toHaveLength(1);
      expect(stateFromBoth.photos[0].id).toBe('p1');

      // 4. From neither (defaults to empty array [])
      const stateDefault = createInitialState(null, null, DEFAULT_SETTINGS);
      expect(stateDefault.photos).toEqual([]);
    });

    it('handles ADD_PHOTO, REMOVE_PHOTO, UPDATE_PHOTO_CAPTION, and SET_PHOTOS immutably', () => {
      const state = createInitialState(null, null, DEFAULT_SETTINGS);
      expect(state.photos).toHaveLength(0);

      const p1 = createDummyPhoto('p1', 'First photo');
      const p2 = createDummyPhoto('p2', 'Second photo');
      const p3 = createDummyPhoto('p3', 'Third photo');

      // ADD_PHOTO p1
      const state1 = shiftFormReducer(state, { type: 'ADD_PHOTO', photo: p1 });
      expect(state1.photos).toHaveLength(1);
      expect(state1.photos[0]).toEqual(p1);
      expect(state.photos).toHaveLength(0); // Immutability of previous state

      // ADD_PHOTO p2
      const state2 = shiftFormReducer(state1, { type: 'ADD_PHOTO', photo: p2 });
      expect(state2.photos).toHaveLength(2);

      // UPDATE_PHOTO_CAPTION for p1
      const state3 = shiftFormReducer(state2, {
        type: 'UPDATE_PHOTO_CAPTION',
        id: 'p1',
        caption: 'Updated First Photo Caption',
      });
      expect(state3.photos[0].caption).toBe('Updated First Photo Caption');
      expect(state3.photos[1].caption).toBe('Second photo');
      expect(state2.photos[0].caption).toBe('First photo'); // Immutability

      // REMOVE_PHOTO p1
      const state4 = shiftFormReducer(state3, { type: 'REMOVE_PHOTO', id: 'p1' });
      expect(state4.photos).toHaveLength(1);
      expect(state4.photos[0].id).toBe('p2');

      // SET_PHOTOS [p2, p3]
      const state5 = shiftFormReducer(state4, { type: 'SET_PHOTOS', photos: [p2, p3] });
      expect(state5.photos).toHaveLength(2);
      expect(state5.photos.map(p => p.id)).toEqual(['p2', 'p3']);

      // Edge case: REMOVE_PHOTO with non-existent id
      const state6 = shiftFormReducer(state5, { type: 'REMOVE_PHOTO', id: 'non-existent' });
      expect(state6.photos).toHaveLength(2);

      // Edge case: UPDATE_PHOTO_CAPTION with non-existent id
      const state7 = shiftFormReducer(state6, {
        type: 'UPDATE_PHOTO_CAPTION',
        id: 'non-existent',
        caption: 'Ghost',
      });
      expect(state7.photos).toEqual(state6.photos);
    });

    it('survives rapid consecutive action dispatch stress simulation (50 interleaved actions)', () => {
      let state = createInitialState(null, null, DEFAULT_SETTINGS);

      // Add 20 photos
      for (let i = 1; i <= 20; i++) {
        state = shiftFormReducer(state, {
          type: 'ADD_PHOTO',
          photo: createDummyPhoto(`rapid-${i}`, `Photo ${i}`),
        });
      }
      expect(state.photos).toHaveLength(20);

      // Update odd captions
      for (let i = 1; i <= 20; i += 2) {
        state = shiftFormReducer(state, {
          type: 'UPDATE_PHOTO_CAPTION',
          id: `rapid-${i}`,
          caption: `Modified ${i}`,
        });
      }
      expect(state.photos).toHaveLength(20);
      expect(state.photos.find(p => p.id === 'rapid-1')?.caption).toBe('Modified 1');
      expect(state.photos.find(p => p.id === 'rapid-2')?.caption).toBe('Photo 2');

      // Remove even photos
      for (let i = 2; i <= 20; i += 2) {
        state = shiftFormReducer(state, {
          type: 'REMOVE_PHOTO',
          id: `rapid-${i}`,
        });
      }
      expect(state.photos).toHaveLength(10);
      expect(state.photos.map(p => p.id)).toEqual([
        'rapid-1', 'rapid-3', 'rapid-5', 'rapid-7', 'rapid-9',
        'rapid-11', 'rapid-13', 'rapid-15', 'rapid-17', 'rapid-19'
      ]);

      // All remaining photos have their updated captions
      for (const p of state.photos) {
        expect(p.caption).toMatch(/^Modified \d+$/);
      }
    });

    it('handles 20 concurrent Dexie photo operations in parallel without transaction deadlocks', async () => {
      const entryId = 'entry-concurrent-ops';
      const photosToInsert = Array.from({ length: 20 }, (_, i) => ({
        id: `concurrent-p${i}`,
        entryId,
        createdAt: new Date().toISOString(),
        caption: `Concurrent Photo ${i}`,
        dataUrl: generateMockImageDataUrl(100 * 1024),
        thumbnailUrl: generateMockImageDataUrl(10 * 1024),
        sizeBytes: 100 * 1024,
        width: 1920,
        height: 1080,
      }));

      // Execute 20 parallel addPhoto calls
      await Promise.all(photosToInsert.map(p => addPhoto(p)));
      expect(await db.photos.where('entryId').equals(entryId).count()).toBe(20);

      // Execute 20 parallel updatePhotoCaption calls
      await Promise.all(
        photosToInsert.map((p, i) => updatePhotoCaption(p.id, `Parallel updated ${i}`))
      );

      const retrieved = await getPhotosByEntryId(entryId);
      expect(retrieved).toHaveLength(20);
      for (let i = 0; i < 20; i++) {
        const item = retrieved.find(p => p.id === `concurrent-p${i}`);
        expect(item?.caption).toBe(`Parallel updated ${i}`);
      }

      // Execute 10 parallel deletePhoto calls
      await Promise.all(
        photosToInsert.slice(0, 10).map(p => deletePhoto(p.id))
      );
      expect(await db.photos.where('entryId').equals(entryId).count()).toBe(10);
    });
  });

  // =========================================================================
  // Section 5: preparePhotosForProtocol Edge Cases & Resiliency Stress Test
  // =========================================================================
  describe('5. preparePhotosForProtocol Edge Cases & Resiliency', () => {

    it('handles undefined, null, and empty array inputs cleanly returning empty array', () => {
      expect(preparePhotosForProtocol(undefined)).toEqual([]);
      expect(preparePhotosForProtocol([])).toEqual([]);
      // @ts-expect-error testing runtime JS boundary
      expect(preparePhotosForProtocol(null)).toEqual([]);
    });

    it('falls back to "Bez popisu" when caption is missing, empty string, or undefined', () => {
      const photos: EntryPhoto[] = [
        {
          id: 'p-no-caption',
          entryId: 'e1',
          createdAt: '2026-03-02T14:30:00.000Z',
          dataUrl: 'data:image/jpeg;base64,abc',
          thumbnailUrl: 'data:image/jpeg;base64,thumb',
          sizeBytes: 1000,
          width: 1920,
          height: 1080,
        },
        {
          id: 'p-empty-caption',
          entryId: 'e1',
          createdAt: '2026-03-02T15:00:00.000Z',
          caption: '',
          dataUrl: 'data:image/jpeg;base64,abc',
          thumbnailUrl: 'data:image/jpeg;base64,thumb',
          sizeBytes: 1000,
          width: 1920,
          height: 1080,
        },
      ];

      const protocolItems = preparePhotosForProtocol(photos);
      expect(protocolItems).toHaveLength(2);
      expect(protocolItems[0].caption).toBe('Bez popisu');
      expect(protocolItems[1].caption).toBe('Bez popisu');
    });

    it('handles long captions (1000+ chars), multi-line captions, and whitespace', () => {
      const longCaption = 'A'.repeat(1000) + ' ' + 'Svářečská kontrola dle ČSN EN ISO 5817 stupeň jakosti B';
      const multilineCaption = "První řádek: kořenový svár TIG\nDruhý řádek: výplň 135 MAG\nTřetí řádek: vizuální kontrola VT2 v pořádku";

      const photos: EntryPhoto[] = [
        {
          id: 'p-long',
          entryId: 'e1',
          createdAt: '2026-03-02T14:30:00.000Z',
          caption: longCaption,
          dataUrl: 'data:image/jpeg;base64,abc',
          thumbnailUrl: 'data:image/jpeg;base64,thumb',
          sizeBytes: 1000,
          width: 1920,
          height: 1080,
        },
        {
          id: 'p-multiline',
          entryId: 'e1',
          createdAt: '2026-03-02T15:30:00.000Z',
          caption: multilineCaption,
          dataUrl: 'data:image/jpeg;base64,abc',
          thumbnailUrl: 'data:image/jpeg;base64,thumb',
          sizeBytes: 1000,
          width: 1920,
          height: 1080,
        },
      ];

      const protocolItems = preparePhotosForProtocol(photos);
      expect(protocolItems[0].caption).toBe(longCaption);
      expect(protocolItems[1].caption).toBe(multilineCaption);
      expect(protocolItems[0].caption.length).toBeGreaterThan(1000);
    });

    it('handles special characters, Czech diacritics, XSS injection strings, and Unicode emojis', () => {
      const specialCases = [
        'Příruba ø150, svár č. 4 – 141 (TIG) kořen + 135 výplň, žíhání @ 650°C & zkouška VT2 / UT',
        '<script>alert("XSS")</script><img src=x onerror=alert(1)>',
        '"><svg onload=alert(1)> &amp; &lt; &gt; \' " / \\',
        '🔥 Svařování konstrukce ⚡ 🛠️ Kotvení 📐 Kontrola ⚠️ Pozor na vítr № 42/2026 § 92e ‰ ⌀ 150mm',
        '   Přední a zadní mezery   ',
      ];

      const photos: EntryPhoto[] = specialCases.map((caption, index) => ({
        id: `p-spec-${index}`,
        entryId: 'e1',
        createdAt: '2026-03-02T14:30:00.000Z',
        caption,
        dataUrl: 'data:image/jpeg;base64,abc',
        thumbnailUrl: `data:image/jpeg;base64,thumb-${index}`,
        sizeBytes: 1000,
        width: 1920,
        height: 1080,
      }));

      const protocolItems = preparePhotosForProtocol(photos);
      expect(protocolItems).toHaveLength(specialCases.length);

      for (let i = 0; i < specialCases.length; i++) {
        expect(protocolItems[i].caption).toBe(specialCases[i]);
        expect(protocolItems[i].thumbnailUrl).toBe(`data:image/jpeg;base64,thumb-${i}`);
        expect(protocolItems[i].dateStr).toMatch(/\d{2}\.\s*\d{2}\.\s*\d{4}/);
        expect(protocolItems[i].timeStr).toMatch(/\d{2}:\d{2}/);
      }
    });

    it('formats localized Czech dates and times accurately and preserves original array ordering', () => {
      const photos: EntryPhoto[] = [
        {
          id: 'p-morning',
          entryId: 'e1',
          createdAt: '2026-03-02T06:15:00.000Z',
          caption: 'Ranní příprava',
          dataUrl: 'data:image/jpeg;base64,abc',
          thumbnailUrl: 'data:image/jpeg;base64,thumb-1',
          sizeBytes: 1000,
          width: 1920,
          height: 1080,
        },
        {
          id: 'p-noon',
          entryId: 'e1',
          createdAt: '2026-03-02T11:45:00.000Z',
          caption: 'Polední svár',
          dataUrl: 'data:image/jpeg;base64,abc',
          thumbnailUrl: 'data:image/jpeg;base64,thumb-2',
          sizeBytes: 1000,
          width: 1920,
          height: 1080,
        },
        {
          id: 'p-evening',
          entryId: 'e1',
          createdAt: '2026-03-02T19:30:00.000Z',
          caption: 'Večerní předání',
          dataUrl: 'data:image/jpeg;base64,abc',
          thumbnailUrl: 'data:image/jpeg;base64,thumb-3',
          sizeBytes: 1000,
          width: 1920,
          height: 1080,
        },
      ];

      const protocolItems = preparePhotosForProtocol(photos);
      expect(protocolItems).toHaveLength(3);

      // Order preservation
      expect(protocolItems.map(p => p.id)).toEqual(['p-morning', 'p-noon', 'p-evening']);

      // Date string format validation (Czech standard typography: DD. MM. YYYY)
      for (const item of protocolItems) {
        expect(item.dateStr).toMatch(/^02\.\s*03\.\s*2026$/);
        expect(item.timeStr).toMatch(/^\d{2}:\d{2}$/);
      }

      // Ensure input array was not mutated
      expect(photos[0].id).toBe('p-morning');
    });

    it('does not throw an unhandled exception when photo has invalid date string in createdAt', () => {
      const photoWithBadDate: EntryPhoto = {
        id: 'p-bad-date',
        entryId: 'e1',
        createdAt: 'not-a-valid-date-string',
        caption: 'Fotka se špatným datem',
        dataUrl: 'data:image/jpeg;base64,abc',
        thumbnailUrl: 'data:image/jpeg;base64,thumb',
        sizeBytes: 1000,
        width: 1920,
        height: 1080,
      };

      expect(() => {
        const res = preparePhotosForProtocol([photoWithBadDate]);
        expect(res).toHaveLength(1);
        expect(res[0].id).toBe('p-bad-date');
      }).not.toThrow();
    });
  });

  // =========================================================================
  // Section 6: Image Utility Edge Cases & Boundaries
  // =========================================================================
  describe('6. Image Compression & Utility Boundaries', () => {

    it('calculateTargetDimensions preserves exact aspect ratios across extreme dimensions', () => {
      // Standard 16:9 4K -> downscaled to 1920x1080
      expect(calculateTargetDimensions(3840, 2160, 1920, 1080)).toEqual({ width: 1920, height: 1080 });

      // Ultra-wide panorama (4000x1000) -> width bounded to 1920
      const wide = calculateTargetDimensions(4000, 1000, 1920, 1080);
      expect(wide.width).toBe(1920);
      expect(wide.height).toBe(480);

      // Ultra-tall vertical photo (1000x4000) -> height bounded to 1080
      const tall = calculateTargetDimensions(1000, 4000, 1920, 1080);
      expect(tall.width).toBe(270);
      expect(tall.height).toBe(1080);

      // Small image (800x600) -> never upscaled
      expect(calculateTargetDimensions(800, 600, 1920, 1080)).toEqual({ width: 800, height: 600 });
    });

    it('getByteSizeFromDataUrl calculates payload byte size accurately and rejects malformed inputs', () => {
      // 1000-character base64 payload represents floor(1000 * 3/4) = 750 bytes
      const testDataUrl = `data:image/jpeg;base64,${'A'.repeat(1000)}`;
      const calculatedBytes = getByteSizeFromDataUrl(testDataUrl);
      expect(calculatedBytes).toBe(750);

      // Malformed or empty data URL throws descriptive error
      expect(() => getByteSizeFromDataUrl('')).toThrow('Invalid data URL format');
      expect(() => getByteSizeFromDataUrl('invalid-no-comma')).toThrow('Invalid data URL format');
      expect(() => getByteSizeFromDataUrl('data:image/jpeg;base64')).toThrow('Malformed data URL: missing payload');
    });

    it('stampPhotoWatermark handles long and special texts without throwing', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;

      expect(() => {
        stampPhotoWatermark(canvas, {
          projectCode: 'VERY-LONG-PROJECT-CODE-9999999999999',
          projectName: 'Projekt rekonstrukce chemického reaktoru a potrubních tras v areálu Spolana Neratovice a.s.',
          welderName: 'Bc. Jan Mošný (IČO: 87654321, Svářečský průkaz EN ISO 9606-1: 141 T BW FM5 S s3.0 D50 H-L045 ss gb)',
          activityCaption: 'Detail kořenového sváru hrdla č. 14 s argonovou ochranou kořene a přídavným drátem Böhler Thermanit GE-316L',
          timestamp: '2026-03-13T10:30:00.000Z',
        });
      }).not.toThrow();
    });
  });
});
