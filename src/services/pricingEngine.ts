import { 
  ExtraCostItem, 
  ShiftSurchargeType, 
  SurchargeConfig, 
  RatesConfig
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
  surchargeConfig: SurchargeConfig
): number {
  const safeBase = Math.max(0, Number(baseRate) || 0);
  const safeMult = Number(multiplier) > 0 ? Number(multiplier) : 1.0;
  const rateWithMultiplier = safeBase * safeMult;

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
  return extraCosts.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
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
  const kmCost = Math.max(0, Number(distanceKm) || 0) * Math.max(0, Number(ratePerKm) || 0);
  const timeCost = Math.max(0, Number(travelTimeHours) || 0) * Math.max(0, Number(travelHourlyRate) || 0);
  const diet = Math.max(0, Number(dietAllowance) || 0);
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
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const day = date.getDay();
  return day === 0 || day === 6;
}

/**
 * Estimates diet allowance recommendation based on total hours spent (shift + travel).
 */
export function estimateDiet(totalDurationHours: number, rates: RatesConfig): { allowance: number; type: 'none' | 'half_day' | 'full_day' } {
  if (totalDurationHours >= 12) {
    return { allowance: rates.dietFullDayRate, type: 'full_day' };
  }
  if (totalDurationHours >= 5) {
    return { allowance: rates.dietHalfDayRate, type: 'half_day' };
  }
  return { allowance: 0, type: 'none' };
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
