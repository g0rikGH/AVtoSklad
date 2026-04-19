import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async createDocument(dto: CreateDocumentDto, userId: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const lastDoc = await tx.document.findFirst({
          where: { type: dto.type },
          orderBy: { number: 'desc' }
        });
        
        const nextNumber = (lastDoc?.number || 0) + 1;

        const document = await tx.document.create({
          data: {
            type: dto.type,
            number: nextNumber,
            name: dto.name,
            partnerId: dto.partnerId,
            totalAmount: dto.rows.reduce((sum, row) => sum + (row.qty * row.price), 0),
            userId,
            rows: {
              create: dto.rows.map((row) => ({
                productId: row.productId,
                qty: row.qty,
                price: row.price,
              })),
            },
          },
          include: { rows: true },
        });

        // FIFO LOGIC STARTS HERE
        const productIds = dto.rows.map(r => r.productId);
        const productsInfo = await tx.catalog.findMany({
          where: { id: { in: productIds } },
          select: { id: true, type: true, parentId: true }
        });
        const productMap = new Map(productsInfo.map(p => [p.id, p]));

        if (dto.type === 'INCOME') {
          for (const row of document.rows) {
            const pInfo = productMap.get(row.productId);
            const physicalId = pInfo?.type === 'PHANTOM' && pInfo.parentId ? pInfo.parentId : row.productId;

            // 1. Create Batch
            await tx.inventoryBatch.create({
              data: {
                productId: physicalId,
                documentRowId: row.id,
                originalQuantity: row.qty,
                remainingQuantity: row.qty,
                purchasePrice: row.price
              }
            });

            // 2. Update StockBalance
            await tx.stockBalance.upsert({
              where: { productId: physicalId },
              create: { productId: physicalId, qty: row.qty },
              update: { qty: { increment: row.qty } },
            });

            // 3. Update Last Purchase Price Cache
            await tx.currentPrice.upsert({
              where: { productId: row.productId },
              create: { productId: row.productId, purchasePrice: row.price, sellingPrice: 0 },
              update: { purchasePrice: row.price }
            });
          }
        } else if (dto.type === 'EXPENSE') {
          for (const row of document.rows) {
            const pInfo = productMap.get(row.productId);
            const physicalId = pInfo?.type === 'PHANTOM' && pInfo.parentId ? pInfo.parentId : row.productId;

            // 1. DEDUCT BATCHES (FIFO)
            let neededQty = row.qty;
            const activeBatches = await tx.inventoryBatch.findMany({
              where: { productId: physicalId, remainingQuantity: { gt: 0 } },
              orderBy: { createdAt: 'asc' }
            });

            const totalAvailable = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
            if (totalAvailable < neededQty) {
              throw new BadRequestException(
                `Недостаточно товара ${row.productId} на складе. Требуется: ${neededQty}, В наличии: ${totalAvailable}`
              );
            }

            for (const batch of activeBatches) {
              if (neededQty <= 0) break;
              const canTake = Math.min(batch.remainingQuantity, neededQty);
              
              await tx.batchTransaction.create({
                data: {
                  documentRowId: row.id,
                  batchId: batch.id,
                  qty: canTake
                }
              });

              await tx.inventoryBatch.update({
                where: { id: batch.id },
                data: { remainingQuantity: { decrement: canTake } }
              });

              neededQty -= canTake;
            }

            // 2. Update StockBalance
            await tx.stockBalance.update({
              where: { productId: physicalId },
              data: { qty: { decrement: row.qty } }
            });
          }
        }

        return document;
      });
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      let errorDetails = error.message;
      if (error.code) {
        errorDetails = `[${error.code}] ${error.message} - Meta: ${JSON.stringify(error.meta || {})}`;
      }

      console.error('Prisma Transaction Error Details:', errorDetails);
      throw new BadRequestException(
        `Ошибка базы данных при сохранении документа: ${errorDetails}`
      );
    }
  }

  async rollbackDocument(id: string) {
    console.log(`[BACKEND-ROLLBACK] Starting rollback for document: ${id}`);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const doc = await tx.document.findUnique({
          where: { id },
          include: { rows: true }
        });

        if (!doc) {
          console.error(`[BACKEND-ROLLBACK] Document not found: ${id}`);
          throw new BadRequestException('Документ не найден');
        }

        console.log(`[BACKEND-ROLLBACK] Processing ${doc.rows.length} rows for document type: ${doc.type}`);

        const productIds = doc.rows.map(r => r.productId);
        const productsInfo = await tx.catalog.findMany({
          where: { id: { in: productIds } },
          select: { id: true, type: true, parentId: true }
        });
        const productMap = new Map(productsInfo.map(p => [p.id, p]));

        if (doc.type === 'INCOME') {
          for (const row of doc.rows) {
            const pInfo = productMap.get(row.productId);
            const physicalId = pInfo?.type === 'PHANTOM' && pInfo.parentId ? pInfo.parentId : row.productId;

            const batch = await tx.inventoryBatch.findFirst({
              where: { documentRowId: row.id }
            });

            if (batch) {
              if (batch.remainingQuantity < batch.originalQuantity) {
                throw new BadRequestException(`Невозможно отменить приход товара ${row.productId}: часть товара из этой партии уже была продана.`);
              }
              await tx.inventoryBatch.delete({ where: { id: batch.id } });
            }

            // Sync total stock
            await tx.stockBalance.update({
              where: { productId: physicalId },
              data: { qty: { decrement: row.qty } }
            });
          }
        } else if (doc.type === 'EXPENSE') {
          for (const row of doc.rows) {
            const pInfo = productMap.get(row.productId);
            const physicalId = pInfo?.type === 'PHANTOM' && pInfo.parentId ? pInfo.parentId : row.productId;

            // 1. Find all batch transactions for this row
            const transactions = await tx.batchTransaction.findMany({
              where: { documentRowId: row.id }
            });

            for (const trans of transactions) {
              // 2. Return qty to batch
              await tx.inventoryBatch.update({
                where: { id: trans.batchId },
                data: { remainingQuantity: { increment: trans.qty } }
              });
              // 3. Delete transaction
              await tx.batchTransaction.delete({ where: { id: trans.id } });
            }

            // 4. Update StockBalance
            await tx.stockBalance.update({
              where: { productId: physicalId },
              data: { qty: { increment: row.qty } }
            });
          }
        }

        console.log(`[BACKEND-ROLLBACK] Deleting document ${id}`);
        await tx.documentRow.deleteMany({ where: { documentId: id } });
        await tx.document.delete({ where: { id } });
        console.log(`[BACKEND-ROLLBACK] Rollback COMPLETED for: ${id}`);
        return { success: true };
      });
    } catch (error: any) {
      console.error(`[BACKEND-ROLLBACK] CRITICAL ERROR for ${id}:`, error);
      throw error;
    }
  }

  async getAllDocuments() {
    return this.prisma.document.findMany({
      include: {
        rows: {
          include: {
            batchTransactions: {
              include: {
                batch: true
              }
            }
          }
        },
        partner: true,
        user: true,
      },
      orderBy: { date: 'desc' },
    });
  }
}
