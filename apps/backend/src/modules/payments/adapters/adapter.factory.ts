import { Injectable, Logger } from '@nestjs/common';
import { IPaymentAdapter } from './payment-adapter.interface';
import { MockPaymentAdapter } from './mock.adapter';
import { SicoobPaymentAdapter } from './sicoob.adapter';
import { AsaasPaymentAdapter } from './asaas.adapter';
import { MercadoPagoPaymentAdapter } from './mercadopago.adapter';
import { InterPaymentAdapter } from './inter.adapter';
import { EfiPaymentAdapter } from './efi.adapter';
import { BancoDoBrasilPaymentAdapter } from './bb.adapter';

type AdapterConstructor = new (config?: Record<string, unknown>) => IPaymentAdapter;

const ADAPTER_REGISTRY: Record<string, AdapterConstructor> = {
  mock: MockPaymentAdapter,
  asaas: AsaasPaymentAdapter,
  sicoob: SicoobPaymentAdapter,
  mercadopago: MercadoPagoPaymentAdapter,
  inter: InterPaymentAdapter,
  efi: EfiPaymentAdapter,
  bb: BancoDoBrasilPaymentAdapter,
};

@Injectable()
export class PaymentAdapterFactory {
  private readonly logger = new Logger(PaymentAdapterFactory.name);
  private readonly cache = new Map<string, IPaymentAdapter>();

  getAdapter(
    bankCode: string,
    config?: Record<string, unknown> | null,
  ): IPaymentAdapter {
    const code = bankCode?.toLowerCase() || 'mock';

    if (!config && this.cache.has(code)) {
      return this.cache.get(code)!;
    }

    const Constructor = ADAPTER_REGISTRY[code];
    if (!Constructor) {
      this.logger.warn(`Unknown adapter "${code}", falling back to mock`);
      return new MockPaymentAdapter();
    }

    const adapter = new Constructor(config ?? {});

    if (!config) {
      this.cache.set(code, adapter);
    }

    this.logger.log(`Adapter resolved: ${adapter.bankName} (${adapter.bankCode})`);
    return adapter;
  }

  getRegisteredProviders(): string[] {
    return Object.keys(ADAPTER_REGISTRY);
  }

  getProviderMetadata(bankCode: string): IPaymentAdapter | null {
    try {
      return this.getAdapter(bankCode);
    } catch {
      return null;
    }
  }
}
