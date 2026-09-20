import { Injectable } from '@nestjs/common';
import type { AuthResponse } from '@valletcontrol/shared';
import { ConflictError } from '../../../../common/errors/app-errors';
import { PasswordHasherPort } from '../ports/password-hasher.port';
import { TokenServicePort } from '../ports/token-service.port';
import { UserRepositoryPort } from '../ports/user-repository.port';

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

/** Use case: cadastro de novo usuário. */
@Injectable()
export class RegisterUseCase {
  constructor(
    private readonly users: UserRepositoryPort,
    private readonly hasher: PasswordHasherPort,
    private readonly tokens: TokenServicePort,
  ) {}

  async execute(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new ConflictError('Email já cadastrado.');
    }

    const passwordHash = await this.hasher.hash(input.password);
    const user = await this.users.create({ name: input.name.trim(), email, passwordHash });
    const accessToken = await this.tokens.sign({ sub: user.id, email: user.email });

    return { user, tokens: { accessToken } };
  }
}
