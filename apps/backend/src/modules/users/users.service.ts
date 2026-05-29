import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from '../../database/entities/user.entity';
import { EncryptionService } from '../../common/services/encryption.service';
import { PaymentAdapterFactory } from '../payments/adapters/adapter.factory';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private userRepo: Repository<UserEntity>,
    private readonly encryptionService: EncryptionService,
    private readonly adapterFactory: PaymentAdapterFactory,
  ) {}

  async findAll(pagination: any) {
    const { page = 1, limit = 20 } = pagination || {};
    const [items, total] = await this.userRepo.findAndCount({
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      select: ['id', 'email', 'name', 'role', 'bankAdapter', 'isActive', 'createdAt', 'updatedAt']
    });

    return {
      items,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getBankConfig(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const rawConfig = (user.bankConfig || {}) as Record<string, any>;
    const asaas = rawConfig.asaas || {};
    
    // Suporte ao formato antigo (migração em tempo de leitura)
    if (!rawConfig.asaas && rawConfig.apiKey) {
      let env = 'production';
      try {
        const decrypted = this.encryptionService.decrypt(rawConfig.apiKey as string);
        if (decrypted.startsWith('$aact_')) env = 'sandbox';
      } catch (e) {}
      
      asaas[env] = {
        apiKey: rawConfig.apiKey,
        environment: env,
        accountHolderName: rawConfig.accountHolderName,
        agency: rawConfig.agency,
        accountNumber: rawConfig.accountNumber,
        balance: rawConfig.balance,
        lastSyncAt: rawConfig.lastSyncAt,
        connected: true
      };
    }

    const formatEnv = (envConfig: any) => {
      if (!envConfig || !envConfig.apiKey) return null;
      let decrypted = '';
      try {
        decrypted = this.encryptionService.decrypt(envConfig.apiKey as string);
      } catch {
        decrypted = String(envConfig.apiKey);
      }
      return {
        hasApiKey: true,
        maskedApiKey: decrypted ? `${decrypted.slice(0, 4)}${'*'.repeat(Math.max(0, decrypted.length - 8))}${decrypted.slice(-4)}` : null,
        environment: envConfig.environment || null,
        accountHolderName: envConfig.accountHolderName || envConfig.name || null,
        agency: envConfig.agency || null,
        accountNumber: envConfig.accountNumber || envConfig.account || null,
        balance: typeof envConfig.balance === 'number' ? envConfig.balance : null,
        lastSyncAt: envConfig.lastSyncAt || null,
        connected: Boolean(envConfig.connected)
      };
    };

    return {
      bankAdapter: user.bankAdapter,
      bankConfig: {
        asaas: {
          production:  formatEnv(asaas.production),
          production2: formatEnv(asaas.production2),
          production3: formatEnv(asaas.production3),
          sandbox:     formatEnv(asaas.sandbox),
          rotationInterval: typeof asaas.rotationInterval === 'number' ? asaas.rotationInterval : 10,
          paymentCounter:   typeof asaas.paymentCounter   === 'number' ? asaas.paymentCounter   : 0,
        },
        autoPayEnabled:      rawConfig.autoPayEnabled      ?? false,
        autoPayDelaySeconds: rawConfig.autoPayDelaySeconds ?? 5,
      },
    };
  }

  async updateAsaasConfig(userId: string, environment: string, bankConfig: Record<string, unknown>, dryRun = false) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const apiKeyRaw = typeof bankConfig.apiKey === 'string' ? bankConfig.apiKey : null;
    const apiKey = apiKeyRaw
      ? apiKeyRaw.replace(/\u200B|\u200C|\u200D/g, '').trim()
      : null;
    
    if (!apiKey) {
      // Remover a configuração daquele ambiente se apiKey for vazia
      const currentConfig = (user.bankConfig || {}) as Record<string, any>;
      if (!currentConfig.asaas) currentConfig.asaas = {};
      currentConfig.asaas[environment] = null;
      
      user.bankAdapter = 'asaas';
      user.bankConfig = currentConfig;
      if (!dryRun) await this.userRepo.save(user);
      
      return { success: true, message: `Configuração ${environment} removida com sucesso` };
    }

    try {
      const baseUrl = environment === 'sandbox'
        ? 'https://api-sandbox.asaas.com/v3'
        : 'https://api.asaas.com/v3';
      const envTag =
        environment === 'sandbox' ? 'SANDBOX' :
        environment === 'production2' ? 'PROD2' :
        environment === 'production3' ? 'PROD3' : 'PROD';

      this.logger.log(`[ASAAS][${envTag}] Testando ${environment} com baseURL: ${baseUrl}`);

      const headers: Record<string, string> = {
        'access_token': apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'AI-Project-OS/1.0',
      };

      // 1. Validar token e buscar dados da conta
      let accountHolderName: string | null = null;
      let agency: string | null = null;
      let accountNumber: string | null = null;

      // 1a. Tentar buscar dados comerciais (Nome do Titular/Empresa) para contas padrão (não White-Label)
      try {
        const commRes = await fetch(`${baseUrl}/myAccount/commercialInfo`, { headers });
        if (commRes.ok) {
          const commData = await commRes.json() as any;
          accountHolderName = this.normalizeNullableString(commData?.companyName || commData?.tradingName || commData?.name || null);
        }
      } catch (e) {}

      // 1b. Tentar buscar agência e conta (para contas padrão)
      try {
        const numRes = await fetch(`${baseUrl}/myAccount/accountNumber`, { headers });
        if (numRes.ok) {
          const numData = await numRes.json() as any;
          agency = this.normalizeNullableString(numData?.agency || null);
          const baseAcc = numData?.account || numData?.accountNumber;
          const digit = numData?.accountDigit;
          accountNumber = this.normalizeNullableString(baseAcc ? (digit ? `${baseAcc}-${digit}` : baseAcc) : null);
        }
      } catch (e) {}

      // 1c. Tentar via /accounts (fallback opcional para Subcontas White Label).
      // Algumas chaves validas nao possuem permissao nesse endpoint; nao devemos bloquear aqui.
      let accountData: Record<string, any> = {};
      try {
        const url = `${baseUrl}/accounts`;
        this.logger.log(`[ASAAS][${envTag}] Endpoint chamado: ${url}`);

        const accountsResponse = await fetch(url, { headers });
        this.logger.log(`[ASAAS][${envTag}] Status HTTP: ${accountsResponse.status}`);

        const contentType = accountsResponse.headers.get('content-type') || '';
        this.logger.log(`[ASAAS][${envTag}] Content-Type: ${contentType}`);

        if (!accountsResponse.ok) {
          const errorText = await accountsResponse.text();
          if ([401, 403, 404].includes(accountsResponse.status)) {
            this.logger.warn(`[ASAAS][${envTag}] /accounts restrito (${accountsResponse.status}). Seguindo validacao por /finance/balance.`);
          } else {
            this.logger.warn(`[ASAAS][${envTag}] /accounts falhou (${accountsResponse.status}). Fallback ativado. Body: ${errorText.slice(0, 300)}`);
          }
        } else if (!contentType.includes('application/json')) {
          const text = await accountsResponse.text();
          this.logger.warn(`[ASAAS][${envTag}] /accounts retornou nao-JSON. Fallback ativado. Body: ${text.slice(0, 300)}`);
        } else {
          const responseText = await accountsResponse.text();
          this.logger.log(`[ASAAS][${envTag}] Resposta /accounts: ${responseText}`);
          const accountsData = JSON.parse(responseText);
          accountData = this.extractAsaasAccount(accountsData);
        }
      } catch (e: any) {
        this.logger.warn(`[ASAAS][${envTag}] Erro ao consultar /accounts (nao bloqueante): ${e?.message || e}`);
      }
      
      if (!accountHolderName) {
        accountHolderName = this.normalizeNullableString(
          accountData?.name || accountData?.companyName || accountData?.tradingName || accountData?.owner?.name || null,
        );
      }
      
      if (!agency) {
        agency = this.normalizeNullableString(accountData?.bankAccount?.agency || accountData?.agency || null);
      }
      
      if (!accountNumber) {
        accountNumber = this.normalizeNullableString(
          accountData?.bankAccount?.account || accountData?.accountNumber || accountData?.account || null,
        );
      }

      // 2. Buscar saldo
      const balanceRes = await fetch(`${baseUrl}/finance/balance`, { headers });
      this.logger.log(`[ASAAS][${envTag}] Status HTTP: ${balanceRes.status} (/finance/balance)`);
      if (!balanceRes.ok) {
        const errData = await balanceRes.json().catch(() => ({})) as any;
        this.logger.error(`[ASAAS][${envTag}] Resposta: ${JSON.stringify(errData)}`);
        throw new BadRequestException(
          `Token Asaas inválido: ${errData.errors?.[0]?.description || errData.message || 'Não foi possível conectar à API Asaas'}`
        );
      }

      const balanceData = await balanceRes.json() as any;
      const balance = this.normalizeBalance(balanceData.balance);
      
      this.logger.log(`[ASAAS][${envTag}] Resposta: ${JSON.stringify(balanceData)}`);
      this.logger.log(`[ASAAS][${envTag}] Conectada com sucesso - titular: ${accountHolderName || 'N/A'}, saldo: ${balance}`);

      if (dryRun) {
        return {
          success: true,
          message: 'Conexão testada com sucesso',
          environment,
          accountHolderName: accountHolderName || null,
          agency: agency || null,
          accountNumber: accountNumber || null,
          balance,
          connected: true,
          lastSyncAt: new Date().toISOString(),
        };
      }

      // ── 3. Persistir no bankConfig do usuário ─────────────────────────
      const encryptedApiKey = this.encryptionService.encrypt(apiKey);
      const savedEnvConfig: Record<string, any> = {
        apiKey: encryptedApiKey,
        environment,
        baseUrl,
        accountHolderName: accountHolderName,
        agency: agency,
        accountNumber: accountNumber,
        balance,
        connected: true,
        lastSyncAt: new Date().toISOString(),
      };

      const currentConfig = (user.bankConfig || {}) as Record<string, any>;
      if (!currentConfig.asaas) currentConfig.asaas = {};
      currentConfig.asaas[environment] = savedEnvConfig;

      user.bankAdapter = 'asaas';
      user.bankConfig = currentConfig;
      await this.userRepo.save(user);

      this.logger.log(`[ASAAS][${envTag}] Configuração ${environment} salva para o usuário ${userId}`);

      return {
        success: true,
        message: 'Configuração salva com sucesso',
        environment,
        accountHolderName: savedEnvConfig.accountHolderName,
        agency: savedEnvConfig.agency,
        accountNumber: savedEnvConfig.accountNumber,
        balance,
        connected: true,
        lastSyncAt: savedEnvConfig.lastSyncAt,
      };
    } catch (err) {
      const envTag =
        environment === 'sandbox' ? 'SANDBOX' :
        environment === 'production2' ? 'PROD2' :
        environment === 'production3' ? 'PROD3' : 'PROD';
      this.logger.error(`[ASAAS][${envTag}] Erro: ${err?.message || err}`);
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(`Falha ao validar token Asaas: ${err.message}`);
    }
  }



  async updatePreferences(userId: string, prefs: {
    rotationInterval?: number;
    autoPayEnabled?: boolean;
    autoPayDelaySeconds?: number;
  }) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const bankConfig = (user.bankConfig || {}) as Record<string, any>;

    if (prefs.rotationInterval !== undefined) {
      if (!bankConfig.asaas) bankConfig.asaas = {};
      bankConfig.asaas.rotationInterval = Math.max(2, Math.min(20, Number(prefs.rotationInterval)));
    }
    if (prefs.autoPayEnabled !== undefined) {
      bankConfig.autoPayEnabled = Boolean(prefs.autoPayEnabled);
    }
    if (prefs.autoPayDelaySeconds !== undefined) {
      bankConfig.autoPayDelaySeconds = Math.max(5, Math.min(10, Number(prefs.autoPayDelaySeconds)));
    }

    user.bankConfig = bankConfig;
    await this.userRepo.save(user);
    this.logger.log(`[PREFERENCES] Usuário ${userId} atualizou preferências: ${JSON.stringify(prefs)}`);
    return { success: true, ...prefs };
  }

  async updateBankConfig(userId: string, bankAdapter: string, bankConfig: Record<string, unknown>, dryRun = false) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }

    const encryptedConfig = this.encryptionService.encryptObject(bankConfig || {});
    user.bankAdapter = bankAdapter;
    user.bankConfig = encryptedConfig;
    await this.userRepo.save(user);
    return {
      success: true,
      message: 'Configuração salva com sucesso',
    };
  }

  private extractAsaasAccount(payload: any): Record<string, any> {
    if (Array.isArray(payload)) return payload[0] || {};
    if (payload?.object === 'list' && Array.isArray(payload?.data)) return payload.data[0] || {};
    if (Array.isArray(payload?.data)) return payload.data[0] || {};
    return payload || {};
  }

  private normalizeNullableString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeBalance(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
  }
}

