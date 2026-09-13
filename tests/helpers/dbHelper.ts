import Dexie, { Table } from 'dexie';
import { db } from '../../src/db';
import { DEFAULT_SETTINGS, DEFAULT_PRESETS, INITIAL_MOCK_ENTRIES } from '../../src/db/seedData';
import { WorkEntry, ShiftPreset, AppSettings } from '../../src/types';

/**
 * Clears all tables in the application database.
 */
export async function clearTestDatabase(): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
  await db.transaction('rw', db.entries, db.presets, db.settings, async () => {
    await db.entries.clear();
    await db.presets.clear();
    await db.settings.clear();
  });
}

/**
 * Resets the default application database back to standard seed data.
 */
export async function resetTestDatabase(): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
  await db.transaction('rw', db.entries, db.presets, db.settings, async () => {
    await db.entries.clear();
    await db.presets.clear();
    await db.settings.clear();

    await db.settings.put(DEFAULT_SETTINGS);
    await db.presets.bulkPut(DEFAULT_PRESETS);
    await db.entries.bulkPut(INITIAL_MOCK_ENTRIES);
  });
}

/**
 * Populates database with custom test data.
 */
export async function populateTestDatabase(options: {
  entries?: WorkEntry[];
  presets?: ShiftPreset[];
  settings?: AppSettings;
}): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
  await db.transaction('rw', db.entries, db.presets, db.settings, async () => {
    if (options.settings) {
      await db.settings.put(options.settings);
    }
    if (options.presets && options.presets.length > 0) {
      await db.presets.bulkPut(options.presets);
    }
    if (options.entries && options.entries.length > 0) {
      await db.entries.bulkPut(options.entries);
    }
  });
}

/**
 * Creates an isolated Dexie database instance with a unique name
 * for tests that need complete independence without interference.
 */
export function createIsolatedTestDb(dbNamePrefix = 'TestDb'): {
  instance: Dexie & {
    entries: Table<WorkEntry, string>;
    presets: Table<ShiftPreset, string>;
    settings: Table<AppSettings, string>;
  };
  cleanup: () => Promise<void>;
} {
  const uniqueName = `${dbNamePrefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const isolatedDb = new Dexie(uniqueName) as any;

  isolatedDb.version(1).stores({
    entries: 'id, date, clientName, projectCode, status, workType, createdAt',
    presets: 'id, name, workType, isDefault',
    settings: 'id',
  });

  return {
    instance: isolatedDb,
    cleanup: async () => {
      isolatedDb.close();
      await Dexie.delete(uniqueName);
    },
  };
}
