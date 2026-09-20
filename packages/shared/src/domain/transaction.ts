import type { Category, Month, PaymentMethod, TransactionType } from './enums';

/**
 * Entidade Transação — modelo canônico de domínio.
 * Representa um lançamento financeiro mensal (receita, despesa ou valor a receber).
 */
export interface Transaction {
  id: string;
  /** Id do usuário dono (isolamento multi-tenant via owner). */
  ownerId: string;
  description: string;
  /** Valor em centavos (inteiro positivo). */
  amountCents: number;
  type: TransactionType;
  /**
   * Bucket da transação. Nulo apenas quando o tipo é despesa e o bucket
   * é um cartão (`cardId`) — nesse caso a categoria exibida vem do cartão.
   */
  category: Category | null;
  /** Obrigatório apenas quando type === DEVEDOR. */
  paymentMethod: PaymentMethod | null;
  cardId?: string | null;
  /** Vencimento em formato ISO (yyyy-mm-dd) ou null. */
  dueDate: string | null;
  /** Mês de referência (1-12). */
  month: Month;
  year: number;
  isPaid: boolean;
  createdAt: string;
  updatedAt: string;
  /**
   * Grupo de parcelas (installments) de um mesmo lançamento. Presente apenas
   * quando a transação faz parte de uma série (2+ parcelas) — usada para
   * "editar/excluir todas as parcelas".
   */
  installmentGroupId?: string | null;
}

/** Entrada para criação de transação (sem campos gerenciados pelo sistema). */
export interface TransactionInput {
  description: string;
  amountCents: number;
  type: TransactionType;
  category: Category | null;
  paymentMethod: PaymentMethod | null;
  cardId?: string | null;
  dueDate: string | null;
  month: Month;
  year: number;
  isPaid?: boolean;
  installmentGroupId?: string | null;
}

/** Campos atualizáveis de uma transação (todos opcionais). */
export type TransactionUpdate = Partial<TransactionInput>;

export interface TransactionSummary {
  totalIncomeCents: number;
  totalExpenseCents: number;
  balanceCents: number;
  totalDebtorsCents: number;
  paidDebtorsCents: number;
  unpaidDebtorsCents: number;
}

/** Filtros avançados para listagem mensal. */
export interface TransactionQuery {
  month: Month;
  year: number;
  /** Busca textual na descrição (case-insensitive). */
  search?: string;
  type?: TransactionType;
  category?: Category;
  isPaid?: boolean;
}
