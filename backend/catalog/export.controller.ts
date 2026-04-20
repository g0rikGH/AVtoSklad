import { Controller, Get, Res, Query, Inject } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import type { Response } from 'express';
import * as XLSX from 'xlsx';

@Controller('export')
export class ExportController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Get('price-list')
  async downloadPriceList(
    @Query('onlyWithPrice') onlyWithPriceStr: string,
    @Res() res: Response
  ) {
    const onlyWithPrice = onlyWithPriceStr === 'true';
    const allProducts = await this.catalogService.getAllProductsView(onlyWithPrice);
    const products = allProducts.filter(p => p.status !== 'draft');
    
    // Group products (parents followed by their phantoms)
    const families = new Map<string, { parent: any | null, phantoms: any[] }>();
    const standalonePhantoms: any[] = [];

    products.forEach(p => {
      if (p.type === 'real') {
        if (!families.has(p.id)) {
          families.set(p.id, { parent: p, phantoms: [] });
        } else {
          families.get(p.id)!.parent = p;
        }
      }
    });

    products.forEach(p => {
      if (p.type === 'phantom') {
        if (p.parentId && families.has(p.parentId)) {
          families.get(p.parentId)!.phantoms.push(p);
        } else {
          standalonePhantoms.push(p);
        }
      }
    });

    const resultRows: any[] = [];
    
    families.forEach((family) => {
      if (family.parent) {
        resultRows.push(family.parent);
      }
      family.phantoms.sort((a, b) => a.article.localeCompare(b.article));
      family.phantoms.forEach(ph => resultRows.push(ph));
    });

    standalonePhantoms.forEach(ph => resultRows.push(ph));

    const data = resultRows.map(p => {
      let exportName = p.name;
      if (p.type === 'phantom' && p.parentId) {
        const family = families.get(p.parentId);
        if (family && family.parent) {
          exportName = family.parent.name;
        }
      }
      return {
        'Артикул': p.article,
        'Производитель': p.brand,
        'Наименование': exportName,
        'Цена': p.sellingPrice || 0,
        'Наличие': p.qty
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Price");

    worksheet['!cols'] = [
      { wch: 15 }, // Артикул
      { wch: 15 }, // Бренд
      { wch: 40 }, // Название
      { wch: 15 }, // Цена продажи
      { wch: 10 }  // Остаток
    ];

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=price_list.xlsx');
    res.send(buffer);
  }
}
