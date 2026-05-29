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
    const { page = 1, limit = 20 } = pagination;
    const skip = (page - 1) * limit;

    const [items, total] = await this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
      relations: ['qrCode'],
    });

    return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async purgeFailedByUser(userId: string): Promise<number> {
    const result = await this.repo.delete({ userId, status: 'FAILED' });
    return result.affected ?? 0;
  }
}
