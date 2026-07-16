import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    const details =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : {};
    const defaultMessage =
      status === Number(HttpStatus.INTERNAL_SERVER_ERROR)
        ? 'Internal server error'
        : typeof exceptionResponse === 'string'
          ? exceptionResponse
          : 'Request failed';

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
    }

    const body: ErrorBody = {
      statusCode: status,
      error:
        typeof details.error === 'string'
          ? details.error
          : (HttpStatus[status] ?? 'Error'),
      message:
        (details.message as string | string[] | undefined) ?? defaultMessage,
      path: request.url,
      timestamp: new Date().toISOString(),
    };
    response.status(status).json(body);
  }
}
