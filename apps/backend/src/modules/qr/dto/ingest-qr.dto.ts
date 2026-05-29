import { IsString, IsNotEmpty, IsOptional, Length, IsDateString, IsBoolean } from 'class-validator';

export class IngestQrDto {
  @IsString()
  @IsNotEmpty()
  payload: string;

  @IsOptional()
  @IsString()
  @Length(64, 64)
  payloadHash?: string;

  @IsString()
  @IsNotEmpty()
  sourceUrl: string;

  @IsDateString()
  capturedAt: string;

  @IsOptional()
  @IsBoolean()
  isTest?: boolean;
}
