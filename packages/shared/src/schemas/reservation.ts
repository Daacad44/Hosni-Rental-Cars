import { z } from 'zod';
import type { PricingBreakdown } from './pricing.js';

export const RESERVATION_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'CONVERTED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export const reservationStatusSchema = z.enum(RESERVATION_STATUSES);
export type ReservationStatus = z.infer<typeof reservationStatusSchema>;

export const createReservationSchema = z
  .object({
    customerId: z.string().min(1),
    category: z.string().trim().min(1).max(40),
    vehicleId: z.string().min(1).nullable().optional(),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    // Confirm immediately (locks the vehicle) instead of leaving it pending.
    confirm: z.boolean().optional(),
    // Manager override for an expired licence, recorded in the audit log.
    overrideLicence: z.boolean().optional(),
  })
  .refine((v) => new Date(v.endAt) > new Date(v.startAt), {
    message: 'The return must be after pickup',
    path: ['endAt'],
  });
export type CreateReservationRequest = z.infer<typeof createReservationSchema>;

export const assignVehicleSchema = z.object({ vehicleId: z.string().min(1) });
export type AssignVehicleRequest = z.infer<typeof assignVehicleSchema>;

export const availabilityQuerySchema = z
  .object({
    from: z.string().datetime(),
    to: z.string().datetime(),
    category: z.string().trim().optional(),
    branchId: z.string().optional(),
  })
  .refine((v) => new Date(v.to) > new Date(v.from), {
    message: 'The end must be after the start',
    path: ['to'],
  });
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const reservationFiltersSchema = z.object({
  status: reservationStatusSchema.optional(),
  branchId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ReservationFilters = z.infer<typeof reservationFiltersSchema>;

export interface AvailableVehicle {
  id: string;
  plateNumber: string;
  make: string;
  model: string;
  category: string;
  branchName: string;
}

export interface ReservationListItem {
  id: string;
  customerName: string;
  category: string;
  vehiclePlate: string | null;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  quotedTotal: string;
}

export interface ReservationDetail {
  id: string;
  customerId: string;
  customerName: string;
  category: string;
  vehicleId: string | null;
  vehiclePlate: string | null;
  branchId: string;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  quotedTotal: string;
  quotedDeposit: string;
  breakdown: PricingBreakdown;
}
