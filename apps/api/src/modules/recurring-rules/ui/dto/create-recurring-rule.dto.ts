import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CATEGORIES, MAX_MONTHS_AHEAD, TRANSACTION_TYPES } from '@walletcontrol/shared';
import type { Category, TransactionType } from '@walletcontrol/shared';

/** `''` (campo vazio do form) e `null` viram `null` = regra sem prazo. */
export function toMonthsAhead({ value }: { value: unknown }): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return typeof value === 'number' ? value : Number(value);
}

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

  /** Horizonte da regra. Ausente ou `null` = sem prazo (comportamento padrão). */
  @Transform(toMonthsAhead)
  @IsOptional()
  @IsInt({ message: 'Meses à frente deve ser um número inteiro.' })
  @Min(1, { message: 'Meses à frente mínima: 1.' })
  @Max(MAX_MONTHS_AHEAD, { message: `Meses à frente máxima: ${MAX_MONTHS_AHEAD}.` })
  monthsAhead?: number | null;

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
