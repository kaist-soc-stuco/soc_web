import { Module } from "@nestjs/common";
import { ContactsRepository } from "./contacts.repository";
import { ContactsService } from "./contacts.service";
import { ContactsController } from "./contacts.controller";
import { AuthModule } from "../auth/auth.module";
import { UsersModule } from "../users/users.module";
import { PostgresModule } from "../../infrastructure/postgres/postgres.module";
import { AuditLogModule } from "../audit/audit-log.module";

@Module({
  imports: [AuthModule, UsersModule, PostgresModule, AuditLogModule],
  controllers: [ContactsController],
  providers: [ContactsRepository, ContactsService],
  exports: [ContactsService, ContactsRepository],
})
export class ContactsModule {}
