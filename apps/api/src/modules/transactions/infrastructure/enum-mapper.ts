import type {
  Category as SharedCategory,
  PaymentMethod as SharedPaymentMethod,
  TransactionType as SharedType,
} from '@valletcontrol/shared';
import { $Enums } from '../../../generated/prisma/client';

export type DbType = $Enums.TransactionType;
export type DbCategory = $Enums.Category;
export type DbPaymentMethod = $Enums.PaymentMethod;

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

const METHOD_TO_DB: Record<SharedPaymentMethod, DbPaymentMethod> = {
  nubank: $Enums.PaymentMethod.NUBANK,
  itaucard: $Enums.PaymentMethod.ITAUCARD,
};

const DB_TO_METHOD: Record<DbPaymentMethod, SharedPaymentMethod> = {
  [$Enums.PaymentMethod.NUBANK]: 'nubank',
  [$Enums.PaymentMethod.ITAUCARD]: 'itaucard',
};

/** Lookup que preserva tipagem sob `noUncheckedIndexedAccess`. */
function lookup<T, K extends keyof T>(record: T, key: K): T[K] {
  return record[key];
}

/**
 * Adapter de mapeamento entre os enum do domínio compartilhado e
 * os enum persistidos no banco (maiúsculas). Concentra a nomenclatura
 * de armazenamento longe das regras de negócio.
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
  toDbMethod(method: SharedPaymentMethod): DbPaymentMethod {
    return lookup(METHOD_TO_DB, method);
  },
  toSharedMethod(method: DbPaymentMethod): SharedPaymentMethod {
    return lookup(DB_TO_METHOD, method);
  },
};
