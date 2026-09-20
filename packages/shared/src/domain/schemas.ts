import { z } from 'zod';
import {
  Category,
  CATEGORIES,
  PAYMENT_METHODS,
  PaymentMethod,
  TRANSACTION_TYPES,
  TransactionType,
} from './enums';
import { buildInstallmentDescription } from './rules';

/** Mês de 1 a 12. */
export const monthSchema = z
  .number()
  .int('Mês deve ser um inteiro')
  .min(1, 'Mês deve estar entre 1 e 12')
  .max(12, 'Mês deve estar entre 1 e 12');

/** Ano razoável para o domínio. */
export const yearSchema = z.number().int().min(2000).max(2200);

/** Valor em centavos (inteiro positivo). */
export const amountCentsSchema = z
  .number()
  .int('Valor deve estar em centavos inteiros')
  .positive('Valor deve ser maior que zero');

export const dueDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar no formato yyyy-mm-dd')
  .nullable()
  .optional();

/**
 * Schema de criação/edição de transação.
 * Reflete as regras puras de domínio (payment_method restrito a devedores
 * e bucket de despesa: categoria fixa OU cartão, nunca ambos).
 */
export const transactionInputSchema = z
  .object({
    description: z.string().trim().min(1, 'Descrição é obrigatória').max(200),
    amountCents: amountCentsSchema,
    category: z.enum(CATEGORIES).nullable(),
    type: z.enum(TRANSACTION_TYPES),
    paymentMethod: z.enum(PAYMENT_METHODS).nullable().default(null).optional(),
    cardId: z.string().nullable().default(null).optional(),
    dueDate: dueDateSchema,
    month: monthSchema,
    year: yearSchema,
    isPaid: z.boolean().optional().default(false),
  })
  .superRefine((value, ctx) => {
    const isDebtor = value.type === TransactionType.DEBTOR;
    const isExpense = value.type === TransactionType.EXPENSE;
    if (isDebtor && !value.paymentMethod) {
      ctx.addIssue({
        code: 'custom',
        path: ['paymentMethod'],
        message: 'Transações do tipo "devedor" exigem um método de pagamento (cartão).',
      });
    }
    if (!isDebtor && value.paymentMethod) {
      ctx.addIssue({
        code: 'custom',
        path: ['paymentMethod'],
        message: 'Método de pagamento só é permitido para transações do tipo "devedor".',
      });
    }
    if (isDebtor && value.category === Category.INCOME) {
      ctx.addIssue({
        code: 'custom',
        path: ['category'],
        message: 'Categoria inconsistente com o tipo "devedor".',
      });
    }
    if (isExpense) {
      const hasCategory = value.category != null;
      const hasCard = Boolean(value.cardId);
      if (hasCategory && hasCard) {
        ctx.addIssue({
          code: 'custom',
          path: ['category'],
          message: 'Escolha uma categoria fixa OU um cartão para essa despesa.',
        });
      }
      if (!hasCategory && !hasCard) {
        ctx.addIssue({
          code: 'custom',
          path: ['category'],
          message: 'Informe uma categoria fixa ou um cartão para essa despesa.',
        });
      }
    }
  });

export type TransactionInputSchema = z.infer<typeof transactionInputSchema>;

/** Schema de recorrência mensal (parcelamento). */
export const recurrenceSchema = z
  .object({
    startMonth: monthSchema,
    startYear: yearSchema,
    installments: z.number().int('Quantidade de parcelas deve ser inteiro').min(1).max(240),
    startFrom: z.number().int('Parcela inicial deve ser inteiro').min(1).max(240).default(1),
  })
  .superRefine((value, ctx) => {
    if (value.startFrom > value.installments) {
      ctx.addIssue({
        code: 'custom',
        path: ['startFrom'],
        message: 'Parcela inicial não pode ser maior que o total de parcelas.',
      });
    }
  })
  .default({ startMonth: 1, startYear: 2000, installments: 1, startFrom: 1 });

export type RecurrenceSchema = z.infer<typeof recurrenceSchema>;

/**
 * Aplica recorrência gerando descrições como "1/12 Pizzaria".
 * Reutilizada no frontend (preview) e no backend (persistência).
 */
export function applyInstallmentPrefix(
  baseDescription: string,
  installment: number,
  total: number,
): string {
  return buildInstallmentDescription(baseDescription, installment, total);
}

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(80),
  email: z.string().trim().email('Email inválido').max(160),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres').max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Email inválido').max(160),
  password: z.string().min(1, 'Senha é obrigatória').max(128),
});

export type RegisterSchema = z.infer<typeof registerSchema>;
export type LoginSchema = z.infer<typeof loginSchema>;

export { PaymentMethod };
