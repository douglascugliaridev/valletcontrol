import {
  BadRequestException,
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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import multer from 'multer';
import type { Card, CardUpdate } from '@valletcontrol/shared';
import type { AuthenticatedUser } from '../../../common/auth/decorators/current-user.decorator';
import { CurrentUser } from '../../../common/auth/decorators/current-user.decorator';
import { CreateCardDto } from './dto/create-card.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import { CreateCardUseCase } from '../application/use-cases/create-card.use-case';
import { DeleteCardUseCase } from '../application/use-cases/delete-card.use-case';
import { ListCardsUseCase } from '../application/use-cases/list-cards.use-case';
import { UpdateCardUseCase } from '../application/use-cases/update-card.use-case';
import {
  ALLOWED_LOGO_MIMES,
  MAX_LOGO_BYTES,
  resolveUploadsDir,
  uploadsPrefix,
} from '../infrastructure/uploads';

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
    private readonly config: ConfigService,
  ) {}

  @Post()
  async add(@CurrentUser() authUser: AuthenticatedUser, @Body() dto: CreateCardDto): Promise<Card> {
    const input = {
      name: dto.name,
      brand: dto.brand,
      last4: dto.last4 ?? null,
      color: dto.color ?? null,
      logoUrl: dto.logoUrl ?? null,
      isDefault: dto.isDefault ?? false,
    };
    return this.createCard.execute({ ownerId: authUser.userId, input });
  }

  @Get()
  async list(@CurrentUser() authUser: AuthenticatedUser): Promise<Card[]> {
    return this.listCards.execute({ ownerId: authUser.userId });
  }

  @Get('logos/:brand')
  @HttpCode(HttpStatus.OK)
  async getBrandLogo(
    @Param('brand') brand: string,
    @Res() res: Response,
  ): Promise<void> {
    const allowedBrands = ['nubank', 'itaucard', 'havan'] as const;
    const normalizedBrand = brand.toLowerCase();
    if (!allowedBrands.includes(normalizedBrand as typeof allowedBrands[number])) {
      res.status(HttpStatus.NOT_FOUND).send('Brand not found');
      return;
    }
    const { readFileSync, existsSync } = await import('node:fs');
    const { join } = await import('node:path');
    const filePath = join(process.cwd(), 'prisma', 'logos', `${normalizedBrand}.png`);
    if (!existsSync(filePath)) {
      res.status(HttpStatus.NOT_FOUND).send('Logo not found');
      return;
    }
    const fileBuffer = readFileSync(filePath);
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
      ...('logoUrl' in dto && { logoUrl: dto.logoUrl ?? null }),
      ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
    };
    return this.updateCard.execute({ ownerId: authUser.userId, id, patch });
  }

  @Post(':id/logo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: MAX_LOGO_BYTES },
    }),
  )
  async uploadLogo(
    @CurrentUser() authUser: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<Card> {
    if (!file) {
      throw new BadRequestException('Envie um arquivo de imagem.');
    }
    const ext = ALLOWED_LOGO_MIMES[file.mimetype];
    if (!ext) {
      throw new BadRequestException('Formato inválido. Use PNG, JPG ou WebP.');
    }
    const filename = `${id}-${randomUUID()}.${ext}`;
    const filePath = join(resolveUploadsDir(), filename);
    await writeFile(filePath, file.buffer);
    const prefix = uploadsPrefix(this.config.getOrThrow<string>('apiPrefix'));
    try {
      return await this.updateCard.execute({
        ownerId: authUser.userId,
        id,
        patch: { logoUrl: `/${prefix}/${filename}` },
      });
    } catch (err) {
      await unlink(filePath).catch(() => undefined);
      throw err;
    }
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() authUser: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.deleteCard.execute({ ownerId: authUser.userId, id });
  }
}
