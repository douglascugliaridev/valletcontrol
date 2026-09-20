import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Min } from 'class-validator';
import { CATEGORIES, TRANSACTION_TYPES } from '@valletcontrol/shared';
import type { Category, TransactionType } from '@valletcontrol/shared';

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
