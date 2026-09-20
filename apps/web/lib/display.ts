import {
  CATEGORIES,
  CATEGORY_TO_TYPE,
  type Category,
  type TransactionType,
} from '@valletcontrol/shared';

export const typeTone: Record<
  TransactionType,
  { badge: 'success' | 'danger' | 'accent'; value: string }
> = {
  receita: { badge: 'success', value: '+ ' },
  despesa: { badge: 'danger', value: '- ' },
  devedor: { badge: 'accent', value: '' },
};

export const categoriesForType = (type: TransactionType): Category[] =>
  CATEGORIES.filter((c) => CATEGORY_TO_TYPE[c] === type);
