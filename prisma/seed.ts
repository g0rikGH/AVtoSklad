import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Начинаю сидирование...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@erp.com' },
    update: {},
    create: {
      email: 'admin@erp.com',
      name: 'System Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('✅ Админ создан:', admin.email);

  const systemPartner = await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000000' }, // Фейковый UUID для обхода
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Системная корректировка (Инвентаризация)',
      type: 'SUPPLIER',
    },
  });
  console.log('✅ Системный контрагент создан:', systemPartner.name);

}

main()
  .catch((e) => {
    console.error('Ошибка в сиде:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
