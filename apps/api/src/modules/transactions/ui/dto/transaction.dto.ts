import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { CATEGORIES, PAYMENT_METHODS, TRANSACTION_TYPES } from '@valletcontrol/shared';
import type {
  Category,
  Month,
  PaymentMethod,
  TransactionType,
  TransactionUpdate,
} from '@valletcontrol/shared';

const enumIsIn = (values: readonly string[]) =>
  IsIn(values, { message: `Valor inválido. Permitidos: ${values.join(', ')}.` });

/** Garante que a parcela inicial não excede o total de parcelas. */
@ValidatorConstraint({ name: 'startFromWithinInstallments', async: false })
class StartFromWithinInstallments implements ValidatorConstraintInterface {
  validate(value: number | undefined, args: ValidationArguments): boolean {
    if (value === undefined) {
      return true;
    }
    const dto = args.object as RecurrenceDto;
    return dto.installments === undefined || value <= dto.installments;
  }

  defaultMessage(): string {
    return 'Parcela inicial não pode ser maior que o total de parcelas.';
  }
}

export class RecurrenceDto {
  @IsInt({ message: 'Quantidade de parcelas deve ser inteira.' })
  @Min(1, { message: 'Parcelas mínimas: 1.' })
  @Max(240, { message: 'Parcelas máximas: 240.' })
  installments!: number;

  @IsOptional()
  @IsInt({ message: 'Parcela inicial deve ser inteira.' })
  @Min(1, { message: 'Parcela inicial mínima: 1.' })
  @Max(240, { message: 'Parcela inicial máxima: 240.' })
  @Validate(StartFromWithinInstallments)
  startFrom?: number;
}

export class CreateTransactionDto {
  @IsString({ message: 'Descrição é obrigatória.' })
  @Length(1, 200, { message: 'Descrição deve ter entre 1 e 200 caracteres.' })
  description!: string;

  @IsInt({ message: 'Valor deve estar em centavos (inteiro).' })
  @Min(1, { message: 'Valor deve ser maior que zero.' })
  amountCents!: number;

  @IsOptional()
  @enumIsIn(CATEGORIES)
  category?: Category | null;

  @enumIsIn(TRANSACTION_TYPES)
  type!: TransactionType;

  @ValidateIf((dto: CreateTransactionDto) => dto.paymentMethod != null)
  @IsIn(PAYMENT_METHODS, { message: 'Método de pagamento inválido.' })
  paymentMethod?: PaymentMethod | null;

  @IsOptional()
  @IsString({ message: 'Cartão deve ser um id válido.' })
  cardId?: string | null;

  @ValidateIf((dto: CreateTransactionDto) => dto.dueDate != null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Data de vencimento deve estar no formato yyyy-mm-dd.',
  })
  dueDate?: string | null;

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

  @Transform(toBool)
  @IsBoolean({ message: 'isPaid deve ser booleano.' })
  @IsOptional()
  isPaid?: boolean;

  @ValidateNested()
  @Type(() => RecurrenceDto)
  @IsOptional()
  recurrence?: RecurrenceDto;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsString({ message: 'Descrição deve ser texto.' })
  @Length(1, 200)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1, { message: 'Valor deve ser maior que zero.' })
  amountCents?: number;

  @IsOptional()
  @enumIsIn(CATEGORIES)
  category?: Category | null;

  @IsOptional()
  @enumIsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  @ValidateIf((dto: UpdateTransactionDto) => dto.paymentMethod != null)
  @IsIn(PAYMENT_METHODS, { message: 'Método de pagamento inválido.' })
  paymentMethod?: PaymentMethod | null;

  @ValidateIf((dto: UpdateTransactionDto) => dto.dueDate != null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Data de vencimento deve estar no formato yyyy-mm-dd.',
  })
  dueDate?: string | null;

  @IsOptional()
  @IsString({ message: 'Cartão deve ser um id válido.' })
  cardId?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  year?: number;

  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;

  /**
   * Aplica o patch a todas as parcelas do mesmo grupo (série). Campos de
   * mês/ano/status de pagamento permanecem individuais.
   */
  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  applyToAll?: boolean;
}

export class ListMonthlyReportQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  @IsOptional()
  month?: number;

  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2200)
  @IsOptional()
  year?: number;

  @IsOptional()
  @IsString()
  @Length(1, 200)
  search?: string;

  @IsOptional()
  @enumIsIn(TRANSACTION_TYPES)
  type?: TransactionType;

  @IsOptional()
  @enumIsIn(CATEGORIES)
  category?: Category;

  @Transform(toBool)
  @IsBoolean()
  @IsOptional()
  isPaid?: boolean;
}

function toBool({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return value === 'true' || value === true;
}

/**
 * Converte o DTO de update em patch. A guarda usa `!== undefined` (e não
 * `'x' in dto`): com `useDefineForClassFields` o class-transformer cria
 * todos os campos declarados, então `in` sempre retorna true e campos
 * ausentes virariam `null`, zerando cardId/paymentMethod/dueDate em
 * updates parciais (ex.: marcar como pago numa despesa-com-cartão).
 */
export function toTransactionUpdate(dto: UpdateTransactionDto): TransactionUpdate {
  return {
    ...(dto.description !== undefined && { description: dto.description }),
    ...(dto.amountCents !== undefined && { amountCents: dto.amountCents }),
    ...(dto.type !== undefined && { type: dto.type }),
    ...(dto.category !== undefined && { category: dto.category }),
    ...(dto.month !== undefined && { month: dto.month as Month }),
    ...(dto.year !== undefined && { year: dto.year }),
    ...(dto.isPaid !== undefined && { isPaid: dto.isPaid }),
    ...(dto.paymentMethod !== undefined && { paymentMethod: dto.paymentMethod ?? null }),
    ...(dto.cardId !== undefined && { cardId: dto.cardId ?? null }),
    ...(dto.dueDate !== undefined && { dueDate: dto.dueDate ?? null }),
  };
}
