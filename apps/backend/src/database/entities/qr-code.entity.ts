import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, OneToOne
} from 'typeorm';
import { UserEntity } from './user.entity';
import { ExtensionDeviceEntity } from './extension-device.entity';
import { PaymentEntity } from './payment.entity';
import { COL_DATETIME } from '../column-types';

/**
 * Ciclo do QR:
 *  RAW_CAPTURED → PENDING → APPROVED → PAYING → PAID
 *                                            ↘ ERROR
 *                              ↘ REJECTED
 *                              ↘ CANCELLED
 *
 * - PAYING: Asaas aceitou o pagamento, ainda aguardando confirmação BACEN
 * - PAID:   Confirmado pelo BACEN (status real do Pix)
 */
export type QrStatus = 'PENDING' | 'APPROVED' | 'PAYING' | 'REJECTED' | 'PAID' | 'ERROR' | 'CANCELLED' | 'RAW_CAPTURED';

@Entity('qr_codes')
export class QrCodeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  // Union types are reflected as `Object` at runtime; specify column type explicitly.
  @Column({ name: 'device_id', type: 'varchar', length: 128, nullable: true })
  deviceId: string | null;

  @Column({ type: 'text' })
  payload: string;

  @Column({ name: 'payload_hash', unique: true, length: 64 })
  payloadHash: string;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true })
  amount: number | null;

  @Column({ name: 'merchant_name', type: 'varchar', length: 255, nullable: true })
  merchantName: string | null;

  @Column({ name: 'merchant_city', type: 'varchar', length: 100, nullable: true })
  merchantCity: string | null;

  @Column({ name: 'pix_key', type: 'varchar', length: 255, nullable: true })
  pixKey: string | null;

  @Column({ name: 'transaction_id', type: 'varchar', length: 100, nullable: true })
  transactionId: string | null;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({
    type: 'text',
    default: 'PENDING',
  })
  status: QrStatus;

  /** true se o payload é um Pix válido e pode ser pago; false se é captura bruta */
  @Column({ name: 'can_pay', type: 'boolean', default: true })
  canPay: boolean;

  /** true se o payload não era um Pix válido no momento da captura */
  @Column({ name: 'is_raw', type: 'boolean', default: false })
  isRaw: boolean;

  @Column({ name: 'captured_at', type: COL_DATETIME })
  capturedAt: Date;

  @Column({ name: 'approved_at', type: COL_DATETIME, nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'approved_by', type: 'varchar', length: 36, nullable: true })
  approvedBy: string | null;

  // Campos preenchidos pelo Asaas decode (PIX dinâmico ou incompleto)
  @Column({ name: 'institution_name', type: 'varchar', length: 255, nullable: true })
  institutionName: string | null;

  @Column({ name: 'asaas_status', type: 'varchar', length: 50, nullable: true })
  asaasStatus: string | null;

  @Column({ name: 'expiration_date', type: COL_DATETIME, nullable: true })
  expirationDate: Date | null;

  /**
   * Snapshot da configuracao de pagamento vinculada a este QR no momento da execucao.
   * Permite auditoria historica mesmo apos alteracoes no bank_config do usuario.
   */
  @Column({ name: 'payment_config_snapshot', type: 'simple-json', nullable: true })
  paymentConfigSnapshot: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity, u => u.qrCodes)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  // Junta pelo campo `deviceId` (varchar) do ExtensionDeviceEntity, nao pelo id (uuid).
  // Necessario porque a coluna fisica `device_id` em qr_codes guarda o identificador
  // da extensao (varchar 128), nao o UUID do registro.
  @ManyToOne(() => ExtensionDeviceEntity, { nullable: true })
  @JoinColumn({ name: 'device_id', referencedColumnName: 'deviceId' })
  device: ExtensionDeviceEntity | null;

  @OneToOne(() => PaymentEntity, p => p.qrCode, { nullable: true })
  payment: PaymentEntity | null;
}
