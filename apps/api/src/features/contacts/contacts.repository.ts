import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { and, asc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";
import { DRIZZLE_DB, PostgresDatabase } from "../../infrastructure/postgres/postgres.provider";
import { executiveContactDepartments, executiveContacts } from "../../infrastructure/postgres/postgres.schema";
import type {
  BulkImportContactsRequest,
  BulkImportContactsResponse,
  ContactRecord,
  ContactActivity,
  ContactDepartmentRecord,
  ContactDepartmentListResponse,
  PublicContactDepartmentListResponse,
  PublicContactListResponse,
  ContactListOptions,
  ContactListResponse,
  CreateContactDepartmentRequest,
  CreateContactRequest,
  ReorderContactsRequest,
  UpdateContactRequest,
  UpdateContactDepartmentRequest,
} from "@soc/contracts";
import { msToIso, msToTimeObj, nowDate, nowMs } from "@soc/shared";
import { enqueueSpreadsheetSync } from "../../infrastructure/google/enqueue-spreadsheet-sync";

@Injectable()
export class ContactsRepository {
  constructor(@Inject(DRIZZLE_DB) private readonly db: PostgresDatabase) {}

  private map(row: typeof executiveContacts.$inferSelect): ContactRecord {
    return {
      id: row.id,
      portalUserId: row.portalUserId,
      activities: (row.activities ?? []).map((activity) => ({ ...activity, year: activity.year < 100 ? 2000 + activity.year : activity.year })),
      nameKo: row.nameKo,
      nameEn: row.nameEn,
      departmentKo: row.departmentKo ?? null,
      departmentEn: row.departmentEn ?? null,
      roleKo: row.roleKo,
      roleEn: row.roleEn,
      studentNumber: row.studentNumber ?? null,
      cohort: row.cohort ? (row.cohort < 100 ? 2000 + row.cohort : row.cohort) : null,
      email: row.email,
      phoneNumber: row.phoneNumber?.replace(/-/g, "") ?? null,
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

  async findPublic(): Promise<PublicContactListResponse> {
    return { items: [] };
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

  async findPublicDepartments(): Promise<PublicContactDepartmentListResponse> {
    return { items: [] };
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
      if (dto.nameKo !== undefined) {
        await tx.update(executiveContacts).set({
          activities: sql`(SELECT COALESCE(jsonb_agg(CASE WHEN a->>'departmentId' = ${id} OR (COALESCE(a->>'departmentId', '') = '' AND a->>'departmentKo' = ${current.nameKo}) THEN jsonb_set(a, '{departmentKo}', to_jsonb(${nameKo}::text)) ELSE a END), '[]'::jsonb) FROM jsonb_array_elements(${executiveContacts.activities}) a)`,
          updatedAt: nowDate(),
        }).where(sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${executiveContacts.activities}) a WHERE a->>'departmentId' = ${id} OR (COALESCE(a->>'departmentId', '') = '' AND a->>'departmentKo' = ${current.nameKo}))`);
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
    const year = input.cohort !== undefined && input.cohort < 100 ? 2000 + input.cohort : input.cohort;
    const yearValues = year !== undefined ? (year > 2000 && year < 2100 ? [year, year - 2000] : [year]) : [];
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
            ilike(sql`replace(${executiveContacts.phoneNumber}, '-', '')`, `%${normalizedQuery.replace(/-/g, "")}%`),
            ilike(executiveContacts.studentNumber, `%${normalizedQuery}%`),
            sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${executiveContacts.activities}) a WHERE a->>'roleKo' ILIKE ${`%${normalizedQuery}%`} OR a->>'roleEn' ILIKE ${`%${normalizedQuery}%`})`,
          )
        : undefined,
      input.cohort !== undefined || input.department
        ? or(
            and(
              sql`jsonb_array_length(${executiveContacts.activities}) = 0`,
              year !== undefined ? sql`${executiveContacts.cohort} IN (${sql.join(yearValues.map(value => sql`${value}`), sql`, `)})` : undefined,
              input.department ? or(eq(executiveContacts.departmentKo, input.department), eq(executiveContacts.departmentEn, input.department)) : undefined,
            ),
            sql`EXISTS (SELECT 1 FROM jsonb_array_elements(${executiveContacts.activities}) a
              WHERE ${year !== undefined ? sql`a->>'year' IN (${sql.join(yearValues.map(value => sql`${String(value)}`), sql`, `)})` : sql`TRUE`}
              AND ${input.department ? sql`(a->>'departmentKo' = ${input.department} OR a->>'departmentEn' = ${input.department})` : sql`TRUE`})`,
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
    return this.db.transaction(async tx => {
    await tx.execute(sql`LOCK TABLE ${executiveContacts} IN SHARE ROW EXCLUSIVE MODE`);
    if (dto.studentNumber?.trim()) {
      const [duplicate] = await tx.select({id: executiveContacts.id}).from(executiveContacts)
        .where(sql`btrim(${executiveContacts.studentNumber}) = ${dto.studentNumber.trim()}`).limit(1);
      if (duplicate) throw new ConflictException("contact_student_number_exists");
    }
    const [sortOrderRow] = await tx
      .select({ maxSortOrder: sql<number | null>`max(${executiveContacts.sortOrder})` })
      .from(executiveContacts);
    const nextSortOrder = Number(sortOrderRow?.maxSortOrder ?? -1) + 1;
    const [row] = await tx
      .insert(executiveContacts)
      .values({
        portalUserId: dto.portalUserId ?? null,
        activities: dto.activities ?? [],
        nameKo: dto.nameKo,
        nameEn: dto.nameEn,
        departmentKo: dto.departmentKo ?? null,
        departmentEn: dto.departmentEn ?? null,
        roleKo: dto.roleKo,
        roleEn: dto.roleEn,
        studentNumber: dto.studentNumber?.trim() || null,
        cohort: dto.cohort ?? null,
        email: dto.email ?? null,
        phoneNumber: dto.phoneNumber ?? null,
        privacyConsented: dto.privacyConsented ?? true,
        publiclyListed: false,
        sortOrder: dto.sortOrder ?? nextSortOrder,
        updatedAt: nowDate(),
      })
      .returning();
    return this.map(row);
    });
  }

  async bulkImport(
    dto: BulkImportContactsRequest,
  ): Promise<BulkImportContactsResponse> {
    const numbers = dto.items.map(item => item.studentNumber?.trim());
    if (numbers.some(number => !number || !/^\d{8}$/.test(number)) || new Set(numbers).size !== numbers.length) {
      throw new BadRequestException("contact_import_student_numbers_invalid");
    }
    return this.db.transaction(async (tx) => {
      // The legacy directory has no unique student-number constraint. Serialize
      // imports against every contact writer, including inserts for new people.
      // Reads stay available; no migration deletes or rewrites the directory.
      await tx.execute(sql`LOCK TABLE ${executiveContacts} IN SHARE ROW EXCLUSIVE MODE`);
      const [order] = await tx.select({ max: sql<number | null>`max(${executiveContacts.sortOrder})` }).from(executiveContacts);
      let nextOrder = Number(order?.max ?? -10) + 10;
      let createdCount = 0;
      const rows: Array<typeof executiveContacts.$inferSelect> = [];
      const year = (value: number) => value < 100 ? 2000 + value : value;
      const currentYear = msToTimeObj(nowMs()).year;
      const history = (row: typeof executiveContacts.$inferSelect): ContactActivity[] => row.activities.length
        ? row.activities.map(activity => ({ ...activity, year: year(activity.year) }))
        : row.cohort ? [{ year: year(row.cohort), departmentKo: row.departmentKo ?? "", departmentEn: row.departmentEn ?? "", roleKo: row.roleKo, roleEn: row.roleEn }] : [];

      for (const item of dto.items) {
        const matches = await tx.select().from(executiveContacts)
          .where(sql`btrim(${executiveContacts.studentNumber}) = ${item.studentNumber}`)
          .orderBy(asc(executiveContacts.createdAt), asc(executiveContacts.id));
        if (new Set(matches.flatMap(row => row.portalUserId ? [row.portalUserId] : [])).size > 1) {
          throw new ConflictException("contact_portal_account_conflict");
        }
        const existing = matches.find(row => row.portalUserId) ?? matches[0];
        const previous = existing ? [existing, ...matches.filter(row => row.id !== existing.id)] : [];
        const text = (field: "nameEn" | "departmentKo" | "departmentEn" | "roleEn" | "email" | "phoneNumber" | "avatarStorageKey") =>
          previous.find(row => row[field]?.trim())?.[field] ?? "";
        const departmentKo = item.departmentKo?.trim() || text("departmentKo");
        const departmentEn = item.departmentEn?.trim() || (departmentKo === existing?.departmentKo ? text("departmentEn") : "");
        const roleEn = item.roleEn?.trim() || (item.roleKo === existing?.roleKo ? text("roleEn") : "");
        const oldActivities = previous.flatMap(history);
        const explicitActivities = Boolean(item.activities?.length);
        let sourceActivities: ContactActivity[] = item.activities?.length ? item.activities : [{
          year: currentYear, departmentKo: item.departmentKo ?? "", departmentEn: item.departmentEn ?? "", roleKo: item.roleKo, roleEn: item.roleEn,
        }];
        const currentActivities = oldActivities.filter(activity => activity.year === currentYear);
        if (!explicitActivities && currentActivities.length > 1) {
          if (!currentActivities.some(activity => activity.roleKo === item.roleKo && activity.departmentKo === departmentKo)) {
            throw new ConflictException("contact_import_activities_ambiguous");
          }
          // A legacy six-column sheet cannot describe all concurrent positions.
          sourceActivities = currentActivities;
        }
        const incoming = sourceActivities.map(activity => {
          const normalizedYear = year(activity.year);
          const old = oldActivities.find(entry => entry.year === normalizedYear && entry.departmentKo === activity.departmentKo && entry.roleKo === activity.roleKo)
            ?? oldActivities.find(entry => entry.year === normalizedYear && entry.departmentKo === activity.departmentKo)
            ?? oldActivities.find(entry => entry.year === normalizedYear);
          const department = explicitActivities ? activity.departmentKo : activity.departmentKo || old?.departmentKo || departmentKo;
          return {
            ...activity, year: normalizedYear, departmentKo: department,
            departmentId: activity.departmentId ?? (department === old?.departmentKo ? old?.departmentId : undefined),
            departmentEn: activity.departmentEn || (department === old?.departmentKo ? old?.departmentEn ?? "" : department === departmentKo ? departmentEn : ""),
            roleEn: activity.roleEn || (activity.roleKo === old?.roleKo ? old?.roleEn ?? "" : ""),
          };
        });
        const replacedYears = new Set(incoming.map(activity => activity.year));
        for (const importedYear of replacedYears) {
          const previousCount = new Set(oldActivities.filter(activity => activity.year === importedYear).map(activity => JSON.stringify([activity.departmentKo, activity.roleKo]))).size;
          const incomingCount = new Set(incoming.filter(activity => activity.year === importedYear).map(activity => JSON.stringify([activity.departmentKo, activity.roleKo]))).size;
          if (previousCount > 1 && incomingCount < previousCount) throw new ConflictException("contact_import_activities_ambiguous");
        }
        const activities = new Map<string, ContactActivity>();
        for (const activity of [...oldActivities.filter(entry => !replacedYears.has(entry.year)), ...incoming]) {
          const key = JSON.stringify([activity.year, activity.departmentKo, activity.roleKo]);
          if (!activities.has(key)) activities.set(key, activity);
        }
        const mergedActivities = [...activities.values()];
        let latest = mergedActivities.reduce<ContactActivity | undefined>((best, activity) =>
          !best || activity.year >= best.year ? activity : best, undefined);
        if (latest) {
          const latestYear = latest.year;
          latest = mergedActivities.find(activity => activity.year === latestYear && activity.departmentKo === existing?.departmentKo && activity.roleKo === existing?.roleKo) ?? latest;
        }
        const values = {
          activities: mergedActivities, nameKo: item.nameKo, nameEn: item.nameEn || text("nameEn"),
          departmentKo: (latest?.departmentKo ?? departmentKo) || null, departmentEn: (latest?.departmentEn ?? departmentEn) || null,
          roleKo: latest?.roleKo ?? item.roleKo, roleEn: latest?.roleEn ?? roleEn, studentNumber: item.studentNumber,
          cohort: latest?.year ?? existing?.cohort ?? null,
          email: item.email?.trim() || text("email") || null,
          phoneNumber: item.phoneNumber?.trim() || text("phoneNumber") || null,
          updatedAt: nowDate(),
        };
        if (existing) {
          const [updated] = await tx.update(executiveContacts).set({
            ...values, avatarStorageKey: text("avatarStorageKey") || null,
            privacyConsented: previous.every(row => row.privacyConsented),
          }).where(eq(executiveContacts.id, existing.id)).returning();
          const duplicates = matches.filter(row => row.id !== existing.id).map(row => row.id);
          if (duplicates.length) await tx.delete(executiveContacts).where(inArray(executiveContacts.id, duplicates));
          rows.push(updated);
        } else {
          const [created] = await tx.insert(executiveContacts).values({
            ...values, portalUserId: item.portalUserId ?? null,
            privacyConsented: item.privacyConsented, publiclyListed: false,
            sortOrder: item.sortOrder ?? nextOrder,
          }).returning();
          nextOrder += 10;
          createdCount++;
          rows.push(created);
        }
      }
      return {
        importedCount: rows.length,
        createdCount,
        updatedCount: rows.length - createdCount,
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
      return this.db.transaction(async tx => {
        const [deleted] = await tx.delete(executiveContacts).where(eq(executiveContacts.id, id)).returning();
        if (!deleted) return null;
        await enqueueSpreadsheetSync(tx, "CONTACTS");
        return { ...this.map(deleted), privacyConsented: false };
      });
    }
    const set: Partial<typeof executiveContacts.$inferInsert> = {
      updatedAt: nowDate(),
    };

    if (dto.portalUserId !== undefined) set.portalUserId = dto.portalUserId;
    if (dto.activities !== undefined) set.activities = dto.activities;
    if (dto.nameKo !== undefined) set.nameKo = dto.nameKo;
    if (dto.nameEn !== undefined) set.nameEn = dto.nameEn;
    if (dto.departmentKo !== undefined) set.departmentKo = dto.departmentKo;
    if (dto.departmentEn !== undefined) set.departmentEn = dto.departmentEn;
    if (dto.roleKo !== undefined) set.roleKo = dto.roleKo;
    if (dto.roleEn !== undefined) set.roleEn = dto.roleEn;
    if (dto.studentNumber !== undefined) set.studentNumber = dto.studentNumber?.trim() || null;
    if (dto.cohort !== undefined) set.cohort = dto.cohort;
    if (dto.email !== undefined) set.email = dto.email;
    if (dto.phoneNumber !== undefined) set.phoneNumber = dto.phoneNumber;
    if (dto.privacyConsented !== undefined) set.privacyConsented = dto.privacyConsented;
    if (dto.sortOrder !== undefined) set.sortOrder = dto.sortOrder;

    const persist = async (executor: Pick<PostgresDatabase, "update">) => {
    const [row] = await executor.update(executiveContacts)
      .set(set)
      .where(eq(executiveContacts.id, id))
      .returning();
    return row ? this.map(row) : null;
    };
    if (dto.studentNumber === undefined) return persist(this.db);
    return this.db.transaction(async tx => {
      await tx.execute(sql`LOCK TABLE ${executiveContacts} IN SHARE ROW EXCLUSIVE MODE`);
      if (dto.studentNumber?.trim()) {
        const [duplicate] = await tx.select({id: executiveContacts.id}).from(executiveContacts)
          .where(and(sql`btrim(${executiveContacts.studentNumber}) = ${dto.studentNumber.trim()}`, ne(executiveContacts.id, id))).limit(1);
        if (duplicate) throw new ConflictException("contact_student_number_exists");
      }
      return persist(tx);
    });
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
