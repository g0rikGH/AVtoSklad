import { Controller, Get, Post, Put, Param, Body, UseGuards, Inject } from '@nestjs/common';
import { PartnersService } from './partners.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsString, IsIn, IsOptional } from 'class-validator';

class CreatePartnerDto {
  @IsString()
  name: string;

  @IsString()
  @IsIn(['SUPPLIER', 'CLIENT', 'supplier', 'client'])
  type: 'SUPPLIER' | 'CLIENT' | 'supplier' | 'client';
}

class UpdateConfigDto {
  @IsString()
  importConfig: string;
}

@Controller('partners')
@UseGuards(JwtAuthGuard)
export class PartnersController {
  constructor(@Inject(PartnersService) private readonly partnersService: PartnersService) {}

  @Get()
  async findAll() {
    const data = await this.partnersService.getAllPartners();
    return { 
      success: true, 
      data: data.map(p => ({ ...p, type: p.type.toLowerCase() })) 
    };
  }

  @Post()
  async create(@Body() body: CreatePartnerDto) {
    const typeUpper = body.type.toUpperCase() as 'SUPPLIER' | 'CLIENT';
    const partner = await this.partnersService.createPartner(body.name, typeUpper);
    return { 
      success: true, 
      data: { ...partner, type: partner.type.toLowerCase() } 
    };
  }

  @Put(':id/config')
  async updateConfig(@Param('id') id: string, @Body() body: UpdateConfigDto) {
    const partner = await this.partnersService.updateConfig(id, body.importConfig);
    return {
      success: true,
      data: { ...partner, type: partner.type.toLowerCase() }
    }
  }
}


