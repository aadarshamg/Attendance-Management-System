import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Two demo sites with geofences (coords are real places for easy DevTools testing).
  const towerB = await prisma.site.upsert({
    where: { id: 'site_tower_b' },
    update: {},
    create: {
      id: 'site_tower_b',
      name: 'Tower-B, Sector 62',
      address: 'Sector 62, Noida, Uttar Pradesh 201309, India',
      geofenceCenterLat: 28.6274,
      geofenceCenterLng: 77.3716,
      geofenceRadiusM: 150,
    },
  });

  const metroSite = await prisma.site.upsert({
    where: { id: 'site_metro_ext' },
    update: {},
    create: {
      id: 'site_metro_ext',
      name: 'Metro Line Extension, Dwarka',
      address: 'Dwarka Sector 21, New Delhi 110077, India',
      geofenceCenterLat: 28.5523,
      geofenceCenterLng: 77.0586,
      geofenceRadiusM: 200,
    },
  });

  await prisma.user.upsert({
    where: { employeeCode: 'ADMIN001' },
    update: {},
    create: {
      name: 'Priya Admin',
      role: 'admin',
      employeeCode: 'ADMIN001',
      phone: '+91-9999900001',
      passwordHash,
    },
  });

  await prisma.user.upsert({
    where: { employeeCode: 'SUP001' },
    update: {},
    create: {
      name: 'M. Reddy (Supervisor)',
      role: 'supervisor',
      employeeCode: 'SUP001',
      phone: '+91-9999900002',
      passwordHash,
      assignedSiteId: towerB.id,
    },
  });

  const workers = [
    { name: 'R. Kumar', code: 'W10482', siteId: towerB.id },
    { name: 'S. Devi', code: 'W10483', siteId: towerB.id },
    { name: 'A. Khan', code: 'W20991', siteId: metroSite.id },
  ];

  for (const w of workers) {
    await prisma.user.upsert({
      where: { employeeCode: w.code },
      update: {},
      create: {
        name: w.name,
        role: 'worker',
        employeeCode: w.code,
        passwordHash,
        assignedSiteId: w.siteId,
      },
    });
  }

  console.log('Seed complete.');
  console.log('  admin      -> ADMIN001 / password123');
  console.log('  supervisor -> SUP001   / password123  (Tower-B)');
  console.log('  workers    -> W10482, W10483 (Tower-B), W20991 (Metro) / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
