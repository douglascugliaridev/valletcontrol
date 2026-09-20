/**
 * Value Object dinheiro brasileiro. Armazena valor em centavos (inteiro)
 * para evitar erros de ponto flutuante em operações financeiras.
 * Totalmente puro — sem dependências externas.
 */

export const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

/**
 * Converte um valor em reais para centavos inteiros.
 * Ex.: 12.34 -> 1234
 */
export function toCents(reais: number): number {
  return Math.round(reais * 100);
}

/**
 * Converte centavos para reais (número).
 * Ex.: 1234 -> 12.34
 */
export function toReais(cents: number): number {
  return cents / 100;
}

/**
 * Formata centavos como moeda pt-BR (R$ 1.234,56).
 */
export function formatCentsAsBRL(cents: number): string {
  return BRL_FORMATTER.format(toReais(cents));
}

/** Value object imutável para valores monetários. */
export class Money {
  /** Valor em centavos, sempre inteiro. */
  readonly cents: number;

  private constructor(cents: number) {
    this.cents = cents;
  }

  static fromCents(cents: number): Money {
    if (!Number.isSafeInteger(cents)) {
      throw new RangeError(`Money deve ser um inteiro de centavos válido. Recebido: ${cents}`);
    }
    return new Money(cents);
  }

  static fromReais(reais: number): Money {
    if (!Number.isFinite(reais)) {
      throw new RangeError(`Money inválido: ${reais}`);
    }
    return new Money(toCents(reais));
  }

  static zero(): Money {
    return new Money(0);
  }

  add(other: Money): Money {
    return new Money(this.cents + other.cents);
  }

  subtract(other: Money): Money {
    return new Money(this.cents - other.cents);
  }

  isPositive(): boolean {
    return this.cents > 0;
  }

  isNegative(): boolean {
    return this.cents < 0;
  }

  isZero(): boolean {
    return this.cents === 0;
  }

  toString(): string {
    return formatCentsAsBRL(this.cents);
  }
}
