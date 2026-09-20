import type { User } from '@valletcontrol/shared';
import { ConflictError } from '../../../../common/errors/app-errors';
import type { PasswordHasherPort } from '../ports/password-hasher.port';
import type { TokenServicePort } from '../ports/token-service.port';
import type { UserRepositoryPort, UserWithPasswordHash } from '../ports/user-repository.port';
import { LoginUseCase } from './login.use-case';
import { RegisterUseCase } from './register.use-case';

const user: User = {
  id: 'u1',
  name: 'Maria',
  email: 'maria@test.com',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
};

function mockDeps() {
  const users: UserRepositoryPort = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  };
  const hasher: PasswordHasherPort = { hash: jest.fn(), verify: jest.fn() };
  const tokens: TokenServicePort = { sign: jest.fn() };
  return { users, hasher, tokens };
}

describe('RegisterUseCase', () => {
  it('registra usuário, normaliza email e emite token', async () => {
    const { users, hasher, tokens } = mockDeps();
    (users.findByEmail as jest.Mock).mockResolvedValue(null);
    (hasher.hash as jest.Mock).mockResolvedValue('scrypt$hash');
    (users.create as jest.Mock).mockResolvedValue(user);
    (tokens.sign as jest.Mock).mockResolvedValue('token-abc');
    const useCase = new RegisterUseCase(users, hasher, tokens);

    const result = await useCase.execute({
      name: '  Maria ',
      email: '  MARIA@TEST.com ',
      password: 'senha-forte-123',
    });

    expect(users.create).toHaveBeenCalledWith({
      name: 'Maria',
      email: 'maria@test.com',
      passwordHash: 'scrypt$hash',
    });
    expect(tokens.sign).toHaveBeenCalledWith({ sub: 'u1', email: 'maria@test.com' });
    expect(result.tokens.accessToken).toBe('token-abc');
  });

  it('lança Conflict quando o email já existe, sem chamar create', async () => {
    const { users, hasher, tokens } = mockDeps();
    (users.findByEmail as jest.Mock).mockResolvedValue(user);
    const useCase = new RegisterUseCase(users, hasher, tokens);

    await expect(
      useCase.execute({ name: 'Maria', email: 'maria@test.com', password: 'senha-forte-123' }),
    ).rejects.toBeInstanceOf(ConflictError);
    expect(users.create).not.toHaveBeenCalled();
  });
});

describe('LoginUseCase', () => {
  it('autentica com credenciais corretas e remove o hash da resposta', async () => {
    const { users, hasher, tokens } = mockDeps();
    const withHash: UserWithPasswordHash = { ...user, passwordHash: 'scrypt$stored' };
    (users.findByEmail as jest.Mock).mockResolvedValue(withHash);
    (hasher.verify as jest.Mock).mockResolvedValue(true);
    (tokens.sign as jest.Mock).mockResolvedValue('token-x');
    const useCase = new LoginUseCase(users, hasher, tokens);

    const result = await useCase.execute({
      email: '  MARIA@TEST.com ',
      password: 'senha-forte-123',
    });

    expect(result.user.email).toBe('maria@test.com');
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.tokens.accessToken).toBe('token-x');
  });

  it('rejeita senha incorreta com Unauthorized (sem enumerar)', async () => {
    const { users, hasher, tokens } = mockDeps();
    const withHash: UserWithPasswordHash = { ...user, passwordHash: 'scrypt$stored' };
    (users.findByEmail as jest.Mock).mockResolvedValue(withHash);
    (hasher.verify as jest.Mock).mockResolvedValue(false);
    const useCase = new LoginUseCase(users, hasher, tokens);

    await expect(
      useCase.execute({ email: 'maria@test.com', password: 'errada' }),
    ).rejects.toMatchObject({
      kind: 'UNAUTHORIZED',
    });
    expect(tokens.sign).not.toHaveBeenCalled();
  });

  it('usa a mesma mensagem para usuário inexistente (anti-enumeração)', async () => {
    const { users, hasher, tokens } = mockDeps();
    (users.findByEmail as jest.Mock).mockResolvedValue(null);
    const useCase = new LoginUseCase(users, hasher, tokens);

    await expect(
      useCase.execute({ email: 'ghost@test.com', password: 'qualquer' }),
    ).rejects.toMatchObject({
      kind: 'UNAUTHORIZED',
    });
    expect(hasher.verify).not.toHaveBeenCalled();
  });
});
