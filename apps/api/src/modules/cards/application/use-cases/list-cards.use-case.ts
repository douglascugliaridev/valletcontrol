import { Injectable } from '@nestjs/common';
import type { Card } from '@valletcontrol/shared';
import { CardRepositoryPort } from '../ports/card-repository.port';

export interface ListCardsInput {
  ownerId: string;
}

/** Lista os cartões do usuário (padrão por primeiro). */
@Injectable()
export class ListCardsUseCase {
  constructor(private readonly cards: CardRepositoryPort) {}

  async execute({ ownerId }: ListCardsInput): Promise<Card[]> {
    return this.cards.findAllByOwner(ownerId);
  }
}
