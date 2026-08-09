import { z } from 'zod';

/** Envelope for a successful response carrying a single payload. */
export interface ApiSuccess<T> {
  data: T;
  meta?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
}

/** Query parameters shared by every paginated list endpoint. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

/** Roles a staff account can hold, in descending order of authority. */
export const ROLES = ['OWNER', 'MANAGER', 'AGENT', 'MECHANIC'] as const;
export type Role = (typeof ROLES)[number];
export const roleSchema = z.enum(ROLES);
