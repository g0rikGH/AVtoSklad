
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.catalog.findMany({
    where: {
      article: {
        contains: 'testman'
      }
    },
    select: {
      article: true,
      status: true,
      currentPrice: true
    }
  });
  console.log('Search results for "testman":');
  console.log(JSON.stringify(products, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
