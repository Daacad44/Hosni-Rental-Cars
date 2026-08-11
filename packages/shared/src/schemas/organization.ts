import { z } from 'zod';
import { moneyString } from '../money.js';

/**
 * Organization settings (§15). OWNER-only, audit-logged. These are the knobs the
 * pricing, settlement and job code reads: the tax rate, the daily-charge grace
 * window, timezone and currency, the service-interval thresholds, and the fuel
 * charge. Changing them never rewrites history — stored quotes and closed
 * agreements keep their own snapshots.
 */
export const orgSettingsSchema = z.object({
  // VAT as a percentage, e.g. "5.00" = 5%.
  vatRate: z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/, 'Enter a percentage like "5.00"'),
  // Minutes past a full day before the next day begins to be charged.
  graceMinutes: z.number().int().min(0).max(1440),
  // IANA timezone; nightly jobs run at 02:00 in this zone.
  timezone: z.string().trim().min(1).max(64),
  currency: z.string().trim().min(3).max(3),
  serviceIntervalKm: z.number().int().min(0).max(1_000_000),
  serviceIntervalDays: z.number().int().min(0).max(3650),
  serviceThresholdKm: z.number().int().min(0).max(100_000),
  serviceThresholdDays: z.number().int().min(0).max(365),
  // Charge per eighth of a tank when a vehicle is returned lower on fuel.
  fuelChargePerEighth: moneyString,
});
export type OrgSettingsRequest = z.infer<typeof orgSettingsSchema>;

export interface OrgSettingsView {
  name: string;
  vatRate: string;
  graceMinutes: number;
  timezone: string;
  currency: string;
  serviceIntervalKm: number;
  serviceIntervalDays: number;
  serviceThresholdKm: number;
  serviceThresholdDays: number;
  fuelChargePerEighth: string;
}
