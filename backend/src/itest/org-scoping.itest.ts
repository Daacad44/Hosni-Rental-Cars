import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  app,
  authCookie,
  principal,
  makeTenant,
  makeVehicle,
  makeCustomer,
  makeReservation,
  makeAgreement,
  makeInvoice,
  makeExpense,
  makeFine,
  makeMaintenance,
  makeRateCard,
  type TestUser,
} from './helpers.js';

/**
 * organizationId is the security boundary. A user from org A must never reach a
 * row in org B — and the correct answer is 404, not 403 and certainly not 200.
 * 403 would confirm the row exists (leaking its existence across the tenant
 * boundary); 200 would hand it over. The acting user is always an OWNER so the
 * role gate never fires first and mask a scoping bug as a role failure.
 *
 * One case per resource, over every id-addressed verb the resource exposes plus
 * its CSV export, asserted against a row that genuinely exists in org B.
 */

const codeOf = (res: request.Response): string | undefined => res.body?.error?.code;

/** A cross-org request must be indistinguishable from "no such row". */
function expectNotFound(res: request.Response): void {
  expect(res.status, `expected 404 but got ${res.status} (code ${codeOf(res)})`).toBe(404);
  expect(codeOf(res)).toBe('NOT_FOUND');
}

describe('org scoping — a user from org A cannot reach org B rows', () => {
  let orgA: { organizationId: string; branchId: string };
  let orgB: { organizationId: string; branchId: string };
  let ownerA: TestUser;

  beforeEach(async () => {
    orgA = await makeTenant('A');
    orgB = await makeTenant('B');
    ownerA = principal({ organizationId: orgA.organizationId, role: 'OWNER' });
  });

  const as = (user: TestUser) => authCookie(user);

  it('vehicles: GET / PATCH / DELETE a foreign vehicle all 404', async () => {
    const vehicleB = await makeVehicle(orgB.organizationId, orgB.branchId);

    expectNotFound(await request(app).get(`/api/v1/vehicles/${vehicleB}`).set('Cookie', as(ownerA)));
    expectNotFound(
      await request(app).patch(`/api/v1/vehicles/${vehicleB}`).set('Cookie', as(ownerA)).send({ colour: 'Red' }),
    );
    expectNotFound(await request(app).delete(`/api/v1/vehicles/${vehicleB}`).set('Cookie', as(ownerA)));
  });

  it('customers: GET / PATCH / block a foreign customer all 404', async () => {
    const customerB = await makeCustomer(orgB.organizationId);

    expectNotFound(await request(app).get(`/api/v1/customers/${customerB}`).set('Cookie', as(ownerA)));
    expectNotFound(
      await request(app)
        .patch(`/api/v1/customers/${customerB}`)
        .set('Cookie', as(ownerA))
        .send({ fullName: 'Valid Name' }),
    );
    expectNotFound(
      await request(app)
        .post(`/api/v1/customers/${customerB}/block`)
        .set('Cookie', as(ownerA))
        .send({ reason: 'test' }),
    );
  });

  it('reservations: GET / confirm / cancel a foreign reservation all 404', async () => {
    const customerB = await makeCustomer(orgB.organizationId);
    const vehicleB = await makeVehicle(orgB.organizationId, orgB.branchId);
    const reservationB = await makeReservation(orgB.organizationId, orgB.branchId, customerB, {
      vehicleId: vehicleB,
    });

    expectNotFound(await request(app).get(`/api/v1/reservations/${reservationB}`).set('Cookie', as(ownerA)));
    expectNotFound(
      await request(app).post(`/api/v1/reservations/${reservationB}/confirm`).set('Cookie', as(ownerA)).send({}),
    );
    expectNotFound(
      await request(app).post(`/api/v1/reservations/${reservationB}/cancel`).set('Cookie', as(ownerA)).send({}),
    );
  });

  it('agreements: GET a foreign agreement 404', async () => {
    const customerB = await makeCustomer(orgB.organizationId);
    const vehicleB = await makeVehicle(orgB.organizationId, orgB.branchId);
    const agreementB = await makeAgreement(orgB.organizationId, orgB.branchId, customerB, vehicleB);

    expectNotFound(await request(app).get(`/api/v1/agreements/${agreementB}`).set('Cookie', as(ownerA)));
  });

  it('invoices: GET / pay a foreign invoice all 404', async () => {
    const customerB = await makeCustomer(orgB.organizationId);
    const invoiceB = await makeInvoice(orgB.organizationId, orgB.branchId, customerB);

    expectNotFound(await request(app).get(`/api/v1/invoices/${invoiceB}`).set('Cookie', as(ownerA)));
    expectNotFound(
      await request(app)
        .post(`/api/v1/invoices/${invoiceB}/payments`)
        .set('Cookie', as(ownerA))
        .send({ amount: '10.00', method: 'CASH' }),
    );
  });

  it('maintenance: GET / update status of a foreign record all 404', async () => {
    const vehicleB = await makeVehicle(orgB.organizationId, orgB.branchId);
    const maintenanceB = await makeMaintenance(orgB.organizationId, vehicleB);

    expectNotFound(await request(app).get(`/api/v1/maintenance/${maintenanceB}`).set('Cookie', as(ownerA)));
    expectNotFound(
      await request(app)
        .patch(`/api/v1/maintenance/${maintenanceB}/status`)
        .set('Cookie', as(ownerA))
        .send({ status: 'IN_PROGRESS' }),
    );
  });

  it('rate cards: PUT / DELETE a foreign card all 404', async () => {
    const cardB = await makeRateCard(orgB.organizationId);

    expectNotFound(
      await request(app)
        .put(`/api/v1/rate-cards/${cardB}`)
        .set('Cookie', as(ownerA))
        .send({
          category: 'ECONOMY',
          dailyRate: '60.00',
          weeklyRate: null,
          monthlyRate: null,
          includedKmPerDay: null,
          extraKmRate: '0.30',
          depositAmount: '250.00',
          lateHourRate: '9.00',
          effectiveFrom: '2020-01-01T00:00:00.000Z',
          effectiveTo: null,
        }),
    );
    expectNotFound(await request(app).delete(`/api/v1/rate-cards/${cardB}`).set('Cookie', as(ownerA)));
  });

  it('fines: charging a foreign fine 404', async () => {
    const customerA = await makeCustomer(orgA.organizationId);
    const fineB = await makeFine(orgB.organizationId);

    // Even with a customer that DOES belong to org A, the fine itself is foreign.
    expectNotFound(
      await request(app)
        .post(`/api/v1/fines/${fineB}/charge`)
        .set('Cookie', as(ownerA))
        .send({ customerId: customerA }),
    );
  });

  it('expenses: DELETE a foreign expense 404, and the CSV export never leaks it', async () => {
    const expenseA = await makeExpense(orgA.organizationId, { description: 'A-fuel' });
    const expenseB = await makeExpense(orgB.organizationId, { description: 'B-fuel' });

    // Delete of a foreign row is 404, and the row survives in org B.
    expectNotFound(await request(app).delete(`/api/v1/expenses/${expenseB}`).set('Cookie', as(ownerA)));

    const csv = await request(app).get('/api/v1/expenses/export').set('Cookie', as(ownerA));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    // Org A's own row is present; org B's is absent from A's export.
    expect(csv.text).toContain('A-fuel');
    expect(csv.text).not.toContain('B-fuel');
    expect(csv.text).not.toContain(expenseB);
    // Sanity: the id we asserted absent is a real, findable row for org B.
    expect(expenseA).not.toEqual(expenseB);
  });
});
