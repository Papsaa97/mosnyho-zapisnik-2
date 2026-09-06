import Dexie, { Table } from 'dexie';
import { WorkEntry, ShiftPreset, AppSettings } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_PRESETS, INITIAL_MOCK_ENTRIES } from './seedData';

export class MosnyDatabase extends Dexie {
  entries!: Table<WorkEntry, string>;
  presets!: Table<ShiftPreset, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('MosnyZapisnikDB');

    this.version(1).stores({
      entries: 'id, date, clientName, projectCode, status, workType, createdAt',
      presets: 'id, name, workType, isDefault',
      settings: 'id'
    });
  }
}

export const db = new MosnyDatabase();

/**
 * Ensures initial database seed on first startup.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
      await db.settings.put(DEFAULT_SETTINGS);
    }

    const presetsCount = await db.presets.count();
    if (presetsCount === 0) {
      await db.presets.bulkPut(DEFAULT_PRESETS);
    }

    const entriesCount = await db.entries.count();
    if (entriesCount === 0) {
      await db.entries.bulkPut(INITIAL_MOCK_ENTRIES);
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
}

/**
 * Resets database back to fresh demo mock data.
 */
export async function resetToDemoData(): Promise<void> {
  await db.transaction('rw', db.entries, db.presets, db.settings, async () => {
    await db.entries.clear();
    await db.presets.clear();
    await db.settings.clear();

    await db.settings.put(DEFAULT_SETTINGS);
    await db.presets.bulkPut(DEFAULT_PRESETS);
    await db.entries.bulkPut(INITIAL_MOCK_ENTRIES);
  });
}
