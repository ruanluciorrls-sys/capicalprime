import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn
} from 'typeorm';
import { UserEntity } from './user.entity';
import { ExtensionDeviceEntity } from './extension-device.entity';
import { COL_DATETIME } from '../column-types';

@Entity('raw_qr_captures')
export class RawQrCaptureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'device_id', type: 'varchar', length: 128, nullable: true })
  deviceId: string | null;

  @Column({ type: 'text' })
  rawContent: string;

  @Column({ name: 'raw_hash', length: 64 })
  rawHash: string;

  @Column({ name: 'source_url', type: 'text', nullable: true })
  sourceUrl: string | null;

  @Column({ name: 'page_title', type: 'varchar', length: 255, nullable: true })
  pageTitle: string | null;

  @Column({ name: 'capture_method', type: 'varchar', length: 50, nullable: true })
  captureMethod: string | null;

  @Column({ type: 'varchar', length: 50, default: 'capturado_bruto' })
  status: string;

  @Column({ name: 'validation_status', type: 'varchar', length: 50, default: 'pending_validation' })
  validationStatus: string;

  @Column({ name: 'can_pay', type: 'boolean', default: false })
  canPay: boolean;

  @Column({ name: 'captured_at', type: COL_DATETIME })
  capturedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  user: UserEntity;

  @ManyToOne(() => ExtensionDeviceEntity, { nullable: true })
  @JoinColumn({ name: 'device_id', referencedColumnName: 'deviceId' })
  device: ExtensionDeviceEntity | null;
}
