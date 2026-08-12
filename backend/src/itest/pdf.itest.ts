import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, authCookie, principal, makeTenant, makeCustomer, makeVehicle, makeAgreement, makeInvoice, type TestUser } from './helpers.js';

/** The rental contract renders as a real PDF (starts with the %PDF- magic). */
describe('PDF generation', () => {
  let org: { organizationId: string; branchId: string };
  let owner: TestUser;
  let agreementId: string;

  beforeEach(async () => {
    org = await makeTenant('Pdf');
    owner = principal({ organizationId: org.organizationId, role: 'OWNER' });
    const customerId = await makeCustomer(org.organizationId, { fullName: 'Amina' });
    const vehicleId = await makeVehicle(org.organizationId, org.branchId);
    agreementId = await makeAgreement(org.organizationId, org.branchId, customerId, vehicleId);
    await makeInvoice(org.organizationId, org.branchId, customerId, { agreementId });
  });

  it('renders the rental contract as a valid PDF', async () => {
    const res = await request(app)
      .get(`/api/v1/agreements/${agreementId}/contract.pdf`)
      .set('Cookie', authCookie(owner))
      .buffer();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
