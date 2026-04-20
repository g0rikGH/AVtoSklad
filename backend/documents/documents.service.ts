import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDocumentDto } from './dto/create-document.dto';

@Injectable()
export class DocumentsService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async createDraft(type: string, partnerId: string, userId: string, name?: string) {
    const lastDoc = await this.prisma.document.findFirst({
      where: { type },
      orderBy: { number: 'desc' }
    });
    
    return await this.prisma.document.create({
      data: {
        type,
        number: (lastDoc?.number || 0) + 1,
        partnerId,
        userId,
        name,
        status: 'DRAFT',
        totalAmount: 0
      }
    });
  }

  async commitDraft(id: string, isInitialBalance?: boolean) {
    return await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.findUnique({
        where: { id },
        include: { rows: true }
      });
      if (!doc || doc.status === 'COMPLETED') throw new BadRequestException('Invalid draft');

      const totalAmount = doc.rows.reduce((sum, row) => sum + (row.qty * row.price), 0);
      
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

          await tx.inventoryBatch.create({
            data: {
              productId: physicalId,
              documentRowId: row.id,
              originalQuantity: row.qty,
              remainingQuantity: row.qty,
              purchasePrice: isInitialBalance ? 0 : row.price,
              needsCostCorrection: !!isInitialBalance
            }
          });

          await tx.stockBalance.upsert({
            where: { productId: physicalId },
            create: { productId: physicalId, qty: row.qty },
            update: { qty: { increment: row.qty } },
          });

          const pPrice = isInitialBalance ? 0 : row.price;
          const sPrice = isInitialBalance ? row.price : 0;
          
          await tx.currentPrice.upsert({
            where: { productId: row.productId },
            create: { productId: row.productId, purchasePrice: pPrice, sellingPrice: sPrice },
            update: isInitialBalance ? { purchasePrice: pPrice, sellingPrice: sPrice } : { purchasePrice: pPrice }
          });
        }
      } else if (doc.type === 'EXPENSE') {
        for (const row of doc.rows) {
          const pInfo = productMap.get(row.productId);
          const physicalId = pInfo?.type === 'PHANTOM' && pInfo.parentId ? pInfo.parentId : row.productId;

          let neededQty = row.qty;
          const activeBatches = await tx.inventoryBatch.findMany({
            where: { productId: physicalId, remainingQuantity: { gt: 0 } },
            orderBy: { createdAt: 'asc' }
          });

          const totalAvailable = activeBatches.reduce((sum, b) => sum + b.remainingQuantity, 0);
          if (totalAvailable < neededQty) {
            throw new BadRequestException(`Недостаточно товара ${row.productId} на складе. В наличии: ${totalAvailable}`);
          }

          for (const batch of activeBatches) {
            if (neededQty <= 0) break;
            const canTake = Math.min(batch.remainingQuantity, neededQty);
            await tx.batchTransaction.create({
              data: { documentRowId: row.id, batchId: batch.id, qty: canTake }
            });
            await tx.inventoryBatch.update({
              where: { id: batch.id },
              data: { remainingQuantity: { decrement: canTake } }
            });
            neededQty -= canTake;
          }

          await tx.stockBalance.update({
            where: { productId: physicalId },
            data: { qty: { decrement: row.qty } }
          });
        }
      }

      await tx.catalog.updateMany({
        where: { id: { in: productIds }, status: 'DRAFT' },
        data: { status: 'ACTIVE' }
      });

      return await tx.document.update({
        where: { id },
        data: { status: 'COMPLETED', totalAmount },
        include: { rows: true }
      });
    }, { timeout: 300000 });
  }

  async deleteDraft(id: string) {
    return await this.prisma.$transaction(async (tx) => {
      const doc = await tx.document.findUnique({
        where: { id },
        include: { rows: true }
      });
      if (!doc || doc.status !== 'DRAFT') return;

      const productIds = doc.rows.map(r => r.productId);
      
      await tx.documentRow.deleteMany({ where: { documentId: id } });
      await tx.document.delete({ where: { id } });

      // Clean up phantoms
      for (const pId of productIds) {
        const remainingRows = await tx.documentRow.count({ where: { productId: pId } });
        const stock = await tx.stockBalance.findUnique({ where: { productId: pId } });
        if (remainingRows === 0 && (!stock || stock.qty === 0)) {
           await tx.stockBalance.deleteMany({ where: { productId: pId } });
           await tx.currentPrice.deleteMany({ where: { productId: pId } });
           await tx.catalog.delete({ where: { id: pId } });
        }
      }
    }, { timeout: 300000 });
  }

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
                purchasePrice: dto.isInitialBalance ? 0 : row.price,
                needsCostCorrection: !!dto.isInitialBalance
              }
            });

            // 2. Update StockBalance
            await tx.stockBalance.upsert({
              where: { productId: physicalId },
              create: { productId: physicalId, qty: row.qty },
              update: { qty: { increment: row.qty } },
            });

            // 3. Update Last Purchase Price Cache (and sellingPrice if initial balance)
            const pPrice = dto.isInitialBalance ? 0 : row.price;
            const sPrice = dto.isInitialBalance ? row.price : 0;
            
            await tx.currentPrice.upsert({
              where: { productId: row.productId },
              create: { productId: row.productId, purchasePrice: pPrice, sellingPrice: sPrice },
              update: dto.isInitialBalance ? { purchasePrice: pPrice, sellingPrice: sPrice } : { purchasePrice: pPrice }
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
                throw new BadRequestException('Cannot revert: some items from this invoice have already been dispatched/sold');
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

        // CLEANUP: Delete "ghost" nomenclature records that have 0 stock, 0 batches, and no other history
        if (doc.type === 'INCOME') {
          console.log(`[BACKEND-ROLLBACK] Checking for ghost products to clean up...`);
          // Get all explicitly referenced product IDs from rows
          const idsToCleanup = new Set<string>();
          for (const row of doc.rows) {
            idsToCleanup.add(row.productId);
            const pInfo = productMap.get(row.productId);
            if (pInfo && pInfo.type === 'PHANTOM' && pInfo.parentId) {
              idsToCleanup.add(pInfo.parentId); // Check the parent too
            }
          }

          for (const pId of Array.from(idsToCleanup)) {
            // Check stock balance
            const stock = await tx.stockBalance.findUnique({ where: { productId: pId } });
            if (stock && stock.qty > 0) continue;

            // Check if ANY inventory batches remain for this product (from other invoices)
            const remainingBatches = await tx.inventoryBatch.count({ where: { productId: pId } });
            if (remainingBatches > 0) continue;

            // Check if ANY other document rows reference this product (meaning it has sales/other history)
            // (Note: the current document rows are already deleted above)
            const otherRows = await tx.documentRow.count({ where: { productId: pId } });
            if (otherRows > 0) continue;

            // If it's a parent product, verify it has no remaining phantom children
            const phantoms = await tx.catalog.count({ where: { parentId: pId } });
            if (phantoms > 0) continue;

            console.log(`[BACKEND-ROLLBACK] Deleting ghost product: ${pId}`);
            
            // Clean up dependent records first
            await tx.stockBalance.deleteMany({ where: { productId: pId } });
            await tx.currentPrice.deleteMany({ where: { productId: pId } });
            
            // Delete the product itself
            await tx.catalog.delete({ where: { id: pId } });
          }
        }

        console.log(`[BACKEND-ROLLBACK] Rollback COMPLETED for: ${id}`);
        return { success: true };
      }, { timeout: 300000 });
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
