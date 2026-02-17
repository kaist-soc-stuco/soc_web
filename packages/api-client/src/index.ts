import type { GreetingResponse, HealthResponse } from '@soc/contracts';

export interface ApiClientOptions {
  baseUrl: string;
  fetcher?: typeof fetch;
}

const withNoTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const readJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
};

export const createApiClient = ({ baseUrl, fetcher = fetch }: ApiClientOptions) => {
  const normalizedBaseUrl = withNoTrailingSlash(baseUrl);

  return {
    getHealth: async (): Promise<HealthResponse> => {
      const response = await fetcher(`${normalizedBaseUrl}/health`);
      return readJson<HealthResponse>(response);
    },

    getGreeting: async (): Promise<GreetingResponse> => {
      const response = await fetcher(`${normalizedBaseUrl}/v1/mock/greeting`);
      return readJson<GreetingResponse>(response);
    },
  };
};
