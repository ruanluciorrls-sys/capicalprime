import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class HeartbeatDto {
  @IsOptional()
  @IsString({ message: 'deviceId deve ser texto.' })
  @MaxLength(128, { message: 'deviceId excede o limite de 128 caracteres.' })
  deviceId?: string;

  @IsString({ message: 'status deve ser texto.' })
  @IsIn(['ONLINE', 'OFFLINE', 'ERROR'], {
    message: 'status invalido. Use ONLINE, OFFLINE ou ERROR.',
  })
  status: 'ONLINE' | 'OFFLINE' | 'ERROR';

  @IsOptional()
  @IsString({ message: 'error deve ser texto.' })
  @MaxLength(2000, { message: 'error excede o limite de 2000 caracteres.' })
  error?: string;

  @IsOptional()
  @IsString({ message: 'version deve ser texto.' })
  @MaxLength(32, { message: 'version excede o limite de 32 caracteres.' })
  version?: string;
}
