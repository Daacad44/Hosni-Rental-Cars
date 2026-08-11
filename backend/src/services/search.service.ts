import type { Prisma } from '@prisma/client';
import type { SearchResults } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import type { AuthContext } from '../middleware/authenticate.js';

/**
 * Global search behind the topbar (§9). Organization-scoped always; an AGENT is
 * additionally branch-scoped, and a MECHANIC (no customer or money access) only
 * ever sees vehicles. A short term returns nothing rather than scanning the
 * whole tenant.
 */
export async function search(actor: AuthContext, rawTerm: string): Promise<SearchResults> {
  const term = rawTerm.trim();
  const empty: SearchResults = { vehicles: [], customers: [], agreements: [] };
  if (term.length < 2) return empty;

  const branchId = actor.role === 'AGENT' ? (actor.branchId ?? '__none__') : undefined;
  const canCustomers = actor.role !== 'MECHANIC';
  const canAgreements = actor.role !== 'MECHANIC';
  const contains = { contains: term, mode: 'insensitive' as const };

  const vehicleWhere: Prisma.VehicleWhereInput = {
    organizationId: actor.organizationId,
    deletedAt: null,
    ...(branchId ? { branchId } : {}),
    OR: [{ plateNumber: contains }, { vin: contains }, { make: contains }, { model: contains }],
  };

  const [vehicles, customers, agreements] = await Promise.all([
    prisma.vehicle.findMany({
      where: vehicleWhere,
      orderBy: { plateNumber: 'asc' },
      take: 6,
      select: { id: true, plateNumber: true, make: true, model: true },
    }),
    canCustomers
      ? prisma.customer.findMany({
          where: {
            organizationId: actor.organizationId,
            deletedAt: null,
            OR: [{ fullName: contains }, { phone: contains }, { nationalId: contains }, { licenceNumber: contains }],
          },
          orderBy: { fullName: 'asc' },
          take: 6,
          select: { id: true, fullName: true, phone: true },
        })
      : Promise.resolve([]),
    canAgreements && /^\d+$/.test(term)
      ? prisma.agreement.findMany({
          where: {
            organizationId: actor.organizationId,
            agreementNumber: Number(term),
            ...(branchId ? { branchId } : {}),
          },
          take: 6,
          select: { id: true, agreementNumber: true, status: true },
        })
      : Promise.resolve([]),
  ]);

  return {
    vehicles: vehicles.map((v) => ({ id: v.id, label: v.plateNumber, sublabel: `${v.make} ${v.model}` })),
    customers: customers.map((c) => ({ id: c.id, label: c.fullName, sublabel: c.phone })),
    agreements: agreements.map((a) => ({ id: a.id, label: `#${a.agreementNumber}`, sublabel: a.status })),
  };
}
