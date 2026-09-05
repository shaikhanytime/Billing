/**
 * Deterministic Money & Decimal Precision Utilities
 * All internal finance values are stored as Integers in minor units (Paise).
 * All unit costs / WAC are stored in Micro-Paise (Scale 10,000).
 * All quantities are stored in Scaled Base Units (Scale 1,000).
 */

export const PAISE_FACTOR = 100;
export const MICRO_PAISE_FACTOR = 10000;
export const QTY_SCALE_FACTOR = 1000;

export function toPaise(rupees: number): number {
  if (isNaN(rupees) || !isFinite(rupees)) return 0;
  return Math.round(rupees * PAISE_FACTOR);
}

export function toRupees(paise: number): number {
  if (isNaN(paise) || !isFinite(paise)) return 0;
  return paise / PAISE_FACTOR;
}

export function toMicroPaise(rupees: number): number {
  if (isNaN(rupees) || !isFinite(rupees)) return 0;
  return Math.round(rupees * MICRO_PAISE_FACTOR);
}

export function microPaiseToRupees(microPaise: number): number {
  if (isNaN(microPaise) || !isFinite(microPaise)) return 0;
  return microPaise / MICRO_PAISE_FACTOR;
}

export function scaleQuantity(qty: number): number {
  if (isNaN(qty) || !isFinite(qty)) return 0;
  return Math.round(qty * QTY_SCALE_FACTOR);
}

export function unscaleQuantity(scaledQty: number): number {
  if (isNaN(scaledQty) || !isFinite(scaledQty)) return 0;
  return scaledQty / QTY_SCALE_FACTOR;
}

/**
 * Calculates line-item tax deterministically.
 * @param taxablePaise Taxable amount in Paise
 * @param gstRate Tax percentage (e.g. 18)
 * @returns Total tax in Paise
 */
export function calculateLineTaxPaise(taxablePaise: number, gstRate: number): number {
  if (taxablePaise <= 0 || gstRate <= 0) return 0;
  return Math.round((taxablePaise * gstRate) / 100);
}
