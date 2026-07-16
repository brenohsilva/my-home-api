import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const user: User = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Maria',
    email: 'maria@example.com',
    passwordHash: '',
    googleAuthId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  let users: jest.Mocked<
    Pick<UsersService, 'create' | 'findByEmail' | 'toPublic' | 'findPublicById'>
  >;
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwt: {
    signAsync: jest.Mock;
    decode: jest.Mock;
    verifyAsync: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    users = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      toPublic: jest.fn(({ passwordHash: _, ...safe }) => safe),
      findPublicById: jest.fn(),
    };
    prisma = {
      refreshToken: {
        create: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    jwt = {
      signAsync: jest.fn((payload: { type: string }) =>
        Promise.resolve(`${payload.type}.token.value`),
      ),
      decode: jest.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 3600 })),
      verifyAsync: jest.fn(),
    };
    const config = {
      get: jest.fn((key: string, fallback: unknown) =>
        key === 'BCRYPT_ROUNDS' ? 10 : fallback,
      ),
      getOrThrow: jest.fn(
        (key: string) => `${key}-with-at-least-32-characters`,
      ),
    };
    service = new AuthService(
      users as unknown as UsersService,
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    );
  });

  it('registers with a password hash and never returns it', async () => {
    users.create.mockImplementation((data) =>
      Promise.resolve({ ...user, passwordHash: data.passwordHash }),
    );
    const result = await service.register({
      name: ' Maria ',
      email: 'MARIA@example.com',
      password: 'Password123!',
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Maria', email: 'maria@example.com' }),
    );
    const storedHash = users.create.mock.calls[0][0].passwordHash;
    expect(await bcrypt.compare('Password123!', storedHash)).toBe(true);
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('rejects invalid credentials without revealing which field failed', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'none@example.com', password: 'Password123!' }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
  });

  it('rotates a valid refresh token and revokes it atomically', async () => {
    const rawToken = 'refresh.token.value';
    jwt.verifyAsync.mockResolvedValue({
      sub: user.id,
      tokenId: 'token-id',
      type: 'refresh',
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-id',
      userId: user.id,
      tokenHash: createHash('sha256').update(rawToken).digest('hex'),
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      user,
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.refresh(rawToken);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { id: 'token-id', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.refreshToken).toBe('refresh.token.value');
  });
});
