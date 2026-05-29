import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private logsRepo: Repository<AuditLogEntity>,
  ) {}

  async findAll(pagination: any) {
    const { page = 1, limit = 50 } = pagination || {};
    const [items, total] = await this.logsRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
    });

    return {
      items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
