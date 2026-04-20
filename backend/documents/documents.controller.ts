import { Controller, Post, Get, Delete, Body, UseGuards, Param, Inject } from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(@Inject(DocumentsService) private readonly documentsService: DocumentsService) {}

  @Post('draft')
  async createDraft(@Body() dto: { type: string, partnerId: string, name?: string }, @CurrentUser() user: any) {
    const doc = await this.documentsService.createDraft(dto.type, dto.partnerId, user.sub, dto.name);
    return { success: true, data: { ...doc, type: doc.type.toLowerCase() } };
  }

  @Post(':id/commit')
  async commitDraft(@Param('id') id: string, @Body('isInitialBalance') isInitialBalance?: boolean) {
    const doc = await this.documentsService.commitDraft(id, isInitialBalance);
    return { success: true, data: { ...doc, type: doc.type.toLowerCase() } };
  }

  @Delete(':id/draft')
  async deleteDraft(@Param('id') id: string) {
    await this.documentsService.deleteDraft(id);
    return { success: true, message: 'Черновик удален' };
  }

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
