import type { Card, CardInput, CardUpdate } from '@valletcontrol/shared';

/**
 * Port (driven adapter) de persistência de cartões.
 * Toda consulta é escopada por `ownerId` (isolamento entre usuários).
 */
export abstract class CardRepositoryPort {
  abstract findAllByOwner(ownerId: string): Promise<Card[]>;

  abstract findByIdAndOwner(id: string, ownerId: string): Promise<Card | null>;

  abstract create(ownerId: string, input: CardInput): Promise<Card>;

  abstract updateByIdAndOwner(id: string, ownerId: string, patch: CardUpdate): Promise<Card>;

  abstract deleteByIdAndOwner(id: string, ownerId: string): Promise<void>;
}
