import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToMany
} from 'typeorm';
import { QrCodeEntity } from './qr-code.entity';
import { ExtensionDeviceEntity } from './extension-device.entity';
import { BankAccountEntity } from './bank-account.entity';
import { COL_DATETIME } from '../column-types';

export type UserRole = 'MASTER_ADMIN' | 'ADMIN' | 'USER' | 'VIEWER';

/**
 * Features (premium flags) que podem ser concedidas por usuário.
 * Master Admin pode ligar/desligar no painel admin.
 */
export type UserFeature = 'AUTO_PAYMENT' | 'BULK_QR' | 'API_ACCESS' | 'WEBHOOK';

@Entity('users')
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  name: string;

  @Column({ unique: true, length: 255 })
  email: string;

  /**
   * Senha (bcrypt hash). Pode ser null para usuários legados (api-key only).
   */
  @Column({ name: 'password_hash', type: 'varchar', length: 255, nullable: true })
  passwordHash: string | null;

  @Column({ unique: true, name: 'api_key', length: 64 })
  apiKey: string;

  @Column({ name: 'api_key_rotated_at', type: COL_DATETIME, nullable: true })
  apiKeyRotatedAt: Date | null;

  @Column({ type: 'varchar', length: 20, default: 'USER' })
  role: UserRole;

  /**
   * Lista de features premium habilitadas. JSON array.
   */
  @Column({ name: 'features', type: 'simple-json', nullable: true })
  features: UserFeature[] | null;

  /**
   * Vencimento da assinatura. Null = sem assinatura ativa (acesso bloqueado, exceto MASTER_ADMIN).
   */
  @Column({ name: 'subscription_expires_at', type: COL_DATETIME, nullable: true })
  subscriptionExpiresAt: Date | null;

  /**
   * Sessão única — ID da sessão atual. Login novo invalida sessão anterior.
   */
  @Column({ name: 'current_session_id', type: 'varchar', length: 64, nullable: true })
  currentSessionId: string | null;

  /**
   * Recuperação de senha — token único, 1 uso, expira em 1h.
   */
  @Column({ name: 'password_reset_token', type: 'varchar', length: 128, nullable: true })
  passwordResetToken: string | null;

  @Column({ name: 'password_reset_expires_at', type: COL_DATETIME, nullable: true })
  passwordResetExpiresAt: Date | null;

  @Column({ name: 'bank_adapter', length: 50, default: 'mock' })
  bankAdapter: string;

  @Column({ name: 'bank_config', type: 'simple-json', nullable: true })
  bankConfig: Record<string, unknown> | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'last_login_at', type: COL_DATETIME, nullable: true })
  lastLoginAt: Date | null;

  @Column({ name: 'last_login_ip', type: 'varchar', length: 64, nullable: true })
  lastLoginIp: string | null;

  @Column({ name: 'last_login_ua', type: 'varchar', length: 255, nullable: true })
  lastLoginUa: string | null;

  @Column({ name: 'extension_last_version', length: 50, default: '1.0.0' })
  extensionLastVersion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => QrCodeEntity, qr => qr.user)
  qrCodes: QrCodeEntity[];

  @OneToMany(() => ExtensionDeviceEntity, d => d.user)
  devices: ExtensionDeviceEntity[];

  @OneToMany(() => BankAccountEntity, ba => ba.user)
  bankAccounts: BankAccountEntity[];
}
