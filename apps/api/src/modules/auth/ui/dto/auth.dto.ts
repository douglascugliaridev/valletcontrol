import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsString({ message: 'Nome é obrigatório.' })
  @Length(2, 80, { message: 'Nome deve ter entre 2 e 80 caracteres.' })
  name!: string;

  @IsEmail({}, { message: 'Email inválido.' })
  @Length(1, 160)
  email!: string;

  @IsString({ message: 'Senha é obrigatória.' })
  @Length(8, 128, { message: 'A senha deve ter no mínimo 8 caracteres.' })
  @Matches(/^(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'A senha deve conter letras e números.',
  })
  password!: string;
}

export class LoginDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Email inválido.' })
  email!: string;

  @IsString({ message: 'Senha é obrigatória.' })
  @Length(1, 128)
  password!: string;
}
