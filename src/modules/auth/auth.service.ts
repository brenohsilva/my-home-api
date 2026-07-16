import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicUser, UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  AccessTokenPayload,
  RefreshTokenPayload,
} from './types/jwt-payload.type';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
export interface AuthResponse extends AuthTokens {
  user: PublicUser;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const passwordHash = await bcrypt.hash(
      dto.password,
      this.config.get<number>('BCRYPT_ROUNDS', 12),
    );
    const user = await this.users.create({
      name: dto.name.trim(),
      email: dto.email.toLowerCase(),
      passwordHash,
    });
    return {
      user: this.users.toPublic(user),
      ...(await this.issueTokens(user)),
    };
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.users.findByEmail(dto.email);
    if (!user || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return {
      user: this.users.toPublic(user),
      ...(await this.issueTokens(user)),
    };
  }

  async refresh(rawToken: string): Promise<AuthResponse> {
    let payload: RefreshTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<RefreshTokenPayload>(rawToken, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.type !== 'refresh')
      throw new UnauthorizedException('Invalid refresh token');

    const stored = await this.prisma.refreshToken.findUnique({
      where: { id: payload.tokenId },
      include: { user: true },
    });
    if (
      !stored ||
      stored.userId !== payload.sub ||
      stored.revokedAt ||
      stored.expiresAt <= new Date() ||
      this.hashRefreshToken(rawToken) !== stored.tokenHash
    ) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const revoked = await this.prisma.refreshToken.updateMany({
      where: { id: stored.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (revoked.count !== 1) {
      throw new UnauthorizedException('Refresh token was already used');
    }
    return {
      user: this.users.toPublic(stored.user),
      ...(await this.issueTokens(stored.user)),
    };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.users.findPublicById(userId);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return user;
  }

  private async issueTokens(user: User): Promise<AuthTokens> {
    const tokenId = randomUUID();
    const accessPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      type: 'access',
    };
    const refreshPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenId,
      type: 'refresh',
    };
    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_ACCESS_EXPIRES_IN',
        '15m',
      ) as never,
    });
    const refreshToken = await this.jwt.signAsync(refreshPayload, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>(
        'JWT_REFRESH_EXPIRES_IN',
        '7d',
      ) as never,
    });
    const decoded = this.jwt.decode<{ exp: number }>(refreshToken);
    if (!decoded)
      throw new UnauthorizedException('Could not create refresh token');
    await this.prisma.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        tokenHash: this.hashRefreshToken(refreshToken),
        expiresAt: new Date(decoded.exp * 1000),
      },
    });
    return { accessToken, refreshToken };
  }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
