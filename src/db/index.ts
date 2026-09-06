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
 * Checks available storage quota and warns if space is critically low.
 * Non-blocking – won't throw.
 */
export async function checkStorageQuota(): Promise<void> {
  try {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const { usage, quota } = await navigator.storage.estimate();
      if (usage !== undefined && quota !== undefined) {
        const usedMB = (usage / 1024 / 1024).toFixed(1);
        const quotaMB = (quota / 1024 / 1024).toFixed(0);
        const usedPercent = (usage / quota) * 100;
        
        if (usedPercent > 80) {
          console.warn(`[DB] Storage nearly full: ${usedMB} MB / ${quotaMB} MB (${usedPercent.toFixed(0)}%)`);
        } else {
          console.log(`[DB] Storage OK: ${usedMB} MB / ${quotaMB} MB used`);
        }
      }
    }
  } catch {
    // Silent fail – quota API is optional
  }
}

/**
 * Ensures initial database seed on first startup.
 */
export async function initializeDatabase(): Promise<void> {
  try {
    // Request persistent storage to avoid iOS eviction
    if ('storage' in navigator && 'persist' in navigator.storage) {
      const persisted = await navigator.storage.persist();
      console.log('[DB] Persistent storage:', persisted ? 'granted ✓' : 'denied (data may be cleared)');
    }

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

    // Check quota after seeding
    await checkStorageQuota();

  } catch (error) {
    console.error('[DB] Failed to initialize database:', error);
    // If it's a QuotaExceededError, surface it
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      alert('Varování: Paměť zařízení je plná. Nelze uložit data. Prosím uvolněte místo v telefonu.');
    }
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
