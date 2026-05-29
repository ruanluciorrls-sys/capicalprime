import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn
} from 'typeorm';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryGeneratedColumn('increment')
  id: number;

  @Column({ length: 50 })
  entity: string;

  @Column({ name: 'entity_id', length: 36 })
  entityId: string;

  @Column({ length: 100 })
  action: string;

  // Union types are reflected as `Object` at runtime; specify column type explicitly.
  @Column({ name: 'actor_id', type: 'varchar', nullable: true, length: 36 })
  actorId: string | null;

  @Column({ name: 'old_data', type: 'simple-json', nullable: true })
  oldData: unknown | null;

  @Column({ name: 'new_data', type: 'simple-json', nullable: true })
  newData: unknown | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
