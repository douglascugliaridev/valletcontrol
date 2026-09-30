import type { Category, TransactionType } from '@walletcontrol/shared';

export interface Filters {
  search: string;
  type?: TransactionType;
  category?: Category;
  isPaid?: boolean;
}

export const EMPTY_FILTERS: Filters = {
  search: '',
  type: undefined,
  category: undefined,
  isPaid: undefined,
};
