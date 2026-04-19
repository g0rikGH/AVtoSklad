import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const lastDoc = await prisma.document.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  console.log('Last Document ID:', lastDoc?.id);
  console.log('Last Document Created At:', lastDoc?.createdAt);

  const batches = await prisma.inventoryBatch.aggregate({
    where: { documentRow: { documentId: lastDoc?.id } },
    _min: { createdAt: true },
    _max: { createdAt: true },
    _count: true
  });
  console.log('Batches Count:', batches._count);
  console.log('Batches Min CreatedAt:', batches._min.createdAt);
  console.log('Batches Max CreatedAt:', batches._max.createdAt);
  
  const catalogCount = await prisma.catalog.count();
  console.log('Total catalog items:', catalogCount);
  const catalogRecent = await prisma.catalog.aggregate({
    _min: { createdAt: true },
    _max: { createdAt: true }
  });
  console.log('Catalog Min:', catalogRecent._min.createdAt);
  console.log('Catalog Max:', catalogRecent._max.createdAt);
}
main();
