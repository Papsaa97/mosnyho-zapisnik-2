import type { ConsumableItem } from '../../../src/types';
import {
  calculateConsumableItemBilledPrice,
} from '../../../src/services/pricingEngine';

export { calculateConsumableItemBilledPrice };
export type { ConsumableItem };

/**
 * Test helper wrapping item billed price with IEEE 754 precision protection
 * for downstream scenario cross-feature balance calculations.
 */
export function calculateItemBilledPrice(
  unitPrice: number,
  quantity: number,
  markupPercent: number = 0
): number {
  const safeUnitPrice = Math.max(0, Number(unitPrice) || 0);
  const safeQuantity = Math.max(0, Number(quantity) || 0);
  const safeMarkup = Math.max(0, Number(markupPercent) || 0);

  const rawCost = safeUnitPrice * safeQuantity;
  return Math.round((rawCost * (100 + safeMarkup)) / 100);
}

export function calculateConsumableSlipTotals(
  items: ConsumableItem[],
  overheadMarkupPercent: number = 0,
  fixedOverheadFee: number = 0
): { totalMaterialCost: number; totalBilledAmount: number } {
  if (!items || items.length === 0) {
    const fee = Math.max(0, Number(fixedOverheadFee) || 0);
    return {
      totalMaterialCost: 0,
      totalBilledAmount: fee,
    };
  }

  let totalCost = 0;
  let totalBilled = 0;

  for (const item of items) {
    const cost = Math.max(0, (item.unitPrice || 0) * (item.quantity || 0));
    totalCost += cost;

    const effectiveMarkup = item.markupPercent !== undefined ? item.markupPercent : overheadMarkupPercent;
    const billed = calculateItemBilledPrice(item.unitPrice, item.quantity, effectiveMarkup);
    totalBilled += billed;
  }

  const fee = Math.max(0, Number(fixedOverheadFee) || 0);
  return {
    totalMaterialCost: Math.round(totalCost),
    totalBilledAmount: Math.round(totalBilled + fee),
  };
}
