import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Создание первичного администратора ---');

  const adminEmail = 'admin@erp.com';
  const adminPassword = 'admin123';

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log(`Пользователь ${adminEmail} уже существует. Пропускаю.`);
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(adminPassword, salt);

  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: passwordHash,
      name: 'Master Admin',
      role: 'ADMIN' // Назначаем права администратора
    }
  });

  console.log(`✅ Администратор успешно создан:`);
  console.log(`Email: ${adminUser.email}`);
  console.log(`Пароль: ${adminPassword}`);
  console.log(`========================================`);
  console.log(`ВАЖНО: Пожалуйста, смените пароль после первого входа!`);
}

main()
  .catch((e) => {
    console.error('Ошибка при создании администратора:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
