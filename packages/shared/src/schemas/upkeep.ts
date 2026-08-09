import { z } from 'zod';
import { moneyString } from '../money.js';

// ── Maintenance ──
export const MAINTENANCE_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
export const maintenanceStatusSchema = z.enum(MAINTENANCE_STATUSES);
export type MaintenanceStatus = z.infer<typeof maintenanceStatusSchema>;

export const createMaintenanceSchema = z
  .object({
    vehicleId: z.string().min(1),
    type: z.string().trim().min(1).max(80),
    scheduledStart: z.string().datetime(),
    scheduledEnd: z.string().datetime(),
    odometer: z.number().int().min(0).optional(),
    vendor: z.string().trim().max(120).optional(),
    cost: moneyString.optional(),
    notes: z.string().trim().max(1000).optional(),
    // Explicit confirmation to schedule over an existing reservation.
    force: z.boolean().optional(),
  })
  .refine((v) => new Date(v.scheduledEnd) > new Date(v.scheduledStart), {
    message: 'The end must be after the start',
    path: ['scheduledEnd'],
  });
export type CreateMaintenanceRequest = z.infer<typeof createMaintenanceSchema>;

export const updateMaintenanceStatusSchema = z.object({
  status: maintenanceStatusSchema,
  odometer: z.number().int().min(0).optional(),
  cost: moneyString.optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type UpdateMaintenanceStatusRequest = z.infer<typeof updateMaintenanceStatusSchema>;

export const maintenanceFiltersSchema = z.object({
  status: maintenanceStatusSchema.optional(),
  vehicleId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type MaintenanceFilters = z.infer<typeof maintenanceFiltersSchema>;

export interface MaintenanceView {
  id: string;
  vehicleId: string;
  vehiclePlate: string;
  type: string;
  status: MaintenanceStatus;
  scheduledStart: string;
  scheduledEnd: string;
  odometer: number | null;
  vendor: string | null;
  cost: string | null;
  notes: string | null;
  nextDueAt: string | null;
  nextDueOdometer: number | null;
}

// ── Expenses ──
export const EXPENSE_CATEGORIES = ['FUEL', 'INSURANCE', 'FINE', 'SALARY', 'PARTS', 'PERMIT', 'OTHER'] as const;
export const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>;

export const createExpenseSchema = z.object({
  category: expenseCategorySchema,
  amount: moneyString,
  date: z.string().datetime(),
  vehicleId: z.string().nullable().optional(),
  branchId: z.string().nullable().optional(),
  description: z.string().trim().max(500).optional(),
  receiptKey: z.string().optional(),
});
export type CreateExpenseRequest = z.infer<typeof createExpenseSchema>;

export const expenseFiltersSchema = z.object({
  category: expenseCategorySchema.optional(),
  vehicleId: z.string().optional(),
  branchId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type ExpenseFilters = z.infer<typeof expenseFiltersSchema>;

export interface ExpenseView {
  id: string;
  category: ExpenseCategory;
  amount: string;
  date: string;
  vehicleId: string | null;
  vehiclePlate: string | null;
  branchId: string | null;
  description: string | null;
}

// ── Traffic fines ──
export const createFineSchema = z.object({
  noticeNumber: z.string().trim().min(1).max(80),
  offenceAt: z.string().datetime(),
  location: z.string().trim().min(1).max(200),
  amount: moneyString,
  vehicleId: z.string().min(1),
  notes: z.string().trim().max(500).optional(),
});
export type CreateFineRequest = z.infer<typeof createFineSchema>;

export const chargeFineSchema = z.object({
  customerId: z.string().min(1),
});
export type ChargeFineRequest = z.infer<typeof chargeFineSchema>;

export interface FineView {
  id: string;
  noticeNumber: string;
  offenceAt: string;
  location: string;
  amount: string;
  vehicleId: string | null;
  vehiclePlate: string | null;
  suggestedAgreementId: string | null;
  suggestedCustomerName: string | null;
  customerCharged: boolean;
  invoiceId: string | null;
}

// ── Alerts ──
export interface AlertView {
  id: string;
  type: string;
  entityType: string;
  entityId: string;
  message: string;
  raisedOn: string;
  resolvedAt: string | null;
}
