import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  SAMPLE_ENTRY_PHOTO_FIXTURE, 
  SAMPLE_ENTRY_PHOTO_VT2_FIXTURE,
} from '../../fixtures/photos.fixture';
import { db } from '../../../src/db';
import type { EntryPhoto } from '../../../src/types';

describe('Feature 28: Dual-Tier IndexedDB Photo Store', () => {
  beforeEach(async () => {
    await db.photos.clear();
  });

  afterEach(async () => {
    await db.photos.clear();
  });

  // Test 1: Verification of dual-tier data structure (full photo + thumbnail)
  it('stores both full compressed image and fast thumbnail in the EntryPhoto record', () => {
    const photo: EntryPhoto = SAMPLE_ENTRY_PHOTO_FIXTURE;

    expect(photo.id).toBeDefined();
    expect(photo.entryId).toBeDefined();

    // Full photo tier (< 500 KB)
    expect(photo.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(photo.sizeBytes).toBeLessThan(500 * 1024);
    expect(photo.width).toBe(1920);
    expect(photo.height).toBe(1080);

    // Thumbnail tier (fast 320x240 miniature)
    expect(photo.thumbnailUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(photo.thumbnailUrl.length).toBeLessThan(photo.dataUrl.length);
    expect(photo.thumbnailUrl.length).toBeLessThan(35 * 1024);
  });

  // Test 2: Persisting and retrieving photo from IndexedDB
  it('saves an EntryPhoto to IndexedDB and retrieves it by ID accurately', async () => {
    await db.photos.add(SAMPLE_ENTRY_PHOTO_FIXTURE);

    const retrieved = await db.photos.get(SAMPLE_ENTRY_PHOTO_FIXTURE.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(SAMPLE_ENTRY_PHOTO_FIXTURE.id);
    expect(retrieved?.entryId).toBe('entry-01');
    expect(retrieved?.caption).toContain('TIG svár nerezového hrdla DN150');
    expect(retrieved?.sizeBytes).toBe(SAMPLE_ENTRY_PHOTO_FIXTURE.sizeBytes);
  });

  // Test 3: Querying multiple photos for a specific shift by entryId index
  it('queries all photos associated with a shift entry efficiently using the entryId index', async () => {
    const photo1: EntryPhoto = { ...SAMPLE_ENTRY_PHOTO_FIXTURE, id: 'photo-shift1-01', entryId: 'shift-100' };
    const photo2: EntryPhoto = { ...SAMPLE_ENTRY_PHOTO_VT2_FIXTURE, id: 'photo-shift1-02', entryId: 'shift-100' };
    const photoOther: EntryPhoto = { ...SAMPLE_ENTRY_PHOTO_FIXTURE, id: 'photo-shift2-01', entryId: 'shift-200' };

    await db.photos.bulkAdd([photo1, photo2, photoOther]);

    // Query by entryId index
    const shift1Photos = await db.photos.where('entryId').equals('shift-100').toArray();
    expect(shift1Photos).toHaveLength(2);
    expect(shift1Photos.map(p => p.id)).toEqual(['photo-shift1-01', 'photo-shift1-02']);

    const shift2Photos = await db.photos.where('entryId').equals('shift-200').toArray();
    expect(shift2Photos).toHaveLength(1);
    expect(shift2Photos[0].id).toBe('photo-shift2-01');
  });

  // Test 4: Updating photo caption
  it('allows updating photo caption in IndexedDB without corrupting image payloads', async () => {
    await db.photos.add(SAMPLE_ENTRY_PHOTO_FIXTURE);

    const updatedCaption = 'Doplněno: Vizuální kontrola schválena TDI Ing. Dvořákem';
    await db.photos.update(SAMPLE_ENTRY_PHOTO_FIXTURE.id, {
      caption: updatedCaption,
    });

    const updated = await db.photos.get(SAMPLE_ENTRY_PHOTO_FIXTURE.id);
    expect(updated?.caption).toBe(updatedCaption);
    expect(updated?.dataUrl).toBe(SAMPLE_ENTRY_PHOTO_FIXTURE.dataUrl);
    expect(updated?.thumbnailUrl).toBe(SAMPLE_ENTRY_PHOTO_FIXTURE.thumbnailUrl);
  });

  // Test 5: Cascade deletion of photos by entryId
  it('deletes all photos associated with an entry when the entry is deleted', async () => {
    const p1 = { ...SAMPLE_ENTRY_PHOTO_FIXTURE, id: 'del-p1', entryId: 'shift-to-delete' };
    const p2 = { ...SAMPLE_ENTRY_PHOTO_VT2_FIXTURE, id: 'del-p2', entryId: 'shift-to-delete' };
    const pKeep = { ...SAMPLE_ENTRY_PHOTO_FIXTURE, id: 'keep-p', entryId: 'shift-to-keep' };

    await db.photos.bulkAdd([p1, p2, pKeep]);

    // Cascade delete simulation
    await db.photos.where('entryId').equals('shift-to-delete').delete();

    const remaining = await db.photos.toArray();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe('keep-p');
  });

  // Test 6: Storage quota and aggregate size budget calculation
  it('calculates total storage size consumed by photos for an entry', async () => {
    await db.photos.bulkAdd([SAMPLE_ENTRY_PHOTO_FIXTURE, SAMPLE_ENTRY_PHOTO_VT2_FIXTURE]);

    const photos = await db.photos.where('entryId').equals('entry-01').toArray();
    const totalBytes = photos.reduce((sum, p) => sum + p.sizeBytes, 0);

    // Sum of 310 KB + 280 KB = 590 KB
    expect(totalBytes).toBe((310 + 280) * 1024);
    // Each individual photo is strictly under 500 KB
    expect(photos.every(p => p.sizeBytes < 500 * 1024)).toBe(true);
  });
});
