import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class ManualQrDto {
  @IsString()
  @IsNotEmpty()
  payload: string;

  @IsOptional()
  @IsString()
  sourceUrl?: string;
}
