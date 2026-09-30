import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CATEGORIES, MAX_MONTHS_AHEAD, TRANSACTION_TYPES } from '@walletcontrol/shared';
import type { Category, TransactionType } from '@walletcontrol/shared';
import { toMonthsAhead } from './create-recurring-rule.dto';

const enumIsIn = (values: readonly string[]) =>
  IsIn(values, { message: `Valor inválido. Permitidos: ${values.join(', ')}.` });

export class UpdateRecurringRuleDto {
  @IsOptional()
  @IsString({ message: 'Descrição deve ser texto.' })
  @Length(1, 200)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Valor deve ser maior que zero.' })
  amountCents?: number;

  @IsOptional()
  @enumIsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  @IsOptional()
  @enumIsIn(CATEGORIES)
  category?: Category;

  /** `null` volta a regra para "sem prazo". */
  @Transform(toMonthsAhead)
  @IsOptional()
  @IsInt({ message: 'Meses à frente deve ser um número inteiro.' })
  @Min(1, { message: 'Meses à frente mínima: 1.' })
  @Max(MAX_MONTHS_AHEAD, { message: `Meses à frente máxima: ${MAX_MONTHS_AHEAD}.` })
  monthsAhead?: number | null;

  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return value === 'true' || value === true;
}
