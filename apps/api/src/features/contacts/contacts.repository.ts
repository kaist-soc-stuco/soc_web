import { Inject, Injectable } from "@nestjs/common";
import { eq, asc } from "drizzle-orm";
import { DRIZZLE_DB, PostgresDatabase } from "../../infrastructure/postgres/postgres.provider";
import { executiveContacts } from "../../infrastructure/postgres/postgres.schema";
import type { ContactRecord, CreateContactRequest, UpdateContactRequest } from "@soc/contracts";
import { msToIso } from "@soc/shared";

@Injectable()
export class ContactsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private map(row: typeof executiveContacts.$inferSelect): ContactRecord {
    return {
      id: row.id,
      nameKo: row.nameKo,
      nameEn: row.nameEn,
      roleKo: row.roleKo,
      roleEn: row.roleEn,
      email: row.email,
      phoneNumber: row.phoneNumber,
      sortOrder: row.sortOrder,
      createdAt: msToIso(row.createdAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  async findAll(): Promise<ContactRecord[]> {
    const rows = await this.db
      .select()
      .from(executiveContacts)
      .orderBy(asc(executiveContacts.sortOrder), asc(executiveContacts.createdAt));
    return rows.map((row) => this.map(row));
  }

  async findById(id: string): Promise<ContactRecord | null> {
    const [row] = await this.db
      .select()
      .from(executiveContacts)
      .where(eq(executiveContacts.id, id));
    return row ? this.map(row) : null;
  }

  async insert(dto: CreateContactRequest): Promise<ContactRecord> {
    const [row] = await this.db
      .insert(executiveContacts)
      .values({
        nameKo: dto.nameKo,
        nameEn: dto.nameEn ?? null,
        roleKo: dto.roleKo,
        roleEn: dto.roleEn ?? null,
        email: dto.email ?? null,
        phoneNumber: dto.phoneNumber ?? null,
        sortOrder: dto.sortOrder ?? 0,
        updatedAt: new Date(),
      })
      .returning();
    return this.map(row);
  }

  async update(id: string, dto: UpdateContactRequest): Promise<ContactRecord | null> {
    const set: Partial<typeof executiveContacts.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (dto.nameKo !== undefined) set.nameKo = dto.nameKo;
    if (dto.nameEn !== undefined) set.nameEn = dto.nameEn;
    if (dto.roleKo !== undefined) set.roleKo = dto.roleKo;
    if (dto.roleEn !== undefined) set.roleEn = dto.roleEn;
    if (dto.email !== undefined) set.email = dto.email;
    if (dto.phoneNumber !== undefined) set.phoneNumber = dto.phoneNumber;
    if (dto.sortOrder !== undefined) set.sortOrder = dto.sortOrder;

    const [row] = await this.db
      .update(executiveContacts)
      .set(set)
      .where(eq(executiveContacts.id, id))
      .returning();
    return row ? this.map(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(executiveContacts)
      .where(eq(executiveContacts.id, id));
  }
}
