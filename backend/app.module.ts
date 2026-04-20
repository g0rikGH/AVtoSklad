import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CatalogModule } from './catalog/catalog.module';
import { DocumentsModule } from './documents/documents.module';
import { PartnersModule } from './partners/partners.module';
import { UsersModule } from './users/users.module';
import { ImportModule } from './import/import.module';
import { BatchesModule } from './batches/batches.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    DocumentsModule,
    PartnersModule,
    ImportModule,
    BatchesModule,
  ],
})
export class AppModule {}
