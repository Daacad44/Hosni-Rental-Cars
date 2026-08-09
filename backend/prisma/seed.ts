import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.upsert({
    where: { id: 'seed-org' },
    update: {},
    create: {
      id: 'seed-org',
      name: 'Hosni Rental Cars',
      timezone: 'Africa/Mogadishu',
      currency: 'USD',
      vatRate: '5.00',
    },
  });

  const mainBranch = await prisma.branch.upsert({
    where: { id: 'seed-branch-main' },
    update: {},
    create: { id: 'seed-branch-main', organizationId: org.id, name: 'Mogadishu Main' },
  });

  const passwordHash = await bcrypt.hash('ChangeMe123!', 12);

  const staff = [
    { id: 'seed-owner', name: 'Owner', email: 'owner@hosni.test', role: 'OWNER' as const, branchId: null },
    { id: 'seed-manager', name: 'Manager', email: 'manager@hosni.test', role: 'MANAGER' as const, branchId: mainBranch.id },
    { id: 'seed-agent', name: 'Agent', email: 'agent@hosni.test', role: 'AGENT' as const, branchId: mainBranch.id },
    { id: 'seed-mechanic', name: 'Mechanic', email: 'mechanic@hosni.test', role: 'MECHANIC' as const, branchId: mainBranch.id },
  ];

  for (const s of staff) {
    await prisma.user.upsert({
      where: { id: s.id },
      update: {},
      create: {
        id: s.id,
        organizationId: org.id,
        branchId: s.branchId,
        name: s.name,
        email: s.email,
        passwordHash,
        role: s.role,
        locale: 'so',
      },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Seed complete. Login with owner@hosni.test / ChangeMe123!');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
