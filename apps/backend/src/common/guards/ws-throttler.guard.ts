import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';

@Injectable()
export class WsThrottlerGuard extends ThrottlerGuard {
  async handleRequest(
    context: ExecutionContext,
    limit: number,
    ttl: number,
    throttler: any,
  ): Promise<boolean> {
    const client = context.switchToWs().getClient();
    const ip = client.conn?.remoteAddress || client.request?.connection?.remoteAddress || 'unknown';
    const key = this.generateKey(context, ip, throttler.name);

    const { totalHits } = await this.storageService.increment(key, ttl);

    if (totalHits > limit) {
      throw new ThrottlerException('Too Many Requests');
    }

    return true;
  }
}
