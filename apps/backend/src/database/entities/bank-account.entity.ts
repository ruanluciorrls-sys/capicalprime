import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index
} from 'typeorm';
import { UserEntity } from './user.entity';
import { COL_DATETIME } from '../column-types';

export type BankProviderCode = 'mock' | 'asaas' | 'sicoob' | 'mercadopago' | 'inter' | 'efi' | 'bb';

export type BankAccountStatus = 'ACTIVE' | 'INACTIVE' | 'ERROR' | 'PENDING_REVIEW';

@Entity('bank_accounts')
@Index(['userId', 'isDefault'], { unique: true, where: '"is_default" IS TRUE' })
@Index(['userId', 'provider'])
export class BankAccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 50, name: 'provider' })
  provider: BankProviderCode;

  @Column({ type: 'varchar', length: 255, name: 'label', nullable: true })
  label: string | null;

  @Column({ type: 'text', name: 'encrypted_credentials' })
  encryptedCredentials: string;

  @Column({ type: 'varchar', length: 20, default: 'ACTIVE', name: 'status' })
  status: BankAccountStatus;

  @Column({ type: 'boolean', default: false, name: 'is_default' })
  isDefault: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true, name: 'environment' })
  environment: 'sandbox' | 'production' | null;

  @Column({ type: 'text', nullable: true, name: 'last_sync_error' })
  lastSyncError: string | null;

  @Column({ type: COL_DATETIME, nullable: true, name: 'last_sync_at' })
  lastSyncAt: Date | null;

  @Column({ type: COL_DATETIME, nullable: true, name: 'last_balance_check_at' })
  lastBalanceCheckAt: Date | null;

  @Column({ type: 'decimal', precision: 15, scale: 2, nullable: true, name: 'last_known_balance' })
  lastKnownBalance: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => UserEntity, u => u.bankAccounts)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
