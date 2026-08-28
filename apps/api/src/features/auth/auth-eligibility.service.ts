import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * 서비스 이용 대상 학과 정책을 한 곳에서 판단합니다.
 *
 * 실제 SSO 환경에서는 AUTH_ELIGIBLE_DEPARTMENTS를 쉼표로 구분해
 * 국문·영문 학과명을 함께 등록할 수 있습니다. 값이 없으면 전산학부만
 * 허용하여, 학과 정보가 누락된 계정은 기본적으로 통과시키지 않습니다.
 */
@Injectable()
export class AuthEligibilityService {
  constructor(private readonly configService: ConfigService) {}

  getAllowedDepartments(): string[] {
    const configured = this.configService.get<string>(
      "AUTH_ELIGIBLE_DEPARTMENTS",
      "전산학부",
    );

    return configured
      .split(",")
      .map((department) => department.trim().toLocaleLowerCase())
      .filter((department) => department.length > 0);
  }

  isEligibleDepartment(
    departmentKo?: string | null,
    departmentEn?: string | null,
  ): boolean {
    const allowed = this.getAllowedDepartments();
    const candidates = [departmentKo, departmentEn]
      .map((department) => department?.trim().toLocaleLowerCase())
      .filter((department): department is string => Boolean(department));

    return candidates.some((candidate) => allowed.includes(candidate));
  }

}
