export interface LoginStartResponse {
  clientId: string;
  loginUrl: string;
  nonce: string;
  redirectUri: string;
  state: string;
}
export type AuthStorageMode = "temporary" | "persisted";
export interface LoginSessionResponse {
  authenticated: boolean;
  canUsePersistentFeatures: boolean;
  requiresConsent: boolean;
  storageMode: AuthStorageMode | null;
  userId?: string;
}

export interface ConsentDecisionRequest {
  consent: boolean;
}
