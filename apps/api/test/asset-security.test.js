const assert = require("node:assert/strict");
const test = require("node:test");
const { NotFoundException } = require("@nestjs/common");

const {
  buildAssetResponseHeaders,
} = require("../dist/apps/api/src/features/asset/asset-response.js");
const {
  AssetService,
} = require("../dist/apps/api/src/features/asset/asset.service.js");

const publicBoard = {
  boardId: 1,
  code: "notice",
  isActive: true,
  managePermissionBit: 0,
  readScope: "PUBLIC",
};

const createService = ({ asset, articleReadable = true } = {}) => {
  let storageReads = 0;
  const assetRepository = {
    findAssetWithLinks: async () => asset ?? null,
  };
  const configService = { get: (_key, fallback) => fallback };
  const storage = {
    delete: async () => {},
    read: async () => {
      storageReads += 1;
      return Buffer.from("file-content");
    },
    upload: async () => "/uploads/assets/file",
  };
  const boardRepository = {
    findByCode: async () => publicBoard,
  };
  const articleRepository = {
    isReadableArticle: async () => articleReadable,
  };

  return {
    getStorageReads: () => storageReads,
    service: new AssetService(
      assetRepository,
      configService,
      storage,
      boardRepository,
      articleRepository,
    ),
  };
};

test("an anonymous caller can read an asset only through a readable public article", async () => {
  const { service } = createService({
    asset: {
      assetId: "1",
      links: [
        { articleId: "10", boardCode: "notice", usageType: "IMAGE" },
      ],
      mimeType: "image/png",
      originalFilename: "poster.png",
      sizeBytes: 12,
      storageKey: "/uploads/assets/poster.png",
      uploadedBy: "owner-1",
    },
  });

  const file = await service.getFile("1", { authenticated: false });
  assert.equal(file.inline, true);
  assert.equal(file.buffer.toString(), "file-content");
});

test("an unreadable article asset is hidden and storage is never opened", async () => {
  const { getStorageReads, service } = createService({
    articleReadable: false,
    asset: {
      assetId: "1",
      links: [
        { articleId: "10", boardCode: "notice", usageType: "ATTACHMENT" },
      ],
      mimeType: "text/plain",
      originalFilename: "private.txt",
      sizeBytes: 12,
      storageKey: "/uploads/assets/private.txt",
      uploadedBy: "owner-1",
    },
  });

  await assert.rejects(
    () => service.getFile("1", { authenticated: false }),
    NotFoundException,
  );
  assert.equal(getStorageReads(), 0);
});

test("an unlinked upload is visible only to its uploader", async () => {
  const fixture = {
    assetId: "1",
    links: [],
    mimeType: "image/jpeg",
    originalFilename: "preview.jpg",
    sizeBytes: 12,
    storageKey: "/uploads/assets/preview.jpg",
    uploadedBy: "owner-1",
  };
  const ownerService = createService({ asset: fixture }).service;
  const strangerService = createService({ asset: fixture }).service;

  await assert.doesNotReject(() =>
    ownerService.getFile("1", {
      authenticated: true,
      user: { id: "owner-1", permission: 0 },
    }),
  );
  await assert.rejects(
    () =>
      strangerService.getFile("1", {
        authenticated: true,
        user: { id: "other-1", permission: 0 },
      }),
    NotFoundException,
  );
});

test("active or mislabeled documents are forced to download with nosniff", () => {
  const headers = buildAssetResponseHeaders({
    inline: true,
    mimeType: "text/plain",
    originalFilename: 'payload".html',
  });

  assert.equal(headers["Content-Type"], "application/octet-stream");
  assert.match(headers["Content-Disposition"], /^attachment;/);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["Content-Security-Policy"], "sandbox; default-src 'none'");
  assert.doesNotMatch(headers["Content-Disposition"], /filename="payload"\.html"/);
});

test("inline SVG is sandboxed even when used as a trusted seeded image", () => {
  const headers = buildAssetResponseHeaders({
    inline: true,
    mimeType: "image/svg+xml",
    originalFilename: "poster.svg",
  });

  assert.equal(headers["Content-Type"], "image/svg+xml");
  assert.match(headers["Content-Disposition"], /^inline;/);
  assert.equal(headers["Content-Security-Policy"], "sandbox; default-src 'none'");
});
