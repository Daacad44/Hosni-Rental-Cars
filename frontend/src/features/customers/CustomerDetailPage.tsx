import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Pencil, Ban, ShieldCheck, GitMerge, AlertTriangle } from 'lucide-react';
import { useCustomer, useCustomerMutation } from './hooks';
import { useAuth } from '../auth/hooks';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { Modal } from '../../components/ui/Modal';
import { Money } from '../../components/ui/Money';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ErrorState } from '../../components/ui/states';

export default function CustomerDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const { data: me } = useAuth();
  const isManager = me ? ['OWNER', 'MANAGER'].includes(me.role) : false;

  const customerQuery = useCustomer(id);
  const mutation = useCustomerMutation(id);
  const [blockOpen, setBlockOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [loserId, setLoserId] = useState('');

  if (customerQuery.isError) return <ErrorState onRetry={() => customerQuery.refetch()} />;
  if (!customerQuery.data) return <div className="p-8 text-center text-sm text-muted">{t('common.loading')}</div>;
  const c = customerQuery.data.data;

  const stat = (label: string, value: React.ReactNode) => (
    <div className="rounded-md border border-border bg-surface p-3 text-center shadow-card">
      <div className="text-xs uppercase text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-foreground">{c.fullName}</h1>
            {c.isBlocked && <StatusBadge tone="error" label={t('customers.blocked')} icon={<Ban size={12} aria-hidden />} />}
            {c.licenceExpired && (
              <StatusBadge tone="warning" label={t('customers.licenceExpired')} icon={<AlertTriangle size={12} aria-hidden />} />
            )}
          </div>
          <p className="font-mono text-sm text-muted">{c.phone}</p>
          {c.isBlocked && c.blockReason && <p className="mt-1 text-sm text-error">{c.blockReason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate(`/customers/${id}/edit`)}>
            <Pencil size={16} aria-hidden />
            {t('customers.edit')}
          </Button>
          {c.isBlocked ? (
            <Button variant="secondary" disabled={mutation.unblock.isPending} onClick={() => mutation.unblock.mutate()}>
              <ShieldCheck size={16} aria-hidden />
              {t('customers.unblock')}
            </Button>
          ) : (
            <Button variant="danger" onClick={() => setBlockOpen(true)}>
              <Ban size={16} aria-hidden />
              {t('customers.block')}
            </Button>
          )}
          {isManager && (
            <Button variant="ghost" onClick={() => setMergeOpen(true)}>
              <GitMerge size={16} aria-hidden />
              {t('customers.merge')}
            </Button>
          )}
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stat(t('customers.stats.rentals'), c.stats.rentalCount)}
        {stat(t('customers.stats.totalSpend'), <Money value={c.stats.totalSpend} />)}
        {stat(t('customers.stats.outstanding'), <Money value={c.stats.outstandingBalance} />)}
        {stat(t('customers.stats.damages'), c.stats.damageCount)}
        {stat(t('customers.stats.lateReturns'), c.stats.lateReturnCount)}
      </div>

      <dl className="grid grid-cols-2 gap-4 rounded-md border border-border bg-surface p-4 shadow-card sm:grid-cols-3">
        <Detail label={t('customers.email')} value={c.email} />
        <Detail label={t('customers.nationalId')} value={c.nationalId} mono />
        <Detail label={t('customers.licenceNumber')} value={c.licenceNumber} mono />
        <Detail label={t('customers.licenceExpiry')} value={c.licenceExpiry?.slice(0, 10) ?? null} />
        <Detail label={t('customers.address')} value={c.address} />
        <Detail label={t('customers.notes')} value={c.notes} />
      </dl>

      <Modal open={blockOpen} onClose={() => setBlockOpen(false)} title={t('customers.block')}>
        <p className="mb-3 text-sm text-foreground">{t('customers.blockConfirm', { name: c.fullName })}</p>
        <TextField label={t('customers.blockReason')} value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBlockOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={mutation.block.isPending || reason.trim().length === 0}
            onClick={() => mutation.block.mutate(reason, { onSuccess: () => setBlockOpen(false) })}
          >
            {t('customers.block')}
          </Button>
        </div>
      </Modal>

      <Modal open={mergeOpen} onClose={() => setMergeOpen(false)} title={t('customers.merge')}>
        <p className="mb-3 text-sm text-muted">{t('customers.mergeConfirm')}</p>
        <TextField label={t('customers.mergeLoserId')} value={loserId} onChange={(e) => setLoserId(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setMergeOpen(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="accent"
            disabled={mutation.merge.isPending || loserId.trim().length === 0}
            onClick={() => mutation.merge.mutate(loserId, { onSuccess: () => setMergeOpen(false) })}
          >
            {t('customers.merge')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted">{label}</dt>
      <dd className={'mt-0.5 text-sm text-foreground' + (mono ? ' font-mono' : '')}>{value || '—'}</dd>
    </div>
  );
}
