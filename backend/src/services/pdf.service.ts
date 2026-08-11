import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';
import { storage } from './storage/index.js';
import { logger } from '../lib/logger.js';
import type { AuthContext } from '../middleware/authenticate.js';

/**
 * The rental contract and receipt (§5.6), rendered to a PDF the agent can hand
 * the customer. It carries the organization details, the agreement number, both
 * inspections (check-out and check-in), the line-by-line settlement from the
 * invoice, and the captured signature. Every figure is read from the database —
 * nothing here recomputes money.
 */

interface Checklist {
  tyres: boolean;
  lights: boolean;
  spare: boolean;
  tools: boolean;
  documents: boolean;
  cleanliness: boolean;
}

async function loadAgreement(actor: AuthContext, id: string) {
  const agreement = await prisma.agreement.findFirst({
    where: { id, organizationId: actor.organizationId },
  });
  if (!agreement) throw notFound('Agreement not found');
  if (actor.role === 'AGENT' && agreement.branchId !== actor.branchId) throw notFound('Agreement not found');
  return agreement;
}

export async function agreementPdf(actor: AuthContext, id: string): Promise<Buffer> {
  const agreement = await loadAgreement(actor, id);
  const [org, branch, customer, vehicle, inspections, invoice] = await Promise.all([
    prisma.organization.findUnique({ where: { id: actor.organizationId } }),
    prisma.branch.findUnique({ where: { id: agreement.branchId }, select: { name: true } }),
    prisma.customer.findUnique({ where: { id: agreement.customerId } }),
    prisma.vehicle.findUnique({ where: { id: agreement.vehicleId } }),
    prisma.inspection.findMany({ where: { agreementId: agreement.id }, orderBy: { createdAt: 'asc' } }),
    prisma.invoice.findFirst({
      where: { agreementId: agreement.id, organizationId: actor.organizationId },
      include: { lines: { orderBy: { createdAt: 'asc' } } },
    }),
  ]);

  const currency = org?.currency ?? 'USD';
  const money = (v: string | number) => `${currency} ${Number(v).toFixed(2)}`;
  const date = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—');

  const checkout = inspections.find((i) => i.type === 'CHECKOUT') ?? null;
  const checkin = inspections.find((i) => i.type === 'CHECKIN') ?? null;
  const signed = [checkin, checkout].find((i) => i && i.signatureKey) ?? null;

  let signatureImage: Buffer | null = null;
  if (signed?.signatureKey) {
    try {
      signatureImage = await storage().read(signed.signatureKey);
    } catch (err) {
      logger.warn({ err, key: signed.signatureKey }, 'Could not read signature for PDF');
    }
  }

  // compress:false keeps the text streams uncompressed — the contract stays a
  // few KB larger but its content is directly inspectable (and testable).
  const doc = new PDFDocument({ size: 'A4', margin: 50, compress: false });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  const rule = () => {
    doc.moveTo(left, doc.y).lineTo(right, doc.y).strokeColor('#cccccc').stroke();
    doc.moveDown(0.5);
  };
  const heading = (text: string) => {
    doc.moveDown(0.6).fontSize(11).fillColor('#333333').font('Helvetica-Bold').text(text.toUpperCase());
    doc.moveDown(0.2);
    doc.font('Helvetica').fillColor('#000000').fontSize(10);
  };
  const kv = (label: string, value: string) => {
    doc.fontSize(10).fillColor('#666666').text(label, { continued: true }).fillColor('#000000').text(`  ${value}`);
  };

  // ── Header: organization + document identity ──
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#0b3d2e').text(org?.name ?? 'Rental');
  doc
    .fontSize(9)
    .font('Helvetica')
    .fillColor('#666666')
    .text(`${branch?.name ?? ''}${branch?.name ? ' · ' : ''}${currency} · VAT ${org ? Number(org.vatRate).toFixed(2) : '0.00'}%`);
  doc.moveDown(0.3);
  doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text(`Rental Agreement & Receipt #${agreement.agreementNumber}`);
  doc.moveDown(0.2);
  rule();

  // ── Parties & period ──
  heading('Rental');
  kv('Customer:', customer?.fullName ?? '—');
  kv('Phone:', customer?.phone ?? '—');
  kv('Vehicle:', vehicle ? `${vehicle.plateNumber} — ${vehicle.make} ${vehicle.model} (${vehicle.year})` : '—');
  kv('Status:', agreement.status);
  kv('Pick-up:', date(agreement.startAt));
  kv('Planned return:', date(agreement.endAt));
  kv('Returned:', date(agreement.closedAt));
  kv('With driver:', agreement.withDriver ? 'Yes' : 'No');

  // ── Inspections (both) ──
  const renderInspection = (title: string, insp: typeof checkout) => {
    heading(title);
    if (!insp) {
      doc.fillColor('#999999').text('Not recorded.').fillColor('#000000');
      return;
    }
    const c = insp.checklist as unknown as Checklist;
    kv('Odometer:', `${insp.odometer.toLocaleString()} km`);
    kv('Fuel:', `${insp.fuelEighths}/8`);
    kv(
      'Checklist:',
      (['tyres', 'lights', 'spare', 'tools', 'documents', 'cleanliness'] as const)
        .map((k) => `${k} ${c?.[k] ? '✓' : '✗'}`)
        .join(', '),
    );
    if (insp.notes) kv('Notes:', insp.notes);
    kv('Recorded:', date(insp.createdAt));
  };
  renderInspection('Check-out inspection', checkout);
  renderInspection('Check-in inspection', checkin);

  // ── Line-by-line settlement ──
  heading('Settlement');
  if (!invoice || invoice.lines.length === 0) {
    doc.fillColor('#999999').text('No charges recorded.').fillColor('#000000');
  } else {
    const colDesc = left;
    const colQty = right - 200;
    const colUnit = right - 140;
    const colAmt = right - 70;
    doc.fontSize(9).fillColor('#666666');
    doc.text('Description', colDesc, doc.y, { continued: true });
    doc.text('Qty', colQty, doc.y, { continued: true, width: 40, align: 'right' });
    doc.text('Unit', colUnit, doc.y, { continued: true, width: 60, align: 'right' });
    doc.text('Amount', colAmt, doc.y, { width: 70, align: 'right' });
    doc.moveDown(0.2);
    doc.fillColor('#000000').fontSize(10);
    for (const l of invoice.lines) {
      const y = doc.y;
      doc.text(l.description, colDesc, y, { width: colQty - colDesc - 8, continued: false });
      doc.text(String(l.quantity), colQty, y, { width: 40, align: 'right' });
      doc.text(Number(l.unitAmount).toFixed(2), colUnit, y, { width: 60, align: 'right' });
      doc.text(Number(l.amount).toFixed(2), colAmt, y, { width: 70, align: 'right' });
      doc.moveDown(0.2);
    }
    doc.moveDown(0.3);
    rule();
    doc.font('Helvetica-Bold');
    kv('Total:', money(invoice.total.toFixed(2)));
    kv('Paid:', money(invoice.paid.toFixed(2)));
    kv('Balance:', money(invoice.balance.toFixed(2)));
    doc.font('Helvetica');
  }

  // ── Signature ──
  heading('Signature');
  if (signatureImage) {
    try {
      doc.image(signatureImage, { fit: [200, 70] });
    } catch (err) {
      logger.warn({ err }, 'Could not embed signature image in PDF');
      doc.fillColor('#000000').text('Signature captured on file.');
    }
  } else {
    doc.fillColor('#999999').text('No signature captured.').fillColor('#000000');
  }
  doc.moveDown(0.5);
  doc.fontSize(8).fillColor('#999999').text(`Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);

  doc.end();
  return done;
}
