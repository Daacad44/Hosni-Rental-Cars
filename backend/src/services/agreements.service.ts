import { Prisma } from '@prisma/client';
import type {
  CheckoutRequest,
  CheckinRequest,
  ExtendAgreementRequest,
  AgreementFilters,
  AgreementDetail,
  AgreementListItem,
  DamageView,
  CheckinResult,
  RateValues,
  SettlementResult,
  InspectionChecklist,
  DamageInput,
} from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound, conflict, forbidden } from '../lib/AppError.js';
import { writeAudit } from './audit.service.js';
import { nextValue } from './counter.service.js';
import { resolveRateValues } from './rateCards.service.js';
import { priceRental, toCents, fromCents } from './pricing.service.js';
import { settle } from './settlement.service.js';
import { assertVehicleFree, isExclusionViolation } from './availability.service.js';
import { createInvoice, addLines, recordPaymentTx, getInvoice, type NewLine } from './invoices.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

type Db = Prisma.TransactionClient;
const MIN_CHECKOUT_PHOTOS = 4;

async function orgSettings(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { graceMinutes: true, vatRate: true, fuelChargePerEighth: true },
  });
  return {
    grace: org?.graceMinutes ?? 59,
    vat: org ? org.vatRate.toFixed(2) : '0.00',
    fuelPerEighth: org ? org.fuelChargePerEighth.toFixed(2) : '0.00',
  };
}

function isManager(actor: AuthContext): boolean {
  return actor.role === 'OWNER' || actor.role === 'MANAGER';
}

async function guardCustomer(
  actor: AuthContext,
  db: Db,
  customerId: string,
  plannedReturn: Date,
  overrideLicence: boolean,
): Promise<void> {
  const customer = await db.customer.findFirst({
    where: { id: customerId, organizationId: actor.organizationId, deletedAt: null },
  });
  if (!customer) throw notFound('Customer not found');
  if (customer.isBlocked) throw new AppError('CUSTOMER_BLOCKED', 'This customer is blocked');
  if (customer.licenceExpiry && customer.licenceExpiry.getTime() < plannedReturn.getTime()) {
    if (!(overrideLicence && isManager(actor))) {
      throw new AppError('LICENCE_EXPIRED', 'The licence expires before the planned return date');
    }
    await writeAudit(
      {
        organizationId: actor.organizationId,
        actorId: actor.id,
        action: 'LICENCE_EXPIRY_OVERRIDE',
        entityType: 'Customer',
        entityId: customerId,
      },
      db,
    );
  }
}

async function createInspection(
  db: Db,
  params: {
    organizationId: string;
    agreementId: string;
    vehicleId: string;
    type: 'CHECKOUT' | 'CHECKIN';
    odometer: number;
    fuelEighths: number;
    checklist: InspectionChecklist;
    notes?: string;
    signatureKey?: string;
    photoKeys: string[];
    damages: DamageInput[];
    createdById: string;
  },
): Promise<void> {
  const inspection = await db.inspection.create({
    data: {
      organizationId: params.organizationId,
      agreementId: params.agreementId,
      type: params.type,
      odometer: params.odometer,
      fuelEighths: params.fuelEighths,
      checklist: params.checklist as unknown as Prisma.InputJsonValue,
      notes: params.notes ?? null,
      signatureKey: params.signatureKey ?? null,
      createdById: params.createdById,
    },
  });
  if (params.photoKeys.length > 0) {
    await db.inspectionPhoto.createMany({
      data: params.photoKeys.map((storageKey, position) => ({
        organizationId: params.organizationId,
        inspectionId: inspection.id,
        storageKey,
        contentType: 'image/jpeg',
        position,
      })),
    });
  }
  if (params.damages.length > 0) {
    await db.damage.createMany({
      data: params.damages.map((d) => ({
        organizationId: params.organizationId,
        vehicleId: params.vehicleId,
        agreementId: params.agreementId,
        inspectionId: inspection.id,
        panel: d.panel,
        severity: d.severity,
        notes: d.notes ?? null,
        chargeable: d.chargeable ?? false,
        chargeAmount: d.chargeable && d.chargeAmount ? new Prisma.Decimal(d.chargeAmount) : null,
      })),
    });
  }
}

export async function checkout(actor: AuthContext, input: CheckoutRequest): Promise<AgreementDetail> {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);
  if (endAt <= startAt) throw conflict('The return must be after pickup');
  if (input.inspection.photoKeys.length < MIN_CHECKOUT_PHOTOS) {
    throw new AppError('VALIDATION_ERROR', `At least ${MIN_CHECKOUT_PHOTOS} photos are required at check-out`);
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: input.vehicleId, organizationId: actor.organizationId, deletedAt: null },
  });
  if (!vehicle) throw notFound('Vehicle not found');
  if (actor.role === 'AGENT' && vehicle.branchId !== actor.branchId) throw notFound('Vehicle not found');
  if (vehicle.isOutOfService) throw new AppError('VEHICLE_UNAVAILABLE', 'The vehicle is out of service');

  if (input.inspection.odometer < vehicle.odometer && !isManager(actor)) {
    throw new AppError('ODOMETER_REGRESSION', 'Odometer cannot be below the current reading');
  }

  // Rates: inherit the reservation's snapshot when converting, else resolve now.
  let rates: RateValues;
  const reservationId = input.reservationId ?? null;
  if (reservationId) {
    const reservation = await prisma.reservation.findFirst({
      where: { id: reservationId, organizationId: actor.organizationId, status: 'CONFIRMED' },
    });
    if (!reservation) throw notFound('Reservation not found');
    rates = reservation.rateValues as unknown as RateValues;
  } else {
    rates = await resolveRateValues(actor.organizationId, vehicle, startAt);
  }

  const { grace, vat } = await orgSettings(actor.organizationId);
  const planned = priceRental({ startAt, endAt, rates, graceMinutes: grace, vatRatePercent: vat });

  try {
    const agreementId = await prisma.$transaction(async (tx) => {
      await assertVehicleFree(tx, {
        organizationId: actor.organizationId,
        vehicleId: vehicle.id,
        startAt,
        endAt,
      });

      const agreementNumber = await nextValue(tx, actor.organizationId, 'agreement');
      const agreement = await tx.agreement.create({
        data: {
          organizationId: actor.organizationId,
          branchId: vehicle.branchId,
          agreementNumber,
          reservationId,
          customerId: input.customerId,
          vehicleId: vehicle.id,
          startAt,
          endAt,
          checkoutOdometer: input.inspection.odometer,
          checkoutFuel: input.inspection.fuelEighths,
          withDriver: input.withDriver ?? false,
          rateValues: rates as unknown as Prisma.InputJsonValue,
          createdById: actor.id,
        },
      });

      await guardCustomer(actor, tx, input.customerId, endAt, input.overrideLicence ?? false);

      await createInspection(tx, {
        organizationId: actor.organizationId,
        agreementId: agreement.id,
        vehicleId: vehicle.id,
        type: 'CHECKOUT',
        odometer: input.inspection.odometer,
        fuelEighths: input.inspection.fuelEighths,
        checklist: input.inspection.checklist,
        notes: input.inspection.notes,
        signatureKey: input.inspection.signatureKey,
        photoKeys: input.inspection.photoKeys,
        damages: input.inspection.damages,
        createdById: actor.id,
      });

      // Opening invoice: the planned rental charge.
      const invoiceId = await createInvoice(tx, {
        organizationId: actor.organizationId,
        branchId: vehicle.branchId,
        agreementId: agreement.id,
        customerId: input.customerId,
        createdById: actor.id,
      });
      const openingLines: NewLine[] = planned.lines.map((l) => ({
        kind: l.kind,
        description: l.labelKey,
        quantity: l.quantity,
        unitAmount: l.unitAmount,
        amount: l.amount,
      }));
      await addLines(tx, actor.organizationId, invoiceId, openingLines);

      // Deposit collected at pickup, recorded as a held payment.
      if (input.depositMethod && toCents(rates.depositAmount) > 0) {
        await recordPaymentTx(tx, {
          organizationId: actor.organizationId,
          invoiceId,
          amount: rates.depositAmount,
          method: input.depositMethod,
          reference: 'DEPOSIT',
          receivedById: actor.id,
        });
      }

      if (reservationId) {
        await tx.reservation.update({ where: { id: reservationId }, data: { status: 'CONVERTED' } });
      }

      if (input.inspection.odometer >= vehicle.odometer) {
        await tx.vehicle.update({ where: { id: vehicle.id }, data: { odometer: input.inspection.odometer } });
      }

      return agreement.id;
    });

    return getAgreement(actor, agreementId);
  } catch (err) {
    if (isExclusionViolation(err)) {
      throw new AppError('OVERLAPPING_RESERVATION', 'The vehicle is already booked for this period');
    }
    throw err;
  }
}

/** Compute the settlement for a return WITHOUT persisting — for the check-in
 * review screen. The figures are still computed server-side (§5.6). */
export async function previewSettlement(
  actor: AuthContext,
  id: string,
  input: CheckinRequest,
): Promise<SettlementResult> {
  const agreement = await loadAgreementRow(actor, id);
  if (agreement.status === 'CLOSED') throw new AppError('AGREEMENT_ALREADY_CLOSED', 'This agreement is already closed');
  const rates = agreement.rateValues as unknown as RateValues;
  const invoice = await prisma.invoice.findFirst({
    where: { agreementId: agreement.id, organizationId: actor.organizationId },
    select: { paid: true },
  });
  const { grace, vat, fuelPerEighth } = await orgSettings(actor.organizationId);
  const damageChargesCents = input.inspection.damages
    .filter((d) => d.chargeable)
    .reduce((sum, d) => sum + (d.chargeAmount ? toCents(d.chargeAmount) : 0), 0);
  return settle({
    rates,
    startAt: agreement.startAt.toISOString(),
    actualReturnAt: (input.actualReturnAt ? new Date(input.actualReturnAt) : new Date()).toISOString(),
    checkoutOdometer: agreement.checkoutOdometer,
    checkinOdometer: input.inspection.odometer,
    checkoutFuelEighths: agreement.checkoutFuel,
    checkinFuelEighths: input.inspection.fuelEighths,
    fuelChargePerEighth: fuelPerEighth,
    damageCharges: fromCents(damageChargesCents),
    depositHeld: rates.depositAmount,
    priorPayments: invoice ? invoice.paid.toFixed(2) : '0.00',
    graceMinutes: grace,
    vatRatePercent: vat,
  });
}

export async function checkin(actor: AuthContext, id: string, input: CheckinRequest): Promise<CheckinResult> {
  const agreement = await loadAgreementRow(actor, id);
  if (agreement.status === 'CLOSED') throw new AppError('AGREEMENT_ALREADY_CLOSED', 'This agreement is already closed');

  const rates = agreement.rateValues as unknown as RateValues;
  const actualReturnAt = input.actualReturnAt ? new Date(input.actualReturnAt) : new Date();

  if (input.inspection.odometer < agreement.checkoutOdometer && !isManager(actor)) {
    throw new AppError('ODOMETER_REGRESSION', 'Return odometer cannot be below the check-out reading');
  }

  // Marking damage chargeable takes money from a customer — manager only.
  const chargeableDamages = input.inspection.damages.filter((d) => d.chargeable);
  if (chargeableDamages.length > 0 && !isManager(actor)) {
    throw forbidden('Only a manager may charge for damage');
  }
  const damageChargesCents = chargeableDamages.reduce(
    (sum, d) => sum + (d.chargeAmount ? toCents(d.chargeAmount) : 0),
    0,
  );

  const invoice = await prisma.invoice.findFirst({
    where: { agreementId: agreement.id, organizationId: actor.organizationId },
    include: { lines: true },
  });
  if (!invoice) throw notFound('Agreement invoice not found');

  const { grace, vat, fuelPerEighth } = await orgSettings(actor.organizationId);

  const settlement: SettlementResult = settle({
    rates,
    startAt: agreement.startAt.toISOString(),
    actualReturnAt: actualReturnAt.toISOString(),
    checkoutOdometer: agreement.checkoutOdometer,
    checkinOdometer: input.inspection.odometer,
    checkoutFuelEighths: agreement.checkoutFuel,
    checkinFuelEighths: input.inspection.fuelEighths,
    fuelChargePerEighth: fuelPerEighth,
    damageCharges: fromCents(damageChargesCents),
    depositHeld: rates.depositAmount,
    priorPayments: invoice.paid.toFixed(2),
    graceMinutes: grace,
    vatRatePercent: vat,
  });

  // Reconcile the opening invoice to the actual settled charges, itemized.
  const openingPreTax = invoice.lines
    .filter((l) => l.kind !== 'TAX')
    .reduce((s, l) => s + toCents(l.amount.toFixed(2)), 0);
  const openingTax = invoice.lines
    .filter((l) => l.kind === 'TAX')
    .reduce((s, l) => s + toCents(l.amount.toFixed(2)), 0);
  const settlementRentalPreTax = settlement.lines
    .filter((l) => l.kind === 'RENTAL' || l.kind === 'EXTRA_DAY')
    .reduce((s, l) => s + toCents(l.amount), 0);

  const adjustments: NewLine[] = [];
  const rentalDiff = settlementRentalPreTax - openingPreTax;
  if (rentalDiff > 0) {
    adjustments.push({ kind: 'EXTRA_DAY', description: 'settlement.line.extraTime', quantity: 1, unitAmount: fromCents(rentalDiff), amount: fromCents(rentalDiff) });
  } else if (rentalDiff < 0) {
    adjustments.push({ kind: 'DISCOUNT', description: 'settlement.line.earlyReturn', quantity: 1, unitAmount: fromCents(rentalDiff), amount: fromCents(rentalDiff) });
  }
  for (const l of settlement.lines) {
    if (l.kind === 'EXTRA_KM' || l.kind === 'FUEL' || l.kind === 'DAMAGE') {
      adjustments.push({ kind: l.kind, description: l.labelKey, quantity: l.quantity, unitAmount: l.unitAmount, amount: l.amount });
    }
  }
  const taxDiff = toCents(settlement.vat) - openingTax;
  if (taxDiff !== 0) {
    adjustments.push({ kind: 'TAX', description: 'pricing.line.vat', quantity: 1, unitAmount: fromCents(taxDiff), amount: fromCents(taxDiff) });
  }

  await prisma.$transaction(async (tx) => {
    await addLines(tx, actor.organizationId, invoice.id, adjustments);

    // Deposit release: hand back the unused portion as a negative payment.
    if (toCents(settlement.refundDue) > 0) {
      await recordPaymentTx(tx, {
        organizationId: actor.organizationId,
        invoiceId: invoice.id,
        amount: fromCents(-toCents(settlement.refundDue)),
        method: input.payment?.method ?? 'CASH',
        reference: 'DEPOSIT_REFUND',
        receivedById: actor.id,
      });
      await writeAudit(
        {
          organizationId: actor.organizationId,
          actorId: actor.id,
          action: 'DEPOSIT_RELEASE',
          entityType: 'Agreement',
          entityId: agreement.id,
          after: { refund: settlement.refundDue },
        },
        tx,
      );
    }

    // Balance collected from the customer at settlement.
    if (input.payment && toCents(input.payment.amount) > 0) {
      await recordPaymentTx(tx, {
        organizationId: actor.organizationId,
        invoiceId: invoice.id,
        amount: input.payment.amount,
        method: input.payment.method,
        reference: input.payment.reference ?? 'SETTLEMENT',
        receivedById: actor.id,
      });
    }

    await createInspection(tx, {
      organizationId: actor.organizationId,
      agreementId: agreement.id,
      vehicleId: agreement.vehicleId,
      type: 'CHECKIN',
      odometer: input.inspection.odometer,
      fuelEighths: input.inspection.fuelEighths,
      checklist: input.inspection.checklist,
      notes: input.inspection.notes,
      signatureKey: input.inspection.signatureKey,
      photoKeys: input.inspection.photoKeys,
      damages: input.inspection.damages,
      createdById: actor.id,
    });

    await tx.agreement.update({
      where: { id: agreement.id },
      data: {
        status: 'CLOSED',
        closedAt: new Date(),
        checkinOdometer: input.inspection.odometer,
        checkinFuel: input.inspection.fuelEighths,
      },
    });

    if (input.inspection.odometer >= agreement.checkoutOdometer) {
      await tx.vehicle.update({ where: { id: agreement.vehicleId }, data: { odometer: input.inspection.odometer } });
    }
  });

  return { settlement, agreement: await getAgreement(actor, agreement.id) };
}

export async function extendAgreement(
  actor: AuthContext,
  id: string,
  input: ExtendAgreementRequest,
): Promise<AgreementDetail> {
  const agreement = await loadAgreementRow(actor, id);
  if (agreement.status === 'CLOSED') throw new AppError('AGREEMENT_ALREADY_CLOSED', 'This agreement is already closed');
  const newEnd = new Date(input.endAt);
  if (newEnd <= agreement.endAt) throw conflict('The new return must be later than the current one');

  await prisma.$transaction(async (tx) => {
    // Re-check availability for the extended window against later bookings.
    await assertVehicleFree(tx, {
      organizationId: actor.organizationId,
      vehicleId: agreement.vehicleId,
      startAt: agreement.endAt,
      endAt: newEnd,
    });
    await tx.agreement.update({ where: { id }, data: { endAt: newEnd } });
  });

  return getAgreement(actor, id);
}

/** Hourly job: mark still-open agreements past their due time OVERDUE. */
export async function markOverdue(organizationId: string, now = new Date()): Promise<number> {
  const res = await prisma.agreement.updateMany({
    where: { organizationId, status: 'OPEN', endAt: { lt: now } },
    data: { status: 'OVERDUE' },
  });
  return res.count;
}

async function loadAgreementRow(actor: AuthContext, id: string) {
  const agreement = await prisma.agreement.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!agreement) throw notFound('Agreement not found');
  if (actor.role === 'AGENT' && agreement.branchId !== actor.branchId) throw notFound('Agreement not found');
  return agreement;
}

function toDamageView(d: {
  id: string;
  panel: string;
  severity: DamageView['severity'];
  notes: string | null;
  chargeable: boolean;
  chargeAmount: Prisma.Decimal | null;
  repairedAt: Date | null;
  isPreExisting: boolean;
}): DamageView {
  return {
    id: d.id,
    panel: d.panel as DamageView['panel'],
    severity: d.severity,
    notes: d.notes,
    chargeable: d.chargeable,
    chargeAmount: d.chargeAmount ? d.chargeAmount.toFixed(2) : null,
    isPreExisting: d.isPreExisting,
    repairedAt: d.repairedAt ? d.repairedAt.toISOString() : null,
  };
}

export async function getAgreement(actor: AuthContext, id: string): Promise<AgreementDetail> {
  const agreement = await loadAgreementRow(actor, id);
  const [customer, vehicle, invoice, inspections, damages] = await Promise.all([
    prisma.customer.findUnique({ where: { id: agreement.customerId }, select: { fullName: true } }),
    prisma.vehicle.findUnique({ where: { id: agreement.vehicleId }, select: { plateNumber: true } }),
    prisma.invoice.findFirst({ where: { agreementId: agreement.id }, select: { id: true } }),
    prisma.inspection.findMany({ where: { agreementId: agreement.id }, select: { id: true, type: true } }),
    prisma.damage.findMany({ where: { agreementId: agreement.id }, orderBy: { createdAt: 'asc' } }),
  ]);

  const checkoutInspectionIds = new Set(inspections.filter((i) => i.type === 'CHECKOUT').map((i) => i.id));
  const pre: DamageView[] = [];
  const neu: DamageView[] = [];
  for (const d of damages) {
    const isPre = d.inspectionId !== null && checkoutInspectionIds.has(d.inspectionId);
    const view = toDamageView({ ...d, isPreExisting: isPre });
    (isPre ? pre : neu).push(view);
  }

  return {
    id: agreement.id,
    agreementNumber: agreement.agreementNumber,
    customerId: agreement.customerId,
    customerName: customer?.fullName ?? '—',
    vehicleId: agreement.vehicleId,
    vehiclePlate: vehicle?.plateNumber ?? '—',
    branchId: agreement.branchId,
    startAt: agreement.startAt.toISOString(),
    endAt: agreement.endAt.toISOString(),
    status: agreement.status,
    checkoutOdometer: agreement.checkoutOdometer,
    checkinOdometer: agreement.checkinOdometer,
    checkoutFuel: agreement.checkoutFuel,
    checkinFuel: agreement.checkinFuel,
    withDriver: agreement.withDriver,
    invoice: invoice ? await getInvoice(actor, invoice.id) : null,
    preExistingDamages: pre,
    newDamages: neu,
  };
}

export async function listAgreements(
  actor: AuthContext,
  filters: AgreementFilters,
): Promise<{ rows: AgreementListItem[]; total: number }> {
  const scopedBranch = actor.role === 'AGENT' ? (actor.branchId ?? '__none__') : filters.branchId;
  const where: Prisma.AgreementWhereInput = {
    organizationId: actor.organizationId,
    ...(scopedBranch ? { branchId: scopedBranch } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.agreement.findMany({
      where,
      orderBy: { agreementNumber: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.agreement.count({ where }),
  ]);

  const customerIds = [...new Set(rows.map((r) => r.customerId))];
  const vehicleIds = [...new Set(rows.map((r) => r.vehicleId))];
  const [customers, vehicles] = await Promise.all([
    prisma.customer.findMany({ where: { id: { in: customerIds } }, select: { id: true, fullName: true } }),
    prisma.vehicle.findMany({ where: { id: { in: vehicleIds } }, select: { id: true, plateNumber: true } }),
  ]);
  const cName = new Map(customers.map((c) => [c.id, c.fullName]));
  const vPlate = new Map(vehicles.map((v) => [v.id, v.plateNumber]));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      agreementNumber: r.agreementNumber,
      customerName: cName.get(r.customerId) ?? '—',
      vehiclePlate: vPlate.get(r.vehicleId) ?? '—',
      startAt: r.startAt.toISOString(),
      endAt: r.endAt.toISOString(),
      status: r.status,
    })),
    total,
  };
}
