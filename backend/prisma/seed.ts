import { PrismaClient, ResourceType, ResourceStatus } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Seed Roles
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'System Administrator with full access',
      permissions: ['ALL'],
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: {
      name: 'MANAGER',
      description: 'Facility & Workspace Manager',
      permissions: ['RESOURCE_MANAGE', 'BOOKING_MANAGE', 'AUDIT_VIEW'],
    },
  });

  const employeeRole = await prisma.role.upsert({
    where: { name: 'EMPLOYEE' },
    update: {},
    create: {
      name: 'EMPLOYEE',
      description: 'Standard enterprise employee',
      permissions: ['BOOKING_CREATE', 'BOOKING_VIEW_OWN', 'RESOURCE_VIEW'],
    },
  });

  console.log('✅ Roles seeded (ADMIN, MANAGER, EMPLOYEE)');

  // 2. Seed Users
  const passwordSalt = 10;
  const adminPassword = await bcrypt.hash('AdminPassword123!', passwordSalt);
  const managerPassword = await bcrypt.hash('ManagerPassword123!', passwordSalt);
  const employeePassword = await bcrypt.hash('EmployeePassword123!', passwordSalt);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@enterprise.local' },
    update: {},
    create: {
      email: 'admin@enterprise.local',
      fullName: 'System Administrator',
      passwordHash: adminPassword,
      roleId: adminRole.id,
    },
  });

  const managerUser = await prisma.user.upsert({
    where: { email: 'manager@enterprise.local' },
    update: {},
    create: {
      email: 'manager@enterprise.local',
      fullName: 'Alex Manager',
      passwordHash: managerPassword,
      roleId: managerRole.id,
    },
  });

  const employeeUser = await prisma.user.upsert({
    where: { email: 'employee@enterprise.local' },
    update: {},
    create: {
      email: 'employee@enterprise.local',
      fullName: 'John Doe',
      passwordHash: employeePassword,
      roleId: employeeRole.id,
    },
  });

  console.log('✅ Users seeded:');
  console.log('   - admin@enterprise.local / AdminPassword123!');
  console.log('   - manager@enterprise.local / ManagerPassword123!');
  console.log('   - employee@enterprise.local / EmployeePassword123!');

  // 3. Seed Resources
  const resourcesData = [
    {
      name: 'Phòng họp A (Meeting Room A)',
      type: ResourceType.MEETING_ROOM,
      capacity: 8,
      status: ResourceStatus.AVAILABLE,
      location: 'Tầng 3 - Cánh Tây',
      description: 'Trang bị TV 65-inch 4K, micro đa hướng và bảng trắng',
    },
    {
      name: 'Phòng họp B (Meeting Room B)',
      type: ResourceType.MEETING_ROOM,
      capacity: 16,
      status: ResourceStatus.AVAILABLE,
      location: 'Tầng 4 - Cánh Đông',
      description: 'Phòng hội nghị vừa với 2 màn hình trình chiếu và hệ thống loa trần',
    },
    {
      name: 'Phòng hội đồng (Executive Boardroom)',
      type: ResourceType.MEETING_ROOM,
      capacity: 30,
      status: ResourceStatus.AVAILABLE,
      location: 'Tầng 5 - Penthouse',
      description: 'Phòng họp VIP cao cấp dành cho ban điều hành và khách hàng VIP',
    },
    {
      name: 'Bàn làm việc linh hoạt (Hot Desk 101)',
      type: ResourceType.DESK,
      capacity: 1,
      status: ResourceStatus.AVAILABLE,
      location: 'Tầng 2 - Khu Open Space',
      description: 'Ghế công thái học Ergonomic, 2 màn hình 27-inch Type-C',
    },
    {
      name: 'Bàn làm việc linh hoạt (Hot Desk 102)',
      type: ResourceType.DESK,
      capacity: 1,
      status: ResourceStatus.AVAILABLE,
      location: 'Tầng 2 - Khu Quiet Zone',
      description: 'Góc làm việc yên tĩnh, trang bị ổ cắm đa năng và đèn chống mỏi mắt',
    },
    {
      name: 'Máy chiếu di động 4K Laser (Projector 4K)',
      type: ResourceType.DEVICE,
      capacity: 1,
      status: ResourceStatus.AVAILABLE,
      location: 'Phòng Thiết bị IT - Tầng 1',
      description: 'Máy chiếu độ sáng cao 5000 lumens, kết nối không dây Apple AirPlay & Miracast',
    },
  ];

  for (const res of resourcesData) {
    const existing = await prisma.resource.findFirst({
      where: { name: res.name },
    });
    if (!existing) {
      await prisma.resource.create({
        data: res,
      });
    }
  }

  console.log(`✅ Seeded ${resourcesData.length} resources`);

  // 4. Initial Audit Log
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'SYSTEM_SEED',
      entityType: 'System',
      entityId: '00000000-0000-0000-0000-000000000000',
      payload: {
        message: 'Initial database seeding executed successfully',
        seededAt: new Date().toISOString(),
      },
    },
  });

  console.log('✅ Initial AuditLog recorded');
  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
