import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLogEntity } from '../database/entities/audit-log.entity';
import { EncryptionService } from './services/encryption.service';
import { AuditLogService } from './services/audit-log.service';
import { CacheService } from './services/cache.service';
import { EmailService } from './services/email.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity]), ConfigModule],
  providers: [EncryptionService, AuditLogService, CacheService, EmailService],
  exports: [TypeOrmModule, EncryptionService, AuditLogService, CacheService, EmailService],
})
export class CommonModule {}
