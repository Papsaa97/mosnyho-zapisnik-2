import { WorkEntry, WorkType } from '../types';
import { db } from '../db';

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  workshop_welding: 'Dílna – svařování',
  site_assembly: 'Montáž na stavbě',
  service_emergency: 'Pohotovost / Havárie',
  travel_only: 'Pouze doprava / cesťák'
};

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rozpracováno (koncept)',
  submitted: 'Odevzdáno odběrateli',
  invoiced: 'Vyfakturováno',
  paid: 'Zaplaceno'
};

/**
 * Exports entries to a localized Czech CSV formatted for MS Excel (semicolon delimiter and UTF-8 BOM).
 */
export function exportEntriesToCSV(entries: WorkEntry[], fileNameSuffix = 'vykaz_praci'): void {
  const headers = [
    'Datum',
    'Projekt / Zakázka',
    'Odběratel',
    'Typ činnosti',
    'Metoda svařování',
    'Od',
    'Do',
    'Pauza (min)',
    'Odpracováno hodin',
    'Základní sazba (Kč/h)',
    'Násobič náročnosti',
    'Příplatky',
    'Účtovaná sazba (Kč/h)',
    'Výdělek za práci (Kč)',
    'Ujeto km',
    'Sazba za km (Kč/km)',
    'Cesťák čas (h)',
    'Náhrada za cestu celkem (Kč)',
    'Stravné / Diety (Kč)',
    'Materiál a vícepráce (Kč)',
    'Celková částka (Kč)',
    'Stav',
    'Číslo faktury',
    'Poznámka'
  ];

  const rows = entries.map(entry => {
    const laborEarnings = Math.round(entry.totalHours * entry.pricing.calculatedHourlyRate);
    const travelTransport = Math.round(
      (entry.travel.distanceKm * entry.travel.ratePerKm) +
      (entry.travel.travelTimeHours * entry.travel.travelHourlyRate)
    );
    const extraCostsTotal = ((entry.extraCosts || []).reduce((sum, i) => sum + (Number(i.amount) || 0), 0)) +
      (entry.consumableSlip?.totalBilledAmount || 0);
    const surchargesText = entry.pricing.shiftSurcharges.join(', ') || 'Žádné';

    const clean = (val: unknown) => {
      const str = String(val ?? '').replace(/"/g, '""');
      return `"${str}"`;
    };

    return [
      clean(entry.date),
      clean(entry.projectName),
      clean(entry.clientName),
      clean(WORK_TYPE_LABELS[entry.workType] || entry.workType),
      clean(entry.weldingMethod || '–'),
      clean(entry.startTime),
      clean(entry.endTime),
      clean(entry.breakMinutes),
      clean(entry.totalHours.toFixed(2).replace('.', ',')),
      clean(entry.pricing.baseHourlyRate),
      clean(entry.pricing.complexityMultiplier.toFixed(2).replace('.', ',')),
      clean(surchargesText),
      clean(entry.pricing.calculatedHourlyRate),
      clean(laborEarnings),
      clean(entry.travel.distanceKm),
      clean(entry.travel.ratePerKm),
      clean(entry.travel.travelTimeHours.toFixed(1).replace('.', ',')),
      clean(travelTransport),
      clean(entry.travel.dietAllowance),
      clean(extraCostsTotal),
      clean(entry.totalEarnings),
      clean(STATUS_LABELS[entry.status] || entry.status),
      clean(entry.invoiceNumber || ''),
      clean(entry.notes || '')
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Vykaz_${fileNameSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Exports complete database to JSON backup file.
 */
export async function exportDatabaseBackupToJSON(): Promise<void> {
  const [entries, presets, settings] = await Promise.all([
    db.entries.toArray(),
    db.presets.toArray(),
    db.settings.toArray()
  ]);

  const backupData = {
    version: '2.0',
    exportedAt: new Date().toISOString(),
    entries,
    presets,
    settings: settings[0] || null
  };

  const jsonContent = JSON.stringify(backupData, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Zaloha_Zapisnik_${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Validates that a work entry has all required fields with correct types.
 */
function isValidWorkEntry(entry: unknown): boolean {
  if (typeof entry !== 'object' || entry === null) return false;
  const e = entry as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.date === 'string' &&
    typeof e.totalHours === 'number' &&
    typeof e.workType === 'string' &&
    typeof e.status === 'string' &&
    typeof e.pricing === 'object' && e.pricing !== null &&
    typeof e.travel === 'object' && e.travel !== null
  );
}

/**
 * Sanitizes a string to prevent XSS (strips HTML tags).
 */
function sanitizeString(value: unknown): string {
  if (typeof value !== 'string') return String(value ?? '');
  return value.replace(/<[^>]*>/g, '');
}

/**
 * Sanitizes all string fields in a work entry.
 */
function sanitizeEntry<T extends Record<string, unknown>>(entry: T): T {
  const result = { ...entry };
  for (const key in result) {
    if (typeof result[key] === 'string') {
      (result as Record<string, unknown>)[key] = sanitizeString(result[key]);
    }
  }
  return result;
}

/**
 * Imports database from JSON backup file with validation and sanitization.
 */
export async function importDatabaseBackupFromJSON(jsonString: string): Promise<boolean> {
  try {
    const data = JSON.parse(jsonString);
    if (!data.entries || !Array.isArray(data.entries)) {
      throw new Error('Neplatný formát zálohy: chybí pole entries');
    }

    // Validate all entries before importing
    const invalidEntries = data.entries.filter((e: unknown) => !isValidWorkEntry(e));
    if (invalidEntries.length > 0) {
      console.warn(`[Import] ${invalidEntries.length} záznamů má neplatný formát a budou přeskočeny.`);
    }

    const validEntries = data.entries
      .filter((e: unknown) => isValidWorkEntry(e))
      .map((e: Record<string, unknown>) => sanitizeEntry(e));

    if (validEntries.length === 0) {
      throw new Error('Záloha neobsahuje žádné platné záznamy');
    }

    await db.transaction('rw', db.entries, db.presets, db.settings, async () => {
      await db.entries.clear();
      await db.entries.bulkPut(validEntries);

      if (data.presets && Array.isArray(data.presets)) {
        await db.presets.clear();
        await db.presets.bulkPut(data.presets);
      }

      if (data.settings) {
        await db.settings.clear();
        await db.settings.put(data.settings);
      }
    });

    return true;
  } catch (error) {
    console.error('Import failed:', error);
    return false;
  }
}
