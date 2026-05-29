import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';
import { UserEntity } from '../../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity, UserEntity])],
  controllers: [LogsController],
  providers: [LogsService],
  exports: [LogsService],
})
export class LogsModule {}
