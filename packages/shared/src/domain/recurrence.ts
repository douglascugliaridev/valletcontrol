import type { Month } from './enums';
import { MONTH_NAMES_LONG } from './enums';

/** Instância (mês/ano) de uma parcela de recorrência. */
export interface RecurrenceInstance {
  month: Month;
  year: number;
  /** Número da parcela, começando em 1. */
  installment: number;
}

/** Parâmetros para gerar uma recorrência mensal. */
export interface RecurrenceConfig {
  startMonth: Month;
  startYear: number;
  installments: number;
  /** Parcela inicial a gerar. Padrão 1 (começa do início). */
  startFrom?: number;
}

/** Mês seguinte com virada de ano automática. */
export function addMonths(
  month: Month,
  year: number,
  amount: number,
): { month: Month; year: number } {
  const total = year * 12 + (month - 1) + amount;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return { month: nextMonth as Month, year: nextYear };
}

/**
 * Expande uma recorrência mensal em N instâncias (meses), com virada
 * de ano automática. Pura e determinística.
 * `startFrom` permite começar de uma parcela intermediária: ex.
 * `{ installments: 12, startFrom: 4 }` gera 4/12 a 12/12 (9 instâncias),
 * com a primeira caindo em startMonth/startYear.
 */
export function expandRecurrence(config: RecurrenceConfig): RecurrenceInstance[] {
  if (!Number.isInteger(config.installments) || config.installments < 1) {
    throw new RangeError(`Quantidade de parcelas inválida: ${config.installments}. Mínimo 1.`);
  }

  const startFrom = config.startFrom ?? 1;
  if (!Number.isInteger(startFrom) || startFrom < 1) {
    throw new RangeError(`Parcela inicial inválida: ${startFrom}. Mínimo 1.`);
  }
  if (startFrom > config.installments) {
    throw new RangeError(
      `Parcela inicial (${startFrom}) não pode ser maior que o total de parcelas (${config.installments}).`,
    );
  }

  const count = config.installments - startFrom + 1;
  const instances: RecurrenceInstance[] = [];
  for (let i = 0; i < count; i++) {
    const installment = startFrom + i;
    const { month, year } = addMonths(config.startMonth, config.startYear, i);
    instances.push({ month, year, installment });
  }
  return instances;
}

/** Label legível de um mês/ano: "Setembro 2026". */
export function formatMonthYear(month: Month, year: number): string {
  return `${MONTH_NAMES_LONG[month - 1]} ${year}`;
}
