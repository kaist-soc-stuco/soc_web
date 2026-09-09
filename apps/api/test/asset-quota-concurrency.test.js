const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const { eq } = require("drizzle-orm");
const { drizzle } = require("drizzle-orm/node-postgres");
const { Pool } = require("pg");

const { AssetRepository } = require("../dist/apps/api/src/features/asset/repositories/asset.repository.js");
const schema = require("../dist/apps/api/src/infrastructure/postgres/postgres.schema.js");

const databaseUrl = process.env.ASSET_QUOTA_TEST_DATABASE_URL;
if (process.env.CI && !databaseUrl) {
  throw new Error("ASSET_QUOTA_TEST_DATABASE_URL_is_required_in_CI");
}
const integrationOptions = { skip: !databaseUrl };

const USER_ID = "30000000-0000-4000-8000-000000000011";

let pool;
let db;
let repository;

before(async () => {
  if (!databaseUrl) return;
  pool = new Pool({ connectionString: databaseUrl, max: 8 });
  db = drizzle(pool, { schema });
  repository = new AssetRepository(db);
});

beforeEach(async () => {
  if (!db) return;
  await db.delete(schema.contentBlocks).where(eq(schema.contentBlocks.createdBy, USER_ID));
  await db.delete(schema.assetUploadReservations).where(eq(schema.assetUploadReservations.uploadedBy, USER_ID));
  await db.delete(schema.assets).where(eq(schema.assets.uploadedBy, USER_ID));
  await db.delete(schema.users).where(eq(schema.users.userId, USER_ID));

  await db.insert(schema.users).values({
    userId: USER_ID,
    kaistUid: "asset-quota-test-1",
    stdNo: "20260011",
    nameKo: "합성 업로드 사용자",
    email: "asset-quota@example.test",
    primaryMajor: "School of Computing",
    academicStatus: "ENROLLED",
    isActive: true,
  });

  await db.insert(schema.assets).values(
    Array.from({ length: 99 }, (_, index) => ({
      storageKey: `synthetic://asset-quota/${index}`,
      originalFilename: `fixture-${index}.txt`,
      mimeType: "text/plain",
      sizeBytes: 1,
      uploadStatus: "COMPLETED",
      uploadExpiresAt: null,
      uploadedBy: USER_ID,
    })),
  );
});

after(async () => {
  await pool?.end();
});

const reservationInput = () => ({
  uploadedBy: USER_ID,
  sizeBytes: 1,
  maxCount: 100,
  maxBytes: 512,
  expiresAt: new Date(Date.now() + 60_000),
});

test(
  "parallel upload reservations consume one remaining slot exactly once",
  integrationOptions,
  async () => {
    const results = await Promise.allSettled([
      repository.reserveAssetUpload(reservationInput()),
      repository.reserveAssetUpload(reservationInput()),
      repository.reserveAssetUpload(reservationInput()),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(results.filter((result) => result.status === "rejected").length, 2);
    for (const result of results) {
      if (result.status === "rejected") {
        assert.equal(result.reason.message, "asset_quota_exceeded");
      }
    }

    const reservations = await db
      .select()
      .from(schema.assetUploadReservations)
      .where(eq(schema.assetUploadReservations.uploadedBy, USER_ID));
    assert.equal(reservations.length, 1);

    await repository.releaseAssetUploadReservation(reservations[0].reservationId, USER_ID);
    const replacement = await repository.reserveAssetUpload(reservationInput());
    assert.ok(replacement);
  },
);

test(
  "expired reservations are reclaimed and a committed reservation is consumed once",
  integrationOptions,
  async () => {
    const expiredId = await repository.reserveAssetUpload({
      ...reservationInput(),
      expiresAt: new Date(Date.now() - 1_000),
    });
    assert.ok(expiredId);
    assert.equal(await repository.releaseExpiredAssetUploadReservations(), 1);

    const reservationId = await repository.reserveAssetUpload(reservationInput());
    const created = await repository.createAssetFromReservation({
      reservationId,
      storageKey: "synthetic://asset-quota/committed",
      originalFilename: "committed.txt",
      mimeType: "text/plain",
      sizeBytes: 1,
      uploadedBy: USER_ID,
    });
    assert.ok(created.assetId);

    await assert.rejects(
      repository.createAssetFromReservation({
        reservationId,
        storageKey: "synthetic://asset-quota/replay",
        originalFilename: "replay.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        uploadedBy: USER_ID,
      }),
      /asset_upload_reservation_invalid/,
    );

    const remainingReservations = await db
      .select()
      .from(schema.assetUploadReservations)
      .where(eq(schema.assetUploadReservations.uploadedBy, USER_ID));
    assert.equal(remainingReservations.length, 0);
  },
);

test(
  "cleanup cannot delete an asset while a reference writer holds the asset fence",
  integrationOptions,
  async () => {
    const { assetId } = await repository.createAsset({
      storageKey: "synthetic://asset-quota/race",
      originalFilename: "race.txt",
      mimeType: "text/plain",
      sizeBytes: 1,
      uploadedBy: USER_ID,
    });
    const client = await pool.connect();
    let committedReference = false;
    try {
      await client.query("BEGIN");
      await client.query(
        "SELECT asset_id FROM asset WHERE asset_id = $1 FOR UPDATE",
        [assetId],
      );

      const cleanupPromise = repository.deleteUnlinkedAsset(assetId);
      const deadline = Date.now() + 5_000;
      let waiting = false;
      while (Date.now() < deadline) {
        const lockState = await client.query(
          `SELECT count(*)::int AS count
           FROM pg_stat_activity
           WHERE wait_event_type = 'Lock'
             AND query ILIKE '%for update%'`,
        );
        if (lockState.rows[0].count > 0) {
          waiting = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(waiting, true, "cleanup should wait on the reference-writer fence");

      await client.query(
        `INSERT INTO content_block
          (type, status, title_ko, title_en, image_url, created_by, updated_by)
         VALUES ('HERO', 'DRAFT', '경합 fixture', 'Race fixture', $1, $2, $2)`,
        [`asset:${assetId}`, USER_ID],
      );
      await client.query("COMMIT");
      committedReference = true;

      assert.equal(await cleanupPromise, null);
      const stillPresent = await db
        .select({ assetId: schema.assets.assetId })
        .from(schema.assets)
        .where(eq(schema.assets.assetId, Number(assetId)));
      assert.equal(stillPresent.length, 1);
    } finally {
      if (!committedReference) await client.query("ROLLBACK");
      client.release();
      await db
        .delete(schema.contentBlocks)
        .where(eq(schema.contentBlocks.createdBy, USER_ID));
      await repository.deleteUnlinkedAsset(assetId);
    }
  },
);
