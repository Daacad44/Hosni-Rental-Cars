import { z } from 'zod';
import { moneyString } from '../money.js';

/** Invoice line kinds, shared by pricing, settlement and invoicing. */
export const INVOICE_LINE_KINDS = [
  'RENTAL',
  'EXTRA_DAY',
  'EXTRA_KM',
  'FUEL',
  'DAMAGE',
  'FINE',
  'DISCOUNT',
  'DEPOSIT',
  'DEPOSIT_REFUND',
  'TAX',
] as const;
export const invoiceLineKindSchema = z.enum(INVOICE_LINE_KINDS);
export type InvoiceLineKind = z.infer<typeof invoiceLineKindSchema>;

/**
 * The rate values a price is computed from. An agreement stores exactly these
 * so a later rate-card edit never alters an existing contract. includedKmPerDay
 * is null for UNLIMITED — which is different from zero.
 */
export const rateValuesSchema = z.object({
  dailyRate: moneyString,
  weeklyRate: moneyString.nullable(),
  monthlyRate: moneyString.nullable(),
  includedKmPerDay: z.number().int().min(0).nullable(),
  extraKmRate: moneyString,
  depositAmount: moneyString,
  lateHourRate: moneyString,
});
export type RateValues = z.infer<typeof rateValuesSchema>;

export const rateCardSchema = z.object({
  category: z.string().trim().min(1).max(40),
  dailyRate: moneyString,
  weeklyRate: moneyString.nullable().optional(),
  monthlyRate: moneyString.nullable().optional(),
  includedKmPerDay: z.number().int().min(0).nullable(),
  extraKmRate: moneyString,
  depositAmount: moneyString,
  lateHourRate: moneyString,
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().nullable().optional(),
});
export type RateCardRequest = z.infer<typeof rateCardSchema>;

export interface RateCardView extends RateCardRequest {
  id: string;
  vehicleId: string | null;
}

/** Price a hypothetical range without persisting. */
export const quoteRequestSchema = z.object({
  vehicleId: z.string().min(1),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  drivenKm: z.number().int().min(0).nullable().optional(),
});
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;

export interface PricingLine {
  kind: InvoiceLineKind;
  labelKey: string;
  quantity: number;
  unitAmount: string;
  amount: string;
}

export interface PricingComposition {
  months: number;
  weeks: number;
  days: number;
  extraHours: number;
}

export interface PricingBreakdown {
  chargedDays: number;
  composition: PricingComposition;
  lines: PricingLine[];
  subtotal: string;
  vat: string;
  total: string;
  deposit: string;
}
