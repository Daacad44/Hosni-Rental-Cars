import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { correctInspection, listInspections } from '../services/agreements.service.js';
import { storage } from '../services/storage/index.js';
import {
  app,
  authCookie,
  principal,
  makeUser,
  makeTenant,
  makeCustomer,
  makeVehicle,
  makeAgreement,
  makeInvoice,
} from './helpers.js';

// superagent does not buffer application/pdf by default; collect the raw bytes.
function binaryParser(res: NodeJS.ReadableStream, callback: (err: Error | null, body: Buffer) => void): void {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
  res.on('end', () => callback(null, Buffer.concat(chunks)));
}

/**
 * Extract the visible text from an uncompressed PDF. PDFKit shows text as
 * hex-encoded strings (`<48656c6c6f> Tj`) and also emits literal `(...)`
 * strings; we decode both. Kerning can split a phrase across show operations,
 * so callers assert on tokens robust to that, not whole sentences.
 */
function pdfText(buf: Buffer): string {
  const raw = buf.toString('latin1');
  let out = '';
  for (const m of raw.matchAll(/<([0-9A-Fa-f\s]+)>/g)) {
    const hex = (m[1] ?? '').replace(/\s+/g, '');
    if (hex.length % 2 === 0) out += Buffer.from(hex, 'hex').toString('latin1') + ' ';
  }
  for (const m of raw.matchAll(/\(((?:[^()\\]|\\.)*)\)/g)) out += (m[1] ?? '') + ' ';
  return out;
}

const checklist = { tyres: true, lights: true, spare: true, tools: true, documents: true, cleanliness: true };
const inspectionInput = {
  odometer: 12345,
  fuelEighths: 6,
  checklist,
  notes: 'corrected reading',
  photoKeys: [] as string[],
  damages: [] as never[],
};

describe('inspection correction (§5.7) is append-only', () => {
  it('creates a new record referencing the original via supersedesId, leaving the original untouched', async () => {
    const { organizationId, branchId } = await makeTenant('IC');
    const owner = await makeUser({ organizationId, role: 'OWNER' });
    const customerId = await makeCustomer(organizationId);
    const vehicleId = await makeVehicle(organizationId, branchId);
    const agreementId = await makeAgreement(organizationId, branchId, customerId, vehicleId);

    const original = await prisma.inspection.create({
      data: { organizationId, agreementId, type: 'CHECKOUT', odometer: 10000, fuelEighths: 8, checklist, notes: 'original' },
    });

    await correctInspection(owner, agreementId, original.id, { reason: 'wrong odometer', inspection: inspectionInput });

    // The original row is unchanged — never edited.
    const originalAfter = await prisma.inspection.findUniqueOrThrow({ where: { id: original.id } });
    expect(originalAfter.odometer).toBe(10000);
    expect(originalAfter.notes).toBe('original');
    expect(originalAfter.supersedesId).toBeNull();

    // A new record exists, referencing the original, of the same type.
    const all = await prisma.inspection.findMany({ where: { agreementId }, orderBy: { createdAt: 'asc' } });
    expect(all).toHaveLength(2);
    const correction = all.find((i) => i.id !== original.id)!;
    expect(correction.supersedesId).toBe(original.id);
    expect(correction.type).toBe('CHECKOUT');
    expect(correction.odometer).toBe(12345);

    // The view marks the original superseded and the correction as a correction.
    const views = await listInspections(owner, agreementId);
    expect(views.find((v) => v.id === original.id)!.superseded).toBe(true);
    expect(views.find((v) => v.id === correction.id)!.supersedesId).toBe(original.id);

    // Audit trail records the correction with its reason.
    const audit = await prisma.auditLog.findFirst({ where: { organizationId, action: 'INSPECTION_CORRECTED' } });
    expect(audit).not.toBeNull();
  });
});

describe('agreement contract PDF (§5.6)', () => {
  it('renders a PDF carrying the org, agreement number, both inspections, settlement and signature', async () => {
    const { organizationId, branchId } = await makeTenant('Hosni PDF Co');
    const owner = principal({ organizationId, role: 'OWNER' });
    const customerId = await makeCustomer(organizationId, { fullName: 'Amina Test' });
    const vehicleId = await makeVehicle(organizationId, branchId);
    const agreementId = await makeAgreement(organizationId, branchId, customerId, vehicleId, { agreementNumber: 7 });

    // A stored signature image the PDF must embed (a minimal 1x1 JPEG).
    const jpeg = Buffer.from(
      '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAAB//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AfwD/2Q==',
      'base64',
    );
    const sigKey = `${organizationId}/inspections/sig-${Date.now()}.jpg`;
    await storage().put(sigKey, jpeg, 'image/jpeg');

    await prisma.inspection.create({
      data: { organizationId, agreementId, type: 'CHECKOUT', odometer: 10000, fuelEighths: 8, checklist, signatureKey: sigKey },
    });
    await prisma.inspection.create({
      data: { organizationId, agreementId, type: 'CHECKIN', odometer: 10500, fuelEighths: 6, checklist },
    });

    const invoiceId = await makeInvoice(organizationId, branchId, customerId, { agreementId });
    await prisma.invoiceLine.create({
      data: { organizationId, invoiceId, kind: 'RENTAL', description: 'Rental charge', quantity: 1, unitAmount: new Prisma.Decimal('150.00'), amount: new Prisma.Decimal('150.00') },
    });

    const res = await request(app)
      .get(`/api/v1/agreements/${agreementId}/contract.pdf`)
      .set('Cookie', authCookie(owner))
      .buffer(true)
      .parse(binaryParser as unknown as (res: request.Response, cb: (err: Error | null, body: unknown) => void) => void);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    const body = res.body as Buffer;
    expect(body.length).toBeGreaterThan(1000);
    const raw = body.toString('latin1');
    // Valid PDF envelope.
    expect(raw.startsWith('%PDF')).toBe(true);
    expect(raw).toContain('%%EOF');

    // Required content (§5.6): org identity + agreement number, the settlement,
    // the signature label, and both inspections. PDFKit kerning inserts stray
    // spaces mid-word, so we compare against a space-stripped projection.
    const packed = pdfText(body).replace(/\s+/g, '');
    expect(packed).toContain('Receipt#7'); // document identity + agreement number
    expect(packed).toContain('HosniPDFCo'); // organization name
    expect(packed).toContain('SETTLEMENT'); // line-by-line settlement section
    expect(packed).toContain('Rentalcharge'); // the settlement line item
    expect(packed).toContain('SIGNATURE');
    // Both inspections render an "INSPECTION" heading.
    expect((packed.match(/INSPECTION/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // The embedded signature image produces an image XObject in the PDF.
    expect(raw).toContain('/Subtype /Image');
  });
});
