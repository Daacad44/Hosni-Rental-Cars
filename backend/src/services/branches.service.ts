import { prisma } from '../lib/prisma.js';
import type { AuthContext } from '../middleware/authenticate.js';

export interface BranchView {
  id: string;
  name: string;
}

/**
 * Branches in the caller's organisation. An AGENT only ever sees their own
 * branch; other roles see all of them for filtering and assignment.
 */
export async function listBranches(actor: AuthContext): Promise<BranchView[]> {
  const branches = await prisma.branch.findMany({
    where: {
      organizationId: actor.organizationId,
      ...(actor.role === 'AGENT' && actor.branchId ? { id: actor.branchId } : {}),
    },
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });
  return branches;
}
