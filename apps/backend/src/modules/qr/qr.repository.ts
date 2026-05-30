import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCodeEntity, QrStatus } from '../../database/entities/qr-code.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class QrRepository {
  constructor(
    @InjectRepository(QrCodeEntity)
    private readonly repo: Repository<QrCodeEntity>,
  ) {}

  async findByHash(hash: string): Promise<QrCodeEntity | null> {
    return this.repo.findOne({ where: { payloadHash: hash } });
  }

  async findById(id: string): Promise<QrCodeEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['device', 'payment'],
    });
  }

  async create(data: Partial<QrCodeEntity>): Promise<QrCodeEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async updateStatus(
    id: string,
    status: QrStatus,
    extra?: Partial<QrCodeEntity>,
  ): Promise<QrCodeEntity> {
    await this.repo.update(id, { status, ...extra } as any);
    return this.repo.findOneOrFail({ where: { id } });
  }

  async findAllByUser(userId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20, status } = pagination;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('qr')
      .leftJoinAndSelect('qr.payment', 'payment')
      .where('qr.userId = :userId', { userId })
      .orderBy('qr.capturedAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      qb.andWhere('qr.status = :status', { status });
    }

    if (pagination.startDate) {
      qb.andWhere('qr.capturedAt >= :startDate', { startDate: new Date(pagination.startDate) });
    }

    if (pagination.endDate) {
      qb.andWhere('qr.capturedAt <= :endDate', { endDate: new Date(pagination.endDate) });
    }

    if (typeof pagination.minAmount === 'number') {
      qb.andWhere('qr.amount >= :minAmount', { minAmount: pagination.minAmount });
    }

    if (typeof pagination.maxAmount === 'number') {
      qb.andWhere('qr.amount <= :maxAmount', { maxAmount: pagination.maxAmount });
    }

    const [items, total] = await qb.getManyAndCount();

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getStats(userId: string) {
    const result = await this.repo
      .createQueryBuilder('qr')
      .select('qr.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(qr.amount)', 'totalAmount')
      .where('qr.userId = :userId', { userId })
      .groupBy('qr.status')
      .getRawMany();

    const stats = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
      paid: 0,
      error: 0,
      cancelled: 0,
      totalAmountPaid: 0,
      totalAmountPending: 0,
    };

    result.forEach((row) => {
      const count = parseInt(row.count, 10);
      const amount = parseFloat(row.totalAmount) || 0;
      stats.total += count;

      const statusKey = row.status.toLowerCase() as keyof typeof stats;
      if (statusKey in stats) {
        (stats as any)[statusKey] = count;
      }

      if (row.status === 'PAID') stats.totalAmountPaid = amount;
      if (row.status === 'PENDING') stats.totalAmountPending = amount;
    });

    return stats;
  }
}
