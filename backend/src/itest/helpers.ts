import { Prisma } from '@prisma/client';
import type { Role } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { createApp } from '../app.js';
import { signAccessToken } from '../utils/tokens.js';
import { ACCESS_COOKIE } from '../utils/cookies.js';

/** A single Express app reused across the suite. */
export const app = createApp();

// Monotonic across the process so numbers/plates/emails never collide within a
// test, regardless of truncation resetting rows between tests.
let seq = 0;
export const uid = (prefix = 'x'): string => `${prefix}-${Date.now().toString(36)}-${++seq}`;

export interface TestUser {
  id: string;
  organizationId: string;
  branchId: string | null;
  role: Role;
}

/** A minimal principal for token signing — no password, no DB row required. */
export function principal(params: {
  organizationId: string;
  role: Role;
  branchId?: string | null;
  id?: string;
}): TestUser {
  return {
    id: params.id ?? uid('user'),
    organizationId: params.organizationId,
    branchId: params.branchId ?? null,
    role: params.role,
  };
}

/** The Cookie header that authenticates a request as `user`, via a real JWT. */
export function authCookie(user: TestUser): string {
  const token = signAccessToken({
    sub: user.id,
    organizationId: user.organizationId,
    branchId: user.branchId,
    role: user.role,
  });
  return `${ACCESS_COOKIE}=${token}`;
}

export async function makeOrg(name = 'Org'): Promise<string> {
  const org = await prisma.organization.create({ data: { name } });
  return org.id;
}

export async function makeBranch(organizationId: string, name = 'Branch'): Promise<string> {
  const branch = await prisma.branch.create({ data: { organizationId, name } });
  return branch.id;
}

/** An organization with one branch — the usual starting point for a test. */
export async function makeTenant(name = 'Org'): Promise<{ organizationId: string; branchId: string }> {
  const organizationId = await makeOrg(name);
  const branchId = await makeBranch(organizationId, `${name} Main`);
  return { organizationId, branchId };
}

export async function makeVehicle(
  organizationId: string,
  branchId: string,
  overrides: Partial<Prisma.VehicleUncheckedCreateInput> = {},
): Promise<string> {
  const v = await prisma.vehicle.create({
    data: {
      organizationId,
      branchId,
      plateNumber: overrides.plateNumber ?? uid('PLATE'),
      vin: overrides.vin ?? uid('VIN'),
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
      category: 'ECONOMY',
      transmission: 'AUTOMATIC',
      fuelType: 'PETROL',
      seats: 5,
      colour: 'White',
      odometer: 10_000,
      acquisitionCost: new Prisma.Decimal('12000.00'),
      acquisitionDate: new Date('2020-01-01T00:00:00Z'),
      ...overrides,
    },
  });
  return v.id;
}

export async function makeCustomer(
  organizationId: string,
  overrides: Partial<Prisma.CustomerUncheckedCreateInput> = {},
): Promise<string> {
  const c = await prisma.customer.create({
    data: {
      organizationId,
      fullName: overrides.fullName ?? `Customer ${uid()}`,
      phone: overrides.phone ?? uid('PHONE'),
      ...overrides,
    },
  });
  return c.id;
}

export async function makeRateCard(
  organizationId: string,
  overrides: Partial<Prisma.RateCardUncheckedCreateInput> = {},
): Promise<string> {
  const card = await prisma.rateCard.create({
    data: {
      organizationId,
      category: 'ECONOMY',
      dailyRate: new Prisma.Decimal('50.00'),
      extraKmRate: new Prisma.Decimal('0.25'),
      depositAmount: new Prisma.Decimal('200.00'),
      lateHourRate: new Prisma.Decimal('8.00'),
      effectiveFrom: new Date('2020-01-01T00:00:00Z'),
      ...overrides,
    },
  });
  return card.id;
}

const emptyBreakdown = () => ({
  chargedDays: 1,
  composition: { months: 0, weeks: 0, days: 1, extraHours: 0 },
  lines: [{ kind: 'RENTAL', labelKey: 'pricing.rental', quantity: 1, unitAmount: '50.00', amount: '50.00' }],
  subtotal: '50.00',
  vat: '2.50',
  total: '52.50',
  deposit: '200.00',
});

const emptyRates = () => ({
  dailyRate: '50.00',
  weeklyRate: null,
  monthlyRate: null,
  includedKmPerDay: null,
  extraKmRate: '0.25',
  depositAmount: '200.00',
  lateHourRate: '8.00',
});

export async function makeReservation(
  organizationId: string,
  branchId: string,
  customerId: string,
  overrides: Partial<Prisma.ReservationUncheckedCreateInput> = {},
): Promise<string> {
  const r = await prisma.reservation.create({
    data: {
      organizationId,
      branchId,
      customerId,
      category: 'ECONOMY',
      startAt: new Date('2025-01-10T00:00:00Z'),
      endAt: new Date('2025-01-12T00:00:00Z'),
      quotedTotal: new Prisma.Decimal('52.50'),
      quotedDeposit: new Prisma.Decimal('200.00'),
      rateValues: emptyRates() as unknown as Prisma.InputJsonValue,
      quoteBreakdown: emptyBreakdown() as unknown as Prisma.InputJsonValue,
      ...overrides,
    },
  });
  return r.id;
}

export async function makeAgreement(
  organizationId: string,
  branchId: string,
  customerId: string,
  vehicleId: string,
  overrides: Partial<Prisma.AgreementUncheckedCreateInput> = {},
): Promise<string> {
  const a = await prisma.agreement.create({
    data: {
      organizationId,
      branchId,
      agreementNumber: overrides.agreementNumber ?? ++seq,
      customerId,
      vehicleId,
      startAt: new Date('2025-01-10T00:00:00Z'),
      endAt: new Date('2025-01-12T00:00:00Z'),
      checkoutOdometer: 10_000,
      checkoutFuel: 8,
      rateValues: emptyRates() as unknown as Prisma.InputJsonValue,
      ...overrides,
    },
  });
  return a.id;
}

export async function makeInvoice(
  organizationId: string,
  branchId: string,
  customerId: string,
  overrides: Partial<Prisma.InvoiceUncheckedCreateInput> = {},
): Promise<string> {
  const inv = await prisma.invoice.create({
    data: {
      organizationId,
      branchId,
      invoiceNumber: overrides.invoiceNumber ?? ++seq,
      customerId,
      ...overrides,
    },
  });
  return inv.id;
}

export async function makeExpense(
  organizationId: string,
  overrides: Partial<Prisma.ExpenseUncheckedCreateInput> = {},
): Promise<string> {
  const e = await prisma.expense.create({
    data: {
      organizationId,
      category: 'FUEL',
      amount: new Prisma.Decimal('40.00'),
      date: new Date('2025-01-10T00:00:00Z'),
      description: overrides.description ?? `Expense ${uid()}`,
      ...overrides,
    },
  });
  return e.id;
}

export async function makeFine(
  organizationId: string,
  overrides: Partial<Prisma.TrafficFineUncheckedCreateInput> = {},
): Promise<string> {
  const f = await prisma.trafficFine.create({
    data: {
      organizationId,
      noticeNumber: overrides.noticeNumber ?? uid('NOTICE'),
      offenceAt: new Date('2025-01-10T00:00:00Z'),
      location: 'Mogadishu',
      amount: new Prisma.Decimal('30.00'),
      ...overrides,
    },
  });
  return f.id;
}

export async function makeMaintenance(
  organizationId: string,
  vehicleId: string,
  overrides: Partial<Prisma.MaintenanceUncheckedCreateInput> = {},
): Promise<string> {
  const m = await prisma.maintenance.create({
    data: {
      organizationId,
      vehicleId,
      type: 'SERVICE',
      scheduledStart: new Date('2025-02-01T00:00:00Z'),
      scheduledEnd: new Date('2025-02-02T00:00:00Z'),
      ...overrides,
    },
  });
  return m.id;
}
