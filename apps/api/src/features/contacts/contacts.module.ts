import { Module } from '@nestjs/common';
import { PostgresModule } from '../../infrastructure/postgres/postgres.module';
import { AuthModule } from '../auth/auth.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { AuthGuard } from '../../shared/guards';
import { PiiCipherService } from '../../shared/security/pii-cipher.service';
import { ContactsController } from './contacts.controller';
import { ContactsRepository } from './contacts.repository';
import { ContactsService } from './contacts.service';

@Module({ imports: [PostgresModule, AuthModule, PermissionsModule], controllers: [ContactsController], providers: [ContactsRepository, ContactsService, PiiCipherService, AuthGuard], exports: [ContactsService] })
export class ContactsModule {}
