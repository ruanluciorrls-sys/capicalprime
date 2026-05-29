import { IsString, IsNotEmpty, Length, IsOptional } from 'class-validator';

export class RegisterDeviceDto {
  @IsString()
  @IsNotEmpty()
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  userApiKey: string;

  @IsOptional()
  @IsString()
  browser?: string;
}
