import type { Role } from '@ams/shared';

export interface JwtPayload {
  sub: string;
  role: Role;
  assignedSiteId: string | null;
  name: string;
  employeeCode: string;
}

/** Shape attached to `request.user` after JwtStrategy validates a token. */
export interface RequestUser {
  id: string;
  role: Role;
  assignedSiteId: string | null;
  name: string;
  employeeCode: string;
}
