const assert = require("node:assert/strict");
const test = require("node:test");
const { Module } = require("@nestjs/common");
const { ConfigModule } = require("@nestjs/config");
const { NestFactory } = require("@nestjs/core");
const { GoogleModule } = require("../dist/apps/api/src/infrastructure/google/google.module.js");
const { UsersHttpModule } = require("../dist/apps/api/src/features/users/users-http.module.js");
const { UsersController } = require("../dist/apps/api/src/features/users/users.controller.js");
const { RetentionModule } = require("../dist/apps/api/src/features/privacy-retention/retention.module.js");
const { RetentionController } = require("../dist/apps/api/src/features/privacy-retention/retention.controller.js");

test("retention controllers and auth guards resolve in the real Nest module graph", async () => {
  class TestModule {}
  Module({ imports: [
    ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [() => ({
      POSTGRES_HOST: "127.0.0.1", POSTGRES_PORT: 1, POSTGRES_DB: "unused",
      POSTGRES_USER: "unused", POSTGRES_PASSWORD: "unused",
      SSO_CLIENT_ID: "synthetic", SSO_CLIENT_SECRET: "synthetic",
      SSO_LOGIN_URL: "https://sso.example.test/login",
      SSO_REDIRECT_URI: "https://example.test/login",
      SSO_AUTH_API_URL: "https://sso.example.test/auth",
      AUTH_PENDING_LOGIN_ENCRYPTION_KEY: "ab".repeat(32),
    })] }),
    GoogleModule, RetentionModule, UsersHttpModule,
  ] })(TestModule);
  // Resolve real controller/guard dependencies without running startup hooks,
  // opening a port, or reading/writing a database or external service.
  const app = await NestFactory.create(TestModule, { logger: false, abortOnError: false });
  try {
    assert.ok(app.get(RetentionController) instanceof RetentionController);
    assert.ok(app.get(UsersController) instanceof UsersController);
  } finally {
    await app.close();
  }
});
