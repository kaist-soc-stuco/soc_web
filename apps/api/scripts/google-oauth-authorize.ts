import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

interface GoogleOAuthClient {
  client_id: string;
  client_secret: string;
  auth_uri?: string;
  token_uri?: string;
}

interface GoogleOAuthClientFile {
  installed?: GoogleOAuthClient;
  web?: GoogleOAuthClient;
}

interface GoogleOAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

const CLIENT_FILE = resolve(
  process.env.GOOGLE_OAUTH_CLIENT_KEY_FILE ?? "../../secrets/google-oauth-client.json",
);
const TOKEN_FILE = resolve(
  process.env.GOOGLE_OAUTH_TOKEN_FILE ?? "../../secrets/google-oauth-token.json",
);
const PORT = Number.parseInt(process.env.GOOGLE_OAUTH_CALLBACK_PORT ?? "53682", 10);
const REDIRECT_URI = `http://127.0.0.1:${PORT}/oauth/callback`;
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  // The app uses a pre-existing operations folder configured by ID. This
  // metadata-only scope lets Drive validate that folder without granting
  // access to file contents outside the app-created Sheets.
  "https://www.googleapis.com/auth/drive.metadata.readonly",
];

const base64Url = (value: Buffer): string =>
  value
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const waitForAuthorizationCode = async (
  authorizationUrl: string,
  expectedState: string,
): Promise<string> =>
  new Promise((resolveCode, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", REDIRECT_URI);
      if (url.pathname !== "/oauth/callback") {
        response.writeHead(404).end("Not found");
        return;
      }
      const error = url.searchParams.get("error");
      const state = url.searchParams.get("state");
      const code = url.searchParams.get("code");
      if (error || state !== expectedState || !code) {
        response
          .writeHead(400, { "Content-Type": "text/plain; charset=utf-8" })
          .end("Google 인증에 실패했습니다. 이 창을 닫고 터미널을 확인해 주세요.");
        server.close();
        reject(new Error(error ?? "google_oauth_callback_invalid"));
        return;
      }
      response
        .writeHead(200, { "Content-Type": "text/plain; charset=utf-8" })
        .end("Google Drive·Sheets 연결이 완료되었습니다. 이 창을 닫아도 됩니다.");
      server.close();
      resolveCode(code);
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => {
      process.stdout.write(
        [
          "아래 주소를 브라우저에서 열고 Google Drive·Sheets 접근만 승인하세요.",
          authorizationUrl,
          "",
        ].join("\n"),
      );
    });
  });

const main = async (): Promise<void> => {
  const clientDocument = JSON.parse(
    await readFile(CLIENT_FILE, "utf8"),
  ) as GoogleOAuthClientFile;
  const client = clientDocument.installed ?? clientDocument.web;
  if (!client?.client_id || !client.client_secret) {
    throw new Error("google_oauth_client_file_invalid");
  }

  const state = base64Url(randomBytes(24));
  const codeVerifier = base64Url(randomBytes(48));
  const codeChallenge = base64Url(
    createHash("sha256").update(codeVerifier).digest(),
  );
  const authorizationUrl = new URL(
    client.auth_uri ?? "https://accounts.google.com/o/oauth2/v2/auth",
  );
  authorizationUrl.search = new URLSearchParams({
    client_id: client.client_id,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  }).toString();

  const code = await waitForAuthorizationCode(authorizationUrl.toString(), state);
  const response = await fetch(client.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: client.client_id,
      client_secret: client.client_secret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: REDIRECT_URI,
    }),
    signal: AbortSignal.timeout(20_000),
  });
  const token = (await response.json()) as GoogleOAuthTokenResponse;
  if (!response.ok || !token.refresh_token) {
    throw new Error(
      `google_oauth_authorization_failed: ${token.error_description ?? token.error ?? response.status}`,
    );
  }

  await mkdir(dirname(TOKEN_FILE), { recursive: true });
  await writeFile(
    TOKEN_FILE,
    `${JSON.stringify(
      {
        refresh_token: token.refresh_token,
        scope: token.scope,
        token_type: token.token_type,
        issued_at: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
    { encoding: "utf8", mode: 0o600 },
  );
  process.stdout.write(`OAuth 토큰을 저장했습니다: ${TOKEN_FILE}\n`);
};

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
