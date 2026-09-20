import { CardBrand as SharedCardBrand } from '@valletcontrol/shared';
import type { CardBrand as SharedCardBrandType } from '@valletcontrol/shared';
import { $Enums } from '../../../generated/prisma/client';

export type DbCardBrand = $Enums.CardBrand;

/**
 * Bandeira compartilhada (`nubank`) → enum do banco (Prisma `NUBANK`).
 * O fallback `OTHERS` evita que um valor desconhecido quebre a escrita.
 */
const SHARED_TO_DB: Record<SharedCardBrandType, DbCardBrand> = {
  [SharedCardBrand.NUBANK]: $Enums.CardBrand.NUBANK,
  [SharedCardBrand.ITAUCARD]: $Enums.CardBrand.ITAUCARD,
  [SharedCardBrand.OTHERS]: $Enums.CardBrand.OTHERS,
};

const DB_TO_SHARED: Record<DbCardBrand, SharedCardBrandType> = {
  [$Enums.CardBrand.NUBANK]: SharedCardBrand.NUBANK,
  [$Enums.CardBrand.ITAUCARD]: SharedCardBrand.ITAUCARD,
  [$Enums.CardBrand.OTHERS]: SharedCardBrand.OTHERS,
};

export const CardBrandMapper = {
  toDb(brand: SharedCardBrandType): DbCardBrand {
    return SHARED_TO_DB[brand] ?? $Enums.CardBrand.OTHERS;
  },
  toShared(brand: DbCardBrand): SharedCardBrandType {
    return DB_TO_SHARED[brand] ?? SharedCardBrand.OTHERS;
  },
};
