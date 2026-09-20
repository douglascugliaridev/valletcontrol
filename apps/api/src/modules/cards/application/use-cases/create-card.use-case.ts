import { Injectable } from '@nestjs/common';
import type { Card, CardInput } from '@valletcontrol/shared';
import { CardRepositoryPort } from '../ports/card-repository.port';

export interface CreateCardInput {
  ownerId: string;
  input: CardInput;
}

/**
 * Use case: criação de cartão de crédito do usuário.
 * O cartão nasce SEM `cardId` na transação — é apenas uma etiqueta de
 * configuração; a associação com transações (cardId) é feita no create
 * de transação, quando o usuário escolhe o cartão usado.
 */
@Injectable()
export class CreateCardUseCase {
  constructor(private readonly cards: CardRepositoryPort) {}

  async execute({ ownerId, input }: CreateCardInput): Promise<Card> {
    return this.cards.create(ownerId, {
      name: input.name.trim(),
      brand: input.brand,
      last4: input.last4?.trim() ?? null,
      color: input.color?.trim() ?? null,
      logoUrl: input.logoUrl?.trim() ?? null,
      isDefault: input.isDefault ?? false,
    });
  }
}
