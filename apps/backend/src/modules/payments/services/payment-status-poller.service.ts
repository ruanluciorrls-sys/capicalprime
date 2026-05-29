import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity } from '../../../database/entities/payment.entity';
import { UserEntity } from '../../../database/entities/user.entity';
import { PaymentsRepository } from '../payments.repository';
import { PaymentAdapterFactory } from '../adapters/adapter.factory';
import { PaymentsService } from '../payments.service';
import { EncryptionService } from '../../../common/services/encryption.service';

/**
 * Service que monitora pagamentos com status PROCESSING (PAGANDO)
 * e consulta o provedor (Asaas) periodicamente para detectar o status REAL do Pix:
 *
 *  PROCESSING (Asaas aceitou) → polling → CONFIRMED → SUCCESS (PAID)
 *                                       → REFUSED   → FAILED  (ERROR)
 *
 * Garante que o status no dashboard reflete EXATAMENTE o que está acontecendo no banco,
 * sem precisar abrir o app/banco para conferir.
 *
 * Configuração:
 *  - POLL_INTERVAL_MS: 15s entre ciclos
 *  - MAX_POLL_AGE_MIN: depois de 30 minutos sem confirmação, marca como FAILED (timeout)
 */
@Injectable()
export class PaymentStatusPollerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentStatusPollerService.name);
  private readonly POLL_INTERVAL_MS = 15_000;
  private readonly MAX_POLL_AGE_MIN = 30;

  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly paymentsRepo: PaymentsRepository,
    private readonly adapterFactory: PaymentAdapterFactory,
    private readonly paymentsService: PaymentsService,
    private readonly encryptionService: EncryptionService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  onModuleInit() {
    this.logger.log(`[POLLER] Iniciando — intervalo ${this.POLL_INTERVAL_MS}ms`);
    this.timer = setInterval(() => this.tick().catch(err => this.logger.error(err)), this.POLL_INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.running) return; // evita sobreposição
    this.running = true;

    try {
      const processing = await this.paymentsRepo.findByStatus('PROCESSING');
      if (processing.length === 0) return;

      this.logger.debug(`[POLLER] Verificando ${processing.length} pagamento(s) em processamento`);

      for (const payment of processing) {
        try {
          await this.checkPayment(payment);
        } catch (err: any) {
          this.logger.warn(`[POLLER] Erro ao checar ${payment.id}: ${err.message}`);
        }
      }
    } finally {
      this.running = false;
    }
  }

  private async checkPayment(payment: PaymentEntity) {
    // Timeout — depois de 30 minutos sem confirmação, marca como falha
    const ageMin = (Date.now() - new Date(payment.createdAt).getTime()) / 60000;
    if (ageMin > this.MAX_POLL_AGE_MIN) {
      this.logger.warn(`[POLLER] Timeout ${this.MAX_POLL_AGE_MIN}min — marcando ${payment.id} como FAILED`);
      await this.paymentsService.markPaymentFailed(
        payment.id,
        payment.qrCodeId,
        'TIMEOUT',
        `Sem confirmação do provedor após ${this.MAX_POLL_AGE_MIN} minutos.`,
      );
      return;
    }

    const user = await this.userRepo.findOne({ where: { id: payment.userId } });
    if (!user) return;

    const adapterName = (user.bankAdapter || '').toLowerCase();
    if (adapterName !== 'asaas') return;

    // Resolve config (decryptar apiKey)
    const config = this.resolveConfig(user.bankConfig);
    if (!config?.apiKey) return;

    const adapter = this.adapterFactory.getAdapter(user.bankAdapter, config) as any;

    // Asaas: GET /pix/transactions/{id} OU /pix/qrCodes/{endToEndId}
    const providerId = payment.providerPaymentId || payment.bankEnd2EndId;
    if (!providerId) {
      this.logger.warn(`[POLLER] Payment ${payment.id} sem providerPaymentId nem endToEndId`);
      return;
    }

    try {
      const baseUrl = (config.baseUrl as string) || 'https://api.asaas.com/v3';
      
      // Tentativa 1: Verifica se o ID pertence a uma transferência (/transfers)
      let res = await fetch(`${baseUrl}/transfers/${encodeURIComponent(providerId)}`, {
        headers: { access_token: String(config.apiKey) },
      });
      
      let data: any = null;
      if (res.ok) {
        data = await res.json();
      }

      // Se não for transferência, tenta como transação PIX (QR Code)
      if (!res.ok || data?.object !== 'transfer') {
        res = await fetch(`${baseUrl}/pix/transactions/${encodeURIComponent(providerId)}`, {
          headers: { access_token: String(config.apiKey) },
        });
        if (res.ok) {
          data = await res.json();
        }
      }

      let providerStatus: string | null = null;
      let endToEndId: string | null = payment.bankEnd2EndId;
      let failureDetail: string | null = null;
      let failureCode: string | null = null;

      if (data) {
        providerStatus = String(data?.status || '').toUpperCase();
        endToEndId = data?.endToEndIdentifier || data?.endToEndId || endToEndId;
        failureDetail =
          data?.failureReason ||
          data?.failReason ||
          data?.reason ||
          data?.message ||
          data?.statusDescription ||
          data?.errors?.[0]?.description ||
          null;
        failureCode =
          data?.failureCode ||
          data?.reasonCode ||
          data?.errorCode ||
          data?.errors?.[0]?.code ||
          null;
        this.logger.debug(`[POLLER] ${payment.id} → status: ${providerStatus} | code: ${failureCode || 'N/A'} | detail: ${failureDetail || 'N/A'} | raw: ${JSON.stringify(data).slice(0, 300)}`);
      } else {
        // Fallback: tenta consultStatus padrão do adapter se as consultas acima falharem
        if (typeof adapter.consultStatus === 'function' && payment.bankEnd2EndId) {
          const status = await adapter.consultStatus({ endToEndId: payment.bankEnd2EndId });
          providerStatus = String(status?.bankStatus || status?.status || '').toUpperCase();
        }
      }

      if (!providerStatus) return;

      // Atualiza providerStatus + lastPolledAt
      await this.paymentsRepo.updateStatus(payment.id, 'PROCESSING', {
        providerStatus,
        lastPolledAt: new Date(),
      } as any);

      // Estados de sucesso definitivos
      const SUCCESS_STATES = ['DONE', 'CONFIRMED', 'COMPLETED', 'RECEIVED', 'SETTLED', 'EXECUTED'];
      const FAIL_STATES = ['REFUSED', 'CANCELLED', 'CANCELED', 'FAILED', 'REJECTED', 'OVERDUE', 'EXPIRED'];

      if (SUCCESS_STATES.includes(providerStatus)) {
        await this.paymentsService.markPaymentSuccess(payment.id, payment.qrCodeId, endToEndId);
      } else if (FAIL_STATES.includes(providerStatus)) {
        const detail = failureDetail || 'motivo não informado';
        const codeSuffix = failureCode ? ` (${failureCode})` : '';
        const errorMsg = `Pix recusado pela Asaas${codeSuffix}: ${detail}`;
        this.logger.warn(`[POLLER] ❌ ${payment.id} → ${providerStatus}${codeSuffix} | motivo: ${detail}`);
        await this.paymentsService.markPaymentFailed(
          payment.id,
          payment.qrCodeId,
          providerStatus,
          errorMsg,
        );
      }
      // Qualquer outro status (PENDING, AWAITING_REQUEST, SCHEDULED) → continua aguardando
    } catch (err: any) {
      this.logger.warn(`[POLLER] HTTP fail para ${payment.id}: ${err.message}`);
    }
  }

  private resolveConfig(bankConfig: Record<string, unknown> | null): Record<string, unknown> | null {
    if (!bankConfig) return null;
    const asaas = (bankConfig as any).asaas;
    if (asaas) {
      const env = asaas.production?.apiKey ? 'production' : (asaas.sandbox?.apiKey ? 'sandbox' : null);
      if (!env) return null;
      const envConfig = asaas[env];
      let apiKey = envConfig.apiKey;
      try { apiKey = this.encryptionService.decrypt(envConfig.apiKey); } catch {}
      return { ...envConfig, apiKey };
    }
    return null;
  }
}
