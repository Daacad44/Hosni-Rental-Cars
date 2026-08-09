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

  // A couple of vehicles so the fleet register is demonstrable on first run.
  const vehicles = [
    {
      id: 'seed-veh-1',
      plateNumber: 'MOG-1001',
      vin: 'JT2BF22K1W0123456',
      make: 'Toyota',
      model: 'Corolla',
      year: 2019,
      category: 'ECONOMY',
      transmission: 'AUTOMATIC' as const,
      fuelType: 'PETROL' as const,
      seats: 5,
      colour: 'White',
      odometer: 84200,
      acquisitionCost: '12000.00',
    },
    {
      id: 'seed-veh-2',
      plateNumber: 'MOG-2087',
      vin: 'JN8AZ2NF1J9540021',
      make: 'Nissan',
      model: 'Patrol',
      year: 2021,
      category: 'SUV',
      transmission: 'AUTOMATIC' as const,
      fuelType: 'DIESEL' as const,
      seats: 7,
      colour: 'Black',
      odometer: 45120,
      acquisitionCost: '38000.00',
    },
  ];

  for (const veh of vehicles) {
    await prisma.vehicle.upsert({
      where: { id: veh.id },
      update: {},
      create: {
        ...veh,
        organizationId: org.id,
        branchId: mainBranch.id,
        acquisitionDate: new Date('2022-01-15'),
      },
    });
  }

  // Category rate cards so vehicles can be priced immediately.
  const rateCards = [
    {
      id: 'seed-rate-economy',
      category: 'ECONOMY',
      dailyRate: '35.00',
      weeklyRate: '210.00',
      monthlyRate: '750.00',
      includedKmPerDay: 150,
      extraKmRate: '0.20',
      depositAmount: '150.00',
      lateHourRate: '6.00',
    },
    {
      id: 'seed-rate-suv',
      category: 'SUV',
      dailyRate: '70.00',
      weeklyRate: '420.00',
      monthlyRate: '1600.00',
      includedKmPerDay: 200,
      extraKmRate: '0.35',
      depositAmount: '400.00',
      lateHourRate: '10.00',
    },
  ];
  for (const rc of rateCards) {
    await prisma.rateCard.upsert({
      where: { id: rc.id },
      update: {},
      create: {
        id: rc.id,
        organizationId: org.id,
        category: rc.category,
        dailyRate: rc.dailyRate,
        weeklyRate: rc.weeklyRate,
        monthlyRate: rc.monthlyRate,
        includedKmPerDay: rc.includedKmPerDay,
        extraKmRate: rc.extraKmRate,
        depositAmount: rc.depositAmount,
        lateHourRate: rc.lateHourRate,
        effectiveFrom: new Date('2024-01-01'),
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
