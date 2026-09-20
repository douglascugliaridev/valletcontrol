import { Injectable } from '@nestjs/common';
import type { AuthResponse } from '@valletcontrol/shared';
import { UnauthorizedError } from '../../../../common/errors/app-errors';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { TokenServicePort } from '../ports/token-service.port';
import { UserRepositoryPort } from '../ports/user-repository.port';

export interface LoginInput {
  email: string;
  password: string;
}

/** Use case: autenticação de usuário existente. */
@Injectable()
export class LoginUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly tokens: TokenServicePort,
  ) {}

  async execute(input: LoginInput): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();
    const record = await this.users.findByEmail(email);

    // Mesma mensagem para usuário inexistente e senha errada (evita enumeração).
    if (!record) {
      throw new UnauthorizedError('Email ou senha inválidos.');
    }

    const passwordMatches = await this.hasher.verify(input.password, record.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedError('Email ou senha inválidos.');
    }

    const { passwordHash: _removed, ...user } = record;
    const accessToken = await this.tokens.sign({ sub: user.id, email: user.email });

    return { user, tokens: { accessToken } };
  }
}
