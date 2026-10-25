import { BadRequestException } from "@nestjs/common";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { PostgresTransaction } from "../../infrastructure/postgres/postgres.provider";
import { assets } from "../../infrastructure/postgres/postgres.schema";

/** Reference writers and orphan cleanup lock assets before reading or changing references. */
export async function lockAssetReferences(tx: PostgresTransaction, assetIds: string[], ownerUserId?: string): Promise<void> {
  const ids = [...new Set(assetIds.map(Number))];
  if (ids.some(id => !Number.isInteger(id) || id < 1 || id > 2_147_483_647)) {
    throw new BadRequestException("asset_reference_unavailable");
  }
  if (!ids.length) return;
  const rows = await tx.select({ assetId: assets.assetId }).from(assets)
    .where(and(inArray(assets.assetId, ids), eq(assets.uploadStatus, "COMPLETED"),
      ownerUserId ? eq(assets.uploadedBy, ownerUserId) : undefined))
    .orderBy(asc(assets.assetId)).for("update");
  if (rows.length !== ids.length) throw new BadRequestException("asset_reference_unavailable");
}
