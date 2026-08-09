import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Download, Trash2 } from 'lucide-react';
import { EXPENSE_CATEGORIES, type CreateExpenseRequest, type CreateFineRequest } from '@hosni/shared';
import { useExpenses, useExpenseMutation, useFines, useFineMutation } from './hooks';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/TextField';
import { SelectField } from '../../components/ui/SelectField';
import { Modal } from '../../components/ui/Modal';
import { Money } from '../../components/ui/Money';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export default function ExpensesPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'expenses' | 'fines'>('expenses');

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold text-foreground">{t('expenses.title')}</h1>
      <p className="mb-4 text-sm text-muted">{t('expenses.subtitle')}</p>

      <div className="mb-4 flex gap-1 border-b border-border">
        {(['expenses', 'fines'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            aria-current={tab === k ? 'page' : undefined}
            className={'min-h-[44px] px-3 text-sm font-medium ' + (tab === k ? 'border-b-2 border-accent text-foreground' : 'text-muted')}
          >
            {t(k === 'expenses' ? 'expenses.tabExpenses' : 'expenses.tabFines')}
          </button>
        ))}
      </div>

      {tab === 'expenses' ? <ExpensesTab /> : <FinesTab />}
    </div>
  );
}

function ExpensesTab() {
  const { t } = useTranslation();
  const query = useExpenses(undefined, 1, 50);
  const mutation = useExpenseMutation();
  const [open, setOpen] = useState(false);
  const data = query.data?.data;

  return (
    <div>
      <div className="mb-3 flex justify-between">
        <a href={`${BASE}/expenses/export`} target="_blank" rel="noreferrer">
          <Button variant="secondary">
            <Download size={16} aria-hidden />
            {t('expenses.export')}
          </Button>
        </a>
        <Button variant="accent" onClick={() => setOpen(true)}>
          <Plus size={18} aria-hidden />
          {t('expenses.add')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {query.isLoading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState title={t('expenses.empty')} body={t('expenses.emptyBody')} />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-surface-alt text-xs font-semibold uppercase text-muted">
                <tr>
                  <th className="px-4 py-2 text-start">{t('expenses.date')}</th>
                  <th className="px-4 py-2 text-start">{t('expenses.category')}</th>
                  <th className="px-4 py-2 text-start">{t('expenses.description')}</th>
                  <th className="px-4 py-2 text-end">{t('expenses.amount')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.items.map((e) => (
                  <tr key={e.id} className="border-t border-border">
                    <td className="px-4 py-2">{e.date.slice(0, 10)}</td>
                    <td className="px-4 py-2">{t(`expenses.cat_${e.category}`)}</td>
                    <td className="px-4 py-2 text-muted">{e.description ?? '—'}</td>
                    <td className="px-4 py-2 text-end font-mono"><Money value={e.amount} /></td>
                    <td className="px-4 py-2 text-end">
                      <Button variant="ghost" className="px-2 text-error" onClick={() => mutation.remove.mutate(e.id)} aria-label={t('common.cancel')}>
                        <Trash2 size={16} aria-hidden />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-4 py-2" colSpan={3}>{t('expenses.total')}</td>
                  <td className="px-4 py-2 text-end font-mono"><Money value={data.sum} /></td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </>
        )}
      </div>

      {open && <ExpenseModal onClose={() => setOpen(false)} onCreate={(b, o) => mutation.create.mutate(b, o)} pending={mutation.create.isPending} />}
    </div>
  );
}

function ExpenseModal({ onClose, onCreate, pending }: { onClose: () => void; onCreate: (b: CreateExpenseRequest, o: { onSuccess: () => void }) => void; pending: boolean }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<CreateExpenseRequest['category']>('FUEL');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  return (
    <Modal open onClose={onClose} title={t('expenses.add')}>
      <div className="flex flex-col gap-3">
        <SelectField label={t('expenses.category')} value={category} onChange={(e) => setCategory(e.target.value as CreateExpenseRequest['category'])} options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: t(`expenses.cat_${c}`) }))} />
        <TextField label={t('expenses.amount')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <TextField label={t('expenses.date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <TextField label={t('expenses.description')} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="accent" disabled={pending || !amount} onClick={() => onCreate({ category, amount, date: new Date(date).toISOString(), description: description || undefined }, { onSuccess: onClose })}>
            {t('common.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function FinesTab() {
  const { t } = useTranslation();
  const query = useFines(1, 50);
  const mutation = useFineMutation();
  const [open, setOpen] = useState(false);
  const rows = query.data?.data ?? [];

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="accent" onClick={() => setOpen(true)}>
          <Plus size={18} aria-hidden />
          {t('expenses.addFine')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {query.isLoading ? (
          <TableSkeleton rows={4} cols={4} />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState title={t('expenses.noFines')} body={t('expenses.addFine')} />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                <div>
                  <span className="font-mono font-medium">{f.noticeNumber}</span>
                  <span className="ms-2 text-xs text-muted">{f.vehiclePlate}</span>
                  <p className="text-xs text-muted">
                    {new Date(f.offenceAt).toLocaleString()} · {f.location}
                    {f.suggestedCustomerName && ` · ${t('expenses.suggested')}: ${f.suggestedCustomerName}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono"><Money value={f.amount} /></span>
                  {f.customerCharged ? (
                    <StatusBadge tone="success" label={t('expenses.charged')} />
                  ) : (
                    f.suggestedAgreementId && f.suggestedCustomerName && (
                      <Button
                        variant="accent"
                        className="min-h-[36px]"
                        disabled={mutation.charge.isPending}
                        onClick={() => {
                          const customerId = window.prompt('Customer ID') ?? '';
                          if (customerId) mutation.charge.mutate({ id: f.id, customerId });
                        }}
                      >
                        {t('expenses.charge')}
                      </Button>
                    )
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && <FineModal onClose={() => setOpen(false)} onCreate={(b, o) => mutation.create.mutate(b, o)} pending={mutation.create.isPending} />}
    </div>
  );
}

function FineModal({ onClose, onCreate, pending }: { onClose: () => void; onCreate: (b: CreateFineRequest, o: { onSuccess: () => void }) => void; pending: boolean }) {
  const { t } = useTranslation();
  const [noticeNumber, setNotice] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [offenceAt, setOffence] = useState('');
  const [location, setLocation] = useState('');
  const [amount, setAmount] = useState('');

  return (
    <Modal open onClose={onClose} title={t('expenses.addFine')}>
      <div className="flex flex-col gap-3">
        <TextField label={t('expenses.noticeNumber')} value={noticeNumber} onChange={(e) => setNotice(e.target.value)} />
        <TextField label={t('maintenance.vehicle')} value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} helper="Vehicle ID" />
        <TextField label={t('expenses.offenceAt')} type="datetime-local" value={offenceAt} onChange={(e) => setOffence(e.target.value)} />
        <TextField label={t('expenses.location')} value={location} onChange={(e) => setLocation(e.target.value)} />
        <TextField label={t('expenses.amount')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            variant="accent"
            disabled={pending || !noticeNumber || !vehicleId || !offenceAt || !location || !amount}
            onClick={() => onCreate({ noticeNumber, vehicleId, offenceAt: new Date(offenceAt).toISOString(), location, amount }, { onSuccess: onClose })}
          >
            {t('common.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
