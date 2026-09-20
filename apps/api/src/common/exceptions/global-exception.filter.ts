import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppError } from '../errors/app-errors';
import { DomainValidationError } from '@valletcontrol/shared';
import type { ErrorResponse } from '@valletcontrol/shared';

/**
 * Filter global de exceções — converte erros em respostas HTTP
 * consistentes com o contrato `ErrorResponse` compartilhado.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { statusCode, body } = this.resolve(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} -> ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json(body);
  }

  private resolve(exception: unknown): { statusCode: HttpStatus; body: ErrorResponse } {
    // 1. Erros de validação de domínio (regras de negócio).
    if (exception instanceof DomainValidationError) {
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        body: {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: exception.message,
          error: 'UnprocessableEntity',
          domainCode: exception.code,
        },
      };
    }

    // 2. Erros de aplicação (estados de fluxo).
    if (exception instanceof AppError) {
      const mapping: Record<AppError['kind'], HttpStatus> = {
        NOT_FOUND: HttpStatus.NOT_FOUND,
        CONFLICT: HttpStatus.CONFLICT,
        UNAUTHORIZED: HttpStatus.UNAUTHORIZED,
        FORBIDDEN: HttpStatus.FORBIDDEN,
      };
      return {
        statusCode: mapping[exception.kind],
        body: {
          statusCode: mapping[exception.kind],
          message: exception.message,
          error: exception.kind,
        },
      };
    }

    // 3. Exceções HTTP nativas do Nest (preserva array de erros do class-validator).
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const res = exception.getResponse();
      const payload: ErrorResponse =
        typeof res === 'string'
          ? { statusCode, message: res, error: exception.name }
          : (res as ErrorResponse);
      return { statusCode, body: payload };
    }

    // 4. Erros inesperados.
    const message = exception instanceof Error ? exception.message : 'Erro interno do servidor.';
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message,
        error: 'InternalServerError',
      },
    };
  }
}
