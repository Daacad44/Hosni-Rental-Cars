import { z } from 'zod';
import { moneyString } from '../money.js';

export const TRANSMISSIONS = ['MANUAL', 'AUTOMATIC'] as const;
export const transmissionSchema = z.enum(TRANSMISSIONS);
export type Transmission = z.infer<typeof transmissionSchema>;

export const FUEL_TYPES = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC'] as const;
export const fuelTypeSchema = z.enum(FUEL_TYPES);
export type FuelType = z.infer<typeof fuelTypeSchema>;

/** Derived operational status — computed by the server, never typed by a user. */
export const VEHICLE_STATUSES = [
  'AVAILABLE',
  'RESERVED',
  'RENTED',
  'MAINTENANCE',
  'OUT_OF_SERVICE',
] as const;
export const vehicleStatusSchema = z.enum(VEHICLE_STATUSES);
export type VehicleStatus = z.infer<typeof vehicleStatusSchema>;

export const VEHICLE_DOCUMENT_TYPES = [
  'INSURANCE',
  'REGISTRATION',
  'INSPECTION',
  'PERMIT',
] as const;
export const vehicleDocumentTypeSchema = z.enum(VEHICLE_DOCUMENT_TYPES);
export type VehicleDocumentType = z.infer<typeof vehicleDocumentTypeSchema>;

const currentYear = new Date().getFullYear();

export const createVehicleSchema = z.object({
  plateNumber: z.string().trim().min(1).max(20),
  vin: z.string().trim().min(1).max(32),
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(60),
  year: z.coerce.number().int().min(1950).max(currentYear + 1),
  category: z.string().trim().min(1).max(40),
  transmission: transmissionSchema,
  fuelType: fuelTypeSchema,
  seats: z.coerce.number().int().min(1).max(60),
  colour: z.string().trim().min(1).max(30),
  odometer: z.coerce.number().int().min(0),
  acquisitionCost: moneyString,
  acquisitionDate: z.string().datetime(),
  branchId: z.string().min(1),
});
export type CreateVehicleRequest = z.infer<typeof createVehicleSchema>;

// Odometer is excluded here — it changes only through the guarded odometer flow.
export const updateVehicleSchema = createVehicleSchema.omit({ odometer: true }).partial();
export type UpdateVehicleRequest = z.infer<typeof updateVehicleSchema>;

/** Correct the odometer. A value below the stored reading requires MANAGER+. */
export const odometerUpdateSchema = z.object({
  odometer: z.coerce.number().int().min(0),
  reason: z.string().trim().max(300).optional(),
});
export type OdometerUpdateRequest = z.infer<typeof odometerUpdateSchema>;

/** Toggle the only manual status override. A reason is required when enabling. */
export const outOfServiceSchema = z
  .object({
    isOutOfService: z.boolean(),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((v) => !v.isOutOfService || (v.reason && v.reason.length > 0), {
    message: 'A reason is required to take a vehicle out of service',
    path: ['reason'],
  });
export type OutOfServiceRequest = z.infer<typeof outOfServiceSchema>;

export const vehicleFiltersSchema = z.object({
  q: z.string().trim().optional(),
  status: vehicleStatusSchema.optional(),
  category: z.string().trim().optional(),
  branchId: z.string().optional(),
  // "documents expiring" filter: within this many days (default 30 when flag set).
  docsExpiringDays: z.coerce.number().int().min(1).max(365).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type VehicleFilters = z.infer<typeof vehicleFiltersSchema>;

export const createVehicleDocumentSchema = z
  .object({
    type: vehicleDocumentTypeSchema,
    number: z.string().trim().min(1).max(60),
    issueDate: z.string().datetime(),
    expiryDate: z.string().datetime(),
    storageKey: z.string().trim().optional(),
    contentType: z.string().trim().optional(),
  })
  .refine((v) => new Date(v.expiryDate) > new Date(v.issueDate), {
    message: 'Expiry must be after the issue date',
    path: ['expiryDate'],
  });
export type CreateVehicleDocumentRequest = z.infer<typeof createVehicleDocumentSchema>;

// ── Response views ──────────────────────────────────────────────────────────

export interface VehicleListItem {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  year: number;
  category: string;
  branchId: string;
  branchName: string;
  status: VehicleStatus;
  odometer: number;
  photoCount: number;
  hasExpiringDocs: boolean;
}

export interface VehicleDetail {
  id: string;
  plateNumber: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  category: string;
  transmission: Transmission;
  fuelType: FuelType;
  seats: number;
  colour: string;
  odometer: number;
  acquisitionCost: string;
  acquisitionDate: string;
  branchId: string;
  branchName: string;
  status: VehicleStatus;
  isOutOfService: boolean;
  outOfServiceReason: string | null;
  createdAt: string;
}

export interface VehicleDocumentView {
  id: string;
  type: VehicleDocumentType;
  number: string;
  issueDate: string;
  expiryDate: string;
  hasFile: boolean;
  daysUntilExpiry: number;
}
