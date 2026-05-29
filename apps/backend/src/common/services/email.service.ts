import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private config: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpHost = this.config.get<string>('SMTP_HOST');
    const smtpPort = this.config.get<number>('SMTP_PORT', 587);
    const smtpUser = this.config.get<string>('SMTP_USER');
    const smtpPass = this.config.get<string>('SMTP_PASS');
    const smtpFrom = this.config.get<string>('SMTP_FROM', 'noreply@capitalprime.local');
    const smtpTls = this.config.get<string>('SMTP_TLS', 'true').toLowerCase() === 'true';

    if (!smtpHost || !smtpUser || !smtpPass) {
      this.logger.warn('SMTP nao configurado — emails serao logados no console (modo desenvolvimento)');
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpTls && smtpPort === 465, // TLS se porta 465, senao STARTTLS
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      from: smtpFrom,
    });

    this.logger.log(`SMTP configurado: ${smtpUser}@${smtpHost}:${smtpPort}`);
  }

  async sendResetPasswordEmail(email: string, resetToken: string, resetLink: string) {
    const subject = '🔑 Recupere sua senha - Capital Prime';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #f59e0b; text-align: center;">Capital Prime</h2>
        <p>Oi,</p>
        <p>Você solicitou para recuperar sua senha. Clique no link abaixo para defini uma nova senha:</p>
        <p style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Recuperar Senha
          </a>
        </p>
        <p><strong>Ou cole este código no formulário:</strong></p>
        <p style="background: #f0f0f0; padding: 12px; border-radius: 4px; font-family: monospace; text-align: center; font-size: 14px;">
          ${resetToken}
        </p>
        <p style="color: #999; font-size: 12px;">
          ⏰ Este link expira em 24 horas<br>
          Se você não solicitou isso, ignore este email.
        </p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
        <p style="text-align: center; color: #999; font-size: 11px;">
          © 2026 Capital Prime. Todos os direitos reservados.
        </p>
      </div>
    `;

    return this.sendEmail(email, subject, html);
  }

  async sendTestEmail(email: string) {
    const subject = '✅ Teste de Email - Capital Prime';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">✅ Email configurado com sucesso!</h2>
        <p>Este é um email de teste do Capital Prime.</p>
        <p>Se você recebeu este email, sua configuração de SMTP está funcionando corretamente.</p>
      </div>
    `;
    return this.sendEmail(email, subject, html);
  }

  private async sendEmail(to: string, subject: string, html: string) {
    if (!this.transporter) {
      this.logger.log(`[MOCK EMAIL] Para: ${to}`);
      this.logger.log(`[MOCK EMAIL] Assunto: ${subject}`);
      this.logger.log(`[MOCK EMAIL] Corpo: ${html.substring(0, 100)}...`);
      return { messageId: 'mock-' + Date.now(), accepted: [to] };
    }

    try {
      const result = await this.transporter.sendMail({
        to,
        subject,
        html,
      });
      this.logger.log(`Email enviado para ${to} (ID: ${result.messageId})`);
      return result;
    } catch (err) {
      this.logger.error(`Falha ao enviar email para ${to}:`, err.message);
      throw new Error(`Falha ao enviar email: ${err.message}`);
    }
  }
}
