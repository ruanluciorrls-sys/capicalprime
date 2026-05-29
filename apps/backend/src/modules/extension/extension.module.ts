import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { ExtensionDeviceEntity } from '../../database/entities/extension-device.entity';
import { UserEntity } from '../../database/entities/user.entity';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';
import { ExtensionController } from './extension.controller';
import { ExtensionService } from './extension.service';
import { CommonModule } from '../../common/common.module';
import { DeviceTokenGuard } from '../../common/guards/device-token.guard';

import { QrModule } from '../qr/qr.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExtensionDeviceEntity, UserEntity, AuditLogEntity]),
    CommonModule,
    QrModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'aios_dev_fallback_jwt_secret_change_in_prod'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '30d') },
      }),
    }),

  ],
  controllers: [ExtensionController],
  providers: [ExtensionService, DeviceTokenGuard],
  exports: [ExtensionService],
})
export class ExtensionModule {}
