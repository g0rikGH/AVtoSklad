import { Controller, Get, Patch, Body, Param, UseGuards, Inject } from '@nestjs/common';
import { BatchesService } from './batches.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('batches')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BatchesController {
  constructor(@Inject(BatchesService) private readonly batchesService: BatchesService) {}

  @Get('correction-queue')
  @Roles('ADMIN', 'MANAGER')
  async getCorrectionQueue() {
    const data = await this.batchesService.getCorrectionQueue();
    return { success: true, data };
  }

  @Patch(':id/cost')
  @Roles('ADMIN', 'MANAGER')
  async updateCost(@Param('id') id: string, @Body('purchasePrice') purchasePrice: number) {
    if (typeof purchasePrice !== 'number' || purchasePrice < 0) {
      return { success: false, message: 'Invalid purchase price' };
    }
    const data = await this.batchesService.updateCost(id, purchasePrice);
    return { success: true, data };
  }
}
