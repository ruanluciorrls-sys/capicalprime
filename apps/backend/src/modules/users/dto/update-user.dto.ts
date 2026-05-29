import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @IsIn(['mock', 'sicoob', 'itau', 'bradesco'])
  bankAdapter?: string;

  @IsOptional()
  bankConfig?: Record<string, unknown>;
}
