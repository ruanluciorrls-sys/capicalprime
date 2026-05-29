import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { EventsService } from './events.service';

@Module({
  imports: [PaymentsModule],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
