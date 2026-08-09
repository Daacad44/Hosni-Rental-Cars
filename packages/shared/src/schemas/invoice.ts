import { z } from 'zod';
import { moneyString } from '../money.js';
import type { InvoiceLineKind } from './pricing.js';

export const INVOICE_STATUSES = ['DRAFT', 'ISSUED', 'PARTIAL', 'PAID', 'VOID'] as const;
export const invoiceStatusSchema = z.enum(INVOICE_STATUSES);
export type InvoiceStatus = z.infer<typeof invoiceStatusSchema>;

export const PAYMENT_METHODS = ['CASH', 'CARD', 'MOBILE_MONEY', 'BANK_TRANSFER'] as const;
export const paymentMethodSchema = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const recordPaymentSchema = z.object({
  amount: moneyString,
  method: paymentMethodSchema,
  reference: z.string().trim().max(120).optional(),
});
export type RecordPaymentRequest = z.infer<typeof recordPaymentSchema>;

export const voidInvoiceSchema = z.object({ reason: z.string().trim().min(1).max(300) });
export type VoidInvoiceRequest = z.infer<typeof voidInvoiceSchema>;

export const invoiceFiltersSchema = z.object({
  status: invoiceStatusSchema.optional(),
  branchId: z.string().optional(),
  customerId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type InvoiceFilters = z.infer<typeof invoiceFiltersSchema>;

export interface InvoiceLineView {
  id: string;
  kind: InvoiceLineKind;
  description: string;
  quantity: number;
  unitAmount: string;
  amount: string;
}

export interface PaymentView {
  id: string;
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  createdAt: string;
}

export interface InvoiceView {
  id: string;
  invoiceNumber: number;
  agreementId: string | null;
  customerId: string;
  status: InvoiceStatus;
  total: string;
  paid: string;
  balance: string;
  voidReason: string | null;
  createdAt: string;
  lines: InvoiceLineView[];
  payments: PaymentView[];
}

export interface InvoiceListItem {
  id: string;
  invoiceNumber: number;
  customerId: string;
  status: InvoiceStatus;
  total: string;
  balance: string;
  createdAt: string;
}

export interface CashSummary {
  date: string;
  total: string;
  byMethod: Record<string, string>;
  byUser: Record<string, string>;
}
