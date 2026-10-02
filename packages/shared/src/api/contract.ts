import type { Transaction, TransactionQuery, TransactionUpdate } from '../domain/transaction';
import type { AuthResponse, User } from '../domain/user';
import type { RecurringRule } from '../domain/recurring-rule';

/**
 * Contrato de API compartilhado entre web/mobile e backend.
 * Base URL: `{NEXT_PUBLIC_API_URL}` (ex.: http://localhost:3001/api).
 */

export interface ApiSuccess<T> {
  data: T;
}

/** Paginação padrão da API. */
export interface PageMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface PagedResponse<T> {
  items: T[];
  meta: PageMeta;
}

/** Resposta de listagem mensal com resumo embutido (evita round-trips). */
export interface MonthlyReport {
  month: TransactionQuery['month'];
  year: TransactionQuery['year'];
  transactions: Transaction[];
  summary: {
    totalIncomeCents: number;
    totalExpenseCents: number;
    balanceCents: number;
    totalDebtorsCents: number;
    paidDebtorsCents: number;
    unpaidDebtorsCents: number;
  };
}

export interface GetMonthlyReportParams {
  month: TransactionQuery['month'];
  year: number;
  search?: string;
  type?: TransactionQuery['type'];
  category?: TransactionQuery['category'];
  isPaid?: boolean;
}

export interface AuthApi {
  login(credentials: { email: string; password: string }): Promise<AuthResponse>;
  register(newUser: { name: string; email: string; password: string }): Promise<AuthResponse>;
  me(): Promise<User>;
}

export interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  /** Código estável de erro (ex.: PAYMENT_METHOD_REQUIRED) — presente em falhas de domínio. */
  domainCode?: string;
}

export interface TransactionCreatedResponse {
  /** Transações criadas (1 para simples, N para recorrência). */
  transactions: Transaction[];
}

export interface CreateTransactionPayload {
  description: string;
  amountCents: number;
  category: Transaction['category'];
  type: Transaction['type'];
  paymentMethod: Transaction['paymentMethod'];
  cardId: Transaction['cardId'];
  dueDate: Transaction['dueDate'];
  month: Transaction['month'];
  year: number;
  /** Recorrência opcional — expandida em N transações com prefixo "i/N". */
  recurrence?: { installments: number; startFrom?: number };
  isPaid?: boolean;
}

/** Semente de uma conta fixa: cria o grupo e materializa N meses. */
export interface MaterializeRecurringRulePayload {
  description: string;
  amountCents: number;
  type: Transaction['type'];
  category: Transaction['category'];
  cardId?: Transaction['cardId'];
  dueDate: Transaction['dueDate'];
  month: Transaction['month'];
  year: number;
  isPaid?: boolean;
  /** Total de meses, contando o mês de referência. Ausente = 1 (só este mês). */
  months?: number;
}

/** Patch aplicado a um grupo de contas fixas a partir de um mês de referência. */
export interface RecurringRuleScopePayload extends TransactionUpdate {
  fromMonth: Transaction['month'];
  fromYear: number;
}

export interface MaterializeRecurringRuleResponse {
  rule: RecurringRule;
  transactions: Transaction[];
}

export interface RecurringRuleScopeResponse {
  rule: RecurringRule;
  changed: number;
  /** Lançamentos já pagos no escopo, preservados porque pagamento não se reescreve em bloco. */
  keptPaid: number;
}

export interface RecurringRuleScopeDeleteResponse {
  deleted: number;
  /** Lançamentos já pagos no escopo, preservados: apagar conta nunca destrói pagamento. */
  keptPaid: number;
  ruleRemoved: boolean;
}
