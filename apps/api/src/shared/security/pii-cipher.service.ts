import {
  createCipheriv,
  createDecipheriv,
  createHmac,
} from "node:crypto";

import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

const ENVELOPE_PREFIX = "enc:v1";
const KID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const MAX_PLAINTEXT_BYTES = 8_192;

@Injectable()
export class PiiCipherService {
  private readonly activeKid: string;
  private readonly keys: Map<string, Buffer>;

  constructor(config: ConfigService) {
    const activeKid = config.get<string>("PII_ENCRYPTION_ACTIVE_KID");
    const keysJson = config.get<string>("PII_ENCRYPTION_KEYS_JSON");
    if (!activeKid || !keysJson || !KID_PATTERN.test(activeKid)) {
      throw new Error("Invalid PII encryption configuration");
    }

    try {
      const parsed = JSON.parse(keysJson) as Record<string, unknown>;
      this.keys = new Map(
        Object.entries(parsed).map(([kid, encoded]) => {
          if (!KID_PATTERN.test(kid) || typeof encoded !== "string") throw new Error();
          const key = Buffer.from(encoded, "base64");
          if (key.length !== 32 || key.toString("base64") !== encoded) throw new Error();
          return [kid, key] as const;
        }),
      );
    } catch {
      throw new Error("Invalid PII encryption configuration");
    }
    if (!this.keys.has(activeKid)) throw new Error("Invalid PII encryption configuration");
    this.activeKid = activeKid;
  }

  encrypt(field: string, value: string | null): string | null {
    return value === null ? null : this.encryptWithKid(this.activeKid, field, value);
  }

  encryptForLookup(field: string, value: string): string[] {
    return [...this.keys.keys()].map((kid) => this.encryptWithKid(kid, field, value));
  }

  decrypt(field: string, envelope: string | null): string | null {
    if (envelope === null) return null;
    try {
      const [prefix, version, kid, nonceValue, tagValue, ciphertextValue, extra] = envelope.split(":");
      if (`${prefix}:${version}` !== ENVELOPE_PREFIX || extra !== undefined || !kid || !KID_PATTERN.test(kid)) throw new Error();
      const rootKey = this.keys.get(kid);
      if (!rootKey) throw new Error();
      const nonce = Buffer.from(nonceValue ?? "", "base64url");
      const tag = Buffer.from(tagValue ?? "", "base64url");
      const ciphertext = Buffer.from(ciphertextValue ?? "", "base64url");
      if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length > MAX_PLAINTEXT_BYTES + 16) throw new Error();
      const decipher = createDecipheriv("aes-256-gcm", this.derive(rootKey, "encryption"), nonce);
      decipher.setAAD(this.aad(kid, field));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      throw new Error("PII ciphertext invalid");
    }
  }
  isValidEnvelope(field: string, value: string): boolean {
    try {
      this.decrypt(field, value);
      return true;
    } catch {
      return false;
    }
  }

  looksLikeEnvelope(value: string): boolean {
    return value.startsWith(`${ENVELOPE_PREFIX}:`);
  }
  private encryptWithKid(kid: string, field: string, value: string): string {
    const plainText = Buffer.from(value, "utf8");
    if (!field || plainText.length > MAX_PLAINTEXT_BYTES) throw new Error("PII value rejected");

    const rootKey = this.keys.get(kid)!;
    const encryptionKey = this.derive(rootKey, "encryption");
    const nonceKey = this.derive(rootKey, "nonce");
    const nonce = createHmac("sha256", nonceKey)
      .update(field, "utf8")
      .update("\0", "utf8")
      .update(plainText)
      .digest()
      .subarray(0, 12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, nonce);
    cipher.setAAD(this.aad(kid, field));
    const ciphertext = Buffer.concat([cipher.update(plainText), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      ENVELOPE_PREFIX,
      kid,
      nonce.toString("base64url"),
      tag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(":");
  }

  private derive(rootKey: Buffer, purpose: "encryption" | "nonce"): Buffer {
    return createHmac("sha256", rootKey).update(`soc-pii-v1:${purpose}`, "utf8").digest();
  }

  private aad(kid: string, field: string): Buffer {
    return Buffer.from(`soc-pii:v1:${kid}:${field}`, "utf8");
  }
}
