/**
 * PostgreSQL users 테이블에 대응하는 최소 타입 골격입니다.
 *
 * TODO:
 * - 실제 DB 컬럼명과 TypeScript 필드명을 최종 통일하세요.
 * - `studentNumber` 같은 추가 식별자가 필요한지 SSO 응답 구조와 함께 검토하세요.
 */
export interface UserRecord {
  createdAt: string;
  id: string;
  kaistUid: string;
  nameEn: string | null;
  nameKo: string;
  ssoSubject: string;
  stdNo: string | null;
  email: string;
  departmentEn: string | null;
  departmentKo: string | null;
  academicStatus: string | null;
  identityCode: string | null;
  isActive: boolean;
  lastLoginAt: string | null;
  updatedAt: string;
}
