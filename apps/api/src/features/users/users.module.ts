import { Module } from '@nestjs/common';

import { PostgresModule } from '../../infrastructure/postgres/postgres.module';
import { UsersController } from './users.controller';
import { UsersRepository } from './repositories/users.repository';
import { UsersService } from './users.service';

@Module({
  imports: [PostgresModule],
  controllers: [UsersController],
  providers: [UsersRepository, UsersService],
  exports: [UsersService],
})
export class UsersModule {}
