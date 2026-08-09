import { z } from 'zod';

export const createCustomerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(4).max(30),
  email: z.string().email().optional().or(z.literal('')),
  nationalId: z.string().trim().max(40).optional(),
  licenceNumber: z.string().trim().max(40).optional(),
  licenceExpiry: z.string().datetime().optional(),
  address: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type CreateCustomerRequest = z.infer<typeof createCustomerSchema>;

export const updateCustomerSchema = createCustomerSchema.partial();
export type UpdateCustomerRequest = z.infer<typeof updateCustomerSchema>;

export const blockCustomerSchema = z.object({
  reason: z.string().trim().min(1).max(300),
});
export type BlockCustomerRequest = z.infer<typeof blockCustomerSchema>;

/** Merge a duplicate (loser) into a surviving customer (winner). Manager only. */
export const mergeCustomerSchema = z.object({
  loserId: z.string().min(1),
});
export type MergeCustomerRequest = z.infer<typeof mergeCustomerSchema>;

export const customerFiltersSchema = z.object({
  q: z.string().trim().optional(),
  blocked: z
    .enum(['true', 'false'])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type CustomerFilters = z.infer<typeof customerFiltersSchema>;

export interface CustomerListItem {
  id: string;
  fullName: string;
  phone: string;
  licenceNumber: string | null;
  isBlocked: boolean;
  licenceExpired: boolean;
}

export interface CustomerStats {
  rentalCount: number;
  totalSpend: string;
  outstandingBalance: string;
  damageCount: number;
  lateReturnCount: number;
}

export interface CustomerDetail {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  nationalId: string | null;
  licenceNumber: string | null;
  licenceExpiry: string | null;
  address: string | null;
  notes: string | null;
  isBlocked: boolean;
  blockReason: string | null;
  licenceExpired: boolean;
  stats: CustomerStats;
  createdAt: string;
}
