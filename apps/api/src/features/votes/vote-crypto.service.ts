import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

interface CipherPayload {
  ciphertext: string;
  iv: string;
  authTag: string;
}

@Injectable()
export class VoteCryptoService {
  private readonly masterKey: Buffer;

  constructor(config: ConfigService) {
    const secret =
      config.get<string>("VOTE_BALLOT_ENCRYPTION_KEY") ??
      config.getOrThrow<string>("AUTH_PENDING_LOGIN_ENCRYPTION_KEY");
    this.masterKey = createHash("sha256")
      .update(`soc-web:vote-ballot-key:v1:${secret}`, "utf8")
      .digest();
  }

  generateVoteKey(): Buffer {
    return randomBytes(32);
  }

  wrapVoteKey(key: Buffer): CipherPayload {
    return this.encrypt(key, this.masterKey);
  }

  unwrapVoteKey(payload: CipherPayload): Buffer {
    return this.decrypt(payload, this.masterKey);
  }

  encryptBallot(ballot: unknown, voteKey: Buffer): CipherPayload {
    return this.encrypt(Buffer.from(JSON.stringify(ballot), "utf8"), voteKey);
  }

  decryptBallot(payload: CipherPayload, voteKey: Buffer): unknown {
    return JSON.parse(this.decrypt(payload, voteKey).toString("utf8"));
  }

  createReceipt(): { code: string; hash: string } {
    const code = randomBytes(18).toString("base64url");
    return { code, hash: this.hashReceipt(code) };
  }

  hashReceipt(code: string): string {
    return createHash("sha256").update(code).digest("hex");
  }

  private encrypt(value: Buffer, key: Buffer): CipherPayload {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
    return {
      ciphertext: ciphertext.toString("base64url"),
      iv: iv.toString("base64url"),
      authTag: cipher.getAuthTag().toString("base64url"),
    };
  }

  private decrypt(payload: CipherPayload, key: Buffer): Buffer {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64url")),
      decipher.final(),
    ]);
  }
}
