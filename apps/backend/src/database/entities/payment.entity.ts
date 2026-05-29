import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, OneToOne, JoinColumn
} from 'typeorm';
import { UserEntity } from './user.entity';
import { QrCodeEntity } from './qr-code.entity';
import { COL_DATETIME } from '../column-types';

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'qr_code_id' })
  qrCodeId: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'adapter_used', length: 50 })
  adapterUsed: string;

  @Column({ type: 'decimal', precision: 15, scale: 2 })
  amount: number;

  @Column({ type: 'text', default: 'PENDING' })
  status: PaymentStatus;

  // Union types are reflected as `Object` at runtime; specify column type explicitly.
  @Column({ name: 'bank_end2end_id', type: 'varchar', length: 100, nullable: true })
  bankEnd2EndId: string | null;

  /** ID do pagamento no provedor (Asaas), usado para polling de status real */
  @Column({ name: 'provider_payment_id', type: 'varchar', length: 100, nullable: true })
  providerPaymentId: string | null;

  /** Último status retornado pelo provedor (PENDING/CONFIRMED/REFUSED/etc) */
  @Column({ name: 'provider_status', type: 'varchar', length: 50, nullable: true })
  providerStatus: string | null;

  /** Última vez que consultamos o status no provedor */
  @Column({ name: 'last_polled_at', type: COL_DATETIME, nullable: true })
  lastPolledAt: Date | null;

  @Column({ name: 'bank_response', type: 'simple-json', nullable: true })
  bankResponse: unknown | null;

  /** Primeiro nome da conta Asaas que realizou o pagamento (para histórico) */
  @Column({ name: 'account_label', type: 'varchar', length: 100, nullable: true })
  accountLabel: string | null;

  /**
   * Snapshot da configuracao efetiva usada para enviar o Pix.
   * Guarda dados de auditoria sem expor segredo completo (api key mascarada).
   */
  @Column({ name: 'config_snapshot', type: 'simple-json', nullable: true })
  configSnapshot: Record<string, unknown> | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @Column({ name: 'retry_count', default: 0 })
  retryCount: number;

  @Column({ name: 'executed_at', type: COL_DATETIME, nullable: true })
  executedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @OneToOne(() => QrCodeEntity, qr => qr.payment)
  @JoinColumn({ name: 'qr_code_id' })
  qrCode: QrCodeEntity;
}
