import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CATEGORIES, TRANSACTION_TYPES } from '@valletcontrol/shared';
import type { Category, TransactionType } from '@valletcontrol/shared';

const enumIsIn = (values: readonly string[]) =>
  IsIn(values, { message: `Valor inválido. Permitidos: ${values.join(', ')}.` });

export class CreateRecurringRuleDto {
  @IsString({ message: 'Descrição é obrigatória.' })
  @Length(1, 200, { message: 'Descrição deve ter entre 1 e 200 caracteres.' })
  description!: string;

  @IsInt({ message: 'Valor deve estar em centavos (inteiro).' })
  @Min(1, { message: 'Valor deve ser maior que zero.' })
  amountCents!: number;

  @enumIsIn(TRANSACTION_TYPES)
  type!: TransactionType;

  @enumIsIn(CATEGORIES)
  category!: Category;

  @Type(() => Number)
  @IsInt({ message: 'Mês inicial deve ser inteiro.' })
  @Min(1, { message: 'Mês inicial deve estar entre 1 e 12.' })
  @Max(12, { message: 'Mês inicial deve estar entre 1 e 12.' })
  startMonth!: number;

  @Type(() => Number)
  @IsInt({ message: 'Ano inicial deve ser inteiro.' })
  @Min(2000, { message: 'Ano inicial inválido.' })
  @Max(2200, { message: 'Ano inicial inválido.' })
  startYear!: number;

  @Transform(toBool)
  @IsBoolean({ message: 'isActive deve ser booleano.' })
  @IsOptional()
  isActive?: boolean;
}

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return value === 'true' || value === true;
}
