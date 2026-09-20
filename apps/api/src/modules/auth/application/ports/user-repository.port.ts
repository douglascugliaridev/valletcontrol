import type { NewUser, User } from '@valletcontrol/shared';

/** Usuário com hash de senha — usado apenas internamente na autenticação. */
export interface UserWithPasswordHash extends User {
  passwordHash: string;
}

/**
 * Port (driven adapter) de persistência de usuários.
 * A camada de aplicação depende desta abstração, nunca do Prisma.
 */
export abstract class UserRepositoryPort {
  abstract findByEmail(email: string): Promise<UserWithPasswordHash | null>;

  abstract findById(id: string): Promise<User | null>;

  abstract create(data: NewUser): Promise<User>;
}
