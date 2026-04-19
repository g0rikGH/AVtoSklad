import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { ExportController } from './export.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CatalogController, ExportController],
  providers: [CatalogService],
  exports: [CatalogService]
})
export class CatalogModule {}
