import { Injectable } from '@nestjs/common';
import type {
  CardBrand,
  Month,
  RecurringRule,
  Transaction,
  TransactionCreatedResponse,
} from '@walletcontrol/shared';
import {
  addMonths,
  validateCardPaymentConsistency,
  validateTransactionInput,
} from '@walletcontrol/shared';
import { NotFoundError } from '../../../../common/errors/app-errors';
import { CardRepositoryPort } from '../../../cards/application/ports/card-repository.port';
import { TransactionRepositoryPort } from '../../../transactions/application/ports/transaction-repository.port';
import { RecurringRuleRepositoryPort } from '../ports/recurring-rule-repository.port';

export interface MaterializeRecurringRuleInput {
  ownerId: string;
  /** Semente da recorrência — vira o mês de referência e o modelo das cópias. */
  seed: {
    description: string;
    amountCents: number;
    type: Transaction['type'];
    category: Transaction['category'];
    cardId?: string | null;
    dueDate: string | null;
    month: Month;
    year: number;
    isPaid?: boolean;
  };
  /** Meses totais do grupo, contados com o mês de referência. `1` = só este mês. */
  months: number;
}

export interface MaterializeRecurringRuleResponse extends TransactionCreatedResponse {
  rule: RecurringRule;
}

/**
 * Use case: cria uma conta fixa materializando N transações reais.
 *
 * Cada mês da recorrência vira uma transação de verdade, todas ligadas por
 * `recurringRuleId`. É isso que faz editar/excluir/marcar pago funcionarem sem
 * tratamento especial, e mantém o relatório mensal como consulta pura — sem linha
 * sintética, sem soma duplicada.
 */
@Injectable()
export class MaterializeRecurringRuleUseCase {
  constructor(
    private readonly rules: RecurringRuleRepositoryPort,
    private readonly transactions: TransactionRepositoryPort,
    private readonly cards: CardRepositoryPort,
  ) {}

  async execute(input: MaterializeRecurringRuleInput): Promise<MaterializeRecurringRuleResponse> {
    const { seed, ownerId } = input;
    const card = seed.cardId ? await this.resolveCard(seed.cardId, ownerId) : null;

    if (card) {
      validateCardPaymentConsistency({
        paymentMethod: null,
        cardBrand: card.brand as CardBrand,
      });
    }

    // Os lançamentos são montados e validados ANTES de qualquer escrita. A ordem
    // importa: validando só depois de `rules.create`, uma semente inválida
    // (categoria incoerente com o tipo, por exemplo) deixava a regra gravada e o
    // grupo aparecia na tela com "0 lançamentos" — lixo que o usuário não criou.
    const description = seed.description.trim();
    const category = seed.category ?? 'contas_fixas';
    const drafts: Transaction[] = [];
    for (let offset = 0; offset < input.months; offset += 1) {
      const { month, year } = addMonths(seed.month, seed.year, offset);
      const draft: Transaction = {
        id: '',
        ownerId,
        description,
        amountCents: seed.amountCents,
        type: seed.type,
        category,
        paymentMethod: null,
        cardId: seed.cardId ?? null,
        dueDate: seed.dueDate,
        month,
        year,
        // Só o mês de referência herda o "pago" que o usuário marcou; os outros
        // começam pendentes, porque ainda não foram pagos.
        isPaid: offset === 0 ? (seed.isPaid ?? false) : false,
        recurringRuleId: null,
        createdAt: '',
        updatedAt: '',
      };
      validateTransactionInput(draft);
      drafts.push(draft);
    }

    const rule = await this.rules.create(ownerId, {
      description,
      amountCents: seed.amountCents,
      type: seed.type,
      category,
      startMonth: seed.month,
      startYear: seed.year,
      monthsAhead: input.months,
      isActive: true,
    });

    const items = drafts.map((draft) => ({
      ...draft,
      recurringRuleId: rule.id,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
    }));

    let created: Transaction[];
    try {
      created = await this.transactions.createMany(ownerId, items);
    } catch (err) {
      // Rede de segurança: se a gravação falhar, a regra sozinha na tela seria um
      // grupo que não existe. Devolve o estado anterior em vez de deixar o resto.
      await this.rules.deleteByIdAndOwner(rule.id, ownerId);
      throw err;
    }

    return {
      rule,
      transactions: [...created].sort((a, b) =>
        a.year !== b.year ? a.year - b.year : a.month - b.month,
      ),
    };
  }

  private async resolveCard(cardId: string, ownerId: string) {
    const card = await this.cards.findByIdAndOwner(cardId, ownerId);
    if (!card) {
      throw new NotFoundError('Cartão não encontrado.');
    }
    return card;
  }
}
