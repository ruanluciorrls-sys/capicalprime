import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { QrCodeEntity } from '../../database/entities/qr-code.entity';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';
import { ExtensionDeviceEntity } from '../../database/entities/extension-device.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { RawQrCaptureEntity } from '../../database/entities/raw-qr-capture.entity';
import { DeviceTokenGuard } from '../../common/guards/device-token.guard';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { CommonModule } from '../../common/common.module';
import { QrController } from './qr.controller';
import { QrService } from './qr.service';
import { QrRepository } from './qr.repository';
import { QrGateway } from './qr.gateway';

@Module({
  imports: [
    TypeOrmModule.forFeature([QrCodeEntity, AuditLogEntity, ExtensionDeviceEntity, UserEntity, RawQrCaptureEntity]),
    CommonModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '30d') },
      }),
    }),
  ],
  controllers: [QrController],
  providers: [QrService, QrRepository, QrGateway, DeviceTokenGuard, ApiKeyGuard],
  exports: [QrService, QrGateway],
})
export class QrModule {}
