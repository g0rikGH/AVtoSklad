import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Некорректный формат email' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Пароль не может быть пустым' })
  password: string;
}
