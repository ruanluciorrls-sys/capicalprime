import {
  Injectable, ConflictException, NotFoundException,
  BadRequestException, Logger
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { createHash } from 'crypto';

import { QrRepository } from './qr.repository';
import { IngestQrDto } from './dto/ingest-qr.dto';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { parsePix, normalizePixInput } from '@aios/shared';
import { QrCodeEntity } from '../../database/entities/qr-code.entity';
import { RawQrCaptureEntity } from '../../database/entities/raw-qr-capture.entity';
import { ExtensionDeviceEntity } from '../../database/entities/extension-device.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuditLogService } from '../../common/services/audit-log.service';
import { RawQrCaptureDto } from './dto/raw-qr-capture.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

function normalizePixCandidateText(text: string): string {
  return String(text || '')
    .replace(/\s+/g, '')
    .replace(/\u200B|\u200C|\u200D/g, '')
    .trim();
}

function isPixCandidate(text: string): boolean {
  const clean = normalizePixCandidateText(text);
  return (
    clean.length >= 80 &&
    clean.startsWith('000201') &&
    clean.toLowerCase().includes('br.gov.bcb.pix') &&
    /6304[A-F0-9]{4}$/i.test(clean)
  );
}

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name);
  constructor(
    private readonly qrRepo: QrRepository,
    @InjectRepository(RawQrCaptureEntity)
    private readonly rawCaptureRepo: Repository<RawQrCaptureEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditLog: AuditLogService,
  ) {}

  async ingest(dto: IngestQrDto, device: ExtensionDeviceEntity): Promise<QrCodeEntity> {
    // Limpar o payload (remove espaÃ§os e chars invisÃ­veis) â€” mesma limpeza do ingestManual.
    // CRÃTICO: o parser PIX EMV precisa de payload sem espaÃ§os para calcular offsets TLV corretamente.
    const cleanPayload = normalizePixInput(dto.payload);
    const hasCountryTagBR = cleanPayload.toUpperCase().includes('5802BR');
    if (!hasCountryTagBR) {
      this.logger.warn('[INGEST] Payload Pix sem tag 5802BR (reforco nao bloqueante).');
    }

    // Sempre calcular o hash do payload limpo para deduplicaÃ§Ã£o consistente.
    // (Ignoramos dto.payloadHash para evitar divergÃªncia hash-sujo vs hash-limpo)
    const payloadHash = createHash('sha256').update(cleanPayload).digest('hex');

    this.logger.log(`[INGEST] payloadHash: ${payloadHash.substring(0, 16)}... | device: ${device.id}`);

    // Global deduplication check
    const existing = await this.qrRepo.findByHash(payloadHash);
    if (existing) {
      throw new ConflictException({
        code: 'QR_DUPLICATE',
        message: 'Este QR Code jÃ¡ foi capturado anteriormente.',
        existingId: existing.id,
      });
    }

    // Tenta parsear como Pix; se invÃ¡lido, salva como captura bruta (RAW_CAPTURED)
    const parsed = parsePix(cleanPayload);
    const isValidPix = parsed.isValid;

    const status = isValidPix ? 'PENDING' : 'RAW_CAPTURED';
    const canPay = isValidPix;

    this.logger.log(
      `[INGEST] isValidPix=${isValidPix} | status=${status} | user: ${device.userId}`,
    );

    // Persist
    let qrCode: QrCodeEntity;
    try {
      qrCode = await this.qrRepo.create({
        userId: device.userId,
        deviceId: device.deviceId,
        payload: cleanPayload,
        payloadHash,
        // Campos Pix sÃ³ preenchidos se vÃ¡lido
        amount:       isValidPix ? parsed.amount       : null,
        merchantName: isValidPix ? parsed.merchantName : null,
        merchantCity: isValidPix ? parsed.merchantCity : null,
        pixKey:       isValidPix ? parsed.pixKey       : null,
        transactionId: isValidPix ? parsed.transactionId : null,
        sourceUrl: dto.sourceUrl,
        status,
        canPay,
        isRaw: !isValidPix,
        capturedAt: new Date(dto.capturedAt),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new ConflictException({
          code: 'QR_DUPLICATE',
          message: 'Este QR Code jÃ¡ foi capturado anteriormente (bloqueado por concorrÃªncia).',
        });
      }
      throw error;
    }

    this.logger.log(`QR ingested: ${qrCode.id} | status: ${status} | user: ${device.userId}`);

    await this.auditLog.record({
      entity: 'QrCode',
      entityId: qrCode.id,
      action: 'INGEST',
      actorId: device.userId,
      newData: {
        status,
        canPay,
        isRaw: !isValidPix,
        amount: parsed.amount,
        merchantName: parsed.merchantName,
        sourceUrl: dto.sourceUrl,
      },
    });

    // Emit event para broadcast WebSocket (dashboard recebe via QR_RECEIVED)
    this.eventEmitter.emit('qr.new', qrCode);

    return qrCode;
  }

  /**
   * Ingest manual a partir do dashboard (sem device).
   *
   * Tratamento inteligente de duplicidade:
   *  - Se jÃ¡ existe e estÃ¡ PENDING/RAW_CAPTURED â†’ reutiliza (devolve o existente)
   *  - Se estÃ¡ APPROVED/PAID â†’ erro claro (jÃ¡ processado)
   *  - Se estÃ¡ REJECTED/CANCELLED/ERROR â†’ reseta de volta pra PENDING (permite re-tentar)
   */
  async ingestManual(payload: string, sourceUrl: string | undefined, userId: string): Promise<QrCodeEntity> {
    const candidatePayload = normalizePixCandidateText(payload);
    const cleanPayload = normalizePixInput(payload);
    const hasCountryTagBR = cleanPayload.toUpperCase().includes('5802BR');
    if (!hasCountryTagBR) {
      this.logger.warn('[INGEST MANUAL] Payload Pix sem tag 5802BR (reforco nao bloqueante).');
    }
    const isCandidate = isPixCandidate(candidatePayload);
    if (!isCandidate) {
      throw new BadRequestException({
        code: 'INVALID_PIX',
        message: 'Conteudo nao e um QR Code Pix valido (requer 000201, BR.GOV.BCB.PIX e CRC final 6304XXXX valido).',
      });
    }

    const payloadHash = createHash('sha256').update(cleanPayload).digest('hex');

    this.logger.log(`[INGEST MANUAL] user: ${userId} | hash: ${payloadHash.substring(0, 16)}...`);

    const parsed = parsePix(cleanPayload);
    const isValidPix = parsed.isValid;
    const nextStatus = isValidPix ? 'PENDING' : 'RAW_CAPTURED';
    const nextCanPay = isValidPix;
    const nextIsRaw = !isValidPix;

    if (!isValidPix) {
      this.logger.warn('[INGEST MANUAL] Candidato Pix recebido, mas parse EMV/CRC falhou. Salvando como RAW_CAPTURED.');
    }

    // â”€â”€ Verifica duplicidade â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const existing = await this.qrRepo.findByHash(payloadHash);
    if (existing) {
      // SÃ³ pode reutilizar QR do prÃ³prio usuÃ¡rio
      if (existing.userId !== userId) {
        throw new ConflictException({
          code: 'QR_DUPLICATE_OTHER_USER',
          message: 'Este QR Code jÃ¡ foi capturado em outra conta.',
        });
      }

      // JÃ¡ pago/aprovado â†’ erro claro
      if (existing.status === 'PAID') {
        throw new ConflictException({
          code: 'QR_ALREADY_PAID',
          message: 'Este QR Code jÃ¡ foi pago anteriormente.',
          existingId: existing.id,
        });
      }
      if (existing.status === 'APPROVED') {
        throw new ConflictException({
          code: 'QR_ALREADY_APPROVED',
          message: 'Este QR Code jÃ¡ foi aprovado e o pagamento estÃ¡ em processamento.',
          existingId: existing.id,
        });
      }

      // Pendente â†’ devolve o mesmo, pra ser aprovado
      if (existing.status === 'PENDING' || existing.status === 'RAW_CAPTURED') {
        this.logger.log(`[INGEST MANUAL] QR jÃ¡ existe como ${existing.status}, reaproveitando ${existing.id}`);
        return existing;
      }

      // Rejeitado/cancelado/erro â†’ reseta pra PENDING e atualiza dados
      this.logger.log(`[INGEST MANUAL] QR existia como ${existing.status}, resetando para ${nextStatus}`);
      await this.qrRepo.updateStatus(existing.id, nextStatus, {
        amount:       isValidPix ? (parsed.amount ?? existing.amount) : existing.amount,
        merchantName: isValidPix ? (parsed.merchantName ?? existing.merchantName) : existing.merchantName,
        merchantCity: isValidPix ? (parsed.merchantCity ?? existing.merchantCity) : existing.merchantCity,
        pixKey:       isValidPix ? (parsed.pixKey ?? existing.pixKey) : existing.pixKey,
        transactionId: isValidPix ? (parsed.transactionId ?? existing.transactionId) : existing.transactionId,
        sourceUrl:    sourceUrl ?? 'manual',
        canPay:       nextCanPay,
        isRaw:        nextIsRaw,
        capturedAt:   new Date(),
      } as any);

      const refreshed = await this.qrRepo.findById(existing.id);
      this.eventEmitter.emit('qr.new', refreshed!);
      return refreshed!;
    }

    // â”€â”€ CriaÃ§Ã£o nova â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    let qrCode: QrCodeEntity;
    try {
      qrCode = await this.qrRepo.create({
        userId,
        deviceId: null,
        payload: cleanPayload,
        payloadHash,
        amount:        isValidPix ? parsed.amount : null,
        merchantName:  isValidPix ? parsed.merchantName : null,
        merchantCity:  isValidPix ? parsed.merchantCity : null,
        pixKey:        isValidPix ? parsed.pixKey : null,
        transactionId: isValidPix ? parsed.transactionId : null,
        sourceUrl:     sourceUrl ?? 'manual',
        status:        nextStatus,
        canPay:        nextCanPay,
        isRaw:         nextIsRaw,
        capturedAt:    new Date(),
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        // Race condition â€” tenta buscar e devolver
        const race = await this.qrRepo.findByHash(payloadHash);
        if (race) return race;
        throw new ConflictException({
          code: 'QR_DUPLICATE',
          message: 'Este QR Code jÃ¡ foi registrado (concorrÃªncia).',
        });
      }
      throw error;
    }

    this.logger.log(`[INGEST MANUAL] QR criado: ${qrCode.id} | status: ${nextStatus} | user: ${userId}`);

    await this.auditLog.record({
      entity: 'QrCode',
      entityId: qrCode.id,
      action: 'INGEST_MANUAL',
      actorId: userId,
      newData: {
        status: nextStatus,
        canPay: nextCanPay,
        isRaw: nextIsRaw,
        amount: parsed.amount,
        merchantName: parsed.merchantName,
        sourceUrl,
      },
    });

    this.eventEmitter.emit('qr.new', qrCode);

    return qrCode;
  }

  async ingestRaw(dto: RawQrCaptureDto, device: ExtensionDeviceEntity): Promise<RawQrCaptureEntity> {
    const rawHash = dto.rawHash || createHash('sha256').update(dto.rawContent).digest('hex');

    this.logger.log(`[RAW INGEST] rawHash recebido: ${dto.rawHash ? 'sim' : 'nÃ£o (calculado)'} | hash: ${rawHash}`);

    const existing = await this.rawCaptureRepo.findOne({ where: { rawHash } });
    if (existing) {
      throw new ConflictException({
        code: 'RAW_CAPTURE_DUPLICATE',
        message: 'Esta captura bruta jÃ¡ foi processada anteriormente.',
        existingId: existing.id,
      });
    }

    const capture = this.rawCaptureRepo.create({
      userId: device.userId,
      deviceId: device.deviceId,
      rawContent: dto.rawContent,
      rawHash,
      sourceUrl: dto.sourceUrl,
      pageTitle: dto.pageTitle,
      captureMethod: dto.captureMethod,
      capturedAt: new Date(dto.capturedAt),
    });

    let savedCapture: RawQrCaptureEntity;
    try {
      savedCapture = await this.rawCaptureRepo.save(capture);
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new ConflictException('Captura bruta bloqueada por concorrÃªncia.');
      }
      throw error;
    }

    this.logger.log(`Raw capture saved: ${savedCapture.id} | user: ${device.userId}`);

    // Emit event for WebSocket broadcast
    this.eventEmitter.emit('raw_qr_capture.new', savedCapture);

    return savedCapture;
  }

  async findAll(userId: string, pagination: PaginationDto) {
    return this.qrRepo.findAllByUser(userId, pagination);
  }

  async findOne(id: string, userId: string): Promise<QrCodeEntity> {
    const qr = await this.qrRepo.findById(id);
    if (!qr || qr.userId !== userId) {
      throw new NotFoundException('QR Code nÃ£o encontrado.');
    }
    return qr;
  }

  async approve(id: string, approverId: string): Promise<QrCodeEntity> {
    const qr = await this.findOne(id, approverId);

    if (qr.status !== 'PENDING') {
      throw new BadRequestException(`QR Code estÃ¡ com status ${qr.status}, nÃ£o pode ser aprovado.`);
    }

    const updated = await this.qrRepo.updateStatus(id, 'APPROVED', {
      approvedAt: new Date(),
      approvedBy: approverId,
    });

    this.logger.log(`QR approved: ${id} | by: ${approverId}`);

    await this.auditLog.record({
      entity: 'QrCode',
      entityId: id,
      action: 'APPROVE',
      actorId: approverId,
      oldData: { status: 'PENDING' },
      newData: { status: 'APPROVED' },
    });

    this.eventEmitter.emit('qr.approved', updated);

    return updated;
  }

  async reject(id: string, userId: string): Promise<QrCodeEntity> {
    const qr = await this.findOne(id, userId);

    if (qr.status !== 'PENDING' && qr.status !== 'RAW_CAPTURED') {
      throw new BadRequestException(`QR Code estÃ¡ com status ${qr.status}, nÃ£o pode ser rejeitado.`);
    }

    const updated = await this.qrRepo.updateStatus(id, 'REJECTED');

    this.logger.log(`QR rejected: ${id} | by: ${userId}`);

    await this.auditLog.record({
      entity: 'QrCode',
      entityId: id,
      action: 'REJECT',
      actorId: userId,
      oldData: { status: 'PENDING' },
      newData: { status: 'REJECTED' },
    });

    this.eventEmitter.emit('qr.rejected', updated);

    return updated;
  }

  async getStats(userId: string) {
    return this.qrRepo.getStats(userId);
  }

  async cancel(id: string, userId: string): Promise<QrCodeEntity> {
    const qr = await this.findOne(id, userId);

    if (qr.status !== 'PENDING' && qr.status !== 'RAW_CAPTURED') {
      throw new BadRequestException(`QR Code estÃ¡ com status ${qr.status}, nÃ£o pode ser cancelado.`);
    }

    const updated = await this.qrRepo.updateStatus(id, 'CANCELLED');

    await this.auditLog.record({
      entity: 'QrCode',
      entityId: id,
      action: 'CANCEL',
      actorId: userId,
      oldData: { status: 'PENDING' },
      newData: { status: 'CANCELLED' },
    });

    this.eventEmitter.emit('qr.cancelled', updated);
    return updated;
  }

  async markAsPaid(id: string): Promise<QrCodeEntity> {
    return this.qrRepo.updateStatus(id, 'PAID');
  }

  async markAsError(id: string): Promise<QrCodeEntity> {
    return this.qrRepo.updateStatus(id, 'ERROR');
  }

  async deleteRaw(id: string, userId: string): Promise<void> {
    const raw = await this.rawCaptureRepo.findOne({ where: { id, userId } });
    if (!raw) {
      throw new NotFoundException('Captura bruta nÃ£o encontrada.');
    }
    await this.rawCaptureRepo.delete(id);
    this.logger.log(`Raw capture deleted: ${id} | by: ${userId}`);
  }

  async findRawCaptures(userId: string): Promise<RawQrCaptureEntity[]> {
    return this.rawCaptureRepo.find({
      where: { userId, validationStatus: 'pending_validation' },
      order: { capturedAt: 'DESC' },
    });
  }

  // â”€â”€ Pix AutomÃ¡tico â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Se o usuÃ¡rio tem AUTO_PAYMENT liberado E autoPayEnabled=true,
  // agenda aprovaÃ§Ã£o automÃ¡tica apÃ³s o delay configurado (5â€“10s).
  @OnEvent('qr.new')
  async handleAutoApprove(qrCode: QrCodeEntity): Promise<void> {
    if (!qrCode?.canPay || !qrCode?.userId) return;

    try {
      const user = await this.userRepo.findOne({ where: { id: qrCode.userId } });
      if (!user) return;

      // Feature flag: AUTO_PAYMENT deve estar liberado no perfil
      const hasFeature = Array.isArray(user.features) && user.features.includes('AUTO_PAYMENT' as any);
      if (!hasFeature) return;

      const bc = (user.bankConfig || {}) as Record<string, any>;
      if (!bc.autoPayEnabled) return;

      const delayMs = Math.max(5, Math.min(10, Number(bc.autoPayDelaySeconds ?? 5))) * 1000;
      this.logger.log(`[AUTO-PAY] Agendando aprovaÃ§Ã£o de ${qrCode.id} em ${delayMs / 1000}s`);

      setTimeout(async () => {
        try {
          const fresh = await this.qrRepo.findById(qrCode.id);
          if (!fresh || fresh.status !== 'PENDING') {
            this.logger.log(`[AUTO-PAY] QR ${qrCode.id} nÃ£o estÃ¡ mais PENDING (status: ${fresh?.status}), ignorando.`);
            return;
          }
          await this.approve(qrCode.id, qrCode.userId);
          this.logger.log(`[AUTO-PAY] âœ… QR ${qrCode.id} aprovado automaticamente`);
        } catch (err: any) {
          this.logger.warn(`[AUTO-PAY] Falha ao auto-aprovar ${qrCode.id}: ${err.message}`);
        }
      }, delayMs);
    } catch (err: any) {
      this.logger.warn(`[AUTO-PAY] Erro no handler: ${err.message}`);
    }
  }
}

