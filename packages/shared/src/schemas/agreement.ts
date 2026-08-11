import { z } from 'zod';
import { moneyString } from '../money.js';
import type { SettlementResult } from './settlement.js';
import type { InvoiceView } from './invoice.js';

export const AGREEMENT_STATUSES = ['OPEN', 'OVERDUE', 'CLOSED'] as const;
export const agreementStatusSchema = z.enum(AGREEMENT_STATUSES);
export type AgreementStatus = z.infer<typeof agreementStatusSchema>;

export const DAMAGE_SEVERITIES = ['MINOR', 'MODERATE', 'SEVERE'] as const;
export const damageSeveritySchema = z.enum(DAMAGE_SEVERITIES);
export type DamageSeverity = z.infer<typeof damageSeveritySchema>;

/** Fixed panel list for marking damage. */
export const DAMAGE_PANELS = [
  'FRONT_BUMPER',
  'REAR_BUMPER',
  'BONNET',
  'ROOF',
  'BOOT',
  'FRONT_LEFT_DOOR',
  'FRONT_RIGHT_DOOR',
  'REAR_LEFT_DOOR',
  'REAR_RIGHT_DOOR',
  'LEFT_WING',
  'RIGHT_WING',
  'WINDSCREEN',
  'REAR_WINDOW',
  'WHEELS',
  'INTERIOR',
  'UNDERBODY',
] as const;
export const damagePanelSchema = z.enum(DAMAGE_PANELS);
export type DamagePanel = z.infer<typeof damagePanelSchema>;

export const FUEL_EIGHTHS = z.number().int().min(0).max(8);

export const inspectionChecklistSchema = z.object({
  tyres: z.boolean(),
  lights: z.boolean(),
  spare: z.boolean(),
  tools: z.boolean(),
  documents: z.boolean(),
  cleanliness: z.boolean(),
});
export type InspectionChecklist = z.infer<typeof inspectionChecklistSchema>;

export const damageInputSchema = z.object({
  panel: damagePanelSchema,
  severity: damageSeveritySchema,
  notes: z.string().trim().max(300).optional(),
  chargeable: z.boolean().optional(),
  chargeAmount: moneyString.optional(),
});
export type DamageInput = z.infer<typeof damageInputSchema>;

const inspectionInputSchema = z.object({
  odometer: z.number().int().min(0),
  fuelEighths: FUEL_EIGHTHS,
  checklist: inspectionChecklistSchema,
  notes: z.string().trim().max(1000).optional(),
  photoKeys: z.array(z.string()).default([]),
  signatureKey: z.string().optional(),
  damages: z.array(damageInputSchema).default([]),
});

export const checkoutSchema = z.object({
  customerId: z.string().min(1),
  vehicleId: z.string().min(1),
  reservationId: z.string().min(1).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  withDriver: z.boolean().optional(),
  overrideLicence: z.boolean().optional(),
  // At least four photos are enforced server-side for a check-out inspection.
  inspection: inspectionInputSchema,
  // Optional deposit/payment collected at pickup.
  depositMethod: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER']).optional(),
});
export type CheckoutRequest = z.infer<typeof checkoutSchema>;

export const checkinSchema = z.object({
  actualReturnAt: z.string().datetime().optional(),
  inspection: inspectionInputSchema,
  // Payment collected at settlement.
  payment: z
    .object({
      amount: moneyString,
      method: z.enum(['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER']),
      reference: z.string().trim().max(120).optional(),
    })
    .optional(),
});
export type CheckinRequest = z.infer<typeof checkinSchema>;

export const extendAgreementSchema = z.object({ endAt: z.string().datetime() });
export type ExtendAgreementRequest = z.infer<typeof extendAgreementSchema>;

/** Append-only correction of a recorded inspection (§5.7). */
export const correctInspectionSchema = z.object({
  odometer: z.number().int().min(0),
  fuelEighths: FUEL_EIGHTHS,
  checklist: inspectionChecklistSchema,
  notes: z.string().trim().max(1000).optional(),
});
export type CorrectInspectionRequest = z.infer<typeof correctInspectionSchema>;

export const agreementFiltersSchema = z.object({
  status: agreementStatusSchema.optional(),
  branchId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type AgreementFilters = z.infer<typeof agreementFiltersSchema>;

export interface DamageView {
  id: string;
  panel: DamagePanel;
  severity: DamageSeverity;
  notes: string | null;
  chargeable: boolean;
  chargeAmount: string | null;
  isPreExisting: boolean;
  repairedAt: string | null;
}

export interface AgreementListItem {
  id: string;
  agreementNumber: number;
  customerName: string;
  vehiclePlate: string;
  startAt: string;
  endAt: string;
  status: AgreementStatus;
}

export interface AgreementDetail {
  id: string;
  agreementNumber: number;
  customerId: string;
  customerName: string;
  vehicleId: string;
  vehiclePlate: string;
  branchId: string;
  startAt: string;
  endAt: string;
  status: AgreementStatus;
  checkoutOdometer: number;
  checkinOdometer: number | null;
  checkoutFuel: number;
  checkinFuel: number | null;
  withDriver: boolean;
  invoice: InvoiceView | null;
  preExistingDamages: DamageView[];
  newDamages: DamageView[];
}

export interface CheckinResult {
  settlement: SettlementResult;
  agreement: AgreementDetail;
}
