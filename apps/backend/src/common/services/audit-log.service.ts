import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  async record(params: {
    entity: string;
    entityId: string;
    action: string;
    actorId?: string;
    oldData?: unknown;
    newData?: unknown;
  }): Promise<void> {
    try {
      await this.repo.save(this.repo.create({
        entity: params.entity,
        entityId: params.entityId,
        action: params.action,
        actorId: params.actorId ?? null,
        oldData: params.oldData ?? null,
        newData: params.newData ?? null,
      }));
    } catch (err) {
      this.logger.error(`Failed to record audit log: ${err.message}`);
    }
  }

  async log(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: any,
  ): Promise<void> {
    await this.record({
      entity: entityType,
      entityId,
      action,
      actorId: userId,
      newData: metadata ?? null,
    });
  }

  async findByEntity(entity: string, entityId: string, limit = 50, offset = 0) {
    const [items, total] = await this.repo.findAndCount({
      where: { entity, entityId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { items, total };
  }

  async findAll(params: {
    entity?: string;
    action?: string;
    actorId?: string;
    limit?: number;
    offset?: number;
  }) {
    const qb = this.repo.createQueryBuilder('log');

    if (params.entity) qb.andWhere('log.entity = :entity', { entity: params.entity });
    if (params.action) qb.andWhere('log.action = :action', { action: params.action });
    if (params.actorId) qb.andWhere('log.actorId = :actorId', { actorId: params.actorId });

    qb.orderBy('log.createdAt', 'DESC')
      .skip(params.offset ?? 0)
      .take(params.limit ?? 50);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }
}
