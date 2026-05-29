import { Controller, Get, Post, Delete, Body, UseGuards, Request, Query } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @UseGuards(ApiKeyGuard)
  async findAll(@Request() req, @Query() pagination: PaginationDto) {
    return this.paymentsService.findAll(req.user.id, pagination);
  }

  @Get('balance')
  @UseGuards(ApiKeyGuard)
  async getBalance(@Request() req) {
    return this.paymentsService.getBalance(req.user.id);
  }

  @Get('transactions')
  @UseGuards(ApiKeyGuard)
  async getTransactions(@Request() req, @Query() pagination: PaginationDto) {
    return this.paymentsService.getTransactions(req.user.id, pagination);
  }

  @Get('asaas/transactions')
  @UseGuards(ApiKeyGuard)
  async getAsaasTransactions(@Request() req, @Query() pagination: PaginationDto) {
    return this.paymentsService.getAsaasTransactions(req.user.id, pagination);
  }

  // Endpoint temporário para diagnóstico — retorna o rawResponse completo do Asaas
  @Get('debug-asaas')
  @UseGuards(ApiKeyGuard)
  async debugAsaas(@Request() req) {
    return this.paymentsService.debugBalance(req.user.id);
  }

  // Diagnóstico: decodifica um payload via Asaas e retorna a resposta bruta completa.
  // Útil para checar se um QR está expirado ou se a chave de API está correta.
  // POST /api/payments/debug-decode  body: { payload: "00020101..." }
  @Post('debug-decode')
  @UseGuards(ApiKeyGuard)
  async debugDecode(@Request() req, @Body() body: { payload: string }) {
    return this.paymentsService.debugDecodeQr(req.user.id, body.payload);
  }

  @Delete('cleanup-failures')
  @UseGuards(ApiKeyGuard)
  async cleanupFailures(@Request() req) {
    return this.paymentsService.purgeFailedAndRejectedPanel(req.user.id);
  }
}
