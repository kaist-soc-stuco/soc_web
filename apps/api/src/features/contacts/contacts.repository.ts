import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { DRIZZLE_DB, PostgresDatabase } from "../../infrastructure/postgres/postgres.provider";
import { executiveContacts } from "../../infrastructure/postgres/postgres.schema";
import type {
  BulkImportContactsRequest,
  BulkImportContactsResponse,
  ContactRecord,
  ContactListOptions,
  ContactListResponse,
  CreateContactRequest,
  ReorderContactsRequest,
  UpdateContactRequest,
} from "@soc/contracts";
import { msToIso, nowDate } from "@soc/shared";

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
      gender: row.gender ?? null,
      cohort: row.cohort ?? null,
      email: row.email,
      phoneNumber: row.phoneNumber,
      privacyConsented: row.privacyConsented,
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

  async findManaged(input: ContactListOptions = {}): Promise<ContactListResponse> {
    const page = Math.max(input.page ?? 1, 1);
    const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 500);
    const offset = (page - 1) * pageSize;
    const normalizedQuery = input.q?.trim() ?? "";
    const normalizedGender = input.gender?.trim() ?? "";
    const conditions: Array<SQL | undefined> = [
      normalizedQuery
        ? or(
            ilike(executiveContacts.nameKo, `%${normalizedQuery}%`),
            ilike(executiveContacts.nameEn, `%${normalizedQuery}%`),
            ilike(executiveContacts.roleKo, `%${normalizedQuery}%`),
            ilike(executiveContacts.roleEn, `%${normalizedQuery}%`),
            ilike(executiveContacts.email, `%${normalizedQuery}%`),
            ilike(executiveContacts.phoneNumber, `%${normalizedQuery}%`),
          )
        : undefined,
      normalizedGender ? ilike(executiveContacts.gender, `%${normalizedGender}%`) : undefined,
      input.cohort !== undefined ? eq(executiveContacts.cohort, input.cohort) : undefined,
      input.department
        ? or(
            eq(executiveContacts.roleKo, input.department),
            eq(executiveContacts.roleEn, input.department),
          )
        : undefined,
      input.privacyConsented !== undefined
        ? eq(executiveContacts.privacyConsented, input.privacyConsented)
        : undefined,
    ].filter(Boolean);
    const whereClause = conditions.length === 0 ? undefined : and(...conditions);

    const rows = await this.db
      .select()
      .from(executiveContacts)
      .where(whereClause)
      .orderBy(asc(executiveContacts.sortOrder), asc(executiveContacts.createdAt))
      .limit(pageSize)
      .offset(offset);
    const countResult = await this.db
      .select({ count: sql<number>`COUNT(*)` })
      .from(executiveContacts)
      .where(whereClause);

    return {
      items: rows.map((row) => this.map(row)),
      total: Number(countResult[0]?.count ?? 0),
      page,
      pageSize,
    };
  }

  async purgeRevoked(): Promise<number> {
    const removed = await this.db
      .delete(executiveContacts)
      .where(eq(executiveContacts.privacyConsented, false))
      .returning({ id: executiveContacts.id });
    return removed.length;
  }

  async findById(id: string): Promise<ContactRecord | null> {
    const [row] = await this.db
      .select()
      .from(executiveContacts)
      .where(eq(executiveContacts.id, id));
    return row ? this.map(row) : null;
  }

  async insert(dto: CreateContactRequest): Promise<ContactRecord> {
    const [sortOrderRow] = await this.db
      .select({ maxSortOrder: sql<number | null>`max(${executiveContacts.sortOrder})` })
      .from(executiveContacts);
    const nextSortOrder = Number(sortOrderRow?.maxSortOrder ?? -1) + 1;
    const [row] = await this.db
      .insert(executiveContacts)
      .values({
        nameKo: dto.nameKo,
        nameEn: dto.nameEn,
        roleKo: dto.roleKo,
        roleEn: dto.roleEn,
        gender: dto.gender ?? null,
        cohort: dto.cohort ?? null,
        email: dto.email ?? null,
        phoneNumber: dto.phoneNumber ?? null,
        privacyConsented: dto.privacyConsented ?? true,
        sortOrder: dto.sortOrder ?? nextSortOrder,
        updatedAt: nowDate(),
      })
      .returning();
    return this.map(row);
  }

  async bulkImport(
    dto: BulkImportContactsRequest,
  ): Promise<BulkImportContactsResponse> {
    return this.db.transaction(async (tx) => {
      let removedCount = 0;

      if (dto.replaceExisting) {
        const removed = await tx.delete(executiveContacts).returning({
          id: executiveContacts.id,
        });
        removedCount = removed.length;
      }

      const rows = await tx
        .insert(executiveContacts)
        .values(
          dto.items.map((item, index) => ({
            nameKo: item.nameKo,
            nameEn: item.nameEn,
            roleKo: item.roleKo,
            roleEn: item.roleEn,
            gender: item.gender ?? null,
            cohort: item.cohort ?? null,
            email: item.email ?? null,
            phoneNumber: item.phoneNumber ?? null,
            privacyConsented: item.privacyConsented ?? true,
            sortOrder: item.sortOrder ?? index * 10,
            updatedAt: nowDate(),
          })),
        )
        .returning();

      return {
        importedCount: rows.length,
        removedCount,
        items: rows
          .map((row) => this.map(row))
          .sort(
            (a, b) =>
              a.sortOrder - b.sortOrder ||
              a.createdAt.localeCompare(b.createdAt),
          ),
      };
    });
  }

  async update(id: string, dto: UpdateContactRequest): Promise<ContactRecord | null> {
    if (dto.privacyConsented === false) {
      await this.db.delete(executiveContacts).where(eq(executiveContacts.id, id));
      return null;
    }
    const set: Partial<typeof executiveContacts.$inferInsert> = {
      updatedAt: nowDate(),
    };

    if (dto.nameKo !== undefined) set.nameKo = dto.nameKo;
    if (dto.nameEn !== undefined) set.nameEn = dto.nameEn;
    if (dto.roleKo !== undefined) set.roleKo = dto.roleKo;
    if (dto.roleEn !== undefined) set.roleEn = dto.roleEn;
    if (dto.gender !== undefined) set.gender = dto.gender;
    if (dto.cohort !== undefined) set.cohort = dto.cohort;
    if (dto.email !== undefined) set.email = dto.email;
    if (dto.phoneNumber !== undefined) set.phoneNumber = dto.phoneNumber;
    if (dto.privacyConsented !== undefined) set.privacyConsented = dto.privacyConsented;
    if (dto.sortOrder !== undefined) set.sortOrder = dto.sortOrder;

    const [row] = await this.db
      .update(executiveContacts)
      .set(set)
      .where(eq(executiveContacts.id, id))
      .returning();
    return row ? this.map(row) : null;
  }

  async reorder(items: ReorderContactsRequest["items"]): Promise<ContactRecord[]> {
    return this.db.transaction(async (tx) => {
      for (const item of items) {
        await tx
          .update(executiveContacts)
          .set({ sortOrder: item.sortOrder, updatedAt: nowDate() })
          .where(eq(executiveContacts.id, item.id));
      }

      const rows = await tx
        .select()
        .from(executiveContacts)
        .orderBy(asc(executiveContacts.sortOrder), asc(executiveContacts.createdAt));
      return rows.map((row) => this.map(row));
    });
  }

  async delete(id: string): Promise<void> {
    await this.db
      .delete(executiveContacts)
      .where(eq(executiveContacts.id, id));
  }
}
