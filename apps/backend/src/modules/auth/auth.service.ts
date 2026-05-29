import {
  Injectable, UnauthorizedException, BadRequestException,
  NotFoundException, Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '../../database/entities/user.entity';
import { EmailService } from '../../common/services/email.service';
import { hashPassword, verifyPassword, generateSecureToken } from '../../common/utils/password.util';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from './dto/password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Login com email + senha. Gera JWT com sessionId único.
   * Login novo INVALIDA sessão anterior (single-session).
   */
  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const user = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase().trim() } });
    if (!user) throw new UnauthorizedException('Email ou senha inválidos.');
    if (!user.passwordHash) {
      throw new UnauthorizedException('Esta conta não possui senha definida. Use a recuperação de senha.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Conta desativada. Contate o administrador.');
    }

    const valid = await verifyPassword(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Email ou senha inválidos.');

    // Bloqueio por assinatura (master admin nunca expira)
    if (user.role !== 'MASTER_ADMIN') {
      if (!user.subscriptionExpiresAt || new Date(user.subscriptionExpiresAt).getTime() < Date.now()) {
        throw new UnauthorizedException({
          code: user.subscriptionExpiresAt ? 'SUBSCRIPTION_EXPIRED' : 'NO_SUBSCRIPTION',
          message: 'Sua assinatura está expirada ou inativa. Contate o administrador.',
        });
      }
    }

    // Gerar nova sessão (invalida a antiga em qualquer outro dispositivo)
    const sessionId = generateSecureToken(24);
    const previousSession = user.currentSessionId;

    user.currentSessionId = sessionId;
    user.lastLoginAt = new Date();
    user.lastLoginIp = meta.ip ?? null;
    user.lastLoginUa = meta.userAgent?.slice(0, 255) ?? null;
    await this.userRepo.save(user);

    if (previousSession && previousSession !== sessionId) {
      // Notifica WS para desconectar sessão anterior, se ainda online
      this.eventEmitter.emit('auth.session.revoked', { userId: user.id, sessionId: previousSession });
      this.logger.log(`[AUTH] Sessão anterior invalidada para ${user.email}`);
    }

    const token = this.jwtService.sign({
      userId: user.id,
      sessionId,
      role: user.role,
      type: 'session',
    });

    return {
      token,
      user: this.sanitize(user),
    };
  }

  /**
   * Logout — limpa currentSessionId. Próximas chamadas com o JWT serão rejeitadas.
   */
  async logout(userId: string) {
    await this.userRepo.update(userId, { currentSessionId: null });
    this.eventEmitter.emit('auth.session.revoked', { userId, sessionId: null });
    return { success: true };
  }

  /**
   * Retorna dados do usuário logado.
   */
  async me(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    return this.sanitize(user);
  }

  /**
   * Solicita recuperação de senha. Gera token único, válido por 24h.
   * Envia email com link de reset seguro.
   */
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email.toLowerCase().trim() } });
    // Não revela se o email existe — sempre retorna sucesso (segurança)
    if (!user) {
      this.logger.warn(`[AUTH] Forgot-password para email inexistente: ${dto.email}`);
      return { success: true, message: 'Se o email existir, um link de recuperação foi enviado.' };
    }

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
      this.logger.log(`[AUTH] Email de reset enviado para ${user.email}`);
    } catch (err) {
      this.logger.error(`[AUTH] Falha ao enviar email para ${user.email}: ${err.message}`);
      // Não falha a requisição, só loga (email pode estar desconfigurado)
    }

    // Em DEV expomos o token pra facilitar testes (nunca fazer em prod)
    if (process.env.NODE_ENV !== 'production') {
      return {
        success: true,
        message: 'Token gerado e enviado por email (ou exibido abaixo em DEV).',
        devToken: token,
        devLink: resetLink,
      };
    }
    return { success: true, message: 'Se o email existir, um link de recuperação foi enviado.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    // Valida JWT token (contém userId + token simples)
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.token);
    } catch (err) {
      throw new BadRequestException('Token inválido ou expirado.');
    }

    const { userId, token: plainToken } = payload;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user || !user.passwordResetToken) {
      throw new BadRequestException('Token inválido.');
    }

    // Compara token criptografado com o JWT extraído
    if (user.passwordResetToken !== plainToken) {
      throw new BadRequestException('Token não corresponde.');
    }

    // Valida expiração
    if (!user.passwordResetExpiresAt || new Date(user.passwordResetExpiresAt).getTime() < Date.now()) {
      throw new BadRequestException('Token expirado. Solicite um novo.');
    }

    // Reseta a senha e limpa sessão (força novo login)
    user.passwordHash = await hashPassword(dto.newPassword);
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    user.currentSessionId = null; // força re-login em todos dispositivos
    await this.userRepo.save(user);

    this.logger.log(`[AUTH] Senha redefinida para ${user.email}`);
    return { success: true, message: 'Senha atualizada. Faça login com a nova senha.' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado.');
    if (!user.passwordHash) throw new BadRequestException('Esta conta não possui senha.');

    const valid = await verifyPassword(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Senha atual incorreta.');

    user.passwordHash = await hashPassword(dto.newPassword);
    await this.userRepo.save(user);

    return { success: true, message: 'Senha alterada com sucesso.' };
  }

  /**
   * Remove campos sensíveis antes de devolver ao cliente.
   */
  private sanitize(user: UserEntity) {
    const { passwordHash, passwordResetToken, passwordResetExpiresAt, currentSessionId, ...rest } = user;
    const daysRemaining = user.subscriptionExpiresAt
      ? Math.max(0, Math.ceil((new Date(user.subscriptionExpiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      : null;
    return {
      ...rest,
      subscriptionDaysRemaining: user.role === 'MASTER_ADMIN' ? null : daysRemaining,
    };
  }
}
