import { ForbiddenException } from "@nestjs/common";
import { Permissions } from "@soc/contracts";

export interface SurveyPermissionCaller {
  permission: number;
}

/** 투표와 그 밖의 설문형 콘텐츠는 서로 다른 관리 권한을 사용합니다. */
export const hasSurveyKindPermission = (
  caller: SurveyPermissionCaller | undefined,
  kind: string,
): boolean => {
  if (!caller) return false;
  if (Permissions.has(caller.permission, Permissions.SUPER_ADMIN)) return true;

  return kind === "VOTE"
    ? Permissions.has(caller.permission, Permissions.MANAGE_POLL)
    : Permissions.has(caller.permission, Permissions.MANAGE_SURVEY);
};

export const assertSurveyKindPermission = (
  caller: SurveyPermissionCaller | undefined,
  kind: string,
): void => {
  if (hasSurveyKindPermission(caller, kind)) return;

  throw new ForbiddenException(
    kind === "VOTE" ? "poll_permission_required" : "survey_permission_required",
  );
};
