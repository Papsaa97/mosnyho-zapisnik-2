import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  clearTestDatabase,
  createIsolatedTestDb,
} from '../../helpers/dbHelper';
import { db } from '../../../src/db';
import {
  ComprehensiveShiftEntry,
  SCENARIO_1_BRIDGE_RAILINGS,
  SCENARIO_4_20H_MARATHON_SHIFT,
} from '../../fixtures/shifts.fixture';

describe('Tier 3 Cross-Feature: Offline Dexie Persistence & Data Integrity (offline-dexie-persistence.test.ts)', () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  // 1. Full Offline Write -> Read Cycle with Deep Structure Verification
  it('persists comprehensive shift entry with welding passport, materials, photos, and dual signatures into Dexie', async () => {
    const shift: ComprehensiveShiftEntry = {
      ...SCENARIO_1_BRIDGE_RAILINGS,
      id: 'dexie-test-shift-01',
    };

    // 1. Store in Dexie
    await db.entries.put(shift as any);

    // 2. Read back from Dexie
    const retrieved = (await db.entries.get('dexie-test-shift-01')) as ComprehensiveShiftEntry | undefined;
    expect(retrieved).toBeDefined();
    if (!retrieved) return;

    // 3. Verify core attributes
    expect(retrieved.id).toBe('dexie-test-shift-01');
    expect(retrieved.projectName).toBe(shift.projectName);
    expect(retrieved.clientName).toBe('Metrostav DIZ s.r.o.');
    expect(retrieved.isPdp).toBe(true);
    expect(retrieved.totalHours).toBe(10.0);
    expect(retrieved.totalEarnings).toBe(shift.totalEarnings);

    // 4. Verify nested welding passport
    expect(retrieved.weldingPassport).toBeDefined();
    expect(retrieved.weldingPassport?.methodCode).toBe('141');
    expect(retrieved.weldingPassport?.baseMaterialGrade).toBe('S355J2');
    expect(retrieved.weldingPassport?.fillerBatch).toContain('Böhler EMK 8');
    expect(retrieved.weldingPassport?.weldInspectionVT).toBe('passed_B');

    // 5. Verify nested consumable slip
    expect(retrieved.consumableSlip).toBeDefined();
    expect(retrieved.consumableSlip?.items).toHaveLength(3);
    expect(retrieved.consumableSlip?.totalBilledAmount).toBe(2347);

    // 6. Verify activity tags
    expect(retrieved.activityTags).toEqual(['Příprava', 'Svařování', 'Montáž ve výškách', 'Kotvení']);

    // 7. Verify dual signatures
    expect(retrieved.signatures?.contractor?.role).toBe('contractor');
    expect(retrieved.signatures?.client?.role).toBe('client');

    // 8. Verify photos
    expect(retrieved.photos).toHaveLength(2);
    expect(retrieved.photos![0].caption).toContain('TIG svár nerezového hrdla');
  });

  // 2. Offline Querying, Filtering, and State Updates
  it('supports querying by clientName, status filtering, and offline status updates', async () => {
    const shift1: ComprehensiveShiftEntry = {
      ...SCENARIO_1_BRIDGE_RAILINGS,
      id: 'shift-query-1',
      clientName: 'Metrostav DIZ s.r.o.',
      status: 'draft',
    };

    const shift2: ComprehensiveShiftEntry = {
      ...SCENARIO_4_20H_MARATHON_SHIFT,
      id: 'shift-query-2',
      clientName: 'TechnoMont Industrial s.r.o.',
      status: 'submitted',
    };

    await db.entries.bulkPut([shift1 as any, shift2 as any]);

    // Query by client
    const metrostavShifts = await db.entries.where('clientName').equals('Metrostav DIZ s.r.o.').toArray();
    expect(metrostavShifts).toHaveLength(1);
    expect(metrostavShifts[0].id).toBe('shift-query-1');

    // Query by status
    const submittedShifts = await db.entries.where('status').equals('submitted').toArray();
    expect(submittedShifts).toHaveLength(1);
    expect(submittedShifts[0].id).toBe('shift-query-2');

    // Offline update: transition shift1 from 'draft' to 'submitted'
    await db.entries.update('shift-query-1', {
      status: 'submitted',
      updatedAt: '2026-03-02T19:00:00.000Z',
    });

    const updated = await db.entries.get('shift-query-1');
    expect(updated?.status).toBe('submitted');
    expect(updated?.updatedAt).toBe('2026-03-02T19:00:00.000Z');
  });

  // 3. Isolated In-Memory Database Lifecycle
  it('creates an isolated Dexie instance for independent testing without data cross-contamination', async () => {
    const { instance: isolatedDb, cleanup } = createIsolatedTestDb('IsolatedTest');

    try {
      await isolatedDb.entries.put({
        ...SCENARIO_1_BRIDGE_RAILINGS,
        id: 'isolated-entry-999',
      } as any);

      const count = await isolatedDb.entries.count();
      expect(count).toBe(1);

      // Verify main db is unaffected
      const mainDbCount = await db.entries.count();
      expect(mainDbCount).toBe(0);

      const isolatedEntry = await isolatedDb.entries.get('isolated-entry-999');
      expect(isolatedEntry?.id).toBe('isolated-entry-999');
    } finally {
      await cleanup();
    }
  });
});
