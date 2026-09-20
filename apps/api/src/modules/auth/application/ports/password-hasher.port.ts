/** Port de hash de senha — desacopla a aplicação do algoritmo (scrypt). */
export abstract class PasswordHasherPort {
  abstract hash(plain: string): Promise<string>;

  abstract verify(plain: string, storedHash: string): Promise<boolean>;
}
