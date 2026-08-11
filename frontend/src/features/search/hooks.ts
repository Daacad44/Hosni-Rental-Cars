import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchApi } from './api';

/** Debounce a fast-changing value so we don't query on every keystroke. */
export function useDebounced<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function useGlobalSearch(term: string) {
  const q = term.trim();
  return useQuery({
    queryKey: ['search', q],
    queryFn: () => searchApi.global(q),
    enabled: q.length >= 2,
    staleTime: 30_000,
  });
}
