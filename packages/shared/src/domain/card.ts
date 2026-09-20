import { PaymentMethod as PaymentMethodValue } from './enums';
import type { PaymentMethod } from './enums';

/**
 * Bandeira do cartão — mantida aqui (const + type) para não duplicar com
 * o enum PaymentMethod do domínio (PaymentMethod) nem com o enum de categoria.
 */
export const CardBrand = {
  NUBANK: 'nubank',
  ITAUCARD: 'itaucard',
  OTHERS: 'outros',
} as const;

export type CardBrand = (typeof CardBrand)[keyof typeof CardBrand];

export const CARD_BRANDS: readonly CardBrand[] = Object.values(CardBrand);

export const CARD_BRAND_LABELS: Readonly<Record<CardBrand, string>> = {
  [CardBrand.NUBANK]: 'Nubank',
  [CardBrand.ITAUCARD]: 'Itaucard',
  [CardBrand.OTHERS]: 'Outros',
};

/**
 * Cartão configurado pelo usuário, usado como etiqueta na transação (cardId)
 * e para pré-selecionar o método de pagamento correspondente no formulário.
 */
export interface Card {
  id: string;
  ownerId: string;
  /** Apelido exibível, ex.: "Meu Nubank". */
  name: string;
  brand: CardBrand;
  /** Últimos 4 dígitos, apenas para exibição ("•• 1234"). */
  last4?: string | null;
  /** Cor em hex (opcional) para destaque visual. */
  color?: string | null;
  /** URL da logo do cartão (opcional) para exibição. */
  logoUrl?: string | null;
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CardInput {
  name: string;
  brand: CardBrand;
  last4?: string | null;
  color?: string | null;
  logoUrl?: string | null;
  isDefault?: boolean;
}

export type CardUpdate = Partial<CardInput>;

/** Exibição amigável: "Meu Nubank •• 1234". Sem números longos expostos. */
export function formatCardLabel(card: Pick<Card, 'name' | 'last4'>): string {
  return card.last4 ? `${card.name} •• ${card.last4}` : card.name;
}

/**
 * Converte bandeira do cartão no PaymentMethod correspondente, quando houver.
 * Útil para pré-selecionar o método de pagamento de despesas com cartão.
 */
export function cardToPaymentMethod(brand: CardBrand): PaymentMethod | null {
  switch (brand) {
    case CardBrand.NUBANK:
      return PaymentMethodValue.NUBANK;
    case CardBrand.ITAUCARD:
      return PaymentMethodValue.ITAUCARD;
    default:
      return null;
  }
}
