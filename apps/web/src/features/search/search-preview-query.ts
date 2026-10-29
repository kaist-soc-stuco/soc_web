/** Do not search a partially composed Hangul syllable or a one-character query. */
export function canPreviewSearch(query: string, composing = false): boolean {
  const value = query.trim();
  return (
    !composing &&
    [...value.replace(/\s/gu, "")].length >= 2 &&
    !/[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/u.test(value)
  );
}
