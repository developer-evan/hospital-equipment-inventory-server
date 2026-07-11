import { Role } from '../../../common/enums/role.enum';

export interface AccessTokenPayload {
  sub: string;
  username: string;
  role: Role;
  departments: string[];
}

export interface RefreshTokenPayload {
  sub: string;
  /** Random nonce so two refresh tokens issued in the same second still differ. */
  jti: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
