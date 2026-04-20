import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReferenceDto, CreateProductDto } from './dto/create-catalog.dto';

@Injectable()
export class CatalogService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getAllProductsView(onlyWithPrice: boolean = false) {
    const whereCondition: any = {};
    
    if (onlyWithPrice) {
      whereCondition.currentPrice = {
        isNot: null,
        sellingPrice: { gt: 0 }
      };
    }

    const products = await this.prisma.catalog.findMany({
      where: whereCondition,
      include: {
        brand: true,
        location: true,
        stockBalance: true,
        currentPrice: true,
        batches: {
          where: { remainingQuantity: { gt: 0 } },
          orderBy: { createdAt: 'asc' }
        },
        parent: {
          include: {
            stockBalance: true,
            batches: {
              where: { remainingQuantity: { gt: 0 } },
              orderBy: { createdAt: 'asc' }
            }
          },
        },
      },
    });

    return products.map((p) => {
      let qty = 0;
      let activeBatches: any[] = [];

      if (p.type === 'REAL') {
        qty = p.stockBalance?.qty ?? 0;
        activeBatches = p.batches;
      } else if (p.type === 'PHANTOM') {
        qty = p.parent?.stockBalance?.qty ?? 0;
        activeBatches = p.parent?.batches ?? [];
      }

      return {
        id: p.id,
        article: p.article,
        name: p.name,
        type: p.type.toLowerCase(),
        comment: p.comment,
        parentId: p.parentId,
        brandId: p.brandId,
        brand: p.brand?.name || 'Без бренда',
        locationId: p.locationId,
        location: p.location?.name || 'Не на полке',
        qty: qty,
        purchasePrice: p.currentPrice?.purchasePrice ?? 0,
        sellingPrice: p.currentPrice?.sellingPrice ?? 0,
        status: p.status.toLowerCase(),
        batches: activeBatches.map(b => ({
          qty: b.remainingQuantity,
          price: b.purchasePrice,
          date: b.createdAt
        }))
      };
    });
  }

  async createBrand(dto: CreateReferenceDto) {
    return this.prisma.brand.create({
      data: { name: dto.name },
    });
  }

  async getBrands() {
    return this.prisma.brand.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createLocation(dto: CreateReferenceDto) {
    return this.prisma.location.create({
      data: { name: dto.name },
    });
  }

  async getLocations() {
    return this.prisma.location.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createProduct(dto: CreateProductDto) {
    if (dto.type === 'PHANTOM') {
      const parent = await this.prisma.catalog.findUnique({
        where: { id: dto.parentId },
        select: { type: true },
      });

      if (!parent) {
        throw new BadRequestException(`Родительский товар с ID ${dto.parentId} не существует.`);
      }

      if (parent.type !== 'REAL') {
        throw new BadRequestException('Архитектурная ошибка: Фантом может ссылаться только на REAL-товар!');
      }
    } else {
      dto.parentId = undefined;
    }

    return this.prisma.catalog.create({
      data: {
        article: dto.article,
        name: dto.name,
        type: dto.type,
        brandId: dto.brandId,
        locationId: dto.locationId,
        comment: dto.comment,
        parentId: dto.parentId,
        status: (dto as any).status || 'ACTIVE',
      },
    });
  }

  async getProductHistory(productId: string) {
    const product = await this.prisma.catalog.findUnique({
      where: { id: productId },
      select: { type: true, parentId: true }
    });

    if (!product) {
      throw new BadRequestException('Товар не найден.');
    }

    const targetProductId = product.type === 'PHANTOM' && product.parentId ? product.parentId : productId;

    const historyRows = await this.prisma.documentRow.findMany({
      where: {
        productId: targetProductId,
        document: {
          type: 'INCOME'
        }
      },
      include: {
        document: {
          include: {
            partner: true
          }
        }
      },
      orderBy: {
        document: {
          date: 'desc'
        }
      }
    });

    return historyRows.map(row => ({
      id: row.id,
      docId: row.document.id,
      docNumber: row.document.number || undefined,
      date: row.document.date,
      supplier: row.document.partner.name,
      qty: row.qty,
      price: row.price
    }));
  }

  async updateProduct(id: string, dto: any) {
    // Basic update logic for product fields + UPSERT for prices if provided
    return this.prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {};
      if (dto.article !== undefined) dataToUpdate.article = dto.article;
      if (dto.name !== undefined) dataToUpdate.name = dto.name;
      if (dto.brandId !== undefined) dataToUpdate.brandId = dto.brandId;
      if (dto.locationId !== undefined) dataToUpdate.locationId = dto.locationId;
      if (dto.comment !== undefined) dataToUpdate.comment = dto.comment;
      if (dto.status !== undefined) dataToUpdate.status = dto.status.toUpperCase();

      const updatedProduct = await tx.catalog.update({
        where: { id },
        data: dataToUpdate
      });

      if (dto.purchasePrice !== undefined || dto.sellingPrice !== undefined) {
        await tx.currentPrice.upsert({
          where: { productId: id },
          create: {
            productId: id,
            purchasePrice: dto.purchasePrice || 0,
            sellingPrice: dto.sellingPrice || 0,
          },
          update: {
            purchasePrice: dto.purchasePrice,
            sellingPrice: dto.sellingPrice,
          }
        });
      }

      return updatedProduct;
    });
  }

  async deleteProduct(id: string) {
    const product = await this.prisma.catalog.findUnique({
      where: { id },
      include: { stockBalance: true },
    });

    if (!product) {
      throw new BadRequestException('Товар не найден.');
    }

    // 1. Проверяем остаток
    if (product.type === 'REAL' && product.stockBalance && product.stockBalance.qty > 0) {
      throw new BadRequestException('Невозможно удалить: остаток товара больше нуля.');
    }

    // Кроссы (PHANTOM) не имеют собственного остатка, они берут его от родителя. 
    // Удаляем их без проверки остатка родителя, чтобы дать возможность "отвязать" кросс.

    // 2. Проверяем наличие в реализациях (EXPENSE)
    // Если это PHANTOM, он мог продаваться по своему артикулу (ID), проверяем именно его ID.
    const expenseCount = await this.prisma.documentRow.count({
      where: {
        productId: id,
        document: {
          type: 'EXPENSE'
        }
      }
    });

    if (expenseCount > 0) {
      throw new BadRequestException('Невозможно удалить: товар участвовал в реализациях (продажах).');
    }

    // 3. Дополнительно проверяем, нет ли у этого реального товара привязанных кроссов (PHANTOM)
    if (product.type === 'REAL') {
      const phantomsCount = await this.prisma.catalog.count({
        where: { parentId: id }
      });
      if (phantomsCount > 0) {
        throw new BadRequestException('Невозможно удалить: у товара есть привязанные кросс-артикулы. Сначала удалите их.');
      }
    }

    // Удаляем связанные данные (цены, остатки - Prisma onCascade должен подчистить, если настроен, 
    // но если нет, удаляем вручную). Проверим схему или удалим явно:
    await this.prisma.currentPrice.deleteMany({ where: { productId: id } });
    await this.prisma.stockBalance.deleteMany({ where: { productId: id } });

    // Само удаление
    return this.prisma.catalog.delete({
      where: { id }
    });
  }

  async bulkUpdateStatus(ids: string[], status: string) {
    return this.prisma.catalog.updateMany({
      where: {
        id: { in: ids }
      },
      data: {
        status: status.toUpperCase()
      }
    });
  }
}
