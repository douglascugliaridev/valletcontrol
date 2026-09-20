import { Injectable } from '@nestjs/common';
import { CardRepositoryPort } from '../ports/card-repository.port';

export interface DeleteCardInput {
  ownerId: string;
  id: string;
}

/** Delete escopado ao dono; sem 404 silencioso (igual transactions). */
@Injectable()
export class DeleteCardUseCase {
  constructor(private readonly cards: CardRepositoryPort) {}

  async execute({ ownerId, id }: DeleteCardInput): Promise<void> {
    await this.cards.deleteByIdAndOwner(id, ownerId);
  }
}
