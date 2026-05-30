import { IsOptional, IsString, IsNumber, Min } from 'class-validator';

export class ApproveQrDto {
  @IsOptional()
  @IsString()
  note?: string;

  /** Valor manual informado pelo operador — usado quando o QR não tem valor embutido (Pix dinâmico) */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  amount?: number;
}
