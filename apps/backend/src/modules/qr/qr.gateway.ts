import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { QrCodeEntity } from '../../database/entities/qr-code.entity';
import { RawQrCaptureEntity } from '../../database/entities/raw-qr-capture.entity';
import { PaymentEntity } from '../../database/entities/payment.entity';
import { UseGuards } from '@nestjs/common';
import { WsThrottlerGuard } from '../../common/guards/ws-throttler.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';

@UseGuards(WsThrottlerGuard)
@WebSocketGateway({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
})
export class QrGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(QrGateway.name);

  // Map: socketId -> userId
  private connectedClients = new Map<string, string>();
  // Map: socketId -> deviceId (for extension sockets)
  private connectedDevices = new Map<string, string>();

  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  afterInit(server: Server) {
    this.logger.log('🔌 WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      // Prioridade: auth.token (socket.io-client envia via { auth: { token } })
      // Fallback: query.token ou query.apiKey (dashboard ou clientes legados)
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query.token as string) ||
        (client.handshake.query.apiKey as string);

      if (!token) {
        this.logger.warn(`[BACKEND] Conexão recusada: token ausente | socketId: ${client.id}`);
        client.disconnect();
        return;
      }

      // Diferencia 3 tipos de token:
      //   1. JWT de SESSÃO (dashboard, login) — payload.type === 'session'
      //   2. JWT de DEVICE (extensão)         — payload.deviceId presente
      //   3. API Key (legado / scripts)       — string que casa com user.apiKey
      let userId: string;
      let isDevice = false;
      let deviceId: string | null = null;
      let sessionId: string | null = null;

      try {
        const payload: any = this.jwtService.verify(token);
        if (payload?.type === 'session' && payload?.userId) {
          // Sessão do dashboard
          userId = payload.userId;
          sessionId = payload.sessionId;

          // Valida sessão única no BD
          const sessionUser = await this.userRepo.findOne({ where: { id: userId } });
          if (!sessionUser || sessionUser.currentSessionId !== sessionId) {
            this.logger.warn(`[BACKEND] Sessão inválida (revogada) | socketId: ${client.id}`);
            client.emit('SESSION_REVOKED', { reason: 'Sessão inválida.' });
            client.disconnect();
            return;
          }
          if (!sessionUser.isActive) {
            client.disconnect();
            return;
          }
        } else if (payload?.deviceId) {
          // Token de device (extensão)
          userId = payload.userId;
          this.connectedDevices.set(client.id, payload.deviceId);
          deviceId = payload.deviceId;
          isDevice = true;
        } else {
          throw new Error('JWT payload sem userId/deviceId');
        }
      } catch (jwtErr) {
        // Fallback: API Key
        const user = await this.userRepo.findOne({ where: { apiKey: token } });
        if (!user) {
          this.logger.warn(`[BACKEND] Token inválido ou API Key não encontrada | socketId: ${client.id}`);
          client.disconnect();
          return;
        }
        if (!user.isActive) {
          client.disconnect();
          return;
        }
        userId = user.id;
      }

      this.connectedClients.set(client.id, userId);
      client.join(`user:${userId}`);

      if (isDevice && deviceId) {
        this.logger.log(`[BACKEND] Extensão conectada via WS: deviceId ${deviceId} | socketId: ${client.id}`);
        this.broadcastToUser(userId, 'DEVICE_ONLINE', { deviceId });
      } else {
        this.logger.log(`Client connected: ${client.id} | user: ${userId}`);
      }

      client.emit('CONNECTED', {
        event: 'CONNECTED',
        data: { message: 'Conectado ao Capital Prime' },
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.warn(`Connection rejected: ${client.id} — ${(err as Error).message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = this.connectedClients.get(client.id);
    const deviceId = this.connectedDevices.get(client.id);

    if (userId && deviceId) {
      this.broadcastToUser(userId, 'DEVICE_OFFLINE', { deviceId });
    }

    this.connectedClients.delete(client.id);
    this.connectedDevices.delete(client.id);
    this.logger.log(`Client disconnected: ${client.id} | user: ${userId}`);
  }

  // ── Event Listeners ────────────────────────────────────────

  @OnEvent('qr.new')
  handleQrNew(qrCode: QrCodeEntity) {
    this.broadcastToUser(qrCode.userId, 'QR_RECEIVED', {
      id: qrCode.id,
      payload: qrCode.payload,
      amount: qrCode.amount,
      merchantName: qrCode.merchantName,
      merchantCity: qrCode.merchantCity,
      pixKey: qrCode.pixKey,
      transactionId: qrCode.transactionId,
      sourceUrl: qrCode.sourceUrl,
      status: qrCode.status,
      capturedAt: qrCode.capturedAt,
      deviceId: qrCode.deviceId,
      canPay: qrCode.canPay,
      isRaw: qrCode.isRaw,
    });
  }

  @OnEvent('raw_qr_capture.new')
  handleRawQrCaptureNew(capture: RawQrCaptureEntity) {
    this.broadcastToUser(capture.userId, 'raw_qr_capture_created', {
      id: capture.id,
      rawContent: capture.rawContent,
      sourceUrl: capture.sourceUrl,
      pageTitle: capture.pageTitle,
      captureMethod: capture.captureMethod,
      status: capture.status,
      validationStatus: capture.validationStatus,
      canPay: capture.canPay,
      capturedAt: capture.capturedAt,
      deviceId: capture.deviceId,
    });
  }

  @OnEvent('qr.approved')
  handleQrApproved(qrCode: QrCodeEntity) {
    this.broadcastToUser(qrCode.userId, 'QR_STATUS_UPDATE', {
      id: qrCode.id,
      status: 'APPROVED',
      approvedAt: qrCode.approvedAt,
    });
  }

  @OnEvent('qr.paying')
  handleQrPaying(qrCode: QrCodeEntity & { status: 'PAYING' }) {
    this.broadcastToUser(qrCode.userId, 'QR_STATUS_UPDATE', {
      id: qrCode.id,
      status: 'PAYING',
    });
  }

  @OnEvent('qr.rejected')
  handleQrRejected(qrCode: QrCodeEntity) {
    this.broadcastToUser(qrCode.userId, 'QR_STATUS_UPDATE', {
      id: qrCode.id,
      status: 'REJECTED',
    });
  }

  @OnEvent('qr.cancelled')
  handleQrCancelled(qrCode: QrCodeEntity) {
    this.broadcastToUser(qrCode.userId, 'QR_STATUS_UPDATE', {
      id: qrCode.id,
      status: 'CANCELLED',
    });
  }

  @OnEvent('payment.pending')
  handlePaymentPending(payment: PaymentEntity) {
    this.broadcastToUser(payment.userId, 'PAYMENT_PENDING', {
      paymentId: payment.id,
      qrCodeId: payment.qrCodeId,
      status: 'PENDING',
      amount: payment.amount,
    });
  }

  @OnEvent('payment.processing')
  handlePaymentProcessing(payment: PaymentEntity) {
    this.broadcastToUser(payment.userId, 'PAYMENT_PROCESSING', {
      paymentId: payment.id,
      qrCodeId: payment.qrCodeId,
      status: 'PROCESSING',
      amount: payment.amount,
      providerStatus: (payment as any).providerStatus,
    });
  }

  @OnEvent('payment.success')
  handlePaymentSuccess(payment: PaymentEntity) {
    this.broadcastToUser(payment.userId, 'PAYMENT_SUCCESS', {
      paymentId: payment.id,
      qrCodeId: payment.qrCodeId,
      status: 'SUCCESS',
      amount: payment.amount,
      bankEnd2EndId: payment.bankEnd2EndId,
      executedAt: payment.executedAt,
    });
  }

  @OnEvent('payment.failed')
  handlePaymentFailed(payment: PaymentEntity) {
    this.broadcastToUser(payment.userId, 'PAYMENT_FAILED', {
      paymentId: payment.id,
      qrCodeId: payment.qrCodeId,
      status: 'FAILED',
      amount: payment.amount,
      errorMessage: payment.errorMessage,
    });
  }

  @OnEvent('extension.status.changed')
  handleExtensionStatusChanged(event: any) {
    this.broadcastToUser(event.userId, 'extension.status.update', event);
  }

  @OnEvent('qr.enriched')
  handleQrEnriched(qrCode: QrCodeEntity) {
    this.broadcastToUser(qrCode.userId, 'QR_ENRICHED', {
      id:              qrCode.id,
      amount:          qrCode.amount,
      merchantName:    qrCode.merchantName,
      merchantCity:    qrCode.merchantCity,
      pixKey:          qrCode.pixKey,
      transactionId:   qrCode.transactionId,
      institutionName: (qrCode as any).institutionName ?? null,
      asaasStatus:     (qrCode as any).asaasStatus ?? null,
      expirationDate:  (qrCode as any).expirationDate ?? null,
    });
  }

  @OnEvent('extension.revoked')
  handleExtensionRevoked(event: { userId: string; deviceId: string }) {
    for (const [socketId, connectedDeviceId] of this.connectedDevices.entries()) {
      if (connectedDeviceId === event.deviceId) {
        this.server.sockets.sockets.get(socketId)?.disconnect(true);
      }
    }
  }

  /**
   * Sessão única: revoga todos os sockets do usuário quando há novo login,
   * logout, reset de senha ou ação admin.
   */
  @OnEvent('auth.session.revoked')
  handleSessionRevoked(event: { userId: string; sessionId: string | null }) {
    this.logger.log(`[BACKEND] Revogando sockets do usuário ${event.userId}`);
    for (const [socketId, connectedUserId] of this.connectedClients.entries()) {
      if (connectedUserId === event.userId) {
        const socket = this.server.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('SESSION_REVOKED', {
            reason: 'Sua sessão foi encerrada (login em outro dispositivo ou ação do admin).',
          });
          socket.disconnect(true);
        }
      }
    }
  }

  // ── Helper ─────────────────────────────────────────────────

  private broadcastToUser(userId: string, event: string, data: unknown) {
    this.server.to(`user:${userId}`).emit(event, {
      event,
      data,
      timestamp: new Date().toISOString(),
      userId,
    });
  }

  public isDeviceOnline(deviceId: string): boolean {
    for (const [_, connectedDeviceId] of this.connectedDevices.entries()) {
      if (connectedDeviceId === deviceId) {
        return true;
      }
    }
    return false;
  }

  public async testDeviceConnection(deviceId: string): Promise<boolean> {
    let targetSocketId: string | undefined;
    for (const [socketId, connectedDeviceId] of this.connectedDevices.entries()) {
      if (connectedDeviceId === deviceId) {
        targetSocketId = socketId;
        break;
      }
    }
    if (!targetSocketId) return false;
    
    const socket = this.server.sockets.sockets.get(targetSocketId);
    if (!socket) return false;
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 3000);
      socket.emit('ping', { deviceId });
      socket.once('pong', (data) => {
        if (data?.deviceId === deviceId) {
          clearTimeout(timeout);
          resolve(true);
        }
      });
    });
  }
}
