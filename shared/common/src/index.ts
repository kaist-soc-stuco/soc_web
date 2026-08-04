export const APP_TITLE = 'SoC Web Platform';

export * from './time';
export * from './survey-phone';

import { formatKorean } from './time';
export const formatKoreanDateTime = (isoString: string): string =>
  formatKorean(isoString);
