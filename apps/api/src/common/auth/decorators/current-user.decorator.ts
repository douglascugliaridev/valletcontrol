import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

/** Usuário autenticado injetado pelo JwtAuthGuard (ver JwtPayload). */
export interface AuthenticatedUser {
  userId: string;
  email: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new Error('CurrentUser decorator usado sem guard de autenticação.');
    }
    return request.user;
  },
);
