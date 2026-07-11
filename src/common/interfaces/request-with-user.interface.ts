import { Request } from 'express';
import { Types } from 'mongoose';
import { Role } from '../enums/role.enum';

export interface AuthenticatedUser {
  userId: Types.ObjectId | string;
  username: string;
  role: Role;
  departments: (Types.ObjectId | string)[];
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
