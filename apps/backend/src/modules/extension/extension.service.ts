import { Injectable, UnauthorizedException, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExtensionDeviceEntity } from '../../database/entities/extension-device.entity';
import { UserEntity } from '../../database/entities/user.entity';
import AdmZip from 'adm-zip';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class ExtensionService {
  private readonly logger = new Logger(ExtensionService.name);
  private readonly EXTENSION_VERSION = '2.4.10';
  private readonly DEFAULT_VPS_PUBLIC_ORIGIN = 'http://177.153.202.47:3001';
  private readonly FORCED_EXTENSION_PUBLIC_ORIGIN =
    (process.env.EXTENSION_FORCE_PUBLIC_ORIGIN || '').trim();

  constructor(
    @InjectRepository(ExtensionDeviceEntity)
    private deviceRepo: Repository<ExtensionDeviceEntity>,
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    private jwtService: JwtService,
    private eventEmitter: EventEmitter2,
  ) {}

  async registerDevice(deviceId: string, userApiKey: string, browser: string) {
    const user = await this.userRepo.findOne({ where: { apiKey: userApiKey } });
    if (!user) throw new UnauthorizedException('API Key invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lida');
    const payload = { userId: user.id, deviceId };
    const deviceToken = this.jwtService.sign(payload);
    await this.deviceRepo.upsert(
      {
        deviceId,
        userId: user.id,
        deviceToken,
        browser,
        isActive: true,
        lastSeen: new Date(),
        connectionStatus: 'ONLINE',
      },
      ['deviceId'],
    );
    return { deviceToken, userId: user.id };
  }

  async getUserDevices(userId: string) {
    return this.deviceRepo.find({ where: { userId, isActive: true }, order: { lastSeen: 'DESC' } });
  }

  async revokeDevice(deviceId: string, userId: string) {
    await this.deviceRepo.update({ deviceId, userId }, { isActive: false, deviceToken: null });
    return { success: true };
  }

  async updateHeartbeat(deviceId: string, status: string, error?: string, version?: string) {
    const normalizedDeviceId = String(deviceId ?? '').trim();
    if (!normalizedDeviceId) {
      throw new BadRequestException('deviceId obrigatorio no heartbeat.');
    }

    const normalizedStatus = String(status ?? '').trim().toUpperCase();
    if (!['ONLINE', 'OFFLINE', 'ERROR'].includes(normalizedStatus)) {
      throw new BadRequestException('status invalido no heartbeat. Use ONLINE, OFFLINE ou ERROR.');
    }

    const result = await this.deviceRepo.update({ deviceId: normalizedDeviceId }, {
      lastSeen: new Date(),
      connectionStatus: normalizedStatus as any,
      lastError: error || null,
      version: version || undefined,
    });

    if (!result.affected) {
      this.logger.warn(`[HEARTBEAT] deviceId nao registrado: ${normalizedDeviceId}`);
      throw new NotFoundException('Dispositivo nao registrado para heartbeat.');
    }

    return { success: true, deviceId: normalizedDeviceId };
  }

  async generateExtensionZip(userId: string, publicBaseHint?: string): Promise<Buffer> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new Error('UsuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado');
    
    // VersÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o da extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o fixada no backend
    const currentVersion = this.EXTENSION_VERSION;
    
    // Atualiza a versÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o no usuÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio apenas para manter o histÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³rico caso necessÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡rio
    if (user.extensionLastVersion !== currentVersion) {
      user.extensionLastVersion = currentVersion;
      await this.userRepo.save(user);
    }

    const deviceId = randomUUID();
    const deviceToken = this.jwtService.sign({ userId, deviceId }, { expiresIn: '365d' });

    await this.deviceRepo.upsert(
      {
        userId,
        deviceId,
        deviceToken,
        browser: 'Chrome Extension',
        version: currentVersion,
        isActive: true,
        lastSeen: new Date(),
        connectionStatus: 'OFFLINE',
      },
      ['deviceId'],
    );

    // Dispara evento para notificar o painel via WebSocket em tempo real
    this.eventEmitter.emit('extension.status.changed', {
      userId,
      deviceId,
      browser: 'Chrome Extension',
      version: currentVersion,
      connectionStatus: 'OFFLINE',
      isActive: true,
      lastSeen: new Date().toISOString(),
    });

    this.logger.log(`[DOWNLOAD] VersÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o: ${currentVersion}, Device token gerado: ${deviceToken.substring(0, 15)}...`);

    const templatePath = this.resolveTemplatePath();
    const rawBaseApiUrl = this.resolveRawExtensionBaseUrl(publicBaseHint);
    const baseApiUrl = this.normalizeExtensionBaseApiUrl(rawBaseApiUrl);
    const apiUrl = `${baseApiUrl}/api/v1`;
    this.logger.log(`[DOWNLOAD] Base resolvida para extensao: ${baseApiUrl} (hint=${publicBaseHint || 'none'})`);

    const replacements: Record<string, string> = {
      '{{API_URL}}': apiUrl,
      '{{WS_URL}}': baseApiUrl,
      '{{DEVICE_TOKEN}}': deviceToken,
      '{{VERSION}}': currentVersion,
      '{{EXTENSION_VERSION}}': currentVersion,
    };

    const zip = new AdmZip();
    const textExtensions = /\.(json|js|html|txt|md|css)$/i;

    const appendFiles = (currentPath: string, zipFolder = '') => {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        // zipPath is relative to root, e.g. "manifest.json" or "icons/icon16.png"
        const zipPath = zipFolder ? `${zipFolder}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          appendFiles(fullPath, zipPath);
          continue;
        }

        if (textExtensions.test(entry.name)) {
          let content = fs.readFileSync(fullPath, 'utf8');
          // Remove UTF-8 BOM if present
          if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
          for (const [placeholder, value] of Object.entries(replacements)) {
            content = content.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
          }
          // Validate JSON files
          if (entry.name.endsWith('.json')) {
            try {
              JSON.parse(content);
            } catch (e) {
              throw new Error(`Arquivo JSON invÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡lido apÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â³s substituiÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o: ${zipPath} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${(e as Error).message}`);
            }
          }
          zip.addFile(zipPath, Buffer.from(content, 'utf8'), '', 0o644);
        } else {
          // Binary file ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â read as buffer
          const buffer = fs.readFileSync(fullPath);
          zip.addFile(zipPath, buffer, '', 0o644);
        }
      }
    };

    appendFiles(templatePath);

    // ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Garantir socket.io-client ESM browser bundle no ZIP ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬
    // O background.js usa: import { io } from './socket.io.esm.min.js'
    // Prioridade 1: jÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ foi incluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do pelo appendFiles (bundle na pasta template)
    // Prioridade 2: encontrar em node_modules (socket.io-client como dep)
    const socketIoBundleName = 'socket.io.esm.min.js';
    if (zip.getEntry(socketIoBundleName)) {
      // JÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ adicionado pelo appendFiles ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â bundle estÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ na pasta templates/
      this.logger.log(`socket.io-client bundle incluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do via template (${templatePath})`);
    } else {
      // Fallback: busca em node_modules (socket.io-client deve ser dep do backend)
      const socketIoCandidates = [
        path.join(process.cwd(), 'node_modules/socket.io-client/dist', socketIoBundleName),
        path.join(process.cwd(), '../..', 'node_modules/socket.io-client/dist', socketIoBundleName),
        path.join(__dirname, '../../../../node_modules/socket.io-client/dist', socketIoBundleName),
        path.join(__dirname, '../../../../../../node_modules/socket.io-client/dist', socketIoBundleName),
      ];
      let found = false;
      for (const candidate of socketIoCandidates) {
        if (fs.existsSync(candidate)) {
          const bundleBuffer = fs.readFileSync(candidate);
          zip.addFile(socketIoBundleName, bundleBuffer, '', 0o644);
          this.logger.log(`socket.io-client bundle incluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­do de node_modules: ${candidate} (${bundleBuffer.length} bytes)`);
          found = true;
          break;
        }
      }
      if (!found) {
        // CrÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­tico: sem o bundle a extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o conecta via Socket.IO
        this.logger.error(`CRÃƒÆ’Ã†â€™Ãƒâ€šÃ‚ÂTICO: ${socketIoBundleName} nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado. Adicione socket.io-client ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â s dependÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Âªncias do backend.`);
        throw new Error('socket.io.esm.min.js nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado. A extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o poderÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¡ conectar ao servidor.');
      }
    }

    // Validate manifest.json is at root
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) {
      const entries = zip.getEntries().map(e => e.entryName).join(', ');
      throw new Error(`manifest.json nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado na raiz do ZIP. Entradas: ${entries}`);
    }

    this.logger.log(`ZIP gerado para userId=${userId} deviceId=${deviceId} ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ${zip.getEntries().length} arquivos`);
    return zip.toBuffer();
  }

  private resolveTemplatePath(): string {
    const candidates = [
      // Preferir sempre o template moderno (apps/backend/templates/extension/extension-template)
      // para evitar empacotar o template legado da raiz do monorepo.
      path.join(process.cwd(), 'apps/backend/templates/extension/extension-template'),
      path.join(process.cwd(), 'templates/extension/extension-template'),
      // Fallback quando o processo roda a partir de apps/backend/dist
      path.resolve(__dirname, '../../../../templates/extension/extension-template'),
      path.resolve(__dirname, '../../../../../apps/backend/templates/extension/extension-template'),
      // Fallbacks legados (somente se os modernos nao existirem)
      path.join(process.cwd(), 'apps/backend/templates/extension'),
      path.join(process.cwd(), 'templates/extension'),
      path.resolve(__dirname, '../../../../templates/extension'),
      path.resolve(__dirname, '../../../../../apps/backend/templates/extension'),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'manifest.json'))) {
        if (candidate.endsWith(path.join('templates', 'extension'))) {
          this.logger.warn(
            `[DOWNLOAD] Usando template legado (${candidate}). Recomenda-se usar extension-template moderno.`,
          );
        }
        this.logger.log(`Template da extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado em: ${candidate}`);
        return candidate;
      }
    }

    const searched = candidates.join('\n  ');
    this.logger.error(`Template da extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado.\nCaminhos verificados:\n  ${searched}`);
    throw new Error('Template da extensÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o encontrado. Verifique a pasta templates/extension/extension-template.');
  }

  private normalizeExtensionBaseApiUrl(input: string): string {
    let base = String(input || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api\/v1$/i, '')
      .replace(/\/api$/i, '');
    if (!base) base = this.getDefaultExtensionOrigin();

    if (!/^https?:\/\//i.test(base)) {
      base = `http://${base}`;
    }

    try {
      const parsed = new URL(base);
      if (parsed.port === '3000') {
        const original = parsed.toString().replace(/\/$/, '');
        parsed.port = '3001';
        const fixed = parsed.toString().replace(/\/$/, '');
        this.logger.warn(`[DOWNLOAD] URL da extensao apontava para painel (${original}). Ajustando para backend (${fixed}).`);
        return fixed;
      }
      parsed.pathname = '';
      parsed.search = '';
      parsed.hash = '';
      return parsed.toString().replace(/\/$/, '');
    } catch {
      // fallback de compatibilidade
    }

    return base;
  }

  private resolveRawExtensionBaseUrl(publicBaseHint?: string): string {
    const forcedOrigin = this.FORCED_EXTENSION_PUBLIC_ORIGIN
      .replace(/\/api\/v1$/i, '')
      .replace(/\/api$/i, '')
      .replace(/\/+$/, '');
    if (forcedOrigin) {
      this.logger.log(`[DOWNLOAD] Origem publica da extensao forcada: ${forcedOrigin}`);
      return forcedOrigin;
    }

    const fromEnv = (
      process.env.EXTENSION_PUBLIC_API_BASE_URL ||
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      ''
    )
      .replace(/\/api\/v1$/i, '')
      .replace(/\/api$/i, '')
      .replace(/\/+$/, '');

    const fromHint = String(publicBaseHint || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api\/v1$/i, '')
      .replace(/\/api$/i, '');

    if (!fromEnv || this.isNonPublicHost(fromEnv)) {
      if (fromHint) {
        this.logger.warn(`[DOWNLOAD] Base da extensao via env parecia interna (${fromEnv || 'empty'}). Usando hint publico: ${fromHint}`);
        return fromHint;
      }
    }

    return fromEnv || fromHint || this.getDefaultExtensionOrigin();
  }

  private getDefaultExtensionOrigin(): string {
    return process.env.NODE_ENV === 'production'
      ? this.DEFAULT_VPS_PUBLIC_ORIGIN
      : 'http://localhost:3001';
  }

  private isLoopbackHost(urlLike: string): boolean {
    const value = String(urlLike || '').toLowerCase();
    return (
      value.includes('localhost') ||
      value.includes('127.0.0.1') ||
      value.includes('[::1]')
    );
  }

  private isNonPublicHost(urlLike: string): boolean {
    const raw = String(urlLike || '').trim();
    if (!raw) return true;

    let hostname = raw.toLowerCase();
    try {
      const normalized = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
      hostname = new URL(normalized).hostname.toLowerCase();
    } catch {
      // Mantem valor bruto como fallback
    }

    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]' ||
      hostname === '0.0.0.0' ||
      hostname === 'backend' ||
      hostname === 'db' ||
      hostname === 'api' ||
      hostname === 'host.docker.internal'
    ) {
      return true;
    }

    if (hostname.endsWith('.local')) return true;

    const privateV4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    if (privateV4) {
      if (/^10\./.test(hostname)) return true;
      if (/^192\.168\./.test(hostname)) return true;
      const octets = hostname.split('.').map(Number);
      if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    }

    return false;
  }
}



