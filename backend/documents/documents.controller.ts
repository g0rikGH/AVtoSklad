import { Controller, Post, Get, Body, UseGuards, Param, Inject } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documentsService: DocumentsService) {}

  @Post()
  async createDocument(@Body() dto: CreateDocumentDto, @CurrentUser() user: any) {
    const doc = await this.documentsService.createDocument(dto, user.sub);
    return { success: true, data: { ...doc, type: doc.type.toLowerCase() } };
  }

  @Get()
  async getAllDocuments() {
    const docs = await this.documentsService.getAllDocuments();
    return { 
      success: true, 
      data: docs.map(d => ({ ...d, type: d.type.toLowerCase() })) 
    };
  }

  @Post(':id/rollback')
  async rollbackDocument(@Param('id') id: string) {
    await this.documentsService.rollbackDocument(id);
    return { success: true, message: 'Документ отменен' };
  }
}
