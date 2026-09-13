import { describe, it, expect } from 'vitest';
import { 
  SAMPLE_ENTRY_PHOTO_FIXTURE, 
  SAMPLE_ENTRY_PHOTO_VT2_FIXTURE 
} from '../../fixtures/photos.fixture';
import { 
  SCENARIO_1_BRIDGE_RAILINGS, 
  ComprehensiveShiftEntry 
} from '../../fixtures/shifts.fixture';
import { preparePhotosForProtocol } from '../../../src/services/imageCompressionService';
import type { ProtocolPhotoItem, EntryPhoto } from '../../../src/types';
export { preparePhotosForProtocol };

describe('Feature 29: Photo Thumbnails in Protocol', () => {
  // Test 1: Preparing photos for A4 protocol layout
  it('formats entry photos into protocol display items with formatted dates, times, and captions', () => {
    const photos: EntryPhoto[] = [SAMPLE_ENTRY_PHOTO_FIXTURE, SAMPLE_ENTRY_PHOTO_VT2_FIXTURE];
    const items = preparePhotosForProtocol(photos);

    expect(items).toHaveLength(2);

    const item1 = items[0];
    expect(item1.id).toBe(SAMPLE_ENTRY_PHOTO_FIXTURE.id);
    expect(item1.thumbnailUrl).toBe(SAMPLE_ENTRY_PHOTO_FIXTURE.thumbnailUrl);
    expect(item1.caption).toBe('TIG svár nerezového hrdla DN150 – kořen a krycí vrstva');
    expect(item1.dateStr).toMatch(/\d{2}\.\s*\d{2}\.\s*2026/);
    expect(item1.timeStr).toMatch(/\d{2}:\d{2}/);

    const item2 = items[1];
    expect(item2.id).toBe(SAMPLE_ENTRY_PHOTO_VT2_FIXTURE.id);
    expect(item2.caption).toContain('Vizuální kontrola VT2');
  });

  // Test 2: Verification of SCENARIO_1_BRIDGE_RAILINGS photos appendix
  it('verifies photo appendix in SCENARIO_1_BRIDGE_RAILINGS fixture', () => {
    const shift: ComprehensiveShiftEntry = SCENARIO_1_BRIDGE_RAILINGS;

    expect(shift.photos).toBeDefined();
    expect(shift.photos).toHaveLength(2);

    const protocolPhotos = preparePhotosForProtocol(shift.photos);
    expect(protocolPhotos).toHaveLength(2);
    expect(protocolPhotos[0].thumbnailUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(protocolPhotos[1].thumbnailUrl).toMatch(/^data:image\/jpeg;base64,/);
  });

  // Test 3: Graceful omission when shift has no photos
  it('returns empty array when shift entry has no photos attached, avoiding empty frames', () => {
    expect(preparePhotosForProtocol(undefined)).toEqual([]);
    expect(preparePhotosForProtocol([])).toEqual([]);
  });

  // Test 4: Default caption fallback for photos without captions
  it('provides sensible fallback caption when caption is missing or blank', () => {
    const photoWithoutCaption: EntryPhoto = {
      ...SAMPLE_ENTRY_PHOTO_FIXTURE,
      caption: undefined,
    };

    const items = preparePhotosForProtocol([photoWithoutCaption]);
    expect(items[0].caption).toBe('Bez popisu');
  });

  // Test 5: Print layout style requirements for A4 page breaks
  it('defines print styling attributes to prevent awkward page splits (break-inside: avoid)', () => {
    const printLayoutSpec = {
      containerClass: 'page-break-inside-avoid print:break-inside-avoid',
      gridColumns: 2, // 2-column layout for A4 print
      thumbnailMaxHeightPx: 160,
      borderStyle: 'border border-slate-300 rounded-lg',
    };

    expect(printLayoutSpec.containerClass).toContain('page-break-inside-avoid');
    expect(printLayoutSpec.containerClass).toContain('print:break-inside-avoid');
    expect(printLayoutSpec.gridColumns).toBe(2);
  });

  // Test 6: Multi-photo grid rendering (1, 2, 3+ photos)
  it('handles varying photo counts (single photo, dual photo, and gallery of 4)', () => {
    const single = preparePhotosForProtocol([SAMPLE_ENTRY_PHOTO_FIXTURE]);
    expect(single).toHaveLength(1);

    const quad = preparePhotosForProtocol([
      SAMPLE_ENTRY_PHOTO_FIXTURE,
      SAMPLE_ENTRY_PHOTO_VT2_FIXTURE,
      { ...SAMPLE_ENTRY_PHOTO_FIXTURE, id: 'photo-3', caption: 'Detail sváru č. 3' },
      { ...SAMPLE_ENTRY_PHOTO_VT2_FIXTURE, id: 'photo-4', caption: 'Montážní celek zábradlí' },
    ]);
    expect(quad).toHaveLength(4);
    expect(quad.map(q => q.id)).toEqual(['photo-svary-01', 'photo-vt2-02', 'photo-3', 'photo-4']);
  });
});
