export const APP_TITLE = 'SoC Web Platform';

export * from './time';

import { formatKorean } from './time';
export const formatKoreanDateTime = (isoString: string): string =>
  formatKorean(isoString);
