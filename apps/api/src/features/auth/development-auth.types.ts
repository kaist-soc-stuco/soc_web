import { IsIn } from "class-validator";

export const DEVELOPMENT_ACCOUNT_IDS = ["admin", "user-1", "user-2"] as const;
export type DevelopmentAccountId = (typeof DEVELOPMENT_ACCOUNT_IDS)[number];

export class DevelopmentLoginRequestDto {
  @IsIn(DEVELOPMENT_ACCOUNT_IDS)
  account!: DevelopmentAccountId;
}
