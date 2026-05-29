import { SetMetadata } from '@nestjs/common';
import { UserFeature } from '../../database/entities/user.entity';

export const FEATURES_KEY = 'features';
/**
 * Requer que o usuário tenha TODAS as features listadas habilitadas pelo MASTER_ADMIN.
 */
export const RequireFeatures = (...features: UserFeature[]) => SetMetadata(FEATURES_KEY, features);
