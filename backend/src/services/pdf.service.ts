import PDFDocument from 'pdfkit';
import type { AgreementDetail, InvoiceView } from '@hosni/shared';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/AppError.js';
import { getAgreement } from './agreements.service.js';
import { getInvoice } from './invoices.service.js';
import type { AuthContext } from '../middleware/authenticate.js';

/** Render a PDFKit document to a Buffer. */
function toBuffer(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    draw(doc);
    doc.end();
  });
}

async function orgName(organizationId: string): Promise<{ name: string; currency: string }> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, currency: true } });
  if (!org) throw notFound('Organization not found');
  return org;
}

function money(n: string, currency: string): string {
  return `${currency} ${n}`;
}

function heading(doc: PDFKit.PDFDocument, org: string, title: string): void {
  doc.fontSize(20).fillColor('#0B1F3A').text(org, { align: 'left' });
  doc.moveDown(0.2).fontSize(14).fillColor('#64748B').text(title);
  doc.moveDown(0.5).strokeColor('#E2E8F0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.8).fillColor('#0F172A');
}

function row(doc: PDFKit.PDFDocument, label: string, value: string): void {
  const y = doc.y;
  doc.fontSize(10).fillColor('#64748B').text(label, 50, y, { width: 180 });
  doc.fontSize(10).fillColor('#0F172A').text(value, 240, y, { width: 305 });
  doc.moveDown(0.4);
}

export async function agreementContractPdf(actor: AuthContext, id: string): Promise<Buffer> {
  const agreement: AgreementDetail = await getAgreement(actor, id);
  const org = await orgName(actor.organizationId);
  return toBuffer((doc) => {
    heading(doc, org.name, `Rental Agreement #${agreement.agreementNumber}`);
    row(doc, 'Customer', agreement.customerName);
    row(doc, 'Vehicle', agreement.vehiclePlate);
    row(doc, 'Pickup', new Date(agreement.startAt).toLocaleString());
    row(doc, 'Planned return', new Date(agreement.endAt).toLocaleString());
    row(doc, 'Odometer out', `${agreement.checkoutOdometer.toLocaleString()} km`);
    row(doc, 'Fuel out', `${agreement.checkoutFuel}/8`);
    row(doc, 'With driver', agreement.withDriver ? 'Yes' : 'No');
    if (agreement.invoice) {
      doc.moveDown(0.5);
      row(doc, 'Opening invoice', `#${agreement.invoice.invoiceNumber} — ${money(agreement.invoice.total, org.currency)}`);
    }
    doc.moveDown(2);
    doc.fontSize(10).fillColor('#64748B').text('Customer signature: ______________________________');
    doc.moveDown(1).text('Agent signature: _________________________________');
  });
}

export async function invoiceReceiptPdf(actor: AuthContext, id: string): Promise<Buffer> {
  const invoice: InvoiceView = await getInvoice(actor, id);
  const org = await orgName(actor.organizationId);
  return toBuffer((doc) => {
    heading(doc, org.name, `Receipt — Invoice #${invoice.invoiceNumber}`);
    doc.fontSize(11).fillColor('#0F172A');
    for (const line of invoice.lines) {
      const y = doc.y;
      doc.fillColor('#0F172A').text(`${line.description} ${line.quantity > 1 ? `×${line.quantity}` : ''}`, 50, y, { width: 380 });
      doc.text(money(line.amount, org.currency), 430, y, { width: 115, align: 'right' });
      doc.moveDown(0.3);
    }
    doc.moveDown(0.5).strokeColor('#E2E8F0').moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    row(doc, 'Total', money(invoice.total, org.currency));
    row(doc, 'Paid', money(invoice.paid, org.currency));
    row(doc, 'Balance', money(invoice.balance, org.currency));
    if (invoice.payments.length > 0) {
      doc.moveDown(0.5).fontSize(10).fillColor('#64748B').text('Payments:');
      for (const p of invoice.payments) {
        doc.fillColor('#0F172A').text(`  ${p.method} — ${money(p.amount, org.currency)}${p.reference ? ` (${p.reference})` : ''}`);
      }
    }
  });
}
