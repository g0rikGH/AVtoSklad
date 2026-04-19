import { IsEnum, IsUUID, IsNumber, IsArray, ValidateNested, ArrayMinSize, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class DocumentRowDto {
  @IsUUID('4', { message: 'productId должен быть валидным UUID' })
  productId: string;

  @IsNumber()
  @Min(1, { message: 'Количество должно быть больше 0' })
  qty: number;

  @IsNumber()
  @Min(0, { message: 'Цена не может быть отрицательной' })
  price: number;
}

export class CreateDocumentDto {
  @IsEnum(['INCOME', 'EXPENSE'], { message: "Тип документа должен быть 'INCOME' или 'EXPENSE'" })
  type: string;

  @IsUUID('4', { message: 'partnerId должен быть валидным UUID' })
  partnerId: string;

  name?: string;

  @IsNumber()
  @Min(0, { message: 'totalAmount не может быть отрицательной суммой' })
  totalAmount: number;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'В документе должна быть хотя бы одна строка (товар)' })
  @Type(() => DocumentRowDto)
  rows: DocumentRowDto[];
}
