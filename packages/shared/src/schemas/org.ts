import { z } from 'zod';
import { moneyString } from '../money.js';

const percent = z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, 'A percentage like "5.00"');

export const updateOrgSettingsSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    timezone: z.string().trim().min(1).max(60),
    currency: z.string().trim().length(3),
    vatRate: percent,
    graceMinutes: z.number().int().min(0).max(1439),
    fuelChargePerEighth: moneyString,
    noShowHours: z.number().int().min(1).max(72),
    serviceIntervalKm: z.number().int().min(100).max(100000),
    serviceIntervalDays: z.number().int().min(1).max(3650),
    serviceThresholdKm: z.number().int().min(0).max(50000),
    serviceThresholdDays: z.number().int().min(0).max(365),
  })
  .partial();
export type UpdateOrgSettingsRequest = z.infer<typeof updateOrgSettingsSchema>;

export interface OrgSettingsView {
  id: string;
  name: string;
  timezone: string;
  currency: string;
  vatRate: string;
  graceMinutes: number;
  fuelChargePerEighth: string;
  noShowHours: number;
  serviceIntervalKm: number;
  serviceIntervalDays: number;
  serviceThresholdKm: number;
  serviceThresholdDays: number;
}
