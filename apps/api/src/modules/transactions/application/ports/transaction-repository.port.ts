import type {
  Transaction,
  TransactionInput,
  TransactionQuery,
  TransactionUpdate,
} from '@valletcontrol/shared';

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
  abstract deleteManyByInstallmentGroupAndOwner(
    groupId: string,
    ownerId: string,
  ): Promise<number>;
}
