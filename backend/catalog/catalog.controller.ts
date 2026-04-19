import { Controller, Get, Post, Body, UseGuards, Inject, Param, Put, Delete } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CreateReferenceDto, CreateProductDto } from './dto/create-catalog.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('catalog')
@UseGuards(JwtAuthGuard)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalogService: CatalogService) {}

  @Get()
  async getCatalog() {
    const data = await this.catalogService.getAllProductsView();
    return { success: true, data };
  }

  @Get('brands')
  async getBrands() {
    const brands = await this.catalogService.getBrands();
    return { success: true, data: brands };
  }

  @Post('brands')
  async createBrand(@Body() dto: CreateReferenceDto) {
    const brand = await this.catalogService.createBrand(dto);
    return { success: true, data: brand };
  }

  @Get('locations')
  async getLocations() {
    const locations = await this.catalogService.getLocations();
    return { success: true, data: locations };
  }

  @Post('locations')
  async createLocation(@Body() dto: CreateReferenceDto) {
    const location = await this.catalogService.createLocation(dto);
    return { success: true, data: location };
  }

  @Get(':id/history')
  async getProductHistory(@Param('id') id: string) {
    const history = await this.catalogService.getProductHistory(id);
    return { success: true, data: history };
  }

  @Post()
  async createProduct(@Body() dto: CreateProductDto) {
    const product = await this.catalogService.createProduct(dto);
    return { success: true, message: 'Товар успешно создан', data: product };
  }

  @Put(':id')
  async updateProduct(@Param('id') id: string, @Body() dto: any) {
    const product = await this.catalogService.updateProduct(id, dto);
    return { success: true, data: product };
  }

  @Delete(':id')
  async deleteProduct(@Param('id') id: string) {
    await this.catalogService.deleteProduct(id);
    return { success: true };
  }

  @Post('bulk-status')
  async bulkUpdateStatus(@Body() dto: { ids: string[], status: string }) {
    await this.catalogService.bulkUpdateStatus(dto.ids, dto.status);
    return { success: true, message: 'Статус товаров успешно обновлен' };
  }
}
