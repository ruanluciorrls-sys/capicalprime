import { DataSource } from 'typeorm';
import { UserEntity } from '../entities/user.entity';
import { hashPassword } from '../../common/utils/password.util';
import AppDataSource from '../data-source';

/**
 * Cria o MASTER_ADMIN inicial e o usuário default.
 * Configurar via .env:
 *   MASTER_ADMIN_EMAIL=ruan@capitalprime.local
 *   MASTER_ADMIN_PASSWORD=ChangeMeNow!2026
 */
export async function seedDefaultUser(dataSource: DataSource) {
  const userRepo = dataSource.getRepository(UserEntity);

  const masterEmail = (process.env.MASTER_ADMIN_EMAIL || 'ruan@capitalprime.local').toLowerCase();
  const masterPassword = process.env.MASTER_ADMIN_PASSWORD || 'CapitalPrime@2026';

  // ── MASTER_ADMIN ────────────────────────────────────────────
  const existingMaster = await userRepo.findOne({ where: { email: masterEmail } });
  if (!existingMaster) {
    const master = userRepo.create({
      name: 'Master Admin',
      email: masterEmail,
      passwordHash: await hashPassword(masterPassword),
      apiKey: 'CAPITAL_PRIME_MASTER_2026',
      role: 'MASTER_ADMIN',
      features: ['AUTO_PAYMENT', 'BULK_QR', 'API_ACCESS', 'WEBHOOK'],
      isActive: true,
      subscriptionExpiresAt: null, // master nunca expira
      bankAdapter: 'asaas',
    });
    await userRepo.save(master);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[SEED] 👑 MASTER_ADMIN criado');
    console.log(`       Email:    ${masterEmail}`);
    console.log(`       Senha:    ${masterPassword}`);
    console.log(`       API Key:  CAPITAL_PRIME_MASTER_2026`);
    console.log('       ⚠️  ALTERE A SENHA NO PRIMEIRO LOGIN');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  } else if (!existingMaster.passwordHash || existingMaster.role !== 'MASTER_ADMIN') {
    // Upgrade do master existente (caso veio de versão antiga sem senha)
    existingMaster.passwordHash = existingMaster.passwordHash || await hashPassword(masterPassword);
    existingMaster.role = 'MASTER_ADMIN';
    existingMaster.features = existingMaster.features || ['AUTO_PAYMENT', 'BULK_QR', 'API_ACCESS', 'WEBHOOK'];
    await userRepo.save(existingMaster);
    console.log('[SEED] 👑 MASTER_ADMIN existente atualizado para nova estrutura.');
  } else {
    console.log(`[SEED] 👑 MASTER_ADMIN já existe: ${masterEmail}`);
  }

  // ── Legacy default user (mantido pra compatibilidade da extensão) ──
  const legacy = await userRepo.findOne({ where: { apiKey: 'AIOS_DEFAULT_KEY_2025' } });
  if (!legacy) {
    const def = userRepo.create({
      name: 'Default User',
      email: 'default@capitalprime.local',
      apiKey: 'AIOS_DEFAULT_KEY_2025',
      role: 'USER',
      bankAdapter: 'mock',
      isActive: true,
      // 365 dias de assinatura inicial pra não travar o dev local
      subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    });
    await userRepo.save(def);
    console.log('[SEED] Default user criado (apiKey AIOS_DEFAULT_KEY_2025).');
  }
}

if (require.main === module) {
  AppDataSource.initialize()
    .then(async (ds) => {
      await seedDefaultUser(ds);
      await ds.destroy();
      process.exit(0);
    })
    .catch((error) => {
      console.error('[SEED] Failed to seed default user:', error);
      process.exit(1);
    });
}
