import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../types/jwt-payload.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    return context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>().user;
  },
);
