import { IsIn, IsObject, IsOptional, IsString, IsBoolean } from 'class-validator';

export class UpdateBankConfigDto {
  @IsString()
  @IsIn(['mock', 'asaas', 'sicoob', 'mercadopago', 'inter', 'efi', 'bb'])
  bankAdapter: string;

  @IsOptional()
  @IsObject()
  bankConfig?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
