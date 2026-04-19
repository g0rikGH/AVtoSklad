import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "file:./dev.db"
    }
  }
});

async function run() {
  try {
    const count = await prisma.user.count();
    console.log("User count:", count);
  } catch (e) {
    console.error("Failed to query DB:", e);
  }
}

run();
