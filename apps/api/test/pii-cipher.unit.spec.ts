import { describe, expect, it } from 'vitest';

import { PiiCipherService } from '../src/shared/security/pii-cipher.service';

const keyA = Buffer.alloc(32, 21).toString('base64');
const keyB = Buffer.alloc(32, 22).toString('base64');
const cipher = (activeKid = 'key-a', keys = { 'key-a': keyA, 'key-b': keyB }) => new PiiCipherService({
  get: (name: string) => name === 'PII_ENCRYPTION_ACTIVE_KID' ? activeKid : JSON.stringify(keys),
} as never);

describe('PiiCipherService', () => {
  it('uses deterministic field-bound key-versioned AES-GCM envelopes', () => {
    const service = cipher();
    const first = service.encrypt('users.user_email', 'person@example.test')!;
    const retry = service.encrypt('users.user_email', 'person@example.test')!;
    const otherField = service.encrypt('users.user_mobile', 'person@example.test')!;

    expect(first).toBe(retry);
    expect(first).not.toBe(otherField);
    expect(first).toMatch(/^enc:v1:key-a:/);
    expect(first).not.toContain('person@example.test');
    expect(service.decrypt('users.user_email', first)).toBe('person@example.test');
    expect(() => service.decrypt('users.user_mobile', first)).toThrow('PII ciphertext invalid');
  });

  it('decrypts an older key version after rotation and rejects tampering or plaintext', () => {
    const oldEnvelope = cipher('key-a').encrypt('users.name_en', 'Ada')!;
    const rotated = cipher('key-b');
    expect(rotated.decrypt('users.name_en', oldEnvelope)).toBe('Ada');
    expect(rotated.encryptForLookup('users.name_en', 'Ada')).toContain(oldEnvelope);
    expect(rotated.encrypt('users.name_en', 'Ada')).toMatch(/^enc:v1:key-b:/);

    const tampered = `${oldEnvelope.slice(0, -1)}${oldEnvelope.endsWith('A') ? 'B' : 'A'}`;
    expect(() => rotated.decrypt('users.name_en', tampered)).toThrow('PII ciphertext invalid');
    expect(() => rotated.decrypt('users.name_en', 'Ada')).toThrow('PII ciphertext invalid');
  });

  it('rejects missing, unknown, or non-32-byte keys', () => {
    expect(() => cipher('missing')).toThrow('Invalid PII encryption configuration');
    expect(() => cipher('key-a', { 'key-a': 'short' } as never)).toThrow('Invalid PII encryption configuration');
  });
});
