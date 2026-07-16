export interface AccessTokenPayload {
  sub: string;
  email: string;
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  tokenId: string;
  type: 'refresh';
}

export interface AuthenticatedUser {
  id: string;
  email: string;
}
