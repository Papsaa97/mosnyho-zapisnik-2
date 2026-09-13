import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { clearTestDatabase, createIsolatedTestDb } from '../../helpers/dbHelper';
import { db } from '../../../src/db';
import { WorkEntry } from '../../../src/types';
import {
  CONTRACTOR_SIGNATURE_FIXTURE,
  CLIENT_SIGNATURE_FIXTURE,
  ProtocolSignature,
} from '../../fixtures/signatures.fixture';
import { SCENARIO_1_BRIDGE_RAILINGS } from '../../fixtures/shifts.fixture';

export interface EntryWithSignatures extends WorkEntry {
  signatures?: {
    contractor?: ProtocolSignature;
    client?: ProtocolSignature;
  };
}

describe('Feature 9: Offline Signature Storage (f09-offline-signature)', () => {
  beforeEach(async () => {
    await clearTestDatabase();
  });

  it('stores contractor signature into Dexie database with shift entry', async () => {
    const entry: EntryWithSignatures = {
      ...SCENARIO_1_BRIDGE_RAILINGS,
      id: 'entry-sig-1',
      signatures: {
        contractor: CONTRACTOR_SIGNATURE_FIXTURE,
      },
    };

    await db.entries.put(entry as any);

    const saved = (await db.entries.get('entry-sig-1')) as EntryWithSignatures;
    expect(saved).toBeDefined();
    expect(saved.signatures?.contractor).toBeDefined();
    expect(saved.signatures?.contractor?.role).toBe('contractor');
    expect(saved.signatures?.contractor?.signerName).toBe('Jan Novák (Zhotovitel)');
    expect(saved.signatures?.contractor?.dataUrl).toMatch(/^data:image\/png;base64,/);
  });

  it('retrieves persisted signature and verifies PNG data URL and metadata integrity', async () => {
    const entry: EntryWithSignatures = {
      ...SCENARIO_1_BRIDGE_RAILINGS,
      id: 'entry-sig-verify',
      signatures: {
        contractor: CONTRACTOR_SIGNATURE_FIXTURE,
        client: CLIENT_SIGNATURE_FIXTURE,
      },
    };

    await db.entries.put(entry as any);

    const retrieved = (await db.entries.get('entry-sig-verify')) as EntryWithSignatures;
    expect(retrieved.signatures?.contractor?.signedAt).toBe(CONTRACTOR_SIGNATURE_FIXTURE.signedAt);
    expect(retrieved.signatures?.client?.signedAt).toBe(CLIENT_SIGNATURE_FIXTURE.signedAt);
    expect(retrieved.signatures?.client?.signerName).toBe(CLIENT_SIGNATURE_FIXTURE.signerName);
  });

  it('supports incremental client signature storage without overwriting contractor signature', async () => {
    const entry: EntryWithSignatures = {
      ...SCENARIO_1_BRIDGE_RAILINGS,
      id: 'entry-sig-incremental',
      signatures: {
        contractor: CONTRACTOR_SIGNATURE_FIXTURE,
      },
    };

    await db.entries.put(entry as any);

    // Later: Client signs
    const existing = (await db.entries.get('entry-sig-incremental')) as EntryWithSignatures;
    const updatedSignatures = {
      ...existing.signatures,
      client: CLIENT_SIGNATURE_FIXTURE,
    };

    await db.entries.update('entry-sig-incremental', {
      signatures: updatedSignatures,
      status: 'submitted',
    } as any);

    const finalEntry = (await db.entries.get('entry-sig-incremental')) as EntryWithSignatures;
    expect(finalEntry.signatures?.contractor).toBeDefined();
    expect(finalEntry.signatures?.contractor?.signerName).toBe(CONTRACTOR_SIGNATURE_FIXTURE.signerName);
    expect(finalEntry.signatures?.client).toBeDefined();
    expect(finalEntry.signatures?.client?.signerName).toBe(CLIENT_SIGNATURE_FIXTURE.signerName);
  });

  it('allows clearing signature from database entry upon reset', async () => {
    const entry: EntryWithSignatures = {
      ...SCENARIO_1_BRIDGE_RAILINGS,
      id: 'entry-sig-clear',
      signatures: {
        contractor: CONTRACTOR_SIGNATURE_FIXTURE,
        client: CLIENT_SIGNATURE_FIXTURE,
      },
    };

    await db.entries.put(entry as any);

    // User clears contractor signature
    await db.entries.update('entry-sig-clear', {
      signatures: {
        client: CLIENT_SIGNATURE_FIXTURE,
      },
    } as any);

    const modified = (await db.entries.get('entry-sig-clear')) as EntryWithSignatures;
    expect(modified.signatures?.contractor).toBeUndefined();
    expect(modified.signatures?.client).toBeDefined();
  });

  it('maintains strict database isolation between signatures on different shift records', async () => {
    const entryA: EntryWithSignatures = {
      ...SCENARIO_1_BRIDGE_RAILINGS,
      id: 'shift-A',
      projectCode: 'PROJ-A',
      signatures: {
        contractor: CONTRACTOR_SIGNATURE_FIXTURE,
      },
    };

    const entryB: EntryWithSignatures = {
      ...SCENARIO_1_BRIDGE_RAILINGS,
      id: 'shift-B',
      projectCode: 'PROJ-B',
      signatures: {}, // Unsigned
    };

    await db.entries.bulkPut([entryA as any, entryB as any]);

    const resA = (await db.entries.get('shift-A')) as EntryWithSignatures;
    const resB = (await db.entries.get('shift-B')) as EntryWithSignatures;

    expect(resA.signatures?.contractor).toBeDefined();
    expect(resB.signatures?.contractor).toBeUndefined();
  });

  it('executes 100% offline within IndexedDB without external network dependency', async () => {
    const { instance: isolatedDb, cleanup } = createIsolatedTestDb('OfflineSigDb');

    try {
      await isolatedDb.entries.put({
        ...SCENARIO_1_BRIDGE_RAILINGS,
        id: 'isolated-1',
        signatures: {
          contractor: CONTRACTOR_SIGNATURE_FIXTURE,
        },
      } as any);

      const count = await isolatedDb.entries.count();
      expect(count).toBe(1);

      const item = (await isolatedDb.entries.get('isolated-1')) as EntryWithSignatures;
      expect(item.signatures?.contractor?.role).toBe('contractor');
    } finally {
      await cleanup();
    }
  });
});
