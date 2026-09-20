import { Module } from '@nestjs/common';
import { CreateCardUseCase } from './application/use-cases/create-card.use-case';
import { DeleteCardUseCase } from './application/use-cases/delete-card.use-case';
import { ListCardsUseCase } from './application/use-cases/list-cards.use-case';
import { UpdateCardUseCase } from './application/use-cases/update-card.use-case';
import { PrismaCardRepository } from './infrastructure/prisma-card.repository';
import { CardRepositoryPort } from './application/ports/card-repository.port';
import { CardsController } from './ui/cards.controller';

/**
 * Módulo de cartões de crédito do usuário.
 * Segue o mesmo frame do domínio das transações: controller (adapter de UI)
 * → use cases (hexágono central) → repository Prisma (adapter de persis-
 * tência), todos escopados ao dono autenticado (`ownerId`).
 */
@Module({
  controllers: [CardsController],
  providers: [
    CreateCardUseCase,
    DeleteCardUseCase,
    ListCardsUseCase,
    UpdateCardUseCase,
    { provide: CardRepositoryPort, useClass: PrismaCardRepository },
  ],
  exports: [CardRepositoryPort],
})
export class CardsModule {}
