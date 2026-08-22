const assert = require("node:assert/strict");
const test = require("node:test");
const { Module } = require("@nestjs/common");
const { NestFactory } = require("@nestjs/core");
const cookieParser = require("cookie-parser");

const {
  AssetController,
} = require("../dist/apps/api/src/features/asset/asset.controller.js");
const {
  AssetService,
} = require("../dist/apps/api/src/features/asset/asset.service.js");
const {
  AuthSessionService,
} = require("../dist/apps/api/src/features/auth/auth-session.service.js");
const {
  AuthSessionRepository,
} = require("../dist/apps/api/src/features/auth/auth-session.repository.js");
const {
  AUTH_SESSION_COOKIE_NAME,
} = require("../dist/apps/api/src/features/auth/auth.tokens.js");
const {
  UsersService,
} = require("../dist/apps/api/src/features/users/users.service.js");
const {
  AuthEligibilityService,
} = require("../dist/apps/api/src/features/auth/auth-eligibility.service.js");

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

const createUploadForm = (size, type = "text/plain") => {
  const form = new FormData();
  form.append("file", new Blob([Buffer.alloc(size)], { type }), "fixture.txt");
  return form;
};

const startUploadServer = async () => {
  const uploadedFiles = [];
  const assetService = {
    cleanupUnlinkedAssets: async () => ({
      scanned: 0,
      deleted: 0,
      failed: 0,
      olderThanHours: 24,
    }),
    getFile: async () => {
      throw new Error("not used by upload tests");
    },
    uploadFile: async ({ file, userId }) => {
      uploadedFiles.push({
        size: file.size,
        type: file.mimetype,
        userId,
      });
      return {
        assetId: "1",
        originalFilename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey: "asset:1",
      };
    },
  };
  const authSessionService = {
    getOptionalCurrentUser: async () => ({ authenticated: false }),
  };
  const authSessionRepository = {
    findBySessionId: async () => ({
      expiresAt: new Date(Date.now() + 60_000),
      mode: "persisted",
      revoked: false,
      userId: "upload-test-user",
    }),
    revoke: async () => undefined,
  };
  const usersService = {
    findById: async () => ({
      userId: "upload-test-user",
      isActive: true,
      departmentKo: "전산학부",
      departmentEn: "School of Computing",
    }),
    resolvePermissionBitmaskByUserId: async () => 0,
  };

  class UploadTestModule {}
  Module({
    controllers: [AssetController],
    providers: [
      { provide: AssetService, useValue: assetService },
      { provide: AuthSessionService, useValue: authSessionService },
      {
        provide: AuthSessionRepository,
        useValue: authSessionRepository,
      },
      { provide: UsersService, useValue: usersService },
      {
        provide: AuthEligibilityService,
        useValue: { isEligibleUser: () => true },
      },
    ],
  })(UploadTestModule);

  const app = await NestFactory.create(UploadTestModule, {
    abortOnError: false,
    logger: ["error"],
  });
  app.use(cookieParser());
  app.setGlobalPrefix("v1");
  await app.listen(0, "127.0.0.1");

  const address = app.getHttpServer().address();
  assert.ok(address && typeof address !== "string");

  return {
    app,
    uploadedFiles,
    uploadUrl: `http://127.0.0.1:${address.port}/v1/assets/upload`,
  };
};

test("the Nest upload endpoint accepts the exact 20 MiB file boundary", async (t) => {
  const fixture = await startUploadServer();
  t.after(() => fixture.app.close());

  const response = await fetch(fixture.uploadUrl, {
    method: "POST",
    body: createUploadForm(MAX_FILE_SIZE_BYTES),
    headers: { Cookie: `${AUTH_SESSION_COOKIE_NAME}=upload-test-session` },
  });

  assert.equal(response.status, 201);
  assert.equal(fixture.uploadedFiles.length, 1);
  assert.deepEqual(fixture.uploadedFiles[0], {
    size: MAX_FILE_SIZE_BYTES,
    type: "text/plain",
    userId: "upload-test-user",
  });
});

test("the Nest upload endpoint rejects a file above 20 MiB before storage", async (t) => {
  const fixture = await startUploadServer();
  t.after(() => fixture.app.close());

  const response = await fetch(fixture.uploadUrl, {
    method: "POST",
    body: createUploadForm(MAX_FILE_SIZE_BYTES + 1),
    headers: { Cookie: `${AUTH_SESSION_COOKIE_NAME}=upload-test-session` },
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.deepEqual(body, {
    message: "File too large",
    error: "Payload Too Large",
    statusCode: 413,
  });
  assert.equal(fixture.uploadedFiles.length, 0);
});

test("the Nest upload endpoint keeps the allowed MIME-type contract", async (t) => {
  const fixture = await startUploadServer();
  t.after(() => fixture.app.close());

  const response = await fetch(fixture.uploadUrl, {
    method: "POST",
    body: createUploadForm(1, "text/html"),
    headers: { Cookie: `${AUTH_SESSION_COOKIE_NAME}=upload-test-session` },
  });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.message, "unsupported_asset_mime_type");
  assert.equal(fixture.uploadedFiles.length, 0);
});
