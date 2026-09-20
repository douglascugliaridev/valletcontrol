import { Injectable, NotFoundException } from '@nestjs/common';
import type { Card, CardUpdate } from '@valletcontrol/shared';
import { CardRepositoryPort } from '../ports/card-repository.port';

export interface UpdateCardInput {
  ownerId: string;
  id: string;
  patch: CardUpdate;
}

/** Update escopado ao dono: busca prévia garante 404 amigável. */
@Injectable()
export class UpdateCardUseCase {
  constructor(private readonly cards: CardRepositoryPort) {}

  async execute({ ownerId, id, patch }: UpdateCardInput): Promise<Card> {
    const existing = await this.cards.findByIdAndOwner(id, ownerId);
    if (!existing) {
      throw new NotFoundException('Cartão não encontrado.');
    }
    return this.cards.updateByIdAndOwner(id, ownerId, patch);
  }
}
