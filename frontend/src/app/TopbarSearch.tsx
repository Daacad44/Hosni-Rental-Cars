import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { Role } from '@hosni/shared';
import { useBranches } from '../features/branches/hooks';
import { useBranchScope } from './BranchScope';

/** Global search: jumps to the customer list filtered by the term. */
export function TopbarSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const q = term.trim();
    if (q) navigate(`/customers?q=${encodeURIComponent(q)}`);
  };

  return (
    <form onSubmit={submit} className="hidden items-center gap-2 rounded-md border border-border px-2 md:flex">
      <Search size={16} className="text-muted" aria-hidden />
      <input
        type="search"
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder={t('common.search')}
        aria-label={t('common.search')}
        className="min-h-[40px] w-48 bg-transparent text-sm focus:outline-none"
      />
    </form>
  );
}

/** Branch switcher for OWNER/MANAGER — sets the default branch scope for lists. */
export function BranchSwitcher({ role }: { role: Role }) {
  const { t } = useTranslation();
  const branches = useBranches();
  const { branchId, setBranchId } = useBranchScope();
  if (role !== 'OWNER' && role !== 'MANAGER') return null;
  const options = branches.data?.data ?? [];
  if (options.length <= 1) return null;

  return (
    <label className="flex items-center gap-1">
      <span className="sr-only">{t('fleet.branch')}</span>
      <select
        value={branchId ?? ''}
        onChange={(e) => setBranchId(e.target.value || null)}
        className="min-h-[44px] rounded-sm border border-border bg-surface px-2 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-600"
      >
        <option value="">{t('fleet.allBranches')}</option>
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
