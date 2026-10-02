import type {
  Month,
  Transaction,
  TransactionInput,
  TransactionQuery,
  TransactionUpdate,
} from '@walletcontrol/shared';

/**
 * Port (driven adapter) de persistência de transações.
 *
 * PONTO DE ATENÇÃO CORRIGIDO — RLS/isolamento de dados:
 * TODOS os métodos exigem `ownerId` (usuário autenticado) e toda
 * consulta é escopada por ele. Nenhum dado de outro usuário é legível
 * ou alterável, mesmo que o id seja "adivinhado".
 */
export abstract class TransactionRepositoryPort {
  abstract findAllByOwner(ownerId: string, query: TransactionQuery): Promise<Transaction[]>;

  abstract findByIdAndOwner(id: string, ownerId: string): Promise<Transaction | null>;

  abstract createMany(ownerId: string, items: TransactionInput[]): Promise<Transaction[]>;

  abstract updateByIdAndOwner(
    id: string,
    ownerId: string,
    patch: TransactionUpdate,
  ): Promise<Transaction>;

  abstract deleteByIdAndOwner(id: string, ownerId: string): Promise<void>;

  /**
   * Atualiza todas as transações de um grupo de parcelas (escopado por dono).
   * Retorna a quantidade de linhas alteradas.
   */
  abstract updateManyByInstallmentGroupAndOwner(
    groupId: string,
    ownerId: string,
    patch: TransactionUpdate,
  ): Promise<number>;

  /**
   * Exclui todas as transações de um grupo de parcelas (escopado por dono).
   * Retorna a quantidade de linhas excluídas.
   */
  abstract deleteManyByInstallmentGroupAndOwner(groupId: string, ownerId: string): Promise<number>;

  /**
   * Transações de um grupo de conta fixa a partir de (year, month), inclusive
   * (escopado por dono). É o "escopo à frente" das contas fixas: o mês de
   * referência entra e os anteriores ficam de fora.
   */
  abstract findManyByRecurringRuleFrom(
    ruleId: string,
    ownerId: string,
    fromYear: number,
    fromMonth: Month,
  ): Promise<Transaction[]>;

  /** Quantas transações o grupo tem ao todo, sem filtro de mês. */
  abstract countTransactionsOfRule(ruleId: string, ownerId: string): Promise<number>;

  /**
   * Primeira transação **não paga** do grupo, em ordem cronológica (menor ano/mês).
   * Define o ponto de corte ao cancelar um grupo: o que vem antes é passado e fica.
   */
  abstract findFirstUnpaidByRecurringRule(
    ruleId: string,
    ownerId: string,
  ): Promise<Transaction | null>;

  /**
   * Atualiza em bloco as transações do grupo a partir de (year, month).
   *
   * `protectPaid` é a salvaguarda de negócio, não um detalhe de implementação: reescrever
   * em lote o valor/descrição de lançamentos **já pagos** falsifica um pagamento que
   * aconteceu. Por isso o use case liga a proteção sempre que o patch mexe nos atributos
   * da conta, e desliga só quando o patch é exclusivamente sobre o estado de pagamento
   * (marcar os meses à frente como pagos precisa, claro, alcançar as linhas não pagas).
   */
  abstract updateManyByRecurringRuleFrom(
    ruleId: string,
    ownerId: string,
    fromYear: number,
    fromMonth: Month,
    patch: TransactionUpdate,
    opts?: { protectPaid?: boolean },
  ): Promise<number>;

  /**
   * Exclui do grupo apenas as transações **não pagas** a partir de (year, month).
   *
   * `isPaid: false` no filtro é a garantia de que apagar um grupo nunca destrói um
   * pagamento já feito — o que importa porque as transações materializadas são dado real.
   * Vale para o escopo ("deste mês em diante") e para o cancelamento da conta inteira.
   */
  abstract deleteManyUnpaidByRecurringRuleFrom(
    ruleId: string,
    ownerId: string,
    fromYear: number,
    fromMonth: Month,
  ): Promise<number>;

  /**
   * Quantas transações **pagas** o grupo tem a partir de (year, month). Serve para
   * dizer ao usuário quantos pagamentos o escopo protegeu, em vez de deixar ele
   *achelar que a operação foi parcial por defeito.
   */
  abstract countPaidByRecurringRuleFrom(
    ruleId: string,
    ownerId: string,
    fromYear: number,
    fromMonth: Month,
  ): Promise<number>;
}
