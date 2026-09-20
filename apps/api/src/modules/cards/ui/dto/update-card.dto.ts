import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { CARD_BRANDS, CardBrand } from '@valletcontrol/shared';

export class UpdateCardDto {
  @IsOptional()
  @IsString()
  @Length(1, 60)
  name?: string;

  @IsOptional()
  @IsEnum(CardBrand)
  @IsIn(CARD_BRANDS)
  brand?: CardBrand;

  @ValidateIf((dto: UpdateCardDto) => dto.last4 != null)
  @IsOptional()
  @Matches(/^\d{4}$/, { message: 'Últimos 4 dígitos devem conter 4 números.' })
  last4?: string | null;

  @ValidateIf((dto: UpdateCardDto) => dto.color != null)
  @IsOptional()
  @Matches(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: 'Cor deve ser hexadecimal.' })
  color?: string | null;

  @ValidateIf((dto: UpdateCardDto) => dto.logoUrl != null)
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
