import {
  Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parsePix, normalizePixInput } from '@aios/shared';

/**
 * Fallback: busca direto na URL do PIX dinÃ¢mico (padrÃ£o BACEN).
 * Toda PIX dinÃ¢mico tem uma URL no campo 26 sub-tag 25 (ex: qrcodes.saq.digital/v2/qr/cob/...)
 * Essa URL retorna JWS (application/jose) ou JSON com os dados da cobranÃ§a.
 * Decodificamos o JWS sem verificar assinatura (sÃ³ queremos os dados visuais).
 */
async function fetchDynamicPixFromUrl(url: string, logger: Logger): Promise<{
  amount?: number;
  merchantName?: string;
  merchantCity?: string;
  pixKey?: string;
  txid?: string;
} | null> {
  try {
    const fullUrl = url.startsWith('http') ? url : `https://${url}`;
    const res = await fetch(fullUrl, {
      headers: { 'Accept': 'application/jose, application/json' },
      // 5s timeout pra nÃ£o travar o enriquecimento
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      logger.warn(`[DIRECT-FETCH] ${fullUrl} â†’ HTTP ${res.status}`);
      return null;
    }
    const text = await res.text();
    let cob: any = null;

    // JWS tem 3 partes separadas por '.': header.payload.signature
    if (text.split('.').length === 3) {
      try {
        const payload = text.split('.')[1];
        // base64url â†’ base64 â†’ JSON
        const b64 = payload.replace(/-/g, '+').replace(/_/g, '/');
        const json = Buffer.from(b64, 'base64').toString('utf8');
        cob = JSON.parse(json);
      } catch (e: any) {
        logger.warn(`[DIRECT-FETCH] Falha ao decodificar JWS: ${e.message}`);
      }
    } else {
      try { cob = JSON.parse(text); } catch {}
    }

    if (!cob) return null;
    logger.debug(`[DIRECT-FETCH] cob: ${JSON.stringify(cob).slice(0, 400)}`);

    // PadrÃ£o BACEN: cob.valor.original / cob.devedor.nome / cob.chave / cob.txid
    const rawValue = cob?.valor?.original ?? cob?.valor?.final ?? cob?.value;
    const parsedAmount = rawValue != null ? parseFloat(String(rawValue)) : NaN;

    return {
      amount:       !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
      merchantName: cob?.recebedor?.nome ?? cob?.devedor?.nome ?? cob?.beneficiario?.nome ?? undefined,
      merchantCity: cob?.recebedor?.cidade ?? undefined,
      pixKey:       cob?.chave ?? undefined,
      txid:         cob?.txid ?? undefined,
    };
  } catch (err: any) {
    logger.warn(`[DIRECT-FETCH] Erro: ${err.message}`);
    return null;
  }
}

import { PaymentsRepository } from './payments.repository';
import { PaymentAdapterFactory } from './adapters/adapter.factory';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { QrCodeEntity } from '../../database/entities/qr-code.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { PaymentEntity } from '../../database/entities/payment.entity';
import { PaymentQueueService, QueueJob } from './services/payment-queue.service';
import { EncryptionService } from '../../common/services/encryption.service';

interface PaymentJobData {
  paymentId: string;
  qrCodeId: string;
  userId: string;
}

interface PaymentConfigSnapshot extends Record<string, unknown> {
  capturedAt: string;
  adapter: string;
  slotKey: string;
  environment: 'production' | 'sandbox';
  baseUrl: string;
  accountLabel: string | null;
  apiKeyMasked: string | null;
  autoPayEnabled: boolean | null;
  autoPayDelaySeconds: number | null;
  rotationInterval: number | null;
  paymentCounter: number | null;
}

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly paymentsRepo: PaymentsRepository,
    private readonly adapterFactory: PaymentAdapterFactory,
    private readonly eventEmitter: EventEmitter2,
    private readonly queueService: PaymentQueueService,
    @InjectRepository(QrCodeEntity)
    private readonly qrRepo: Repository<QrCodeEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Resolve a configuraÃ§Ã£o do adapter para pagamentos/consultas.
   *
   * O bankConfig pode ser salvo em dois formatos:
   * - Formato ANTIGO: todo o objeto criptografado campo a campo via encryptObject()
   * - Formato NOVO (Asaas): apenas o campo `apiKey` Ã© criptografado individualmente;
   *   os demais campos (accountHolderName, agency, accountNumber, balance) sÃ£o texto plano.
   *
   * Detectamos o formato novo pela presenÃ§a de apiKey como string e outros campos
   * nÃ£o-criptografados (nÃºmeros, strings legibles). No formato novo, decriptamos
   * apenas `apiKey`. No antigo, decriptamos tudo.
   */
  private resolveAdapterConfig(bankConfig: Record<string, unknown> | null, environment?: 'production' | 'sandbox'): Record<string, unknown> | null {
    if (!bankConfig) return null;

    const asaas = bankConfig.asaas as any;
    if (asaas) {
      const targetEnv = environment || (asaas.production?.apiKey ? 'production' : 'sandbox');
      const envConfig = asaas[targetEnv];
      
      if (envConfig && envConfig.apiKey) {
        let decryptedApiKey = envConfig.apiKey;
        try {
          decryptedApiKey = this.encryptionService.decrypt(envConfig.apiKey);
        } catch {
          this.logger.warn(`[resolveAdapterConfig] Falha ao decriptar apiKey do ambiente ${targetEnv}`);
        }
        return { ...envConfig, apiKey: decryptedApiKey };
      }
    }

    // Suporte legado
    const hasNewFormat =
      typeof bankConfig.apiKey === 'string' &&
      (typeof bankConfig.balance === 'number' ||
       typeof bankConfig.accountHolderName === 'string' ||
       typeof bankConfig.agency === 'string' ||
       typeof bankConfig.accountNumber === 'string');

    if (hasNewFormat) {
      let decryptedApiKey: string = bankConfig.apiKey as string;
      try {
        decryptedApiKey = this.encryptionService.decrypt(bankConfig.apiKey as string);
      } catch {
        this.logger.warn('[resolveAdapterConfig] Falha ao decriptar apiKey â€” usando valor bruto');
      }
      return { ...bankConfig, apiKey: decryptedApiKey };
    }

    try {
      return this.encryptionService.decryptObject<Record<string, unknown>>(bankConfig as Record<string, string>);
    } catch {
      this.logger.warn('[resolveAdapterConfig] Falha ao decriptar objeto completo â€” usando config bruta');
      return bankConfig;
    }
  }

  onModuleInit() {
    this.queueService.registerHandler('payment.process', async (job) => {
      await this.processPaymentJob(job as QueueJob<PaymentJobData>);
    });
  }

  /**
   * Seleciona qual slot de conta Asaas usar com base no rodÃ­zio configurado.
   * Slots: production (0), production2 (1), production3 (2)
   * Rotaciona a cada `rotationInterval` pagamentos.
   */
  private selectActiveAccountSlot(bankConfig: Record<string, any>): { slotKey: string; config: Record<string, unknown> | null; accountLabel: string | null } {
    const asaas = bankConfig?.asaas as Record<string, any> | undefined;
    if (!asaas) return { slotKey: 'production', config: null, accountLabel: null };

    const slots = [
      { key: 'production',  cfg: asaas.production  },
      { key: 'production2', cfg: asaas.production2 },
      { key: 'production3', cfg: asaas.production3 },
    ].filter(s => s.cfg?.apiKey);

    if (slots.length === 0) return { slotKey: 'production', config: null, accountLabel: null };
    if (slots.length === 1) {
      const s = slots[0];
      return { slotKey: s.key, config: s.cfg, accountLabel: s.cfg?.accountHolderName ?? null };
    }

    // RodÃ­zio: a cada rotationInterval pagamentos, avanÃ§a para o prÃ³ximo slot
    const interval = Math.max(1, Number(asaas.rotationInterval ?? 10));
    const counter  = Number(asaas.paymentCounter ?? 0);
    const slotIdx  = Math.floor(counter / interval) % slots.length;
    const selected = slots[slotIdx];

    this.logger.log(`[ROTATION] counter=${counter} interval=${interval} â†’ slot ${slotIdx} (${selected.key})`);
    return { slotKey: selected.key, config: selected.cfg, accountLabel: selected.cfg?.accountHolderName ?? null };
  }

  private maskApiKey(apiKey: unknown): string | null {
    if (typeof apiKey !== 'string' || !apiKey.trim()) return null;
    const key = apiKey.trim();
    const last4 = key.slice(-4);
    return `***${last4}`;
  }

  private buildPaymentConfigSnapshot(
    user: UserEntity,
    slotKey: string,
    slotConfig: Record<string, unknown> | null,
  ): PaymentConfigSnapshot {
    const bankConfigRaw = (user.bankConfig || {}) as Record<string, any>;
    const asaas = bankConfigRaw?.asaas as Record<string, any> | undefined;

    const envValue = typeof (slotConfig as any)?.environment === 'string'
      ? String((slotConfig as any).environment).toLowerCase()
      : 'production';
    const environment: 'production' | 'sandbox' = envValue === 'sandbox' ? 'sandbox' : 'production';

    const rawBaseUrl = typeof (slotConfig as any)?.baseUrl === 'string'
      ? String((slotConfig as any).baseUrl).trim()
      : '';
    const baseUrl = rawBaseUrl
      ? rawBaseUrl.replace(/\/$/, '')
      : environment === 'sandbox'
        ? 'https://api-sandbox.asaas.com/v3'
        : 'https://api.asaas.com/v3';

    const autoPayEnabled = asaas ? Boolean(asaas.autoPayEnabled) : null;
    const autoPayDelaySeconds = asaas?.autoPayDelaySeconds != null
      ? Number(asaas.autoPayDelaySeconds)
      : null;
    const rotationInterval = asaas?.rotationInterval != null
      ? Number(asaas.rotationInterval)
      : null;
    const paymentCounter = asaas?.paymentCounter != null
      ? Number(asaas.paymentCounter)
      : null;

    return {
      capturedAt: new Date().toISOString(),
      adapter: user.bankAdapter || 'mock',
      slotKey,
      environment,
      baseUrl,
      accountLabel: typeof (slotConfig as any)?.accountHolderName === 'string'
        ? (slotConfig as any).accountHolderName
        : null,
      apiKeyMasked: this.maskApiKey((slotConfig as any)?.apiKey),
      autoPayEnabled,
      autoPayDelaySeconds,
      rotationInterval,
      paymentCounter,
    };
  }

  private async incrementPaymentCounter(userId: string): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) return;
      const bc = (user.bankConfig || {}) as Record<string, any>;
      if (!bc.asaas) bc.asaas = {};
      bc.asaas.paymentCounter = (Number(bc.asaas.paymentCounter ?? 0)) + 1;
      user.bankConfig = bc;
      await this.userRepo.save(user);
    } catch (err: any) {
      this.logger.warn(`[ROTATION] Falha ao incrementar counter: ${err.message}`);
    }
  }

  async execute(qrCode: QrCodeEntity): Promise<PaymentEntity> {
    const user = await this.userRepo.findOne({ where: { id: qrCode.userId } });
    if (!user) throw new NotFoundException('UsuÃ¡rio nÃ£o encontrado.');

    // Seleciona conta ativa com rodÃ­zio
    const bankConfigRaw = (user.bankConfig || {}) as Record<string, any>;
    const { slotKey, config: slotConfig, accountLabel } = this.selectActiveAccountSlot(bankConfigRaw);
    const configSnapshot = this.buildPaymentConfigSnapshot(user, slotKey, slotConfig);

    // Create payment record
    const payment = await this.paymentsRepo.create({
      qrCodeId: qrCode.id,
      userId: qrCode.userId,
      adapterUsed: user.bankAdapter,
      amount: qrCode.amount ?? 0,
      status: 'PENDING',
      accountLabel,
      configSnapshot,
    } as any);

    await this.qrRepo.update(
      qrCode.id,
      { paymentConfigSnapshot: configSnapshot as unknown as Record<string, unknown> } as any,
    ).catch((err: any) => {
      this.logger.warn(`[PAY] Nao foi possivel salvar snapshot no QR ${qrCode.id}: ${err.message}`);
    });

    this.eventEmitter.emit('payment.pending', payment);
    this.logger.log(`Payment started: ${payment.id} | QR: ${qrCode.id} | adapter: ${user.bankAdapter} | slot: ${slotKey} | conta: ${accountLabel || 'N/A'}`);

    // Add to queue for async processing
    this.queueService.add<PaymentJobData>('payment.process', {
      paymentId: payment.id,
      qrCodeId: qrCode.id,
      userId: user.id,
    }, { maxAttempts: 3, jobId: payment.id });

    return payment;
  }

  private async processPaymentJob(job: QueueJob<PaymentJobData>): Promise<void> {
    const { paymentId, qrCodeId, userId } = job.data;

    const payment = await this.paymentsRepo.findById(paymentId);
    const qrCode = await this.qrRepo.findOne({ where: { id: qrCodeId } });
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!payment || !qrCode || !user) {
      throw new Error('Required entities not found for payment processing.');
    }

    await this.paymentsRepo.updateStatus(payment.id, 'PROCESSING');

    // Seleciona conta ativa com rodÃ­zio e resolve configuraÃ§Ã£o
    const bankConfigRaw = (user.bankConfig || {}) as Record<string, any>;
    const snapshotSlotKey =
      payment.configSnapshot &&
      typeof payment.configSnapshot === 'object' &&
      typeof (payment.configSnapshot as Record<string, unknown>).slotKey === 'string'
        ? String((payment.configSnapshot as Record<string, unknown>).slotKey)
        : null;

    const snapshotSlotConfig =
      snapshotSlotKey &&
      (bankConfigRaw?.asaas as Record<string, any> | undefined)?.[snapshotSlotKey]
        ? ((bankConfigRaw.asaas as Record<string, any>)[snapshotSlotKey] as Record<string, unknown>)
        : null;

    const selectedSlot = snapshotSlotKey && snapshotSlotConfig
      ? {
          slotKey: snapshotSlotKey,
          config: snapshotSlotConfig,
          accountLabel: (snapshotSlotConfig as any)?.accountHolderName ?? null,
        }
      : this.selectActiveAccountSlot(bankConfigRaw);

    const { slotKey, config: slotConfig, accountLabel } = selectedSlot;
    const decryptedConfig = slotConfig
      ? this.resolveAdapterConfig({ asaas: { [slotKey]: slotConfig } })
      : this.resolveAdapterConfig(user.bankConfig);
    const adapter = this.adapterFactory.getAdapter(user.bankAdapter, decryptedConfig);

    this.logger.log(`[PAY] Usando slot ${slotKey} (${accountLabel || 'sem nome'}) para payment ${paymentId}`);

    // â”€â”€ Garante que temos valor antes de pagar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let effectiveAmount = Number(payment.amount) || Number(qrCode.amount) || 0;

    // Passo 1: re-parsear o payload EMV diretamente (PIX estÃ¡tico / copia-e-cola).
    // Isso resolve o caso em que o amount foi gravado como null/0 no BD mas estÃ¡
    // embutido no campo 54 do payload.
    if (!effectiveAmount || effectiveAmount <= 0) {
      try {
        const reParsed = parsePix(qrCode.payload);
        if (reParsed.amount && reParsed.amount > 0) {
          effectiveAmount = reParsed.amount;
          await this.qrRepo.update(qrCode.id, {
            amount:       reParsed.amount,
            merchantName: qrCode.merchantName ?? reParsed.merchantName ?? null,
            pixKey:       qrCode.pixKey       ?? reParsed.pixKey       ?? null,
          });
          this.logger.log(`[PAY] Valor extraÃ­do do payload EMV (parsePix): R$ ${reParsed.amount}`);
        }
      } catch (parseErr: any) {
        this.logger.warn(`[PAY] parsePix falhou: ${parseErr.message}`);
      }
    }

    // Passo 2: se ainda sem valor, tenta decodificar via Asaas (PIX dinÃ¢mico / QR de cobranÃ§a).
    if ((!effectiveAmount || effectiveAmount <= 0) && typeof (adapter as any).decodeQr === 'function') {
      this.logger.log(`[PAY] Amount ainda vazio. Decodificando QR via Asaas...`);
      try {
        const decoded = await (adapter as any).decodeQr(qrCode.payload);
        if (decoded?.amount && decoded.amount > 0) {
          effectiveAmount = decoded.amount;
          await this.qrRepo.update(qrCode.id, {
            amount:       decoded.amount,
            merchantName: qrCode.merchantName ?? decoded.merchantName ?? null,
            pixKey:       qrCode.pixKey       ?? decoded.pixKey       ?? null,
          });
          await this.paymentsRepo.updateStatus(payment.id, 'PROCESSING', { amount: decoded.amount } as any);
          this.logger.log(`[PAY] Valor decodificado via Asaas: R$ ${decoded.amount}`);
        }
      } catch (err: any) {
        this.logger.warn(`[PAY] Decode Asaas falhou: ${err.message}`);
      }
    }

    if (!effectiveAmount || effectiveAmount <= 0) {
      const updated = await this.paymentsRepo.updateStatus(payment.id, 'FAILED', {
        errorMessage: 'NÃ£o foi possÃ­vel determinar o valor do Pix (QR sem valor).',
      });
      await this.qrRepo.update(qrCode.id, { status: 'ERROR' });
      this.eventEmitter.emit('payment.failed', updated);
      return;
    }

    // Garante que o payload estÃ¡ limpo antes de enviar ao adapter
    const cleanedPayload = normalizePixInput(qrCode.payload);

    // Detecta PIX dinÃ¢mico: se parsePix retorna uma URL, Ã© PIX dinÃ¢mico.
    // Nesse caso NÃƒO enviamos `value` â€” a Asaas lÃª o valor da URL do QR.
    // Enviar `value` diferente do valor embarcado causa "payload invÃ¡lido" na Asaas.
    let isDynamicPix = false;
    try {
      const pixMeta = parsePix(cleanedPayload);
      isDynamicPix = !!(pixMeta.url);
    } catch {}

    this.logger.log(`[PAY] Enviando para adapter â€” tipo: ${isDynamicPix ? 'DINÃ‚MICO' : 'ESTÃTICO'} | payload len: ${cleanedPayload.length} | amount: R$ ${effectiveAmount}`);

    const result = await adapter.pay({
      payload: cleanedPayload,
      amount: effectiveAmount,
      pixKey: qrCode.pixKey ?? '',
      txid: qrCode.transactionId ?? undefined,
      isDynamic: isDynamicPix,
    });

    // Erros 4xx da Asaas sÃ£o permanentes (QR expirado, jÃ¡ pago, payload invÃ¡lido, saldo insuficiente).
    // NÃ£o adianta re-tentar â€” falhamos imediatamente sem gastar as outras tentativas.
    const isPermanentError =
      !result.success &&
      (result.errorCode?.match(/^ASAAS_4\d\d$/) ||
       result.errorMessage?.toLowerCase().includes('payload') ||
       result.errorMessage?.toLowerCase().includes('expirado') ||
       result.errorMessage?.toLowerCase().includes('jÃ¡ foi pago') ||
       result.errorMessage?.toLowerCase().includes('saldo insuficiente'));

    if (!result.success && isPermanentError) {
      const errMsg = result.errorMessage ?? 'Falha permanente no pagamento (Asaas)';
      this.logger.error(`[PAY] Erro PERMANENTE (sem retry): ${errMsg} | code: ${result.errorCode}`);

      const updated = await this.paymentsRepo.updateStatus(payment.id, 'FAILED', {
        errorMessage: errMsg,
        retryCount: job.attempts,
      });
      await this.qrRepo.update(qrCode.id, { status: 'ERROR' });
      this.eventEmitter.emit('payment.failed', updated);
      return; // nÃ£o lanÃ§a erro, nÃ£o enfileira retry
    }

    if (result.success) {
      // âœ… Asaas ACEITOU o pagamento â€” mas BACEN ainda pode estar processando.
      // Marca como PROCESSING (PAGANDO) e deixa o poller confirmar o status real.
      const providerId =
        (result.rawResponse as any)?.id ??
        (result.rawResponse as any)?.paymentId ??
        result.endToEndId ?? null;

      const updated = await this.paymentsRepo.updateStatus(payment.id, 'PROCESSING', {
        bankEnd2EndId:     result.endToEndId  ?? null,
        providerPaymentId: providerId,
        providerStatus:    result.bankStatus  ?? 'PENDING',
        bankResponse:      result.rawResponse,
        lastPolledAt:      new Date(),
        retryCount:        job.attempts - 1,
      } as any);

      // Marca QR como PAYING (pagando) â€” ainda nÃ£o Ã© PAID
      await this.qrRepo.update(qrCode.id, { status: 'PAYING' });

      // Incrementa contador de rodÃ­zio
      await this.incrementPaymentCounter(userId);

      this.eventEmitter.emit('payment.processing', updated);
      this.eventEmitter.emit('qr.paying', { ...qrCode, status: 'PAYING' });
      this.logger.log(`[PAY] Aceito por Asaas. PAGANDO... | payment: ${payment.id} | providerId: ${providerId}`);

      // Se o Asaas jÃ¡ confirmou imediatamente (status DONE/CONFIRMED), finaliza
      const immediateStatus = String(result.bankStatus || '').toUpperCase();
      if (['DONE', 'CONFIRMED', 'RECEIVED', 'SETTLED', 'COMPLETED'].includes(immediateStatus)) {
        await this.markPaymentSuccess(payment.id, qrCode.id, result.endToEndId ?? null);
      }
    } else {
      const isFinal = job.attempts >= job.maxAttempts;

      const updated = await this.paymentsRepo.updateStatus(
        payment.id,
        isFinal ? 'FAILED' : 'PENDING',
        {
          errorMessage: result.errorMessage ?? 'Falha no pagamento',
          retryCount: job.attempts,
        },
      );

      if (isFinal) {
        await this.qrRepo.update(qrCode.id, { status: 'ERROR' });
        this.eventEmitter.emit('payment.failed', updated);
        this.logger.error(`[PAY] FAILED permanently: ${payment.id} â€” ${result.errorMessage}`);
      }

      throw new Error(result.errorMessage ?? 'Falha no pagamento');
    }
  }

  /**
   * Marca um pagamento como SUCCESS e o QR como PAID.
   * Usado pelo PaymentStatusPoller quando Asaas confirma o pix.
   */
  async markPaymentSuccess(paymentId: string, qrCodeId: string, endToEndId: string | null) {
    const updated = await this.paymentsRepo.updateStatus(paymentId, 'SUCCESS', {
      executedAt: new Date(),
      bankEnd2EndId: endToEndId,
      providerStatus: 'CONFIRMED',
    } as any);
    await this.qrRepo.update(qrCodeId, { status: 'PAID' });
    this.eventEmitter.emit('payment.success', updated);
    this.logger.log(`[PAY] âœ… CONCLUÃDO: ${paymentId}`);
    return updated;
  }

  /**
   * Marca um pagamento como FAILED apÃ³s Asaas reportar erro definitivo.
   */
  async markPaymentFailed(paymentId: string, qrCodeId: string, providerStatus: string, errorMessage?: string) {
    const updated = await this.paymentsRepo.updateStatus(paymentId, 'FAILED', {
      providerStatus,
      errorMessage: errorMessage ?? `Pix rejeitado pelo provedor (${providerStatus})`,
    } as any);
    await this.qrRepo.update(qrCodeId, { status: 'ERROR' });
    this.eventEmitter.emit('payment.failed', updated);
    this.logger.warn(`[PAY] âŒ FALHOU: ${paymentId} â†’ ${providerStatus}`);
    return updated;
  }

  // â”€â”€ Enriquecimento automÃ¡tico via Asaas Decode â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Escuta todo QR novo. PIX dinÃ¢mico nÃ£o carrega valor no payload (spec BACEN),
  // entÃ£o chamamos a API Asaas para decodificar e obter o valor real em background.
  // IMPORTANTE: usa a chave de produÃ§Ã£o Asaas diretamente (independente do bankAdapter),
  // da mesma forma que getBalance â€” assim funciona mesmo quando bankAdapter='mock'.
  @OnEvent('qr.new')
  async handleQrEnrichment(qrCode: QrCodeEntity): Promise<void> {
    // SÃ³ enriquece PIX vÃ¡lidos sem valor (PIX dinÃ¢mico tem amount=null por spec)
    if (!qrCode.canPay || (qrCode.amount !== null && qrCode.amount !== undefined && Number(qrCode.amount) > 0)) return;

    const user = await this.userRepo.findOne({ where: { id: qrCode.userId } });
    if (!user) return;

    // â”€â”€ Resolve chave de produÃ§Ã£o Asaas (ignora bankAdapter â€” pode ser 'mock') â”€â”€
    const PROD_URL = 'https://api.asaas.com/v3';
    const bankConfigRaw = (user.bankConfig || {}) as Record<string, any>;
    const asaas = bankConfigRaw?.asaas as Record<string, any> | undefined;
    if (!asaas) return;

    let prodApiKey: string | null = null;
    for (const slot of ['production', 'production2', 'production3'] as const) {
      const slotCfg = asaas[slot] as Record<string, any> | undefined;
      if (slotCfg?.apiKey) {
        try {
          prodApiKey = this.encryptionService.decrypt(slotCfg.apiKey as string);
        } catch {
          prodApiKey = slotCfg.apiKey as string; // fallback: nÃ£o criptografado
        }
        break;
      }
    }
    if (!prodApiKey) return;

    try {
      // â”€â”€ EstratÃ©gia 1: Asaas decode (preferencial â€” tambÃ©m retorna institutionName) â”€â”€
      const adapter = this.adapterFactory.getAdapter('asaas', { apiKey: prodApiKey, baseUrl: PROD_URL }) as any;
      let decoded: any = null;

      if (typeof adapter.decodeQr === 'function') {
        this.logger.log(`[ENRICH] [1/2] Tentando Asaas decode para QR ${qrCode.id}...`);
        decoded = await adapter.decodeQr(qrCode.payload);
      }

      // â”€â”€ EstratÃ©gia 2: Fetch direto da URL do PIX dinÃ¢mico (fallback BACEN) â”€â”€
      // Roda quando: Asaas retornou null OU retornou sem amount.
      // Usa parsePix para extrair a URL do payload (campo 26 sub-tag 25).
      if (!decoded || !decoded.amount || decoded.amount <= 0) {
        const parsed = parsePix(qrCode.payload);
        if (parsed.url) {
          this.logger.log(`[ENRICH] [2/2] Asaas sem valor â€” buscando direto em ${parsed.url}`);
          const direct = await fetchDynamicPixFromUrl(parsed.url, this.logger);
          if (direct) {
            // Merge: prioriza dados do Asaas (que tem institutionName), mas usa o amount do direct se Asaas falhou
            decoded = {
              ...(decoded || {}),
              amount:       decoded?.amount       || direct.amount,
              merchantName: decoded?.merchantName || direct.merchantName,
              merchantCity: decoded?.merchantCity || direct.merchantCity,
              pixKey:       decoded?.pixKey       || direct.pixKey,
              txid:         decoded?.txid         || direct.txid,
            };
          }
        }
      }

      if (!decoded) {
        this.logger.log(`[ENRICH] QR ${qrCode.id} â€” nenhum mÃ©todo retornou dados (PIX pode estar expirado)`);
        return;
      }

      const updates: Record<string, unknown> = {};
      if (decoded.amount && decoded.amount > 0)             updates.amount        = decoded.amount;
      if (decoded.merchantName  && !qrCode.merchantName)    updates.merchantName  = decoded.merchantName;
      if (decoded.merchantCity  && !qrCode.merchantCity)    updates.merchantCity  = decoded.merchantCity;
      if (decoded.pixKey        && !qrCode.pixKey)          updates.pixKey        = decoded.pixKey;
      if (decoded.txid          && !qrCode.transactionId)   updates.transactionId = decoded.txid;
      if (decoded.institutionName) updates.institutionName  = decoded.institutionName;
      if (decoded.asaasStatus)     updates.asaasStatus      = decoded.asaasStatus;
      if (decoded.expirationDate)  updates.expirationDate   = new Date(decoded.expirationDate);

      if (Object.keys(updates).length === 0) {
        this.logger.log(`[ENRICH] QR ${qrCode.id} â€” decode OK mas sem dados novos (PIX provavelmente expirado ou sem valor)`);
        return;
      }

      await this.qrRepo.update(qrCode.id, updates);
      this.logger.log(`[ENRICH] âœ… QR ${qrCode.id} enriquecido â€” amount=${updates.amount ?? 'N/A'}, institution=${updates.institutionName ?? 'N/A'}`);
      this.eventEmitter.emit('qr.enriched', { ...qrCode, ...updates });
    } catch (err: any) {
      this.logger.warn(`[ENRICH] Falha ao enriquecer QR ${qrCode.id}: ${err.message}`);
    }
  }

  async findAll(userId: string, pagination: PaginationDto) {
    return this.paymentsRepo.findAllByUser(userId, pagination);
  }

  async findOne(id: string, userId: string): Promise<PaymentEntity> {
    const payment = await this.paymentsRepo.findById(id);
    if (!payment || payment.userId !== userId) {
      throw new NotFoundException('Pagamento nÃ£o encontrado.');
    }
    return payment;
  }

  async retry(id: string, userId: string): Promise<PaymentEntity> {
    const payment = await this.findOne(id, userId);
    if (payment.status !== 'FAILED') {
      throw new BadRequestException('Apenas pagamentos com falha podem ser re-tentados.');
    }

    const reset = await this.paymentsRepo.updateStatus(payment.id, 'PENDING', {
      errorMessage: null,
      retryCount: 0,
    });

    this.queueService.add<PaymentJobData>('payment.process', {
      paymentId: payment.id,
      qrCodeId: payment.qrCodeId,
      userId: payment.userId,
    }, { maxAttempts: 3, jobId: payment.id });

    return reset;
  }

  /**
   * Limpeza administrativa do painel:
   * - remove pagamentos com status FAILED
   * - remove QRs rejeitados/falhos/cancelados que ficaram sem pagamento vinculado
   *
   * Nao toca em pagamentos SUCCESS/PROCESSING/PENDING.
   */
  async purgeFailedAndRejectedPanel(userId: string) {
    const deletedFailedPayments = await this.paymentsRepo.purgeFailedByUser(userId);

    const rejectedQrStatuses = ['REJECTED', 'ERROR', 'CANCELLED'];
    const qrRows = await this.qrRepo
      .createQueryBuilder('qr')
      .leftJoin(PaymentEntity, 'p', 'p.qrCodeId = qr.id')
      .select('qr.id', 'id')
      .where('qr.userId = :userId', { userId })
      .andWhere('qr.status IN (:...statuses)', { statuses: rejectedQrStatuses })
      .andWhere('p.id IS NULL')
      .getRawMany<{ id: string }>();

    const qrIdsToDelete = qrRows.map((row) => row.id).filter(Boolean);
    let deletedRejectedQrs = 0;
    if (qrIdsToDelete.length > 0) {
      const qrDelete = await this.qrRepo.delete(qrIdsToDelete);
      deletedRejectedQrs = qrDelete.affected ?? qrIdsToDelete.length;
    }

    const totalDeleted = deletedFailedPayments + deletedRejectedQrs;
    this.logger.warn(
      `[ADMIN-CLEANUP] user=${userId} | failedPayments=${deletedFailedPayments} | rejectedQrs=${deletedRejectedQrs} | total=${totalDeleted}`,
    );

    return {
      ok: true,
      deletedFailedPayments,
      deletedRejectedQrs,
      totalDeleted,
    };
  }

  async getBalance(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('UsuÃ¡rio nÃ£o encontrado.');

    const PROD_URL = 'https://api.asaas.com/v3';
    const bankConfigRaw = (user.bankConfig || {}) as Record<string, any>;
    const asaas = bankConfigRaw?.asaas as Record<string, any> | undefined;

    // â”€â”€ Resolve a chave de PRODUÃ‡ÃƒO prioritariamente â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Tenta production â†’ production2 â†’ production3. Sandbox ignorado para saldo.
    let prodApiKey: string | null = null;
    let prodSlotKey = 'production';

    if (asaas) {
      for (const slot of ['production', 'production2', 'production3'] as const) {
        const slotCfg = asaas[slot] as Record<string, any> | undefined;
        if (slotCfg?.apiKey) {
          try {
            prodApiKey = this.encryptionService.decrypt(slotCfg.apiKey as string);
          } catch {
            prodApiKey = slotCfg.apiKey as string;
          }
          prodSlotKey = slot;
          break;
        }
      }
    }

    // Fallback: formato antigo (apiKey criptografado na raiz)
    if (!prodApiKey) {
      try {
        const old = this.resolveAdapterConfig(user.bankConfig);
        if (old?.apiKey && typeof old.apiKey === 'string') {
          prodApiKey = old.apiKey;
        }
      } catch {}
    }

    // Sem chave configurada â†’ retorna null (frontend nÃ£o exibe o saldo)
    if (!prodApiKey) {
      return { success: false, available: null, configured: false, currency: 'BRL' };
    }

    this.logger.log(`[BALANCE] Consultando saldo via slot "${prodSlotKey}" em produÃ§Ã£o`);

    try {
      // Adapter com chave e URL de PRODUÃ‡ÃƒO explÃ­citas
      const adapter = this.adapterFactory.getAdapter('asaas', {
        apiKey: prodApiKey,
        baseUrl: PROD_URL,
      });
      const result = await adapter.getBalance();

      if (result.success && typeof result.available === 'number') {
        // Persiste o saldo atualizado no slot correto
        if (asaas && asaas[prodSlotKey]) {
          asaas[prodSlotKey].balance    = result.available;
          asaas[prodSlotKey].lastSyncAt = new Date().toISOString();
          bankConfigRaw.asaas = asaas;
          user.bankConfig = bankConfigRaw;
          await this.userRepo.save(user).catch(() => {});
        }
        return { success: true, available: result.available, configured: true, currency: 'BRL' };
      }

      // API falhou â†’ devolve saldo armazenado como fallback
      const stored = asaas?.[prodSlotKey]?.balance ?? bankConfigRaw?.balance ?? null;
      return {
        success: false,
        available: typeof stored === 'number' ? stored : null,
        configured: true,
        message: 'Saldo indisponÃ­vel no momento',
        currency: 'BRL',
      };
    } catch (error) {
      this.logger.error(`[BALANCE] Erro ao consultar saldo: ${(error as Error).message}`);
      const stored = asaas?.[prodSlotKey]?.balance ?? bankConfigRaw?.balance ?? null;
      return {
        success: false,
        available: typeof stored === 'number' ? stored : null,
        configured: true,
        message: 'Saldo indisponÃ­vel no momento',
        currency: 'BRL',
      };
    }
  }

  async getAsaasTransactions(userId: string, pagination: PaginationDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('UsuÃ¡rio nÃ£o encontrado.');

    const adapterName = (user.bankAdapter || '').toLowerCase();
    if (adapterName !== 'asaas') {
      return {
        items: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        message: 'IntegraÃ§Ã£o Asaas nÃ£o configurada',
      };
    }

    const adapterConfig = this.resolveAdapterConfig(user.bankConfig);
    const apiKey = typeof adapterConfig?.apiKey === 'string' ? adapterConfig.apiKey.trim() : '';
    if (!apiKey) {
      return {
        items: [],
        meta: { total: 0, page: 1, limit: 20, totalPages: 0 },
        message: 'API Asaas nÃ£o configurada',
      };
    }

    const environment = adapterConfig?.environment === 'sandbox' ? 'sandbox' : 'production';
    const baseUrl = typeof adapterConfig?.baseUrl === 'string' && adapterConfig.baseUrl
      ? String(adapterConfig.baseUrl).replace(/\/$/, '')
      : environment === 'sandbox'
        ? 'https://api-sandbox.asaas.com/v3'
        : 'https://api.asaas.com/v3';

    const page = Number(pagination.page ?? 1);
    const limit = Number(pagination.limit ?? 20);
    const status = pagination.status;

    const params = new URLSearchParams();
    params.set('offset', String(Math.max(0, (page - 1) * limit)));
    params.set('limit', String(limit));
    if (status) params.set('status', status);

    const url = `${baseUrl}/payments?${params.toString()}`;
    this.logger.log(`[ASAAS] Ambiente detectado: ${environment} | baseURL: ${baseUrl}`);

    try {
      const response = await fetch(url, {
        headers: {
          access_token: apiKey,
          'Content-Type': 'application/json',
        },
      });

      const payload = await response.json().catch(() => ({})) as any;
      if (!response.ok) {
        this.logger.error(`[ASAAS] Erro detalhado /v3/payments | status=${response.status} | body=${JSON.stringify(payload)}`);
        return {
          items: [],
          meta: { total: 0, page, limit, totalPages: 0 },
          error: payload?.errors?.[0]?.description || payload?.message || 'Falha ao buscar histÃ³rico de pagamentos',
        };
      }

      this.logger.log(`[ASAAS] Resposta da API /v3/payments: ${JSON.stringify(payload)}`);

      const rawItems: any[] = Array.isArray(payload?.data) ? payload.data : [];
      const items = rawItems.map((entry: any) => ({
        id: String(entry?.id || ''),
        customer: entry?.customerName || entry?.customer || null,
        value: typeof entry?.value === 'number' ? entry.value : 0,
        status: entry?.status || 'PENDING',
        dateCreated: entry?.dateCreated || null,
        paymentDate: entry?.paymentDate || null,
        billingType: entry?.billingType || null,
      }));

      const total = typeof payload?.totalCount === 'number' ? payload.totalCount : items.length;
      return {
        items,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar histÃ³rico de pagamentos';
      this.logger.error(`[ASAAS] Erro detalhado /v3/payments: ${message}`);
      return {
        items: [],
        meta: { total: 0, page, limit, totalPages: 0 },
        error: message,
      };
    }
  }

  async getTransactions(userId: string, pagination: PaginationDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('UsuÃ¡rio nÃ£o encontrado.');

    const adapterConfig = this.resolveAdapterConfig(user.bankConfig);
    const adapterName = (user.bankAdapter || '').toLowerCase();

    if (!adapterName || adapterName === 'mock') {
      return { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
    }

    const apiKey = adapterConfig?.apiKey;
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 }, message: 'API nÃ£o configurada' };
    }

    try {
      const adapter = this.adapterFactory.getAdapter(user.bankAdapter, adapterConfig);
      if (typeof (adapter as any).getTransactions !== 'function') {
        return { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 }, message: 'Extrato nÃ£o suportado por este banco' };
      }
      const page = Number(pagination.page ?? 1);
      const limit = Number(pagination.limit ?? 20);
      return (adapter as any).getTransactions(limit, (page - 1) * limit);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao buscar transaÃ§Ãµes';
      this.logger.error(`[getTransactions] ${message}`);
      return { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 }, error: message };
    }
  }

  /**
   * DiagnÃ³stico: decodifica um payload via Asaas decode e retorna a resposta completa.
   * Permite verificar se o QR estÃ¡ expirado, qual o valor, etc., sem efetuar pagamento.
   */
  async debugDecodeQr(userId: string, payload: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('UsuÃ¡rio nÃ£o encontrado.');

    const PROD_URL = 'https://api.asaas.com/v3';
    const bankConfigRaw = (user.bankConfig || {}) as Record<string, any>;
    const asaas = bankConfigRaw?.asaas as Record<string, any> | undefined;

    let prodApiKey: string | null = null;
    if (asaas) {
      for (const slot of ['production', 'production2', 'production3'] as const) {
        const slotCfg = asaas[slot] as Record<string, any> | undefined;
        if (slotCfg?.apiKey) {
          try { prodApiKey = this.encryptionService.decrypt(slotCfg.apiKey as string); }
          catch { prodApiKey = slotCfg.apiKey as string; }
          break;
        }
      }
    }

    if (!prodApiKey) {
      return { error: 'Nenhuma chave Asaas de produÃ§Ã£o configurada.', payload };
    }

    const cleanPayload = normalizePixInput(payload);
    const adapter = this.adapterFactory.getAdapter('asaas', { apiKey: prodApiKey, baseUrl: PROD_URL }) as any;
    const decoded = await adapter.decodeQr(cleanPayload);

    return {
      payload: cleanPayload.slice(0, 80) + '...',
      payloadLength: cleanPayload.length,
      asaasDecodeResult: decoded,
      environment: 'production',
      baseUrl: PROD_URL,
    };
  }

  async debugBalance(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('UsuÃ¡rio nÃ£o encontrado.');

    const adapterConfig = this.resolveAdapterConfig(user.bankConfig);
    const adapter = this.adapterFactory.getAdapter(user.bankAdapter, adapterConfig);
    const result = await adapter.getBalance();
    // Retorna tudo incluindo rawResponse para diagnÃ³stico
    return result;
  }
}

