import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, Index
} from 'typeorm';
import { PaymentEntity } from './payment.entity';
import { COL_DATETIME } from '../column-types';

export type ReceiptType = 'BANK_PROVIDED' | 'SYSTEM_GENERATED' | 'MANUAL_UPLOAD';

export type ReceiptFormat = 'pdf' | 'json' | 'html' | 'png' | 'jpeg';

@Entity('financial_receipts')
@Index(['paymentId'])
@Index(['bankEnd2EndId'])
export class FinancialReceiptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'payment_id' })
  paymentId: string;

  // Union types are reflected as `Object` at runtime; specify column type explicitly.
  @Column({ name: 'bank_end2end_id', type: 'varchar', length: 100, nullable: true })
  bankEnd2EndId: string | null;

  @Column({ type: 'varchar', length: 50, name: 'type', default: 'BANK_PROVIDED' })
  type: ReceiptType;

  @Column({ type: 'varchar', length: 20, name: 'format', nullable: true })
  format: ReceiptFormat | null;

  @Column({ type: 'text', nullable: true, name: 'receipt_url' })
  receiptUrl: string | null;

  @Column({ type: 'text', nullable: true, name: 'receipt_data' })
  receiptData: string | null;

  @Column({ type: 'simple-json', nullable: true, name: 'parsed_data' })
  parsedData: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true, name: 'original_filename' })
  originalFilename: string | null;

  @Column({ type: 'integer', nullable: true, name: 'file_size_bytes' })
  fileSizeBytes: number | null;

  @Column({ type: 'text', nullable: true, name: 'mime_type' })
  mimeType: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true, name: 'content_hash' })
  contentHash: string | null;

  @Column({ type: COL_DATETIME, nullable: true, name: 'emitted_at' })
  emittedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => PaymentEntity)
  @JoinColumn({ name: 'payment_id' })
  payment: PaymentEntity;
}
