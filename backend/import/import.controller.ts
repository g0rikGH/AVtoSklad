import { Controller, Post, Body, UseGuards, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('import')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportController {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  @Post('chunk')
  @Roles('ADMIN', 'MANAGER')
  async processChunk(@Body('items') items: any[]) {
    const startTime = performance.now();
    let insertedCount = 0;
    let updatedCount = 0;
    let newBrandsCount = 0;

    if (!Array.isArray(items) || items.length > 50) {
      return { 
        success: false, 
        message: 'Invalid payload. Expected array of max 50 items.',
        insertedCount: 0,
        updatedCount: 0,
        newBrandsCount: 0,
        chunkTimeMs: performance.now() - startTime,
        errors: []
      };
    }

    const errors: { identifier: string; reason: string }[] = [];
    
    // 1. Deduplicate items by article within the incoming chunk to avoid parallel create collisions
    const cleanItemsMap = new Map<string, any>();
    for (const item of items) {
      const article = item.article?.toString().trim().toUpperCase();
      if (article) {
        cleanItemsMap.set(article, item);
      } else {
        errors.push({ identifier: 'Unknown', reason: 'Отсутствует артикул' });
      }
    }
    const cleanItems = Array.from(cleanItemsMap.values());

    if (cleanItems.length === 0) {
      return { 
        success: true, 
        processed: 0, 
        insertedCount: 0,
        updatedCount: 0,
        newBrandsCount: 0,
        chunkTimeMs: performance.now() - startTime,
        errors, 
        failedItems: errors 
      };
    }

    try {
      // Open a SINGLE interactive transaction for the entire chunk
      await this.prisma.$transaction(async (tx) => {
        // -- EAGER READS --
        const uniqueArticles = cleanItems.map(i => i.article.toString().trim().toUpperCase());
        const uniqueBrandNames = [...new Set(cleanItems.filter(i => i.brandName).map(i => i.brandName.toString().trim()))];

        // Fetch existing brands and catalogs in bulk
        const existingBrands = await tx.brand.findMany({ where: { name: { in: uniqueBrandNames } } });
        const existingProducts = await tx.catalog.findMany({ where: { article: { in: uniqueArticles } } });
        
        const brandMap = new Map(existingBrands.map(b => [b.name, b.id]));
        const catalogMap = new Map(existingProducts.map(p => [p.article, p]));

        // -- MEMORY DIFF: CREATE MISSING BRANDS --
        const missingBrands = uniqueBrandNames.filter(name => !brandMap.has(name));
        if (missingBrands.length > 0) {
           newBrandsCount = missingBrands.length;
           // Fast sequential creates inside the transaction
           for (const name of missingBrands) {
             const newBrand = await tx.brand.create({ data: { name } });
             brandMap.set(newBrand.name, newBrand.id);
           }
        }

        // -- BULK WRITE ASSEMBLY --
        const txPromises: any[] = [];
        
        for (const item of cleanItems) {
          const article = item.article.toString().trim().toUpperCase();
          const brandId = item.brandName ? brandMap.get(item.brandName.toString().trim()) || null : null;
          const existingProduct = catalogMap.get(article);
          const price = item.price !== undefined && item.price !== null ? Number(item.price) : null;

          if (existingProduct) {
            updatedCount++;
            // Prepare UPDATE promise
            txPromises.push(tx.catalog.update({
              where: { id: existingProduct.id },
              data: {
                name: item.name || existingProduct.name,
                brandId: brandId || existingProduct.brandId
              }
            }));

            if (price !== null) {
              txPromises.push(tx.currentPrice.upsert({
                where: { productId: existingProduct.id },
                create: { productId: existingProduct.id, purchasePrice: price, sellingPrice: 0 },
                update: { purchasePrice: price }
              }));
            }
          } else {
            insertedCount++;
            // Prepare CREATE promise with nested CurrentPrice
            const createData: any = {
              article,
              name: item.name || 'Без названия',
              type: 'REAL',
              status: 'DRAFT',
              brandId
            };
            
            if (price !== null) {
              createData.currentPrice = {
                create: {
                  purchasePrice: price,
                  sellingPrice: 0
                }
              };
            }

            txPromises.push(tx.catalog.create({
              data: createData
            }));
          }
        }

        // Execute all prepared catalog and price operations safely inside the transaction
        await Promise.all(txPromises);
      }, { timeout: 15000 }); // Increase timeout to 15s for safety

    } catch (error: any) {
      console.error("Bulk import failed:", error);
      // In case of a major transaction failure, all items in this chunk basically fail
      cleanItems.forEach(item => {
        errors.push({
          identifier: item.article || 'Unknown',
          reason: 'Транзакция прервана: ' + (error.message || 'Ошибка базы данных')
        });
      });
      return {
        success: false,
        processed: 0,
        insertedCount: 0,
        updatedCount: 0,
        newBrandsCount: 0,
        chunkTimeMs: performance.now() - startTime,
        errors,
        failedItems: errors
      };
    }

    return {
      success: true,
      processed: cleanItems.length,
      insertedCount,
      updatedCount,
      newBrandsCount,
      chunkTimeMs: performance.now() - startTime,
      errors,
      failedItems: errors
    };
  }
}
