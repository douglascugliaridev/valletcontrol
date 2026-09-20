import type {
  Category as SharedCategory,
  TransactionType as SharedType,
} from '@valletcontrol/shared';
import { $Enums } from '../../../generated/prisma/client';

export type DbType = $Enums.TransactionType;
export type DbCategory = $Enums.Category;

const TYPE_TO_DB: Record<SharedType, DbType> = {
  receita: $Enums.TransactionType.RECEITA,
  despesa: $Enums.TransactionType.DESPESA,
  devedor: $Enums.TransactionType.DEVEDOR,
};

const DB_TO_TYPE: Record<DbType, SharedType> = {
  [$Enums.TransactionType.RECEITA]: 'receita',
  [$Enums.TransactionType.DESPESA]: 'despesa',
  [$Enums.TransactionType.DEVEDOR]: 'devedor',
};

const CATEGORY_TO_DB: Record<SharedCategory, DbCategory> = {
  contas_fixas: $Enums.Category.CONTAS_FIXAS,
  outros: $Enums.Category.OUTROS,
  receita: $Enums.Category.RECEITA,
  devedores: $Enums.Category.DEVEDORES,
};

const DB_TO_CATEGORY: Record<DbCategory, SharedCategory> = {
  [$Enums.Category.CONTAS_FIXAS]: 'contas_fixas',
  [$Enums.Category.OUTROS]: 'outros',
  [$Enums.Category.RECEITA]: 'receita',
  [$Enums.Category.DEVEDORES]: 'devedores',
};

/** Lookup que preserva tipagem sob `noUncheckedIndexedAccess`. */
function lookup<T, K extends keyof T>(record: T, key: K): T[K] {
  return record[key];
}

/**
 * Adapter de mapeamento entre os enum do domínio compartilhado e
 * os enum persistidos no banco (maiúsculas). Espelha o enum-mapper
 * do módulo de transações — os tipos/categorias são os mesmos.
 */
export const EnumMapper = {
  toDbType(type: SharedType): DbType {
    return lookup(TYPE_TO_DB, type);
  },
  toSharedType(type: DbType): SharedType {
    return lookup(DB_TO_TYPE, type);
  },
  toDbCategory(category: SharedCategory): DbCategory {
    return lookup(CATEGORY_TO_DB, category);
  },
  toSharedCategory(category: DbCategory): SharedCategory {
    return lookup(DB_TO_CATEGORY, category);
  },
};
