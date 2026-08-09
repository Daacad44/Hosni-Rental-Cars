import type { Prisma } from '@prisma/client';

/**
 * Allocate the next value in a gapless sequence, inside the caller's
 * transaction. The upsert + atomic increment guarantees no two agreements or
 * invoices ever share a number and none are skipped.
 */
export async function nextValue(
  tx: Prisma.TransactionClient,
  organizationId: string,
  name: string,
): Promise<number> {
  const row = await tx.counter.upsert({
    where: { organizationId_name: { organizationId, name } },
    create: { organizationId, name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return row.value;
}
