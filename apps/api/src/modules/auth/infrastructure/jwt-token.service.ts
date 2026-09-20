import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TokenServicePort } from '../application/ports/token-service.port';

/** Adapter de tokens — delega para o JwtService do Nest. */
@Injectable()
export class JwtTokenService implements TokenServicePort {
  constructor(private readonly jwtService: JwtService) {}

  sign(payload: { sub: string; email: string }): Promise<string> {
    return Promise.resolve(this.jwtService.sign(payload));
  }
}
