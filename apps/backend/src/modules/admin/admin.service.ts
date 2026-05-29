import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserEntity } from '../../database/entities/user.entity';
import { hashPassword, generateSecureToken } from '../../common/utils/password.util';
import { EmailService } from '../../common/services/email.service';
import { CreateUserDto, UpdateUserDto, ExtendSubscriptionDto, SetPasswordDto } from './dto/admin-user.dto';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
  ) {}

  async listUsers(query: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const qb = this.userRepo.createQueryBuilder('u').orderBy('u.createdAt', 'DESC');

    if (query.search) {
      qb.where('LOWER(u.email) LIKE :s OR LOWER(u.name) LIKE :s', {
        s: `%${query.search.toLowerCase()}%`,
      });
    }

    const [items, total] = await qb.skip((page - 1) * limit).take(limit).getManyAndCount();

    return {
      items: items.map(u => this.sanitize(u)),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async getUser(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return this.sanitize(user);
  }

  async createUser(dto: CreateUserDto, actorId: string) {
    const emailNorm = dto.email.toLowerCase().trim();
    const existing = await this.userRepo.findOne({ where: { email: emailNorm } });
    if (existing) throw new BadRequestException('Já existe um usuário com este email.');

    const user = this.userRepo.create({
      name: dto.name,
      email: emailNorm,
      passwordHash: await hashPassword(dto.password),
      apiKey: `CP_${generateSecureToken(20)}`.slice(0, 64),
      role: dto.role ?? 'USER',
      features: dto.features ?? [],
      isActive: dto.isActive ?? true,
      subscriptionExpiresAt: dto.subscriptionDays
        ? new Date(Date.now() + dto.subscriptionDays * 24 * 60 * 60 * 1000)
        : null,
    });

    const saved = await this.userRepo.save(user);
    this.logger.log(`[ADMIN] Usuário criado: ${saved.email} (${saved.role}) por ${actorId}`);

    return this.sanitize(saved);
  }

  async updateUser(id: string, dto: UpdateUserDto, actorId: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    // Proteção: ninguém pode rebaixar MASTER_ADMIN exceto outro MASTER_ADMIN
    if (user.role === 'MASTER_ADMIN' && dto.role && dto.role !== 'MASTER_ADMIN' && actorId !== user.id) {
      throw new ForbiddenException('Não é possível alterar a role de outro MASTER_ADMIN.');
    }

    Object.assign(user, {
      ...(dto.name !== undefined        ? { name: dto.name } : {}),
      ...(dto.email !== undefined       ? { email: dto.email.toLowerCase().trim() } : {}),
      ...(dto.role !== undefined        ? { role: dto.role } : {}),
      ...(dto.features !== undefined    ? { features: dto.features } : {}),
      ...(dto.isActive !== undefined    ? { isActive: dto.isActive } : {}),
      ...(dto.subscriptionExpiresAt !== undefined ? {
        subscriptionExpiresAt: dto.subscriptionExpiresAt ? new Date(dto.subscriptionExpiresAt) : null
      } : {}),
    });

    const saved = await this.userRepo.save(user);
    this.logger.log(`[ADMIN] Usuário ${user.email} atualizado por ${actorId}`);
    return this.sanitize(saved);
  }

  async deleteUser(id: string, actorId: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (user.role === 'MASTER_ADMIN') {
      throw new ForbiddenException('Não é possível excluir um MASTER_ADMIN. Rebaixe primeiro.');
    }
    await this.userRepo.delete(id);
    this.logger.warn(`[ADMIN] Usuário ${user.email} excluído por ${actorId}`);
    return { success: true };
  }

  async extendSubscription(id: string, dto: ExtendSubscriptionDto, actorId: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const base = user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt).getTime() > Date.now()
      ? new Date(user.subscriptionExpiresAt)
      : new Date();
    base.setTime(base.getTime() + dto.days * 24 * 60 * 60 * 1000);

    user.subscriptionExpiresAt = base;
    const saved = await this.userRepo.save(user);

    this.logger.log(`[ADMIN] Assinatura de ${user.email} estendida em ${dto.days} dias por ${actorId}`);
    return this.sanitize(saved);
  }

  async revokeSession(id: string, actorId: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const oldSessionId = user.currentSessionId;
    user.currentSessionId = null;
    await this.userRepo.save(user);

    this.eventEmitter.emit('auth.session.revoked', { userId: user.id, sessionId: oldSessionId });
    this.logger.log(`[ADMIN] Sessão de ${user.email} revogada por ${actorId}`);
    return { success: true };
  }

  async setPassword(id: string, dto: SetPasswordDto, actorId: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    user.passwordHash = await hashPassword(dto.newPassword);
    user.currentSessionId = null; // força re-login
    await this.userRepo.save(user);
    this.logger.warn(`[ADMIN] Senha de ${user.email} redefinida por ${actorId}`);
    return { success: true };
  }

  /**
   * Admin requisita reset de senha para um usuário.
   * Gera token único, envia email com link de reset, válido por 24h.
   */
  async resetUserPassword(id: string, actorId: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const token = generateSecureToken(32);
    user.passwordResetToken = token;
    user.passwordResetExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h
    await this.userRepo.save(user);

    // Constrói link de reset com JWT (mais seguro que token claro na URL)
    const resetJwt = this.jwtService.sign(
      { userId: user.id, token },
      { expiresIn: '24h' }
    );
    const publicUrl = this.config.get<string>('PUBLIC_URL', 'http://localhost:3000');
    const resetLink = `${publicUrl}/auth/reset-password?token=${resetJwt}`;

    // Envia email
    try {
      await this.emailService.sendResetPasswordEmail(user.email, token, resetLink);
      this.logger.log(`[ADMIN] Email de reset enviado para ${user.email} por ${actorId}`);
    } catch (err) {
      this.logger.error(`[ADMIN] Falha ao enviar email para ${user.email}: ${err.message}`);
      // Não falha a requisição, só loga
    }

    // Em DEV expomos o link pra facilitar testes
    if (process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        message: 'Email de reset enviado (ou exibido abaixo em DEV).',
        devLink: resetLink,
        userEmail: user.email,
      };
    }
    return {
      success: true,
      message: 'Email de reset enviado para o usuário.',
      userEmail: user.email,
    };
  }

  async rotateApiKey(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    user.apiKey = `CP_${generateSecureToken(20)}`.slice(0, 64);
    user.apiKeyRotatedAt = new Date();
    await this.userRepo.save(user);
    return { apiKey: user.apiKey };
  }

  async getUserPreferences(id: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    const bc = (user.bankConfig || {}) as Record<string, any>;
    const asaas = (bc.asaas || {}) as Record<string, any>;
    return {
      autoPayEnabled:      bc.autoPayEnabled      ?? false,
      autoPayDelaySeconds: bc.autoPayDelaySeconds ?? 5,
      rotationInterval:    asaas.rotationInterval ?? 10,
    };
  }

  async updateUserPreferences(
    id: string,
    prefs: { autoPayEnabled?: boolean; autoPayDelaySeconds?: number; rotationInterval?: number },
    actorId: string,
  ) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');

    const bankConfig = (user.bankConfig || {}) as Record<string, any>;

    if (prefs.autoPayEnabled !== undefined) {
      bankConfig.autoPayEnabled = Boolean(prefs.autoPayEnabled);
    }
    if (prefs.autoPayDelaySeconds !== undefined) {
      bankConfig.autoPayDelaySeconds = Math.max(5, Math.min(10, Number(prefs.autoPayDelaySeconds)));
    }
    if (prefs.rotationInterval !== undefined) {
      if (!bankConfig.asaas) bankConfig.asaas = {};
      bankConfig.asaas.rotationInterval = Math.max(2, Math.min(20, Number(prefs.rotationInterval)));
    }

    user.bankConfig = bankConfig;
    await this.userRepo.save(user);
    this.logger.log(`[ADMIN] Preferências de pagamento do usuário ${id} atualizadas por ${actorId}: ${JSON.stringify(prefs)}`);
    return { success: true, ...prefs };
  }

  private sanitize(user: UserEntity) {
    const { passwordHash, passwordResetToken, passwordResetExpiresAt, ...rest } = user;
    const daysRemaining = user.subscriptionExpiresAt
      ? Math.max(0, Math.ceil((new Date(user.subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;
    return {
      ...rest,
      subscriptionDaysRemaining: user.role === 'MASTER_ADMIN' ? null : daysRemaining,
      hasActiveSession: !!user.currentSessionId,
    };
  }
}
