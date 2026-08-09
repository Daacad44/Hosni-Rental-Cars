import { z } from 'zod';
import { roleSchema } from '../api.js';

export const LOCALES = ['so', 'en'] as const;
export const localeSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof localeSchema>;

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

/** Shape returned by GET /auth/me and embedded after a successful login. */
export const authUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  role: roleSchema,
  locale: localeSchema,
  organization: z.object({ id: z.string(), name: z.string(), timezone: z.string() }),
  branch: z.object({ id: z.string(), name: z.string() }).nullable(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const loginResponseSchema = z.object({ user: authUserSchema });
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const createUserRequestSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: roleSchema,
  branchId: z.string().nullable().optional(),
  locale: localeSchema.default('so'),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z
  .object({
    name: z.string().min(2).max(120),
    role: roleSchema,
    branchId: z.string().nullable(),
    locale: localeSchema,
    password: z.string().min(8).max(128),
  })
  .partial();
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;
