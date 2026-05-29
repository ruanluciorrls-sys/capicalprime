import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn, UpdateDateColumn
} from 'typeorm';
import { UserEntity } from './user.entity';
import { COL_DATETIME } from '../column-types';

export type ConnectionStatus = 'ONLINE' | 'OFFLINE' | 'ERROR';

@Entity('extension_devices')
export class ExtensionDeviceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'device_id', unique: true, length: 128 })
  deviceId: string;

  @Column({ name: 'device_token', type: 'varchar', length: 512, nullable: true })
  deviceToken: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  browser: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  version: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true, name: 'connection_status' })
  connectionStatus: ConnectionStatus | null;

  @Column({ type: 'text', nullable: true, name: 'last_error' })
  lastError: string | null;

  @Column({ name: 'last_seen', type: COL_DATETIME, nullable: true })
  lastSeen: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => UserEntity, u => u.devices)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;
}
