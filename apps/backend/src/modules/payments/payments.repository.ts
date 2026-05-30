import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaymentEntity, PaymentStatus } from '../../database/entities/payment.entity';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Injectable()
export class PaymentsRepository {
  constructor(
    @InjectRepository(PaymentEntity)
    private readonly repo: Repository<PaymentEntity>,
  ) {}

  async create(data: Partial<PaymentEntity>): Promise<PaymentEntity> {
    const entity = this.repo.create(data);
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<PaymentEntity | null> {
    return this.repo.findOne({ where: { id }, relations: ['qrCode'] });
  }

  async updateStatus(
    id: string,
    status: PaymentStatus,
    extra?: Partial<PaymentEntity>,
  ): Promise<PaymentEntity> {
    await this.repo.update(id, { status, ...extra } as any);
    return this.repo.findOneOrFail({ where: { id } });
  }

  /**
   * Busca todos os pagamentos com status especificado, ordenados pelo mais antigo.
   * Usado pelo PaymentStatusPoller para verificar status na Asaas.
   */
  async findByStatus(status: PaymentStatus | PaymentStatus[]): Promise<PaymentEntity[]> {
    const statuses = Array.isArray(status) ? status : [status];
    return this.repo
      .createQueryBuilder('p')
      .where('p.status IN (:...statuses)', { statuses })
      .orderBy('p.createdAt', 'ASC')
      .getMany();
  }

  async findAllByUser(userId: string, pagination: PaginationDto) {
    const { page = 1, limit = 20, status, startDate, endDate } = pagination;
    const skip = (page - 1) * limit;

    const qb = this.repo.createQueryBuilder('p')
      .where('p.userId = :userId', { userId })
      .leftJoinAndSelect('p.qrCode', 'qrCode');

    if (status) {
      qb.andWhere('p.status = :status', { status });
    }

    if (startDate) {
      qb.andWhere('p.createdAt >= :startDate', { startDate: new Date(startDate) });
    }

    if (endDate) {
      // Add 23:59:59 to endDate if it's just a date
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      qb.andWhere('p.createdAt <= :endDate', { endDate: end });
    }

    qb.orderBy('p.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async purgeFailedByUser(userId: string): Promise<number> {
    const result = await this.repo.delete({ userId, status: 'FAILED' });
    return result.affected ?? 0;
  }

  async getStats(userId: string) {
    const result = await this.repo
      .createQueryBuilder('p')
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(p.amount)', 'totalAmount')
      .where('p.userId = :userId', { userId })
      .groupBy('p.status')
      .getRawMany();

    const stats = {
      total: 0,
      successCount: 0,
      failedCount: 0,
      pendingCount: 0,
      totalAmountPaid: 0,
    };

    result.forEach((row) => {
      const count = parseInt(row.count, 10);
      const amount = parseFloat(row.totalAmount) || 0;
      stats.total += count;

      if (row.status === 'SUCCESS') {
        stats.successCount = count;
        stats.totalAmountPaid = amount;
      }
      if (row.status === 'FAILED') stats.failedCount = count;
      if (row.status === 'PENDING') stats.pendingCount = count;
    });

    return stats;
  }
}
