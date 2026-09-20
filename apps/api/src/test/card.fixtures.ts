import type { Card } from '@valletcontrol/shared';
import { CardRepositoryPort } from '../modules/cards/application/ports/card-repository.port';

export function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'card-1',
    ownerId: 'user-1',
    name: 'Meu Nubank',
    brand: 'nubank',
    last4: '1234',
    color: null,
    isDefault: false,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Mock tipado do port de repositório de cartões. */
class MockCardRepository extends CardRepositoryPort {
  findAllByOwner = jest.fn();
  findByIdAndOwner = jest.fn();
  create = jest.fn();
  updateByIdAndOwner = jest.fn();
  deleteByIdAndOwner = jest.fn();
}

export function mockCardRepository(): MockCardRepository {
  return new MockCardRepository();
}
