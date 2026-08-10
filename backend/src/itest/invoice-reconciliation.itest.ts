import { describe, it, expect, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import {
  createInvoice,
  addLines,
  recordPaymentTx,
  deriveInvoiceStatus,
  type NewLine,
} from '../services/invoices.service.js';
import { makeTenant, makeCustomer } from './helpers.js';

/**
 * Invoice reconciliation, as an invariant rather than an example. For arbitrary
 * generated sets of lines and payments, the identity balance = total − paid must
 * hold exactly (decimal money, no float drift), and the status must always be
 * DERIVED from the current numbers — never a stale value written earlier. If a
 * status could be stored and left behind, the second half of each round (which
 * mutates the invoice and re-checks) would catch it.
 */

// Deterministic PRNG so a failure reproduces from the seed printed in the name.
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const money = (r: () => number, max: number): string => (Math.floor(r() * max * 100) / 100).toFixed(2);

/** The status rule, restated independently of the implementation under test. */
function expectedStatus(isVoid: boolean, total: Prisma.Decimal, paid: Prisma.Decimal): string {
  if (isVoid) return 'VOID';
  if (total.isZero()) return 'DRAFT';
  if (paid.isZero()) return 'ISSUED';
  if (paid.lessThan(total)) return 'PARTIAL';
  return 'PAID';
}

describe('invoice reconciliation invariants', () => {
  let organizationId: string;
  let branchId: string;
  let customerId: string;

  beforeEach(async () => {
    ({ organizationId, branchId } = await makeTenant('I'));
    customerId = await makeCustomer(organizationId);
  });

  it('balance = total − paid and status is always derived, across generated sets', async () => {
    for (let round = 0; round < 40; round++) {
      const r = rng(1000 + round);

      const invoiceId = await prisma.$transaction((tx) =>
        createInvoice(tx, { organizationId, branchId, customerId }),
      );

      // Generate lines.
      const lineCount = Math.floor(r() * 5); // 0..4 — includes the empty (DRAFT) case
      const lines: NewLine[] = [];
      let expectedTotal = new Prisma.Decimal(0);
      for (let i = 0; i < lineCount; i++) {
        const quantity = 1 + Math.floor(r() * 3);
        const unit = money(r, 100);
        const amount = new Prisma.Decimal(unit).times(quantity);
        lines.push({ kind: 'RENTAL', description: `line ${i}`, quantity, unitAmount: unit, amount: amount.toFixed(2) });
        expectedTotal = expectedTotal.plus(amount);
      }
      if (lines.length > 0) {
        await prisma.$transaction((tx) => addLines(tx, organizationId, invoiceId, lines));
      }

      // Generate payments (never exceeding total by much; may leave a balance).
      const paymentCount = Math.floor(r() * 4);
      let expectedPaid = new Prisma.Decimal(0);
      for (let i = 0; i < paymentCount; i++) {
        const cap = expectedTotal.isZero() ? 20 : Number(expectedTotal) / 2;
        const amount = money(r, Math.max(1, cap));
        if (new Prisma.Decimal(amount).isZero()) continue;
        await prisma.$transaction((tx) =>
          recordPaymentTx(tx, { organizationId, invoiceId, amount, method: 'CASH' }),
        );
        expectedPaid = expectedPaid.plus(amount);
      }

      const inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });

      // Stored aggregates match an independent sum of the child rows.
      expect(inv.total.equals(expectedTotal), `round ${round} total`).toBe(true);
      expect(inv.paid.equals(expectedPaid), `round ${round} paid`).toBe(true);
      // The core identity.
      expect(inv.balance.equals(inv.total.minus(inv.paid)), `round ${round} balance identity`).toBe(true);
      // Status is a pure function of the current numbers.
      expect(deriveInvoiceStatus(inv)).toBe(expectedStatus(inv.isVoid, inv.total, inv.paid));

      // Now mutate and re-check: a stored/stale status would survive this, a
      // derived one cannot. Add one more line, then one more payment.
      await prisma.$transaction((tx) =>
        addLines(tx, organizationId, invoiceId, [
          { kind: 'FINE', description: 'extra', quantity: 1, unitAmount: '15.00', amount: '15.00' },
        ]),
      );
      await prisma.$transaction((tx) =>
        recordPaymentTx(tx, { organizationId, invoiceId, amount: '5.00', method: 'CARD' }),
      );

      const after = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      expect(after.total.equals(expectedTotal.plus('15.00')), `round ${round} total after`).toBe(true);
      expect(after.paid.equals(expectedPaid.plus('5.00')), `round ${round} paid after`).toBe(true);
      expect(after.balance.equals(after.total.minus(after.paid)), `round ${round} balance after`).toBe(true);
      expect(deriveInvoiceStatus(after)).toBe(expectedStatus(after.isVoid, after.total, after.paid));
    }
  });

  it('a fully paid invoice reads PAID; a partial one PARTIAL; an empty one DRAFT', async () => {
    // Anchored examples pinning the ends of the derivation, alongside the fuzz.
    const invoiceId = await prisma.$transaction((tx) =>
      createInvoice(tx, { organizationId, branchId, customerId }),
    );
    let inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(deriveInvoiceStatus(inv)).toBe('DRAFT');

    await prisma.$transaction((tx) =>
      addLines(tx, organizationId, invoiceId, [
        { kind: 'RENTAL', description: 'r', quantity: 1, unitAmount: '100.00', amount: '100.00' },
      ]),
    );
    inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(deriveInvoiceStatus(inv)).toBe('ISSUED');
    expect(inv.balance.toFixed(2)).toBe('100.00');

    await prisma.$transaction((tx) =>
      recordPaymentTx(tx, { organizationId, invoiceId, amount: '40.00', method: 'CASH' }),
    );
    inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(deriveInvoiceStatus(inv)).toBe('PARTIAL');
    expect(inv.balance.toFixed(2)).toBe('60.00');

    await prisma.$transaction((tx) =>
      recordPaymentTx(tx, { organizationId, invoiceId, amount: '60.00', method: 'CASH' }),
    );
    inv = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
    expect(deriveInvoiceStatus(inv)).toBe('PAID');
    expect(inv.balance.toFixed(2)).toBe('0.00');
  });
});
