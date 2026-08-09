import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, MinusCircle, Plus, UserPlus } from 'lucide-react';
import { useUsers, useDeactivateUser } from './hooks';
import type { UserRow } from './api';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { Modal } from '../../components/ui/Modal';
import { TableSkeleton, ErrorState, EmptyState } from '../../components/ui/states';
import { CreateUserForm } from './CreateUserForm';

const PAGE_SIZE = 20;

export default function UsersPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [toDeactivate, setToDeactivate] = useState<UserRow | null>(null);

  const usersQuery = useUsers(page, PAGE_SIZE);
  const deactivate = useDeactivateUser();

  const rows = usersQuery.data?.data ?? [];
  const total = usersQuery.data?.meta?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">{t('users.title')}</h1>
          <p className="text-sm text-muted">{t('users.subtitle')}</p>
        </div>
        <Button variant="accent" onClick={() => setCreateOpen(true)}>
          <Plus size={18} aria-hidden />
          {t('users.add')}
        </Button>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface shadow-card">
        {usersQuery.isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : usersQuery.isError ? (
          <ErrorState onRetry={() => usersQuery.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={t('users.empty')}
            body={t('users.emptyBody')}
            action={
              <Button variant="accent" onClick={() => setCreateOpen(true)}>
                <UserPlus size={18} aria-hidden />
                {t('users.add')}
              </Button>
            }
          />
        ) : (
          <>
            {/* Table on >= 768px, cards below */}
            <table className="hidden w-full border-collapse md:table">
              <thead className="sticky top-0 bg-surface-alt">
                <tr className="text-start text-xs font-semibold uppercase text-muted">
                  <th className="px-4 py-3 text-start">{t('users.name')}</th>
                  <th className="px-4 py-3 text-start">{t('auth.email')}</th>
                  <th className="px-4 py-3 text-start">{t('users.role')}</th>
                  <th className="px-4 py-3 text-start">{t('users.branch')}</th>
                  <th className="px-4 py-3 text-start">{t('users.status')}</th>
                  <th className="px-4 py-3 text-end">{t('users.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="h-row border-t border-border text-sm">
                    <td className="px-4 py-2 font-medium text-foreground">{u.name}</td>
                    <td className="px-4 py-2 font-mono text-muted">{u.email}</td>
                    <td className="px-4 py-2">{t(`roles.${u.role}`)}</td>
                    <td className="px-4 py-2">{u.branchName ?? t('users.noBranch')}</td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        tone={u.isActive ? 'success' : 'neutral'}
                        label={u.isActive ? t('users.active') : t('users.inactive')}
                        icon={
                          u.isActive ? (
                            <CheckCircle2 size={12} aria-hidden />
                          ) : (
                            <MinusCircle size={12} aria-hidden />
                          )
                        }
                      />
                    </td>
                    <td className="px-4 py-2 text-end">
                      {u.isActive && (
                        <Button
                          variant="ghost"
                          className="min-h-[36px] px-2 text-error"
                          onClick={() => setToDeactivate(u)}
                        >
                          {t('users.deactivate')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((u) => (
                <li key={u.id} className="flex flex-col gap-1 p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-foreground">{u.name}</span>
                    <StatusBadge
                      tone={u.isActive ? 'success' : 'neutral'}
                      label={u.isActive ? t('users.active') : t('users.inactive')}
                      icon={
                        u.isActive ? (
                          <CheckCircle2 size={12} aria-hidden />
                        ) : (
                          <MinusCircle size={12} aria-hidden />
                        )
                      }
                    />
                  </div>
                  <span className="font-mono text-xs text-muted">{u.email}</span>
                  <span className="text-sm">
                    {t(`roles.${u.role}`)} · {u.branchName ?? t('users.noBranch')}
                  </span>
                  {u.isActive && (
                    <Button
                      variant="ghost"
                      className="mt-1 self-start px-2 text-error"
                      onClick={() => setToDeactivate(u)}
                    >
                      {t('users.deactivate')}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-muted">
          <span>
            {t('common.page')} {page} {t('common.of')} {pageCount}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="min-h-[44px]"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ‹
            </Button>
            <Button
              variant="secondary"
              className="min-h-[44px]"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              ›
            </Button>
          </div>
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('users.add')}>
        <CreateUserForm onDone={() => setCreateOpen(false)} />
      </Modal>

      <Modal
        open={toDeactivate !== null}
        onClose={() => setToDeactivate(null)}
        title={t('users.deactivate')}
      >
        <p className="mb-4 text-sm text-foreground">
          {toDeactivate && t('users.deactivateConfirm', { name: toDeactivate.name })}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setToDeactivate(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="danger"
            disabled={deactivate.isPending}
            onClick={() => {
              if (!toDeactivate) return;
              deactivate.mutate(toDeactivate.id, { onSuccess: () => setToDeactivate(null) });
            }}
          >
            {t('users.deactivate')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
