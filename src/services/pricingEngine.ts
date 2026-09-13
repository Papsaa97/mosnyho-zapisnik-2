import { 
  ExtraCostItem, 
  ShiftSurchargeType, 
  SurchargeConfig, 
  RatesConfig,
  DietBandType,
  DietEstimateResult,
  ConsumableItem,
  ConsumableSlip,
  QuickActionTag
} from '../types';


/**
 * Calculates net worked hours from start time, end time, and break minutes.
 * Handles overnight shifts across midnight (e.g. 22:00 to 06:00).
 * Guards against NaN, negative results, and excessive break minutes.
 */
export function calculateNetHours(startTime: string, endTime: string, breakMinutes: number): number {
  if (!startTime || !endTime) return 0;

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;

  let startMinutes = startH * 60 + startM;
  let endMinutes = endH * 60 + endM;

  // Overnight shift crosses midnight
  if (endMinutes < startMinutes) {
    endMinutes += 24 * 60;
  }

  const durationMinutes = endMinutes - startMinutes;
  // Guard: break cannot exceed shift duration (already validated in form, but safety net here)
  const safeBreak = Math.min(Math.max(0, breakMinutes || 0), durationMinutes);
  const netMinutes = Math.max(0, durationMinutes - safeBreak);

  const result = Math.round((netMinutes / 60) * 100) / 100;
  return Number.isFinite(result) ? result : 0;
}

/**
 * Calculates effective hourly rate based on base rate, multiplier, and surcharges.
 */
export function calculateEffectiveHourlyRate(
  baseRate: number,
  multiplier: number,
  surcharges: ShiftSurchargeType[],
  surchargeConfig: SurchargeConfig,
  manualHourlyRateOverride?: number
): number {
  if (manualHourlyRateOverride !== undefined && manualHourlyRateOverride > 0) {
    return manualHourlyRateOverride;
  }

  const safeBase = Number(baseRate) || 0;
  const safeMult = Number(multiplier) > 0 ? Number(multiplier) : 1.0;
  let rateWithMultiplier = safeBase * safeMult;

  if (surchargeConfig.useFixedBonus) {
    let bonus = 0;
    if (surcharges.includes('weekend')) bonus += surchargeConfig.fixedWeekendBonus || 0;
    if (surcharges.includes('night')) bonus += surchargeConfig.fixedNightBonus || 0;
    if (surcharges.includes('holiday')) bonus += surchargeConfig.fixedHolidayBonus || 0;
    return Math.round(rateWithMultiplier + bonus);
  }

  // Percentage surcharges (additive)
  let percentBonus = 0;
  if (surcharges.includes('weekend')) percentBonus += (surchargeConfig.weekendPercent || 25);
  if (surcharges.includes('night')) percentBonus += (surchargeConfig.nightPercent || 20);
  if (surcharges.includes('holiday')) percentBonus += (surchargeConfig.holidayPercent || 50);

  const finalRate = rateWithMultiplier * (1 + percentBonus / 100);
  return Math.round(finalRate * 10) / 10;
}

/**
 * Calculates sum of extra costs.
 */
export function calculateExtraCostsTotal(extraCosts: ExtraCostItem[]): number {
  if (!Array.isArray(extraCosts)) return 0;
  return extraCosts.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
}

/**
 * Calculates total travel compensation (km + driving time + diets).
 */
export function calculateTravelTotal(
  distanceKm: number,
  ratePerKm: number,
  travelTimeHours: number,
  travelHourlyRate: number,
  dietAllowance: number
): number {
  const kmCost = (Number(distanceKm) || 0) * (Number(ratePerKm) || 0);
  const timeCost = (Number(travelTimeHours) || 0) * (Number(travelHourlyRate) || 0);
  const diet = Number(dietAllowance) || 0;
  return Math.round((kmCost + timeCost + diet) * 100) / 100;
}

/**
 * Calculates grand total earnings for an entry.
 */
export function calculateGrandTotal(entry: {
  totalHours: number;
  pricing: {
    calculatedHourlyRate: number;
    manualTotalOverride?: number;
    isManualOverride?: boolean;
  };
  travel: {
    distanceKm: number;
    ratePerKm: number;
    travelTimeHours: number;
    travelHourlyRate: number;
    dietAllowance: number;
  };
  extraCosts: ExtraCostItem[];
}): number {
  if (entry.pricing.isManualOverride && (entry.pricing.manualTotalOverride || 0) > 0) {
    return Number(entry.pricing.manualTotalOverride);
  }

  const laborEarnings = (Number(entry.totalHours) || 0) * (Number(entry.pricing.calculatedHourlyRate) || 0);
  const travelEarnings = calculateTravelTotal(
    entry.travel.distanceKm,
    entry.travel.ratePerKm,
    entry.travel.travelTimeHours,
    entry.travel.travelHourlyRate,
    entry.travel.dietAllowance
  );
  const extraCostsTotal = calculateExtraCostsTotal(entry.extraCosts);

  return Math.round(laborEarnings + travelEarnings + extraCostsTotal);
}

/**
 * Checks if a date string is a weekend (Saturday or Sunday).
 */
export function isDateWeekend(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return false;
  const [year, month, day] = parts;
  const date = new Date(year, month - 1, day);
  if (isNaN(date.getTime())) return false;
  const weekday = date.getDay();
  return weekday === 0 || weekday === 6;
}

export const PDP_STATUTORY_CLAUSE = 
  "Daň odvede zákazník – režim přenesené daňové povinnosti dle § 92e zákona o DPH";

export function normalizeDietType(dietType?: string): DietBandType {
  if (!dietType || dietType === 'none') return 'none';
  if (dietType === 'half_day' || dietType === 'band_1') return 'band_1';
  if (dietType === 'full_day' || dietType === 'band_2') return 'band_2';
  if (dietType === 'band_3') return 'band_3';
  if (dietType === 'custom') return 'custom';
  return 'none';
}

/**
 * Estimates diet allowance recommendation based on total hours spent (shift + travel)
 * according to Czech Labor Code (§ 163 / § 176) 3 statutory MPSV tiers:
 * - Band 1: 5.0h to 12.0h inclusive (default 166 Kč)
 * - Band 2: > 12.0h to 18.0h inclusive (default 256 Kč)
 * - Band 3: > 18.0h (default 398 Kč)
 * - Under 5.0h: 0 Kč (none)
 */
export function estimateDiet(
  totalDurationHours: number,
  rates: RatesConfig
): DietEstimateResult {
  const safeHours = Number(totalDurationHours) || 0;
  const band1Rate = rates.dietBand1Rate ?? rates.dietHalfDayRate ?? 166;
  const band2Rate = rates.dietBand2Rate ?? rates.dietFullDayRate ?? 256;
  const band3Rate = rates.dietBand3Rate ?? rates.dietOver18Rate ?? 398;

  if (safeHours > 18) {
    return { allowance: band3Rate, type: 'band_3', description: 'nad 18 h (Pásmo 3)' };
  }
  if (safeHours > 12) {
    return { allowance: band2Rate, type: 'band_2', description: '12–18 h (Pásmo 2)' };
  }
  if (safeHours >= 5) {
    return { allowance: band1Rate, type: 'band_1', description: '5–12 h (Pásmo 1)' };
  }
  return { allowance: 0, type: 'none', description: 'Bez nároku (< 5 h)' };
}

export interface VatCalculationResult {
  taxBase: number;
  vatRatePercent: number;
  vatAmount: number;
  totalWithVat: number;
  isPdp: boolean;
  statutoryClause?: string;
}

/**
 * Calculates VAT and total amount, accounting for § 92e PDP (reverse charge).
 * When isPdp is true:
 * - VAT is 0% (0 Kč)
 * - Total equals tax base
 * - Mandatory statutory clause is included
 */
export function calculateVatAndTotal(
  amount: number,
  isPdp: boolean = false,
  standardVatRatePercent: number = 21
): VatCalculationResult {
  const taxBase = Math.round(Number(amount) || 0);
  if (isPdp) {
    return {
      taxBase,
      vatRatePercent: 0,
      vatAmount: 0,
      totalWithVat: taxBase,
      isPdp: true,
      statutoryClause: PDP_STATUTORY_CLAUSE
    };
  }
  const vatAmount = Math.round((taxBase * standardVatRatePercent) / 100);
  return {
    taxBase,
    vatRatePercent: standardVatRatePercent,
    vatAmount,
    totalWithVat: taxBase + vatAmount,
    isPdp: false
  };
}

/**
 * Formats Czech currency string: e.g. "12 450 Kč"
 */
export function formatCurrency(amount: number): string {
  const rounded = Math.round(amount || 0);
  return new Intl.NumberFormat('cs-CZ', {
    style: 'currency',
    currency: 'CZK',
    maximumFractionDigits: 0
  }).format(rounded);
}

/**
 * Formats hours with decimal Czech comma: e.g. "8,5 h"
 */
export function formatHours(hours: number): string {
  const safe = Number(hours) || 0;
  return `${safe.toFixed(1).replace('.', ',')} h`;
}

/**
 * Calculates billed price for a single consumable item including markup.
 * Formula: round(quantity * unitPrice * (1 + markupPercent / 100))
 * Cleanly guards against negative values and NaN.
 */
export function calculateConsumableItemBilledPrice(
  quantity: number,
  unitPrice: number,
  markupPercent: number = 0
): number {
  const safeQty = Math.max(0, Number(quantity) || 0);
  const safePrice = Math.max(0, Number(unitPrice) || 0);
  const safeMarkup = Math.max(0, Number(markupPercent) || 0);
  const base = safeQty * safePrice;
  return Math.round(base * (1 + safeMarkup / 100));
}

/**
 * Alias for calculateConsumableItemBilledPrice with (unitPrice, quantity, markupPercent) signature.
 */
export function calculateItemBilledPrice(
  unitPrice: number,
  quantity: number,
  markupPercent: number = 0
): number {
  return calculateConsumableItemBilledPrice(quantity, unitPrice, markupPercent);
}

/**
 * Calculates total material purchase cost and total billed amount for a consumables slip.
 * If items individually specify markupPercent, sums their individual billed prices;
 * otherwise applies overheadMarkupPercent to the total material cost.
 * Adds fixedOverheadFee to the billed amount.
 */
export function calculateConsumableSlipTotals(
  items: ConsumableItem[] | null | undefined,
  overheadMarkupPercent: number = 0,
  fixedOverheadFee: number = 0
): { totalMaterialCost: number; totalBilledAmount: number } {
  const safeFixedFee = Math.max(0, Number(fixedOverheadFee) || 0);

  if (!items || items.length === 0) {
    return {
      totalMaterialCost: 0,
      totalBilledAmount: safeFixedFee,
    };
  }

  const totalMaterialCost = items.reduce(
    (sum, item) => {
      const safeQty = Math.max(0, Number(item.quantity) || 0);
      const safeUnitPrice = Math.max(0, Number(item.unitPrice) || 0);
      return sum + Math.round(safeQty * safeUnitPrice);
    },
    0
  );

  const hasItemMarkups = items.some(i => i.markupPercent !== undefined);
  let itemsBilledSum = 0;

  if (hasItemMarkups) {
    itemsBilledSum = items.reduce((sum, item) => {
      if (item.billedPrice !== undefined) {
        return sum + Math.max(0, Number(item.billedPrice) || 0);
      }
      const safeQty = Math.max(0, Number(item.quantity) || 0);
      const safeUnitPrice = Math.max(0, Number(item.unitPrice) || 0);
      return sum + calculateConsumableItemBilledPrice(safeQty, safeUnitPrice, item.markupPercent ?? overheadMarkupPercent);
    }, 0);
  } else {
    const allHaveBilledPrice = items.every(i => i.billedPrice !== undefined);
    if (allHaveBilledPrice && overheadMarkupPercent === 0) {
      itemsBilledSum = items.reduce((sum, item) => sum + Math.max(0, Number(item.billedPrice) || 0), 0);
    } else {
      itemsBilledSum = Math.round(totalMaterialCost * (1 + (Math.max(0, Number(overheadMarkupPercent) || 0)) / 100));
    }
  }

  const totalBilledAmount = Math.max(0, itemsBilledSum + safeFixedFee);

  return { totalMaterialCost: Math.max(0, totalMaterialCost), totalBilledAmount };
}

/**
 * Calculates grand total earnings for an entry including consumable materials slip.
 * Respects manualTotalOverride when isManualOverride is active.
 */
export function calculateGrandTotalWithMaterials(
  entry: Parameters<typeof calculateGrandTotal>[0] & { consumableSlip?: ConsumableSlip }
): number {
  if (entry.pricing.isManualOverride && (entry.pricing.manualTotalOverride || 0) > 0) {
    return Number(entry.pricing.manualTotalOverride);
  }
  const baseTotal = calculateGrandTotal(entry);
  const materialsBilled = entry.consumableSlip?.totalBilledAmount || 0;
  return Math.round(baseTotal + materialsBilled);
}

/**
 * Formats activity tags as a clean comma-separated list for protocol header summary.
 */
export function formatActivityTagsForProtocol(tags?: QuickActionTag[]): string {
  if (!tags || !Array.isArray(tags) || tags.length === 0) return '';
  return tags.join(', ');
}
