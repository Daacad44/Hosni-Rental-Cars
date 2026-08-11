import { createContext, useContext, useState, type ReactNode } from 'react';

const KEY = 'hosni.activeBranch';

interface ActiveBranch {
  /** Empty string means "all branches". */
  branchId: string;
  setBranchId: (id: string) => void;
}

const ActiveBranchContext = createContext<ActiveBranch>({ branchId: '', setBranchId: () => {} });

/**
 * The branch the user is currently working in, shared across the app and
 * persisted so it survives a reload. Branch-scoped list pages read it as their
 * default filter; the topbar switcher writes it. AGENT/MECHANIC are branch-
 * locked on the server, so their selection here is fixed to their own branch.
 */
export function ActiveBranchProvider({ children }: { children: ReactNode }) {
  const [branchId, setBranchIdState] = useState<string>(() => localStorage.getItem(KEY) ?? '');
  const setBranchId = (id: string) => {
    setBranchIdState(id);
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  };
  return <ActiveBranchContext.Provider value={{ branchId, setBranchId }}>{children}</ActiveBranchContext.Provider>;
}

export function useActiveBranch(): ActiveBranch {
  return useContext(ActiveBranchContext);
}
