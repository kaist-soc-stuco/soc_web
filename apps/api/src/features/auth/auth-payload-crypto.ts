import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
} from "node:crypto";

const ENVELOPE_VERSION = 1;
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

interface EncryptedJsonEnvelope {
  version: typeof ENVELOPE_VERSION;
  iv: string;
  authTag: string;
  ciphertext: string;
}

const isEncryptedJsonEnvelope = (
  value: unknown,
): value is EncryptedJsonEnvelope => {
  if (!value || typeof value !== "object") return false;
  const envelope = value as Partial<EncryptedJsonEnvelope>;
  return (
    envelope.version === ENVELOPE_VERSION &&
    typeof envelope.iv === "string" &&
    typeof envelope.authTag === "string" &&
    typeof envelope.ciphertext === "string"
  );
};

/** Versioned AES-GCM envelope with a purpose-separated key. */
export class AuthPayloadCipher {
  private readonly key: Buffer;
  private readonly additionalData: Buffer;

  constructor(secret: string, purpose: string) {
    this.additionalData = Buffer.from(
      `soc-web:${purpose}:v${ENVELOPE_VERSION}`,
      "utf8",
    );
    this.key = createHmac("sha256", secret)
      .update(this.additionalData)
      .digest();
  }

  encrypt(value: unknown): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(this.additionalData);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);

    return JSON.stringify({
      version: ENVELOPE_VERSION,
      iv: iv.toString("base64url"),
      authTag: cipher.getAuthTag().toString("base64url"),
      ciphertext: ciphertext.toString("base64url"),
    } satisfies EncryptedJsonEnvelope);
  }

  decrypt(rawValue: string): unknown | null {
    try {
      const envelope: unknown = JSON.parse(rawValue);
      if (!isEncryptedJsonEnvelope(envelope)) return null;

      const iv = Buffer.from(envelope.iv, "base64url");
      const authTag = Buffer.from(envelope.authTag, "base64url");
      const ciphertext = Buffer.from(envelope.ciphertext, "base64url");
      if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) {
        return null;
      }

      const decipher = createDecipheriv("aes-256-gcm", this.key, iv);
      decipher.setAAD(this.additionalData);
      decipher.setAuthTag(authTag);
      const plaintext = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString("utf8");

      return JSON.parse(plaintext) as unknown;
    } catch {
      return null;
    }
  }
}
