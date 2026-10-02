import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';
import { CATEGORIES, TRANSACTION_TYPES } from '@walletcontrol/shared';
import type { Category, TransactionType } from '@walletcontrol/shared';

const enumIsIn = (values: readonly string[]) =>
  IsIn(values, { message: `Valor inválido. Permitidos: ${values.join(', ')}.` });

/** Vazio (campo não preenchido) vira `null` = transação simples, sem recorrência. */
function toOptionalMonths({ value }: { value: unknown }): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return typeof value === 'number' ? value : Number(value);
}

/**
 * Semente de uma conta fixa criada pela tela de transações.
 *
 * `months` é a quantidade total de meses do grupo, **contando o mês de referência**.
 * Ausente ou `null` cria uma transação comum, sem grupo.
 */
export class MaterializeRecurringRuleDto {
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
  @IsInt({ message: 'Mês deve ser inteiro.' })
  @Min(1, { message: 'Mês deve estar entre 1 e 12.' })
  @Max(12, { message: 'Mês deve estar entre 1 e 12.' })
  month!: number;

  @Type(() => Number)
  @IsInt({ message: 'Ano deve ser inteiro.' })
  @Min(2000, { message: 'Ano inválido.' })
  @Max(2200, { message: 'Ano inválido.' })
  year!: number;

  @IsOptional()
  @IsString({ message: 'Cartão deve ser um id.' })
  cardId?: string;

  @IsOptional()
  @IsString({ message: 'Vencimento deve ser uma data ISO (yyyy-mm-dd).' })
  dueDate?: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'isPaid deve ser booleano.' })
  @IsOptional()
  isPaid?: boolean;

  @Transform(toOptionalMonths)
  @IsOptional()
  @IsInt({ message: 'Quantidade de meses deve ser um número inteiro.' })
  @Min(1, { message: 'Quantidade de meses mínima: 1.' })
  @Max(600, { message: 'Quantidade de meses máxima: 600.' })
  months?: number | null;
}

/** Patch aplicado a um grupo de conta fixa a partir de um mês de referência. */
export class RecurringRuleScopeDto {
  @Type(() => Number)
  @IsInt({ message: 'Mês de referência deve ser inteiro.' })
  @Min(1, { message: 'Mês deve estar entre 1 e 12.' })
  @Max(12, { message: 'Mês deve estar entre 1 e 12.' })
  fromMonth!: number;

  @Type(() => Number)
  @IsInt({ message: 'Ano de referência deve ser inteiro.' })
  @Min(2000, { message: 'Ano inválido.' })
  @Max(2200, { message: 'Ano inválido.' })
  fromYear!: number;

  @IsOptional()
  @IsString({ message: 'Descrição deve ser texto.' })
  description?: string;

  @IsOptional()
  @IsInt({ message: 'Valor deve estar em centavos (inteiro).' })
  @Min(1, { message: 'Valor deve ser maior que zero.' })
  amountCents?: number;

  @IsOptional()
  @enumIsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  @IsOptional()
  @enumIsIn(CATEGORIES)
  category?: Category;

  @IsOptional()
  @IsString({ message: 'Cartão deve ser um id.' })
  cardId?: string;

  @IsOptional()
  @IsString({ message: 'Vencimento deve ser uma data ISO (yyyy-mm-dd).' })
  dueDate?: string;

  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean({ message: 'isPaid deve ser booleano.' })
  @IsOptional()
  isPaid?: boolean;
}

/** Corpo de `POST /recurring-rules/:id/extend`. */
export class ExtendRecurringRuleDto {
  @Type(() => Number)
  @IsInt({ message: 'Quantidade de meses deve ser um número inteiro.' })
  @Min(1, { message: 'Quantidade de meses mínima: 1.' })
  @Max(600, { message: 'Quantidade de meses máxima: 600.' })
  months!: number;
}
