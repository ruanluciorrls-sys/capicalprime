import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { QrCodeEntity } from '../../database/entities/qr-code.entity';
import { PaymentEntity } from '../../database/entities/payment.entity';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(
    @InjectRepository(QrCodeEntity)
    private readonly qrRepo: Repository<QrCodeEntity>,
    @InjectRepository(PaymentEntity)
    private readonly paymentRepo: Repository<PaymentEntity>,
  ) {}

  @Get()
  async check() {
    const start = Date.now();
    let dbStatus = 'healthy';
    let dbError: string | null = null;

    try {
      await this.qrRepo.query('SELECT 1');
    } catch (err) {
      dbStatus = 'unhealthy';
      dbError = err.message;
    }

    const qrCount = dbStatus === 'healthy' ? await this.qrRepo.count() : -1;
    const paymentCount = dbStatus === 'healthy' ? await this.paymentRepo.count() : -1;

    return {
      status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: {
        status: dbStatus,
        error: dbError,
        qrCodes: qrCount,
        payments: paymentCount,
      },
      latency: `${Date.now() - start}ms`,
    };
  }

  @Get('ping')
  ping() {
    return { pong: true, timestamp: new Date().toISOString() };
  }

  @Get('ip')
  async getIp() {
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json() as any;
      return { ip: data.ip };
    } catch (e: any) {
      return { error: 'Failed to fetch IP', details: e.message };
    }
  }
}
