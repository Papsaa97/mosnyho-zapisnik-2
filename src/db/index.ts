import Dexie, { Table } from 'dexie';
import { WorkEntry, ShiftPreset, AppSettings, EntryPhoto, DualSignaturesRecord } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_PRESETS, INITIAL_MOCK_ENTRIES } from './seedData';

export class AppDatabase extends Dexie {
  entries!: Table<WorkEntry, string>;
  presets!: Table<ShiftPreset, string>;
  settings!: Table<AppSettings, string>;
  photos!: Table<EntryPhoto, string>;

  constructor() {
    super('MontazniZapisnikDB');

    this.version(1).stores({
      entries: 'id, date, clientName, projectCode, status, workType, createdAt',
      presets: 'id, name, workType, isDefault',
      settings: 'id'
    });

    this.version(2).stores({
      photos: 'id, entryId, createdAt'
    });
  }
}

export const db = new AppDatabase();

export async function addPhoto(photo: EntryPhoto): Promise<string> {
  return await db.photos.put(photo);
}

export async function getPhotosByEntryId(entryId: string): Promise<EntryPhoto[]> {
  return await db.photos.where('entryId').equals(entryId).toArray();
}

export async function updatePhotoCaption(id: string, caption: string): Promise<number> {
  return await db.photos.update(id, { caption });
}

export async function deletePhoto(id: string): Promise<void> {
  await db.photos.delete(id);
}

export async function deletePhotosByEntryId(entryId: string): Promise<number> {
  return await db.photos.where('entryId').equals(entryId).delete();
}

/**
 * Updates signatures for a work entry in Dexie IndexedDB
 */
export async function updateEntrySignatures(
  entryId: string,
  signatures: DualSignaturesRecord
): Promise<number> {
  return await db.entries.update(entryId, {
    signatures,
    contractorSignature: signatures.contractor,
    clientSignature: signatures.client,
  });
}

/**
 * Safely inspects storage quota estimate.
 * Non-blocking – returns null if unavailable.
 */
export async function getDatabaseStorageEstimate(): Promise<{ usage: number; quota: number; usedPercent: number } | null> {
  try {
    if (navigator.storage && 'estimate' in navigator.storage) {
      const { usage, quota } = await navigator.storage.estimate();
      if (usage !== undefined && quota !== undefined) {
        return {
          usage,
          quota,
          usedPercent: quota > 0 ? (usage / quota) * 100 : 0,
        };
      }
    }
  } catch {
    // Silent fail
  }
  return null;
}

/**
 * Checks available storage quota and warns if space is critically low.
 * Non-blocking – won't throw.
 */
export async function checkStorageQuota(): Promise<void> {
  try {
    if (navigator.storage && 'estimate' in navigator.storage) {
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
    if (navigator.storage && 'persist' in navigator.storage) {
      const persisted = await navigator.storage.persist();
      console.log('[DB] Persistent storage:', persisted ? 'granted ✓' : 'denied (data may be cleared)');
    }

    // Migrate from legacy MosnyZapisnikDB if it exists
    if (await Dexie.exists('MosnyZapisnikDB')) {
      try {
        const legacyDb = new Dexie('MosnyZapisnikDB');
        legacyDb.version(1).stores({
          entries: 'id, date, clientName, projectCode, status, workType, createdAt',
          presets: 'id, name, workType, isDefault',
          settings: 'id'
        });
        const [oldEntries, oldPresets, oldSettings] = await Promise.all([
          legacyDb.table<WorkEntry, string>('entries').toArray(),
          legacyDb.table<ShiftPreset, string>('presets').toArray(),
          legacyDb.table<AppSettings, string>('settings').toArray()
        ]);
        if (oldEntries.length > 0 && (await db.entries.count()) === 0) {
          await db.entries.bulkPut(oldEntries);
        }
        if (oldPresets.length > 0 && (await db.presets.count()) === 0) {
          await db.presets.bulkPut(oldPresets);
        }
        if (oldSettings.length > 0 && (await db.settings.count()) === 0) {
          const s = oldSettings[0];
          if (s?.contractor && (s.contractor.name?.includes('Mošný') || s.contractor.email?.includes('mosny'))) {
            s.contractor.name = DEFAULT_SETTINGS.contractor.name;
            s.contractor.email = DEFAULT_SETTINGS.contractor.email;
            s.contractor.ico = DEFAULT_SETTINGS.contractor.ico;
            s.contractor.phone = DEFAULT_SETTINGS.contractor.phone;
          }
          await db.settings.put(s);
        }
        legacyDb.close();
        await Dexie.delete('MosnyZapisnikDB');
        console.log('[DB] Migrated data from legacy database to MontazniZapisnikDB');
      } catch (err) {
        console.warn('[DB] Legacy migration error:', err);
      }
    }

    const settingsCount = await db.settings.count();
    if (settingsCount === 0) {
      await db.settings.put(DEFAULT_SETTINGS);
    } else {
      // Migrate legacy contractor name if present in user's existing IndexedDB
      const existingSettings = await db.settings.get('global_settings');
      if (existingSettings?.contractor && (
        existingSettings.contractor.name?.includes('Mošný') || 
        existingSettings.contractor.email?.includes('mosny')
      )) {
        existingSettings.contractor.name = DEFAULT_SETTINGS.contractor.name;
        existingSettings.contractor.email = DEFAULT_SETTINGS.contractor.email;
        existingSettings.contractor.ico = DEFAULT_SETTINGS.contractor.ico;
        existingSettings.contractor.dic = DEFAULT_SETTINGS.contractor.dic;
        existingSettings.contractor.phone = DEFAULT_SETTINGS.contractor.phone;
        existingSettings.contractor.bankAccount = DEFAULT_SETTINGS.contractor.bankAccount;
        existingSettings.contractor.iban = DEFAULT_SETTINGS.contractor.iban;
        existingSettings.contractor.swift = DEFAULT_SETTINGS.contractor.swift;
        await db.settings.put(existingSettings);
      }

      // Ensure rates.dietOver18Rate exists in existing settings
      if (existingSettings?.rates && existingSettings.rates.dietOver18Rate === undefined) {
        existingSettings.rates.dietOver18Rate = DEFAULT_SETTINGS.rates.dietOver18Rate;
        await db.settings.put(existingSettings);
      }
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
      window.dispatchEvent(new CustomEvent('db-quota-error', {
        detail: { message: 'Paměť zařízení je plná. Nelze uložit data. Prosím uvolněte místo v telefonu.' }
      }));
    }
  }
}

/**
 * Resets database back to fresh demo mock data.
 */
export async function resetToDemoData(): Promise<void> {
  await db.transaction('rw', db.entries, db.presets, db.settings, db.photos, async () => {
    await db.entries.clear();
    await db.presets.clear();
    await db.settings.clear();
    await db.photos.clear();

    await db.settings.put(DEFAULT_SETTINGS);
    await db.presets.bulkPut(DEFAULT_PRESETS);
    await db.entries.bulkPut(INITIAL_MOCK_ENTRIES);
  });
}
