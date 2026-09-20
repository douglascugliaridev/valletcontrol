import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { PasswordHasherPort } from '../application/ports/password-hasher.port';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }; // OWASP: scrypt N=2^14, r=8, p=1
const PREFIX = 'scrypt';

/**
 * Adapter de hash de senha usando scrypt do Node (crypto nativo,
 * sem dependências nativas de terceiros).
 */
@Injectable()
export class ScryptPasswordHasher implements PasswordHasherPort {
  async hash(plain: string): Promise<string> {
    const salt = randomBytes(16);
    const derivedKey = await scryptAsync(plain, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return `${PREFIX}$${salt.toString('hex')}$${derivedKey.toString('hex')}`;
  }

  async verify(plain: string, storedHash: string): Promise<boolean> {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== PREFIX) {
      return false;
    }
    const [, saltHex, hashHex] = parts;
    const salt = Buffer.from(saltHex ?? '', 'hex');
    const expected = Buffer.from(hashHex ?? '', 'hex');
    const actual = await scryptAsync(plain, salt, expected.length || KEY_LENGTH, SCRYPT_OPTIONS);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}
