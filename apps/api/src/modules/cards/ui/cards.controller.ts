import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Card, CardUpdate } from '@walletcontrol/shared';
import type { AuthenticatedUser } from '../../../common/auth/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/auth/decorators/current-user.decorator';
import { Public } from '../../../common/auth/decorators/public.decorator';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CreateCardUseCase } from '../application/use-cases/create-card.use-case';
import { DeleteCardUseCase } from '../application/use-cases/delete-card.use-case';
import { ListCardsUseCase } from '../application/use-cases/list-cards.use-case';
import { UpdateCardUseCase } from '../application/use-cases/update-card.use-case';
import { BRAND_SLUGS, readBrandLogo } from '../infrastructure/uploads';

/**
 * Controller REST de cartões — frame driver adapter (espelho do transactions).
 * Toda a autorização é escopada via @CurrentUser / @AuthenticatedUser.
 */
@Controller('cards')
export class CardsController {
  constructor(
    private readonly createCard: CreateCardUseCase,
    private readonly listCards: ListCardsUseCase,
    private readonly updateCard: UpdateCardUseCase,
    private readonly deleteCard: DeleteCardUseCase,
  ) {}

  @Post()
  async add(@CurrentUser() authUser: AuthenticatedUser, @Body() dto: CreateCardDto): Promise<Card> {
    const input = {
      name: dto.name,
      brand: dto.brand,
      last4: dto.last4 ?? null,
      color: dto.color ?? null,
      isDefault: dto.isDefault ?? false,
    };
    return this.createCard.execute({ ownerId: authUser.userId, input });
  }

  @Get()
  async list(@CurrentUser() authUser: AuthenticatedUser): Promise<Card[]> {
    return this.listCards.execute({ ownerId: authUser.userId });
  }

  @Public()
  @Get('logos/:brand')
  @HttpCode(HttpStatus.OK)
  async getBrandLogo(@Param('brand') brand: string, @Res() res: Response): Promise<void> {
    // `BRAND_SLUGS` é a lista de slugs: manter uma cópia aqui era o que deixou o
    // Havan fora — o controller o aceitava, mas o mapeamento interno não resolvia.
    const normalizedBrand = brand.toLowerCase();
    if (!BRAND_SLUGS.includes(normalizedBrand as (typeof BRAND_SLUGS)[number])) {
      res.status(HttpStatus.NOT_FOUND).send('Brand not found');
      return;
    }
    const fileBuffer = readBrandLogo(normalizedBrand as (typeof BRAND_SLUGS)[number]);
    if (!fileBuffer) {
      res.status(HttpStatus.NOT_FOUND).send('Logo not found');
      return;
    }
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(fileBuffer);
  }

  @Patch(':id')
  async update(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCardDto,
  ): Promise<Card> {
    const patch: CardUpdate = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.brand !== undefined && { brand: dto.brand }),
      ...('last4' in dto && { last4: dto.last4 ?? null }),
      ...('color' in dto && { color: dto.color ?? null }),
      ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
    };
    return this.updateCard.execute({ ownerId: authUser.userId, id, patch });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteCard.execute({ ownerId: authUser.userId, id });
  }
}
