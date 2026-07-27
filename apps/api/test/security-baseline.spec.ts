import {
  ACTOR_PII_PROJECTION_POLICY,
  AUTH_COOKIE_POLICY,
  COMPATIBILITY_BACKFILL_POLICY,
  ERROR_ENVELOPE_POLICY,
  JOSE_ES256_POLICY,
  ORIGIN_POLICY,
  RELEASE_MANIFEST,
  RELEASE_MANIFEST_SLICE_COUNTS,
  RELEASE_MANIFEST_TOTAL_OPERATIONS,
  assertReleaseManifest,
  type ReleaseManifestRow,
} from '@soc/contracts';
import { describe, expect, it } from 'vitest';

describe('Phase 0A security baseline contracts', () => {
  it('keeps authentication cookies host-only, HTTP-only, and scoped by purpose', () => {
    expect(AUTH_COOKIE_POLICY.attributes).toMatchObject({
      hostOnly: true,
      httpOnly: true,
      sameSite: 'lax',
      domain: 'absent',
    });
    expect(AUTH_COOKIE_POLICY.access).toMatchObject({ name: 'soc_at', path: '/api', maxAgeSeconds: 900 });
    expect(AUTH_COOKIE_POLICY.refresh).toMatchObject({ name: 'soc_rt', path: '/api/auth', maxAgeSeconds: 604800 });
    expect(AUTH_COOKIE_POLICY.attributes.secure).toEqual({ production: true, development: false });
  });

  it('requires strict ES256 verification and rejects unsafe token headers', () => {
    expect(JOSE_ES256_POLICY.algorithm).toBe('ES256');
    expect(JOSE_ES256_POLICY.protectedHeader).toMatchObject({
      exactAllowlist: ['alg', 'kid'],
      required: ['alg', 'kid'],
      unknown: 'rejected',
      critical: 'rejected',
      remoteKeyReferences: 'rejected',
    });
    expect(JOSE_ES256_POLICY.payloadKid).toBe('forbidden');
    expect(JOSE_ES256_POLICY.refresh.jti).toBe('rotating');
  });

  it('requires an exact origin for unsafe API requests except the login callback', () => {
    expect(ORIGIN_POLICY.unsafeApiRequests).toMatchObject({
      pathPattern: '/api/**',
      methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
      excludedRequest: { method: 'POST', path: '/api/auth/login' },
      origin: 'required_exact_configured_public_origin',
      missingOrMismatch: { status: 403, code: 'origin_required_or_mismatch' },
    });
  });

  it('preserves canonical error, PII, and additive migration fail-closed policies', () => {
    expect(ERROR_ENVELOPE_POLICY.fields).toEqual(['code', 'message', 'requestId']);
    expect(ERROR_ENVELOPE_POLICY.featureDisabled).toEqual({
      status: 503,
      code: 'feature_disabled',
      sideEffects: 'forbidden',
    });
    expect(ACTOR_PII_PROJECTION_POLICY.pii.browserStorage).toBe('forbidden');
    expect(ACTOR_PII_PROJECTION_POLICY.audit.prohibitedFields).toContain('plaintext');
    expect(COMPATIBILITY_BACKFILL_POLICY.migration).toEqual({
      direction: 'additive_forward_only',
      readiness: 'migrate_only',
      validation: 'journal_and_checksum_startup_and_deploy_fail_closed',
    });
  });
});

describe('release manifest validation', () => {
  it('accepts the complete canonical manifest', () => {
    expect(RELEASE_MANIFEST).toHaveLength(RELEASE_MANIFEST_TOTAL_OPERATIONS);
    expect(() => assertReleaseManifest()).not.toThrow();
  });

  it('rejects duplicate operation IDs', () => {
    const manifest: ReleaseManifestRow[] = RELEASE_MANIFEST.map((row) => ({ ...row }));
    manifest[1] = { ...manifest[1], id: manifest[0].id };

    expect(() => assertReleaseManifest(manifest)).toThrow('Release manifest operation ID is duplicated: AUTH-START.');
  });

  it('rejects incorrect slice counts', () => {
    const manifest: ReleaseManifestRow[] = RELEASE_MANIFEST.map((row) => ({ ...row }));
    manifest[0] = { ...manifest[0], slice: 'assets' };

    expect(() => assertReleaseManifest(manifest, RELEASE_MANIFEST_SLICE_COUNTS)).toThrow(
      'Release manifest slice auth_health must contain 8 operations; received 7.',
    );
  });
});
