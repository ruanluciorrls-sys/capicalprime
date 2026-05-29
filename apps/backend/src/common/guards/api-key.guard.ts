import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../../database/entities/user.entity';

/**
 * Guard unificado para autenticação do dashboard.
 *
 * Aceita DOIS modos:
 *  1. Authorization: Bearer <jwt>           → modo recomendado (login com senha)
 *  2. X-Api-Key: <apiKey>  ou  query.apiKey → modo legado / scripts / extensão
 *
 * Em ambos os modos, valida:
 *  - usuário existe e está ativo
 *  - assinatura não expirou (exceto MASTER_ADMIN)
 *  - se for JWT: sessionId no token == currentSessionId do BD (sessão única)
 *
 * Carrega `req.user` (entidade completa) e `req.authMethod` ('jwt' | 'apiKey').
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // ── 1. Tenta JWT primeiro ────────────────────────────────────
    const authHeader = request.headers['authorization'] || request.headers['Authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        try {
          const payload: any = this.jwtService.verify(token);
          if (!payload?.userId || payload?.type !== 'session') {
            throw new UnauthorizedException('Token inválido.');
          }
          const user = await this.userRepo.findOne({ where: { id: payload.userId } });
          if (!user) throw new UnauthorizedException('Usuário não encontrado.');

          this.assertActive(user);
          this.assertSubscription(user);

          // Sessão única
          if (!user.currentSessionId || user.currentSessionId !== payload.sessionId) {
            throw new UnauthorizedException({
              code: 'SESSION_EXPIRED',
              message: 'Sua sessão foi encerrada (login em outro dispositivo).',
            });
          }

          request.user = user;
          request.authMethod = 'jwt';
          return true;
        } catch (err: any) {
          if (err instanceof UnauthorizedException || err instanceof ForbiddenException) throw err;
          throw new UnauthorizedException('Token inválido ou expirado.');
        }
      }
    }

    // ── 2. Fallback para API Key ─────────────────────────────────
    const apiKey = request.headers['x-api-key'] || request.query['apiKey'];
    if (!apiKey) {
      throw new UnauthorizedException('Autenticação ausente (Bearer token ou X-Api-Key).');
    }

    const user = await this.userRepo.findOne({ where: { apiKey } });
    if (!user) throw new UnauthorizedException('API Key inválida.');

    this.assertActive(user);
    this.assertSubscription(user);

    request.user = user;
    request.authMethod = 'apiKey';
    return true;
  }

  private assertActive(user: UserEntity) {
    if (!user.isActive) {
      throw new ForbiddenException('Conta desativada. Contate o administrador.');
    }
  }

  private assertSubscription(user: UserEntity) {
    if (user.role === 'MASTER_ADMIN') return; // master admin nunca expira
    if (!user.subscriptionExpiresAt) {
      throw new ForbiddenException({
        code: 'NO_SUBSCRIPTION',
        message: 'Você não possui uma assinatura ativa.',
      });
    }
    if (new Date(user.subscriptionExpiresAt).getTime() < Date.now()) {
      throw new ForbiddenException({
        code: 'SUBSCRIPTION_EXPIRED',
        message: 'Sua assinatura expirou. Contate o administrador para renovar.',
      });
    }
  }
}
