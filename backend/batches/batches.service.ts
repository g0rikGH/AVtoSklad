import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BatchesService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getCorrectionQueue() {
    return this.prisma.inventoryBatch.findMany({
      where: { needsCostCorrection: true },
      include: {
        product: {
          select: {
            article: true,
            name: true,
            brand: { select: { name: true } },
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updateCost(id: string, newCost: number) {
    const batch = await this.prisma.inventoryBatch.findUnique({ where: { id } });
    if (!batch) throw new NotFoundException('Партия не найдена');

    return this.prisma.$transaction(async (tx) => {
      // Update the batch
      const updatedBatch = await tx.inventoryBatch.update({
        where: { id },
        data: {
          purchasePrice: newCost,
          needsCostCorrection: false
        }
      });

      // Also update the CurrentPrice if this is the latest batch
      await tx.currentPrice.upsert({
        where: { productId: batch.productId },
        create: { productId: batch.productId, purchasePrice: newCost, sellingPrice: 0 },
        update: { purchasePrice: newCost }
      });

      return updatedBatch;
    });
  }
}
