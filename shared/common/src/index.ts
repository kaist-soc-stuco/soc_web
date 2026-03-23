export const APP_TITLE = 'SoC Web Platform';

export const formatKoreanDateTime = (isoString: string): string => {
  const date = new Date(isoString);

  if (Number.isNaN(date.valueOf())) {
    return 'invalid-date';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(date);
};
