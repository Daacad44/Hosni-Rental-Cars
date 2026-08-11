import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';
import type { SearchResultItem } from '@hosni/shared';
import { useGlobalSearch, useDebounced } from '../features/search/hooks';

/**
 * Topbar global search (§9). Debounced so it queries on pause, not per
 * keystroke; results are grouped by type and navigate to the matching detail
 * page. The server scopes results by org, role and branch — this just renders
 * what comes back.
 */
export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const debounced = useDebounced(input, 250);
  const query = useGlobalSearch(debounced);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const go = (path: string) => {
    setOpen(false);
    setInput('');
    navigate(path);
  };

  const results = query.data?.data;
  const total = results ? results.vehicles.length + results.customers.length + results.agreements.length : 0;
  const showDropdown = open && debounced.trim().length >= 2;

  const group = (titleKey: string, items: SearchResultItem[], toPath: (it: SearchResultItem) => string) =>
    items.length > 0 ? (
      <div>
        <div className="px-3 py-1 text-xs font-semibold uppercase text-muted">{t(titleKey)}</div>
        {items.map((it) => (
          <button
            key={it.id}
            className="flex w-full items-center justify-between gap-2 px-3 py-2 text-start text-sm hover:bg-surface-alt"
            onMouseDown={() => go(toPath(it))}
          >
            <span className="truncate text-foreground">{it.label}</span>
            <span className="truncate text-xs text-muted">{it.sublabel}</span>
          </button>
        ))}
      </div>
    ) : null;

  return (
    <div ref={rootRef} className="relative">
      <label className="flex items-center gap-2 rounded-md border border-border bg-surface px-2">
        <Search size={16} className="text-muted" aria-hidden />
        <input
          className="min-h-[36px] w-36 bg-transparent text-sm focus:outline-none sm:w-64"
          placeholder={t('search.placeholder')}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false);
          }}
          aria-label={t('search.placeholder')}
        />
      </label>
      {showDropdown && (
        <div className="absolute end-0 z-50 mt-1 w-72 overflow-hidden rounded-md border border-border bg-surface shadow-card sm:w-80">
          {query.isLoading ? (
            <div className="px-3 py-3 text-sm text-muted">{t('common.loading')}</div>
          ) : total > 0 ? (
            <div className="max-h-80 overflow-auto py-1">
              {group('search.vehicles', results!.vehicles, (it) => `/fleet/${it.id}`)}
              {group('search.customers', results!.customers, (it) => `/customers/${it.id}`)}
              {group('search.agreements', results!.agreements, (it) => `/rentals/${it.id}`)}
            </div>
          ) : (
            <div className="px-3 py-3 text-sm text-muted">{t('search.noResults')}</div>
          )}
        </div>
      )}
    </div>
  );
}
