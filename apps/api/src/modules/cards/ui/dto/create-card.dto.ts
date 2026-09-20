import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { CARD_BRANDS, CardBrand } from '@valletcontrol/shared';
import type { CardInput } from '@valletcontrol/shared';

export class CreateCardDto implements CardInput {
  @IsString({ message: 'Nome do cartão é obrigatório.' })
  @Length(1, 60, { message: 'Nome deve ter entre 1 e 60 caracteres.' })
  name!: string;

  @IsEnum(CardBrand, { message: 'Bandeira inválida.' })
  @IsIn(CARD_BRANDS, { message: 'Bandeira inválida. Permitidas: ' + CARD_BRANDS.join(', ') + '.' })
  brand!: CardBrand;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}$/, { message: 'Últimos 4 dígitos devem conter 4 números.' })
  last4?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, {
    message: 'Cor deve ser hexadecimal (ex.: #512DA8).',
  })
  color?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 500, { message: 'Logo deve ter entre 1 e 500 caracteres.' })
  logoUrl?: string | null;

  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return value === 'true' || value === true;
}
