import { Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { DRIZZLE_DB, PostgresDatabase } from "../../infrastructure/postgres/postgres.provider";
import { executiveContactDepartments, executiveContacts } from "../../infrastructure/postgres/postgres.schema";
import type {
  BulkImportContactsRequest,
  BulkImportContactsResponse,
  ContactRecord,
  ContactDepartmentRecord,
  ContactDepartmentListResponse,
  ContactListOptions,
  ContactListResponse,
  CreateContactDepartmentRequest,
  CreateContactRequest,
  ReorderContactsRequest,
  UpdateContactRequest,
  UpdateContactDepartmentRequest,
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
      departmentKo: row.departmentKo ?? null,
      departmentEn: row.departmentEn ?? null,
      roleKo: row.roleKo,
      roleEn: row.roleEn,
      studentNumber: row.studentNumber ?? null,
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

  private mapDepartment(
    row: typeof executiveContactDepartments.$inferSelect,
  ): ContactDepartmentRecord {
    return {
      id: row.id,
      nameKo: row.nameKo,
      nameEn: row.nameEn,
      descriptionKo: row.descriptionKo,
      descriptionEn: row.descriptionEn,
      inquiryEmail: row.inquiryEmail || null,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: msToIso(row.createdAt.valueOf()),
      updatedAt: msToIso(row.updatedAt.valueOf()),
    };
  }

  async findDepartments(includeInactive = false): Promise<ContactDepartmentListResponse> {
    const rows = await this.db
      .select()
      .from(executiveContactDepartments)
      .where(includeInactive ? undefined : eq(executiveContactDepartments.isActive, true))
      .orderBy(asc(executiveContactDepartments.sortOrder), asc(executiveContactDepartments.nameKo));
    return { items: rows.map((row) => this.mapDepartment(row)) };
  }

  async findDepartmentById(id: string): Promise<ContactDepartmentRecord | null> {
    const [row] = await this.db
      .select()
      .from(executiveContactDepartments)
      .where(eq(executiveContactDepartments.id, id));
    return row ? this.mapDepartment(row) : null;
  }

  async insertDepartment(dto: CreateContactDepartmentRequest): Promise<ContactDepartmentRecord> {
    const [sortOrderRow] = await this.db
      .select({ maxSortOrder: sql<number | null>`max(${executiveContactDepartments.sortOrder})` })
      .from(executiveContactDepartments);
    const [row] = await this.db
      .insert(executiveContactDepartments)
      .values({
        nameKo: dto.nameKo,
        nameEn: dto.nameEn ?? "",
        descriptionKo: dto.descriptionKo ?? "",
        descriptionEn: dto.descriptionEn ?? "",
        inquiryEmail: dto.inquiryEmail ?? "",
        sortOrder: dto.sortOrder ?? Number(sortOrderRow?.maxSortOrder ?? -1) + 1,
        isActive: dto.isActive ?? true,
        updatedAt: nowDate(),
      })
      .returning();
    return this.mapDepartment(row);
  }

  async updateDepartment(
    id: string,
    dto: UpdateContactDepartmentRequest,
  ): Promise<ContactDepartmentRecord | null> {
    const current = await this.findDepartmentById(id);
    if (!current) return null;
    const nameKo = dto.nameKo ?? current.nameKo;
    const nameEn = dto.nameEn ?? current.nameEn;
    const descriptionKo = dto.descriptionKo ?? current.descriptionKo;
    const descriptionEn = dto.descriptionEn ?? current.descriptionEn;
    const inquiryEmail = dto.inquiryEmail ?? current.inquiryEmail ?? "";
    const set: Partial<typeof executiveContactDepartments.$inferInsert> = {
      updatedAt: nowDate(),
    };
    if (dto.nameKo !== undefined) set.nameKo = nameKo;
    if (dto.nameEn !== undefined) set.nameEn = nameEn;
    if (dto.descriptionKo !== undefined) set.descriptionKo = descriptionKo;
    if (dto.descriptionEn !== undefined) set.descriptionEn = descriptionEn;
    if (dto.inquiryEmail !== undefined) set.inquiryEmail = inquiryEmail;
    if (dto.sortOrder !== undefined) set.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) set.isActive = dto.isActive;

    const result = await this.db.transaction(async (tx) => {
      if (dto.nameKo !== undefined || dto.nameEn !== undefined) {
        await tx
          .update(executiveContacts)
          .set({ departmentKo: nameKo, departmentEn: nameEn || null, updatedAt: nowDate() })
          .where(
            or(
              eq(executiveContacts.departmentKo, current.nameKo),
              current.nameEn ? eq(executiveContacts.departmentEn, current.nameEn) : undefined,
            ),
          );
      }
      const [row] = await tx
        .update(executiveContactDepartments)
        .set(set)
        .where(eq(executiveContactDepartments.id, id))
        .returning();
      return row;
    });
    return result ? this.mapDepartment(result) : null;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    const [row] = await this.db
      .delete(executiveContactDepartments)
      .where(eq(executiveContactDepartments.id, id))
      .returning({ id: executiveContactDepartments.id });
    return Boolean(row);
  }

  async findManaged(input: ContactListOptions = {}): Promise<ContactListResponse> {
    const page = Math.max(input.page ?? 1, 1);
    const pageSize = Math.min(Math.max(input.pageSize ?? 50, 1), 500);
    const offset = (page - 1) * pageSize;
    const normalizedQuery = input.q?.trim() ?? "";
    const conditions: Array<SQL | undefined> = [
      normalizedQuery
        ? or(
            ilike(executiveContacts.nameKo, `%${normalizedQuery}%`),
            ilike(executiveContacts.nameEn, `%${normalizedQuery}%`),
            ilike(executiveContacts.departmentKo, `%${normalizedQuery}%`),
            ilike(executiveContacts.departmentEn, `%${normalizedQuery}%`),
            ilike(executiveContacts.roleKo, `%${normalizedQuery}%`),
            ilike(executiveContacts.roleEn, `%${normalizedQuery}%`),
            ilike(executiveContacts.email, `%${normalizedQuery}%`),
            ilike(executiveContacts.phoneNumber, `%${normalizedQuery}%`),
            ilike(executiveContacts.studentNumber, `%${normalizedQuery}%`),
          )
        : undefined,
      input.cohort !== undefined ? eq(executiveContacts.cohort, input.cohort) : undefined,
        input.department
        ? or(
            eq(executiveContacts.departmentKo, input.department),
            eq(executiveContacts.departmentEn, input.department),
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
        departmentKo: dto.departmentKo ?? null,
        departmentEn: dto.departmentEn ?? null,
        roleKo: dto.roleKo,
        roleEn: dto.roleEn,
        studentNumber: dto.studentNumber ?? null,
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
            departmentKo: item.departmentKo ?? null,
            departmentEn: item.departmentEn ?? null,
            roleKo: item.roleKo,
            roleEn: item.roleEn,
            studentNumber: item.studentNumber ?? null,
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
    if (dto.departmentKo !== undefined) set.departmentKo = dto.departmentKo;
    if (dto.departmentEn !== undefined) set.departmentEn = dto.departmentEn;
    if (dto.roleKo !== undefined) set.roleKo = dto.roleKo;
    if (dto.roleEn !== undefined) set.roleEn = dto.roleEn;
    if (dto.studentNumber !== undefined) set.studentNumber = dto.studentNumber;
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
