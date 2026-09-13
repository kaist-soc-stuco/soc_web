export function meetsVoteQuorum(eligibleCount: number, votedCount: number, percent: number | null | undefined = 50, inclusive = true): boolean {
  const threshold = percent ?? 50;
  if (!Number.isInteger(eligibleCount) || eligibleCount <= 0 || !Number.isInteger(votedCount) || votedCount < 0 || votedCount > eligibleCount || !Number.isFinite(threshold) || threshold < 0 || threshold > 100) return false;
  return inclusive ? votedCount * 100 >= eligibleCount * threshold : votedCount * 100 > eligibleCount * threshold;
}
