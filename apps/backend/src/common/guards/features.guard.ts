import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURES_KEY } from '../decorators/features.decorator';
import { UserFeature } from '../../database/entities/user.entity';

@Injectable()
export class FeaturesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserFeature[]>(FEATURES_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest();
    const user = req.user;
    if (!user) throw new ForbiddenException('Usuário não autenticado.');

    // MASTER_ADMIN tem todas as features liberadas implicitamente
    if (user.role === 'MASTER_ADMIN') return true;

    const userFeatures: UserFeature[] = user.features ?? [];
    const missing = required.filter(f => !userFeatures.includes(f));
    if (missing.length > 0) {
      throw new ForbiddenException(`Feature não habilitada: ${missing.join(', ')}. Contate o administrador.`);
    }
    return true;
  }
}
