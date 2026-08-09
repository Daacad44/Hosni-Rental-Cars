import { Prisma } from '@prisma/client';
import type { CreateExpenseRequest, ExpenseFilters, ExpenseView } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';
import type { AuthContext } from '../middleware/authenticate.js';

type Row = Prisma.ExpenseGetPayload<object>;

function whereFrom(actor: AuthContext, filters: ExpenseFilters): Prisma.ExpenseWhereInput {
  return {
    organizationId: actor.organizationId,
    ...(filters.category ? { category: filters.category } : {}),
    ...(filters.vehicleId ? { vehicleId: filters.vehicleId } : {}),
    ...(filters.branchId ? { branchId: filters.branchId } : {}),
    ...(filters.from || filters.to
      ? {
          date: {
            ...(filters.from ? { gte: new Date(filters.from) } : {}),
            ...(filters.to ? { lte: new Date(filters.to) } : {}),
          },
        }
      : {}),
  };
}

async function plateMap(rows: Row[]): Promise<Map<string, string>> {
  const ids = rows.map((r) => r.vehicleId).filter((v): v is string => v !== null);
  const vehicles = await prisma.vehicle.findMany({ where: { id: { in: ids } }, select: { id: true, plateNumber: true } });
  return new Map(vehicles.map((v) => [v.id, v.plateNumber]));
}

function toView(r: Row, plate: string | null): ExpenseView {
  return {
    id: r.id,
    category: r.category,
    amount: r.amount.toFixed(2),
    date: r.date.toISOString(),
    vehicleId: r.vehicleId,
    vehiclePlate: plate,
    branchId: r.branchId,
    description: r.description,
  };
}

export async function createExpense(actor: AuthContext, input: CreateExpenseRequest): Promise<ExpenseView> {
  const row = await prisma.expense.create({
    data: {
      organizationId: actor.organizationId,
      category: input.category,
      amount: new Prisma.Decimal(input.amount),
      date: new Date(input.date),
      vehicleId: input.vehicleId ?? null,
      branchId: input.branchId ?? null,
      description: input.description ?? null,
      receiptKey: input.receiptKey ?? null,
      createdById: actor.id,
    },
  });
  const plates = await plateMap([row]);
  return toView(row, row.vehicleId ? (plates.get(row.vehicleId) ?? null) : null);
}

export async function listExpenses(
  actor: AuthContext,
  filters: ExpenseFilters,
): Promise<{ rows: ExpenseView[]; total: number; sum: string }> {
  const where = whereFrom(actor, filters);
  const [rows, total, agg] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.expense.count({ where }),
    prisma.expense.aggregate({ where, _sum: { amount: true } }),
  ]);
  const plates = await plateMap(rows);
  return {
    rows: rows.map((r) => toView(r, r.vehicleId ? (plates.get(r.vehicleId) ?? null) : null)),
    total,
    sum: (agg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
  };
}

/** All matching expenses as CSV, scoped exactly like the screen. */
export async function exportExpensesCsv(actor: AuthContext, filters: ExpenseFilters): Promise<string> {
  const rows = await prisma.expense.findMany({ where: whereFrom(actor, filters), orderBy: { date: 'desc' } });
  const plates = await plateMap(rows);
  const header = 'date,category,amount,vehicle,branch,description';
  const lines = rows.map((r) => {
    const plate = r.vehicleId ? (plates.get(r.vehicleId) ?? '') : '';
    const desc = (r.description ?? '').replace(/"/g, '""');
    return `${r.date.toISOString().slice(0, 10)},${r.category},${r.amount.toFixed(2)},${plate},${r.branchId ?? ''},"${desc}"`;
  });
  return [header, ...lines].join('\n');
}

export async function deleteExpense(actor: AuthContext, id: string): Promise<void> {
  const row = await prisma.expense.findFirst({ where: { id, organizationId: actor.organizationId } });
  if (!row) throw notFound('Expense not found');
  await prisma.expense.delete({ where: { id } });
}
