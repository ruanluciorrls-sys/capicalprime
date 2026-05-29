import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserEntity } from '../../database/entities/user.entity';
import { ExtensionDeviceEntity } from '../../database/entities/extension-device.entity';
import { seedDefaultUser } from '../../database/seeds/user.seed';
import { CommonModule } from '../../common/common.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, ExtensionDeviceEntity]),
    CommonModule,
    PaymentsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule implements OnModuleInit {
  constructor(@InjectDataSource() private dataSource: DataSource) {}
  async onModuleInit() {
    await seedDefaultUser(this.dataSource);
  }
}
