/** Port de emissão de tokens JWT. */
export abstract class TokenServicePort {
  abstract sign(payload: { sub: string; email: string }): Promise<string>;
}
