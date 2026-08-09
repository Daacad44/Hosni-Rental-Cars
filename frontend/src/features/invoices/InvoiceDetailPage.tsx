import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PAYMENT_METHODS, type PaymentMethod } from '@hosni/shared';
import { useInvoice, usePayInvoice } from './hooks';
import { InvoiceStatusBadge } from './InvoiceStatusBadge';
import { useAuth } from '../auth/hooks';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Modal } from '../../components/ui/Modal';
import { Money } from '../../components/ui/Money';
import { ErrorState } from '../../components/ui/states';
import { ApiError } from '../../lib/apiClient';

export default function InvoiceDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams();
  const { data: me } = useAuth();
  const isManager = me ? ['OWNER', 'MANAGER'].includes(me.role) : false;

  const invoiceQuery = useInvoice(id);
  const mutation = usePayInvoice(id);

  const [payOpen, setPayOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [voidReason, setVoidReason] = useState('');
  // A fresh idempotency key per open dialog; a double submit reuses it.
  const [idemKey, setIdemKey] = useState(() => crypto.randomUUID());

  if (invoiceQuery.isError) return <ErrorState onRetry={() => invoiceQuery.refetch()} />;
  if (!invoiceQuery.data) return <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>;
  const inv = invoiceQuery.data.data;

  const openPay = () => {
    setAmount(inv.balance);
    setIdemKey(crypto.randomUUID());
    setPayOpen(true);
  };

  const payError = mutation.pay.error instanceof ApiError ? mutation.pay.error.message : null;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-mono text-xl font-bold text-foreground">#{inv.invoiceNumber}</h1>
          <InvoiceStatusBadge status={inv.status} />
        </div>
        <div className="flex gap-2">
          {inv.status !== 'PAID' && inv.status !== 'VOID' && (
            <Button variant="accent" onClick={openPay}>
              {t('invoices.recordPayment')}
            </Button>
          )}
          {isManager && inv.status !== 'VOID' && (
            <Button variant="ghost" className="text-error" onClick={() => setVoidOpen(true)}>
              {t('invoices.void')}
            </Button>
          )}
        </div>
      </div>

      {inv.voidReason && (
        <div className="mb-4 rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
          {inv.voidReason}
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Tile label={t('invoices.total')} value={inv.total} />
        <Tile label={t('invoices.paid')} value={inv.paid} />
        <Tile label={t('invoices.balance')} value={inv.balance} emphasize />
      </div>

      <div className="mb-4 overflow-hidden rounded-md border border-border bg-surface shadow-card">
        <div className="border-b border-border bg-surface-alt px-4 py-2 text-xs font-semibold uppercase text-muted">
          {t('invoices.lines')}
        </div>
        <table className="w-full text-sm">
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.id} className="border-b border-border">
                <td className="px-4 py-2">
                  {t(`invoices.kind_${l.kind}`)}
                  {l.quantity > 1 && <span className="ms-1 text-xs text-muted">×{l.quantity}</span>}
                </td>
                <td className="px-4 py-2 text-end font-mono"><Money value={l.amount} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        <div className="border-b border-border bg-surface-alt px-4 py-2 text-xs font-semibold uppercase text-muted">
          {t('invoices.payments')}
        </div>
        {inv.payments.length === 0 ? (
          <p className="p-4 text-sm text-muted">—</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {inv.payments.map((p) => (
                <tr key={p.id} className="border-b border-border">
                  <td className="px-4 py-2">
                    {t(`invoices.method_${p.method}`)}
                    {p.reference && <span className="ms-1 text-xs text-muted">{p.reference}</span>}
                  </td>
                  <td className="px-4 py-2 text-end font-mono"><Money value={p.amount} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={t('invoices.recordPayment')}>
        <div className="flex flex-col gap-4">
          {payError && (
            <div role="alert" className="rounded-sm border border-error bg-surface-alt px-3 py-2 text-sm text-error">
              {payError}
            </div>
          )}
          {/* Cash is the common case — first in the list. */}
          <SelectField
            label={t('invoices.method')}
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: t(`invoices.method_${m}`) }))}
          />
          <TextField label={t('invoices.amount')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          <TextField label={t('invoices.reference')} value={reference} onChange={(e) => setReference(e.target.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPayOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="accent"
              disabled={mutation.pay.isPending}
              onClick={() =>
                mutation.pay.mutate(
                  { body: { amount, method, reference: reference || undefined }, key: idemKey },
                  { onSuccess: () => setPayOpen(false) },
                )
              }
            >
              {t('invoices.recordPayment')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={voidOpen} onClose={() => setVoidOpen(false)} title={t('invoices.void')}>
        <p className="mb-3 text-sm text-foreground">{t('invoices.voidConfirm', { n: inv.invoiceNumber })}</p>
        <TextField label={t('invoices.voidReason')} value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setVoidOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={mutation.void.isPending || voidReason.trim().length === 0}
            onClick={() => mutation.void.mutate(voidReason, { onSuccess: () => setVoidOpen(false) })}
          >
            {t('invoices.void')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Tile({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className={'rounded-md border border-border bg-surface p-3 text-center shadow-card ' + (emphasize ? 'font-semibold' : '')}>
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className={'mt-1 font-mono ' + (emphasize ? 'text-lg' : '')}>
        <Money value={value} />
      </div>
    </div>
  );
}
