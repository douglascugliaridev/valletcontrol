import { ScryptPasswordHasher } from './scrypt-password-hasher';

const hasher = new ScryptPasswordHasher();

describe('ScryptPasswordHasher', () => {
  it('hash produz formato compatível PREFIX$salt$digest (segredo de formato compartilhado com o seed)', async () => {
    const hashed = await hasher.hash('senha-segura-123');
    const parts = hashed.split('$');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('scrypt');
    expect(parts[1]).toHaveLength(32); // salt hex de 16 bytes
    expect(parts[2]).toHaveLength(128); // digest de 64 bytes
  });

  it('verifica a senha correta', async () => {
    const hashed = await hasher.hash('senha-segura-123');
    await expect(hasher.verify('senha-segura-123', hashed)).resolves.toBe(true);
  });

  it('rejeita senha incorreta', async () => {
    const hashed = await hasher.hash('senha-segura-123');
    await expect(hasher.verify('outra-senha', hashed)).resolves.toBe(false);
  });

  it('rejeita hash adulterado em qualquer parte', async () => {
    const hashed = await hasher.hash('senha-segura-123');
    const [, salt, digest] = hashed.split('$');
    const tampered = `scrypt$${salt}$f${digest!.slice(1)}`;
    await expect(hasher.verify('senha-segura-123', tampered)).resolves.toBe(false);
    await expect(hasher.verify('senha-segura-123', 'plain-texto')).resolves.toBe(false);
    await expect(hasher.verify('senha-segura-123', 'bcrypt$x$y')).resolves.toBe(false);
  });

  it('produz hashes únicos mesmo com a mesma senha (salt aleatório)', async () => {
    const a = await hasher.hash('senha-segura-123');
    const b = await hasher.hash('senha-segura-123');
    expect(a).not.toBe(b);
  });
});
