const E164_PHONE = /^\+[1-9]\d{7,14}$/;

/** Normalizes presentation-only phone punctuation without accepting a national-format number. */
export function normalizeE164Phone(input: string): string | null {
  const normalized = input.trim().replace(/[\s()-]/g, '');
  return E164_PHONE.test(normalized) ? normalized : null;
}

export function isE164Phone(input: string): boolean {
  return E164_PHONE.test(input);
}
