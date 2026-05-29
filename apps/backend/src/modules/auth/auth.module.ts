import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserEntity } from '../../database/entities/user.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FeaturesGuard } from '../../common/guards/features.guard';
import { CommonModule } from '../../common/common.module';

/**
 * AuthModule é GLOBAL — fornece JwtService, ApiKeyGuard, RolesGuard, FeaturesGuard
 * para todo o app sem precisar reimportar em cada módulo.
 */
@Global()
@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
    CommonModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'aios_dev_fallback_jwt_secret_change_in_prod'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, ApiKeyGuard, RolesGuard, FeaturesGuard],
  exports: [AuthService, ApiKeyGuard, RolesGuard, FeaturesGuard, JwtModule, TypeOrmModule],
})
export class AuthModule {}
