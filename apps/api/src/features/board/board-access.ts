export interface CurrentUserContext {
  authenticated: boolean;
  user?: {
    id: string;
    permission: number;
  };
}
