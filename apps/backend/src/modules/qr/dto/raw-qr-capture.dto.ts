import { IsString, IsNotEmpty, IsOptional, Length, IsDateString } from 'class-validator';

export class RawQrCaptureDto {
  @IsString()
  @IsNotEmpty()
  rawContent: string;

  @IsString()
  @Length(64, 64)
  rawHash: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;

  @IsOptional()
  @IsString()
  pageTitle?: string;

  @IsOptional()
  @IsString()
  captureMethod?: string;

  @IsDateString()
  capturedAt: string;
}
