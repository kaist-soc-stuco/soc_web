export const APP_TITLE = "SoC Web Platform";

export * from './time';
import { formatKorean } from './time';

export const formatKoreanDateTime = (isoString: string): string =>
  formatKorean(isoString);

export const hasPermission = (
  userPermission: number,
  requiredBit: number,
): boolean => {
  if (requiredBit === 0) {
    return true;
  }

  return (userPermission & requiredBit) === requiredBit;
};