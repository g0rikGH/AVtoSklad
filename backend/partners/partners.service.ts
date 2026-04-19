import { Injectable, Inject } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PartnersService {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async getAllPartners() {
    return this.prisma.partner.findMany({
      orderBy: { name: 'asc' }
    });
  }

  async createPartner(name: string, type: 'SUPPLIER' | 'CLIENT') {
    return this.prisma.partner.create({
      data: {
        name,
        type: type.toUpperCase()
      }
    });
  }

  async updateConfig(id: string, importConfig: string) {
    return this.prisma.partner.update({
      where: { id },
      data: { importConfig }
    });
  }
}
