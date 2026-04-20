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
  async processChunk(
    @Body('items') items: any[], 
    @Body('isInitialBalance') isInitialBalance?: boolean,
    @Body('documentId') documentId?: string
  ) {
    const startTime = performance.now();
    let insertedCount = 0;
    let updatedCount = 0;
    let newBrandsCount = 0;

    if (!Array.isArray(items) || items.length > 50) {
      return { 
        success: false, message: 'Invalid payload.'
      };
    }

    const errors: { identifier: string; reason: string }[] = [];
    const cleanItemsMap = new Map<string, any>();
    for (const item of items) {
      const article = item.article?.toString().trim().toUpperCase();
      if (article) cleanItemsMap.set(article, item);
    }
    const cleanItems = Array.from(cleanItemsMap.values());

    if (cleanItems.length === 0) return { success: true, processed: 0, errors };

    try {
      await this.prisma.$transaction(async (tx) => {
        const uniqueArticles = cleanItems.map(i => i.article.toString().trim().toUpperCase());
        const uniqueBrandNames = [...new Set(cleanItems.filter(i => i.brandName).map(i => i.brandName.toString().trim()))];

        const existingBrands = await tx.brand.findMany({ where: { name: { in: uniqueBrandNames } } });
        const existingProducts = await tx.catalog.findMany({ where: { article: { in: uniqueArticles } } });
        
        const brandMap = new Map(existingBrands.map(b => [b.name, b.id]));
        const catalogMap = new Map(existingProducts.map(p => [p.article, p]));

        const missingBrands = uniqueBrandNames.filter(name => !brandMap.has(name));
        if (missingBrands.length > 0) {
           newBrandsCount = missingBrands.length;
           for (const name of missingBrands) {
             const newBrand = await tx.brand.create({ data: { name } });
             brandMap.set(newBrand.name, newBrand.id);
           }
        }

        for (const item of cleanItems) {
          const article = item.article.toString().trim().toUpperCase();
          const brandId = item.brandName ? brandMap.get(item.brandName.toString().trim()) || null : null;
          let product = catalogMap.get(article);
          const price = item.price !== undefined && item.price !== null ? Number(item.price) : null;
          const qty = item.qty !== undefined && item.qty !== null ? Number(item.qty) : 0;

          if (product) {
            updatedCount++;
            product = await tx.catalog.update({
              where: { id: product.id },
              data: {
                name: item.name || product.name,
                brandId: brandId || product.brandId
              }
            });

            if (price !== null) {
              const pPrice = isInitialBalance ? 0 : price;
              const sPrice = isInitialBalance ? price : 0;
              await tx.currentPrice.upsert({
                where: { productId: product.id },
                create: { productId: product.id, purchasePrice: pPrice, sellingPrice: sPrice },
                update: { purchasePrice: pPrice, sellingPrice: sPrice }
              });
            }
          } else {
            insertedCount++;
            const createData: any = {
              article, name: item.name || 'Без названия', type: 'REAL',
              status: 'DRAFT', brandId
            };
            
            if (price !== null) {
              const pPrice = isInitialBalance ? 0 : price;
              const sPrice = isInitialBalance ? price : 0;
              createData.currentPrice = {
                create: { purchasePrice: pPrice, sellingPrice: sPrice }
              };
            }
            product = await tx.catalog.create({ data: createData });
          }

          if (documentId && qty > 0) {
            await tx.documentRow.create({
              data: {
                documentId,
                productId: product.id,
                qty,
                price: price || 0
              }
            });
          }
        }
      }, { timeout: 15000 });

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
