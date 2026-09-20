import { Injectable } from '@nestjs/common';
import type { User } from '@valletcontrol/shared';
import { UnauthorizedError } from '../../../../common/errors/app-errors';
import { UserRepositoryPort } from '../ports/user-repository.port';

/** Use case: retorna o usuário autenticado pelo token. */
@Injectable()
export class GetMeUseCase {
  constructor(private readonly users: UserRepositoryPort) {}

  async execute(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new UnauthorizedError('Usuário não encontrado.');
    }
    return user;
  }
}
