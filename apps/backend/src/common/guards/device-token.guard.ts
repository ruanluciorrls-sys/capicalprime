import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtensionDeviceEntity } from '../../database/entities/extension-device.entity';

@Injectable()
export class DeviceTokenGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(ExtensionDeviceEntity)
    private readonly deviceRepo: Repository<ExtensionDeviceEntity>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] as string | undefined;
    const headerDeviceToken = request.headers['x-device-token'] as string | string[] | undefined;

    const tokenFromAuth =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.substring(7)
        : '';

    const tokenFromHeader = Array.isArray(headerDeviceToken)
      ? String(headerDeviceToken[0] || '')
      : String(headerDeviceToken || '');

    const token = tokenFromAuth || tokenFromHeader;
    if (!token) {
      throw new UnauthorizedException('device_token_ausente');
    }

    // Primary path: token signed with current JWT secret.
    try {
      const payload = this.jwtService.verify(token) as { deviceId?: string };
      if (payload?.deviceId) {
        const device = await this.deviceRepo.findOne({
          where: { deviceId: payload.deviceId, deviceToken: token, isActive: true },
        });

        if (device) {
          await this.deviceRepo.update(device.id, { lastSeen: new Date() });
          request.device = device;
          return true;
        }

        // Self-heal path: token is valid but device row was revoked/deleted.
        // Recreate/reactivate device using data from signed token payload.
        const payloadAny = payload as { deviceId: string; userId?: string };
        if (payloadAny.userId) {
          const recreated = this.deviceRepo.create({
            userId: payloadAny.userId,
            deviceId: payloadAny.deviceId,
            deviceToken: token,
            browser: 'Chrome Extension',
            isActive: true,
            lastSeen: new Date(),
            connectionStatus: 'ONLINE',
            lastError: null,
          });
          const saved = await this.deviceRepo.save(recreated);
          request.device = saved;
          return true;
        }
      }
    } catch {
      // fall through to DB token lookup fallback
    }

    // Resilient fallback: if token exists and is active in DB, accept it.
    // This keeps extension devices connected even after JWT secret rotations,
    // as long as the device record is still active server-side.
    const deviceByToken = await this.deviceRepo.findOne({
      where: { deviceToken: token, isActive: true },
    });

    if (deviceByToken) {
      await this.deviceRepo.update(deviceByToken.id, { lastSeen: new Date() });
      request.device = deviceByToken;
      return true;
    }

    throw new UnauthorizedException('token_invalido_ou_expirado');
  }
}
