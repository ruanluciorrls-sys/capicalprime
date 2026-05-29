import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index
} from 'typeorm';

export type WebhookStatus = 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'IGNORED';

export type WebhookSource = 'asaas' | 'mercadopago' | 'inter' | 'efi' | 'bb' | 'sicoob' | 'mock';

@Entity('payment_webhooks')
@Index(['source', 'eventId'])
@Index(['paymentId'])
@Index(['status'])
export class PaymentWebhookEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50, name: 'source' })
  source: WebhookSource;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'event_id' })
  eventId: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'event_type' })
  eventType: string | null;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'payment_id' })
  paymentId: string | null;

  @Column({ type: 'text', name: 'raw_body' })
  rawBody: string;

  @Column({ type: 'simple-json', nullable: true, name: 'parsed_body' })
  parsedBody: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'ip_address' })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'signature' })
  signature: string | null;

  @Column({ type: 'boolean', default: false, name: 'signature_valid' })
  signatureValid: boolean;

  @Column({ type: 'varchar', length: 20, default: 'RECEIVED', name: 'status' })
  status: WebhookStatus;

  @Column({ type: 'text', nullable: true, name: 'error_message' })
  errorMessage: string | null;

  @Column({ type: 'integer', default: 0, name: 'processing_time_ms' })
  processingTimeMs: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
