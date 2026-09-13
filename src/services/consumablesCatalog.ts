import { ConsumableCategory, ConsumableItem, QuickActionTag } from '../types';

export type CatalogTemplateItem = Omit<ConsumableItem, 'id' | 'quantity' | 'billedPrice'>;

/**
 * Predefined standard catalog of workshop and site consumables.
 * Conforms to ČSN / DIN standards (e.g. DIN 933 / 934 8.8, ISO technical gases, standard abrasives).
 */
export const STANDARD_CONSUMABLES_CATALOG: CatalogTemplateItem[] = [
  // 1. Řezné a brusné kotouče
  { category: 'cutting_grinding', name: 'Řezný kotouč ocel/nerez 125 × 1.0 mm', unit: 'ks', unitPrice: 35 },
  { category: 'cutting_grinding', name: 'Řezný kotouč ocel 150 × 1.6 mm', unit: 'ks', unitPrice: 55 },
  { category: 'cutting_grinding', name: 'Řezný kotouč ocel 230 × 1.9 mm', unit: 'ks', unitPrice: 95 },
  { category: 'cutting_grinding', name: 'Brusný lamelový kotouč 125 mm Z40/Z60', unit: 'ks', unitPrice: 75 },
  { category: 'cutting_grinding', name: 'Čisticí fíbrový kotouč Clean & Strip na sváry', unit: 'ks', unitPrice: 180 },

  // 2. Technické plyny
  { category: 'technical_gases', name: 'Argon 4.6 (100% Ar) náplň/podíl', unit: 'lahev/den', unitPrice: 650 },
  { category: 'technical_gases', name: 'CORGON 18 (82% Ar + 18% CO2) směs', unit: 'lahev/den', unitPrice: 550 },
  { category: 'technical_gases', name: 'Acetylen technický', unit: 'lahev', unitPrice: 850 },
  { category: 'technical_gases', name: 'Kyslík technický', unit: 'lahev', unitPrice: 450 },
  { category: 'technical_gases', name: 'Formovací plyn na kořen svaru', unit: 'lahev/den', unitPrice: 700 },

  // 3. Kotevní technika
  { category: 'anchors', name: 'Chemická kotva vinylester 300 ml', unit: 'kartuše', unitPrice: 280 },
  { category: 'anchors', name: 'Statický směšovač k chemické maltě', unit: 'ks', unitPrice: 25 },
  { category: 'anchors', name: 'Průvlaková ocelová kotva M10 × 90 mm pozink', unit: 'ks', unitPrice: 35 },
  { category: 'anchors', name: 'Průvlaková ocelová kotva M12 × 120 mm pozink', unit: 'ks', unitPrice: 55 },
  { category: 'anchors', name: 'Průvlaková ocelová kotva M16 × 140 mm pevnostní', unit: 'ks', unitPrice: 90 },
  { category: 'anchors', name: 'Závitová tyč M12 nerez A2', unit: 'm', unitPrice: 85 },

  // 4. Spojovací materiál (DIN 933 / DIN 934 pevnost 8.8)
  { category: 'fasteners', name: 'Šroub šestihranný DIN 933 M10×30 pozink 8.8', unit: 'ks', unitPrice: 8 },
  { category: 'fasteners', name: 'Šroub šestihranný DIN 933 M12×40 pozink 8.8', unit: 'ks', unitPrice: 14 },
  { category: 'fasteners', name: 'Šroub šestihranný DIN 933 M16×60 pozink 8.8', unit: 'ks', unitPrice: 28 },
  { category: 'fasteners', name: 'Matice šestihranná DIN 934 M10/M12/M16 8.8', unit: 'ks', unitPrice: 6 },
  { category: 'fasteners', name: 'Podložka kruhová DIN 125 / DIN 9021', unit: 'ks', unitPrice: 4 },
  { category: 'fasteners', name: 'Samojistná matice DIN 985 pozink', unit: 'ks', unitPrice: 8 },

  // 5. Svářečský spotřební materiál
  { category: 'welding_consumables', name: 'Svařovací drát SG2 1.2 mm cívka 15 kg', unit: 'cívka', unitPrice: 1100 },
  { category: 'welding_consumables', name: 'TIG přídavný drát ER316L 2.0 mm', unit: 'kg', unitPrice: 280 },
  { category: 'welding_consumables', name: 'Elektrody bazické E-B 121 balení', unit: 'balení', unitPrice: 450 },
  { category: 'welding_consumables', name: 'Separační sprej na svařování', unit: 'ks', unitPrice: 120 },
];

export interface ConsumableCategoryMeta {
  key: ConsumableCategory;
  label: string;
  description: string;
  defaultUnit: string;
}

export const CONSUMABLE_CATEGORIES: ConsumableCategoryMeta[] = [
  { key: 'cutting_grinding', label: 'Řezání & broušení', description: 'Kotouče 125/150/230, lameláky', defaultUnit: 'ks' },
  { key: 'technical_gases', label: 'Technické plyny', description: 'Argon, CORGON, acetylen, kyslík', defaultUnit: 'lahev' },
  { key: 'anchors', label: 'Kotevní technika', description: 'Chemická malta, průvlakové kotvy', defaultUnit: 'ks' },
  { key: 'fasteners', label: 'Spojovací materiál', description: 'Šrouby DIN 933, matice DIN 934 8.8', defaultUnit: 'ks' },
  { key: 'welding_consumables', label: 'Svářečský materiál', description: 'Drát SG2, TIG tyče, elektrody', defaultUnit: 'kg' },
  { key: 'custom', label: 'Vlastní položka', description: 'Ostatní materiál ze stavby', defaultUnit: 'ks' },
];

/**
 * 5 mandatory 1-touch activity chips for glove-friendly quick selection.
 */
export const MANDATORY_ACTIVITY_CHIPS: QuickActionTag[] = [
  'Příprava',
  'Svařování',
  'Montáž ve výškách',
  'Broušení/začištění',
  'Kotvení'
];

/**
 * Toggles an activity chip on or off in the selected array.
 */
export function toggleActivityChip(
  selectedChips: QuickActionTag[],
  chipToToggle: QuickActionTag
): QuickActionTag[] {
  if (selectedChips.includes(chipToToggle)) {
    return selectedChips.filter(c => c !== chipToToggle);
  } else {
    return [...selectedChips, chipToToggle];
  }
}
