import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function wipeAndSeed() {
  console.log('Очистка базы данных...');
  
  // Удаляем все каскадно
  await prisma.batchTransaction.deleteMany({});
  await prisma.inventoryBatch.deleteMany({});
  await prisma.documentRow.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.stockBalance.deleteMany({});
  await prisma.currentPrice.deleteMany({});
  await prisma.catalog.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.location.deleteMany({});
  
  // Удаляем всех контрагентов, кроме системного
  await prisma.partner.deleteMany({
    where: { id: { not: '00000000-0000-0000-0000-000000000000' } }
  });
  
  await prisma.user.deleteMany({});

  console.log('Сидирование начальных данных...');
  
  // 1. Создаем админа
  const passwordHash = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@erp.com',
      name: 'System Admin',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log('✅ Админ создан:', admin.email);

  // 2. Системный контрагент
  await prisma.partner.upsert({
    where: { id: '00000000-0000-0000-0000-000000000000' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000000',
      name: 'Системная корректировка (Инвентаризация)',
      type: 'SUPPLIER',
    },
  });

  // 3. Создаем 1 тестовый бренд, локацию и товар
  const brand = await prisma.brand.create({ data: { name: 'Generic Auto' } });
  const loc = await prisma.location.create({ data: { name: 'A-01' } });
  
  const product = await prisma.catalog.create({
    data: {
      article: 'TEST-001',
      name: 'Тестовый масляный фильтр',
      type: 'REAL',
      brandId: brand.id,
      locationId: loc.id,
      status: 'ACTIVE'
    }
  });

  // Даем ему 10 штук остатка и цены
  await prisma.stockBalance.create({ data: { productId: product.id, qty: 10 } });
  await prisma.currentPrice.create({ data: { productId: product.id, purchasePrice: 150, sellingPrice: 300 } });
  
  // И 1 партию для консистентности ФИФО
  await prisma.inventoryBatch.create({
    data: {
      productId: product.id,
      originalQuantity: 10,
      remainingQuantity: 10,
      purchasePrice: 150,
      needsCostCorrection: true
    }
  });
  
  console.log('✅ База сброшена. Тестовый товар добавлен:', product.article);
}

wipeAndSeed()
  .catch((e) => {
    console.error('Ошибка при сбросе/сидировании:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
