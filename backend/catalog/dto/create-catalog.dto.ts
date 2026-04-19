import { IsString, IsNotEmpty, IsOptional, IsUUID, IsEnum, ValidateIf, Matches } from 'class-validator';

export class CreateReferenceDto {
  @IsString({ message: 'Название должно быть строкой' })
  @IsNotEmpty({ message: 'Название не может быть пустым' })
  name: string;
}

export class CreateProductDto {
  @IsString()
  @IsNotEmpty({ message: 'Артикул обязателен' })
  @Matches(/^[^А-Яа-яЁё]*$/, { message: 'Артикул не должен содержать кириллицу' })
  article: string;

  @IsString()
  @IsNotEmpty({ message: 'Наименование обязательно' })
  name: string;

  @IsOptional()
  @IsUUID('4', { message: 'brandId должен быть валидным UUID' })
  brandId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'locationId должен быть валидным UUID' })
  locationId?: string;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsEnum(['REAL', 'PHANTOM'], { message: 'Тип должен быть REAL или PHANTOM' })
  type: string;

  @ValidateIf(o => o.type === 'PHANTOM')
  @IsNotEmpty({ message: 'parentId обязателен для создания фантома' })
  @IsUUID('4', { message: 'parentId должен быть валидным UUID' })
  parentId?: string;

  @IsOptional()
  @IsEnum(['ACTIVE', 'DRAFT', 'ARCHIVED'], { message: 'Статус должен быть ACTIVE, DRAFT или ARCHIVED' })
  status?: string;
}
