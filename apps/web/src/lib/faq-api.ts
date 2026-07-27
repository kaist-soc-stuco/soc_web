import type { PublicFaqListResponse } from '@soc/contracts';

import { getApiJson } from '@/lib/api-client';

export const getFaqs = (): Promise<PublicFaqListResponse> => getApiJson('/faqs?locale=ko');
