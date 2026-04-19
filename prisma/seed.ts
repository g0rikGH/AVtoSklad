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
      name: 'Системная корректировка (Инвентаризация)',
      type: 'SUPPLIER',
    },
  });
  console.log('✅ Системный контрагент создан:', systemPartner.name);

  const defaultBrand = await prisma.brand.create({
    data: { name: 'Toyota' }
  });

  const defaultLoc = await prisma.location.create({
    data: { name: 'Стеллаж A1' }
  });

  const testProduct = await prisma.catalog.create({
    data: {
      article: '111-TEST',
      name: 'Кассета ВВБ Prius',
      type: 'REAL',
      brandId: defaultBrand.id,
      locationId: defaultLoc.id
    }
  });

  console.log('✅ Тестовый товар: ', testProduct.name);

  // Дадим немного остатка
  await prisma.stockBalance.create({
    data: { productId: testProduct.id, qty: 10 }
  });

  await prisma.currentPrice.create({
    data: { productId: testProduct.id, purchasePrice: 50, sellingPrice: 100 }
  });

}

main()
  .catch((e) => {
    console.error('Ошибка в сиде:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
