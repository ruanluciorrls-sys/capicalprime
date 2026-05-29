import { IsOptional, IsString } from 'class-validator';

export class ApproveQrDto {
  @IsOptional()
  @IsString()
  note?: string;
}
