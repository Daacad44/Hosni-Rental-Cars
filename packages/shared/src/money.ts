import { z } from 'zod';

/**
 * Money crosses the wire as a string, never a float. This validates a
 * non-negative decimal with up to two fraction digits. The server re-parses
 * and recomputes every amount regardless — a value in a request body is never
 * trusted as a total.
 */
export const moneyString = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Must be a monetary amount like "1500.00"');

export type MoneyString = z.infer<typeof moneyString>;
