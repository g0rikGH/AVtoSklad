import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database...');

  await prisma.batchTransaction.deleteMany({});
  await prisma.inventoryBatch.deleteMany({});
  await prisma.documentRow.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.stockBalance.deleteMany({});
  await prisma.currentPrice.deleteMany({});
  await prisma.catalog.deleteMany({});
  await prisma.brand.deleteMany({});
  await prisma.location.deleteMany({});
  await prisma.partner.deleteMany({
    where: {
      id: {
        not: '00000000-0000-0000-0000-000000000000'
      }
    }
  });

  console.log('Database cleared!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
