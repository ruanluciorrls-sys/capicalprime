import {
  IsEmail, IsString, IsOptional, IsIn, MinLength, IsBoolean,
  IsInt, Min, IsArray, IsDateString,
} from 'class-validator';
import { UserRole, UserFeature } from '../../../database/entities/user.entity';

const FEATURES: UserFeature[] = ['AUTO_PAYMENT', 'BULK_QR', 'API_ACCESS', 'WEBHOOK'];
const ROLES: UserRole[] = ['MASTER_ADMIN', 'ADMIN', 'USER', 'VIEWER'];

export class CreateUserDto {
  @IsString() @MinLength(2)
  name: string;

  @IsEmail()
  email: string;

  @IsString() @MinLength(8)
  password: string;

  @IsOptional() @IsIn(ROLES)
  role?: UserRole;

  @IsOptional() @IsInt() @Min(0)
  subscriptionDays?: number;

  @IsOptional() @IsArray() @IsIn(FEATURES, { each: true })
  features?: UserFeature[];

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2)
  name?: string;

  @IsOptional() @IsEmail()
  email?: string;

  @IsOptional() @IsIn(ROLES)
  role?: UserRole;

  @IsOptional() @IsArray() @IsIn(FEATURES, { each: true })
  features?: UserFeature[];

  @IsOptional() @IsBoolean()
  isActive?: boolean;

  @IsOptional() @IsDateString()
  subscriptionExpiresAt?: string;
}

export class ExtendSubscriptionDto {
  @IsInt() @Min(1)
  days: number;
}

export class SetPasswordDto {
  @IsString() @MinLength(8)
  newPassword: string;
}
