import { Controller, Post, Body, Get, Delete, Param, UseGuards, Request, Res, Logger, NotFoundException } from '@nestjs/common';
import { ExtensionService } from './extension.service';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { Response } from 'express';
import { QrGateway } from '../qr/qr.gateway';
import { HeartbeatDto } from './dto/heartbeat.dto';
import { DeviceTokenGuard } from '../../common/guards/device-token.guard';

@Controller('extension')
export class ExtensionController {
  private readonly logger = new Logger(ExtensionController.name);
  private static readonly HEARTBEAT_ONLINE_WINDOW_MS = 2 * 60 * 1000;
  private static readonly FORCED_EXTENSION_PUBLIC_ORIGIN =
    (process.env.EXTENSION_FORCE_PUBLIC_ORIGIN || '').trim();

  constructor(
    private readonly extensionService: ExtensionService,
    private readonly qrGateway: QrGateway,
  ) {}

  @Post('register')
  async register(@Body() body: { deviceId: string; userApiKey: string; browser: string }) {
    return this.extensionService.registerDevice(body.deviceId, body.userApiKey, body.browser);
  }

  @Get('devices')
  @UseGuards(ApiKeyGuard)
  async getUserDevices(@Request() req) {
    const devices = await this.extensionService.getUserDevices(req.user.id);
    return devices.map(device => ({
      ...device,
      isOnline: this.isDeviceDetectable(device),
    }));
  }

  @Delete('devices/:deviceId')
  @UseGuards(ApiKeyGuard)
  async revokeDevice(@Param('deviceId') deviceId: string, @Request() req) {
    return this.extensionService.revokeDevice(deviceId, req.user.id);
  }

  @Post('devices/:deviceId/test')
  @UseGuards(ApiKeyGuard)
  async testDevice(@Param('deviceId') deviceId: string, @Request() req) {
    const devices = await this.extensionService.getUserDevices(req.user.id);
    const device = devices.find(d => d.deviceId === deviceId);
    if (!device) {
      throw new NotFoundException('Dispositivo nao encontrado.');
    }
    const wsOnline = await this.qrGateway.testDeviceConnection(deviceId);
    const heartbeatOnline = this.hasRecentHeartbeat(device);
    const isOnline = wsOnline || heartbeatOnline;
    return { online: isOnline, deviceId, lastSeen: device.lastSeen };
  }

  @Post('heartbeat')
  @UseGuards(DeviceTokenGuard)
  async heartbeat(@Body() body: HeartbeatDto, @Request() req) {
    const resolvedDeviceId = String(body.deviceId ?? req.device?.deviceId ?? '').trim();
    return this.extensionService.updateHeartbeat(resolvedDeviceId, body.status, body.error, body.version);
  }

  @Get('download')
  @UseGuards(ApiKeyGuard)
  async downloadExtension(@Request() req, @Res() res: Response) {
    try {
      this.logger.log(`[DOWNLOAD] Gerando extensao para usuario ${req.user.id}`);
      const publicBaseHint = this.resolvePublicBaseHint(req);
      this.logger.log(`[DOWNLOAD] Public base hint recebido: ${publicBaseHint || 'none'}`);
      const zipBuffer = await this.extensionService.generateExtensionZip(req.user.id, publicBaseHint);
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="aios-extension-${req.user.id}.zip"`);
      this.logger.log(`[DOWNLOAD] ZIP criado com sucesso, tamanho: ${zipBuffer.length} bytes`);
      res.send(zipBuffer);
    } catch (error) {
      this.logger.error(`[DOWNLOAD] Erro: ${(error as Error).message}`);
      res.status(500).json({ success: false, error: error instanceof Error ? error.message : 'Erro interno' });
    }
  }

  private isDeviceDetectable(device: { deviceId: string; connectionStatus?: string | null; lastSeen?: Date | string | null }): boolean {
    return this.qrGateway.isDeviceOnline(device.deviceId) || this.hasRecentHeartbeat(device);
  }

  private hasRecentHeartbeat(device: { connectionStatus?: string | null; lastSeen?: Date | string | null }): boolean {
    if (device.connectionStatus !== 'ONLINE' || !device.lastSeen) return false;
    const lastSeenTs = new Date(device.lastSeen).getTime();
    if (!Number.isFinite(lastSeenTs)) return false;
    return (Date.now() - lastSeenTs) <= ExtensionController.HEARTBEAT_ONLINE_WINDOW_MS;
  }

  private resolvePublicBaseHint(req: any): string {
    if (ExtensionController.FORCED_EXTENSION_PUBLIC_ORIGIN) {
      return ExtensionController.FORCED_EXTENSION_PUBLIC_ORIGIN.replace(/\/+$/, '');
    }

    const headerHint = String(req.headers?.['x-extension-public-api-base-url'] || '').trim();
    if (headerHint) return headerHint;

    const origin = String(req.headers?.origin || '').trim();
    if (origin) return origin;

    const referer = String(req.headers?.referer || '').trim();
    if (referer) {
      try {
        const url = new URL(referer);
        return `${url.protocol}//${url.host}`;
      } catch {
        // segue para fallback
      }
    }

    const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').trim();
    const forwardedHost = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').trim();
    if (forwardedHost) {
      const proto = forwardedProto || req.protocol || 'http';
      return `${proto}://${forwardedHost}`;
    }

    return '';
  }
}
