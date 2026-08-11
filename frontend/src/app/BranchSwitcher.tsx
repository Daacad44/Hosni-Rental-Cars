import { useTranslation } from 'react-i18next';
import { Building2 } from 'lucide-react';
import type { AuthUser } from '@hosni/shared';
import { useBranches } from '../features/branches/hooks';
import { useActiveBranch } from './ActiveBranchContext';

/**
 * Topbar branch switcher (§9). Managers and owners choose a branch (or "all");
 * the choice drives the branch-scoped list pages. An AGENT/MECHANIC is locked
 * to their own branch on the server, so they see it as a static chip.
 */
export function BranchSwitcher({ user }: { user: AuthUser }) {
  const { t } = useTranslation();
  const { branchId, setBranchId } = useActiveBranch();
  const canSwitch = user.role === 'OWNER' || user.role === 'MANAGER';
  const branches = useBranches();

  if (!canSwitch) {
    if (!user.branch) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-surface-alt px-2 py-1 text-xs text-foreground">
        <Building2 size={12} aria-hidden />
        {user.branch.name}
      </span>
    );
  }

  const options = branches.data?.data ?? [];
  return (
    <label className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2">
      <Building2 size={14} className="text-muted" aria-hidden />
      <select
        aria-label={t('branch.switch')}
        value={branchId}
        onChange={(e) => setBranchId(e.target.value)}
        className="min-h-[36px] bg-transparent text-sm text-foreground focus:outline-none"
      >
        <option value="">{t('branch.all')}</option>
        {options.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </label>
  );
}
