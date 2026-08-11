import { createContext, useContext, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'hosni.branch';

interface BranchScope {
  branchId: string | null;
  setBranchId: (id: string | null) => void;
}

const Ctx = createContext<BranchScope>({ branchId: null, setBranchId: () => {} });

/**
 * The branch chosen in the topbar switcher (OWNER/MANAGER). List views use it as
 * the default branch filter; AGENT is already branch-scoped by the server.
 */
export function BranchScopeProvider({ children }: { children: ReactNode }) {
  const [branchId, setBranchIdState] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const setBranchId = (id: string | null) => {
    if (id) localStorage.setItem(STORAGE_KEY, id);
    else localStorage.removeItem(STORAGE_KEY);
    setBranchIdState(id);
  };
  return <Ctx.Provider value={{ branchId, setBranchId }}>{children}</Ctx.Provider>;
}

export function useBranchScope(): BranchScope {
  return useContext(Ctx);
}
