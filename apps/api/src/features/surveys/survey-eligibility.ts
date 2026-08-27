import type {
  SurveyAcademicEligibility,
  SurveySocAffiliation,
} from "@soc/contracts";

interface SurveyEligibilityUser {
  primaryMajor?: string | null;
  doubleMajor?: string | null;
  minor?: string | null;
  departmentKo?: string | null;
  departmentEn?: string | null;
  academicStatus?: string | null;
}

const normalize = (value?: string | null): string =>
  (value ?? "").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");

const isSchoolOfComputing = (value?: string | null): boolean => {
  const normalized = normalize(value);
  return (
    normalized.includes("전산학부") ||
    normalized.includes("전산학과") ||
    normalized.includes("school of computing") ||
    normalized.includes("computer science")
  );
};

export const getSocAffiliations = (
  user: SurveyEligibilityUser,
): SurveySocAffiliation[] => {
  const affiliations: SurveySocAffiliation[] = [];
  if (
    isSchoolOfComputing(user.primaryMajor) ||
    (!user.primaryMajor &&
      (isSchoolOfComputing(user.departmentKo) ||
        isSchoolOfComputing(user.departmentEn)))
  ) {
    affiliations.push("PRIMARY");
  }
  if (isSchoolOfComputing(user.doubleMajor)) affiliations.push("DOUBLE");
  if (isSchoolOfComputing(user.minor)) affiliations.push("MINOR");
  return affiliations;
};

const isEnrolled = (value?: string | null): boolean => {
  const normalized = normalize(value);
  return normalized === "재학" || normalized === "enrolled" || normalized === "active";
};

const isOnLeave = (value?: string | null): boolean => {
  const normalized = normalize(value);
  return (
    normalized === "휴학" ||
    normalized === "leave" ||
    normalized === "leave of absence"
  );
};

export type SurveyEligibilityFailure =
  | "soc_affiliation_required"
  | "academic_status_required";

export const getSurveyEligibilityFailure = (input: {
  user: SurveyEligibilityUser;
  eligibleSocAffiliations: SurveySocAffiliation[];
  academicEligibility: SurveyAcademicEligibility;
}): SurveyEligibilityFailure | null => {
  if (input.eligibleSocAffiliations.length > 0) {
    const userAffiliations = getSocAffiliations(input.user);
    if (!input.eligibleSocAffiliations.some((item) => userAffiliations.includes(item))) {
      return "soc_affiliation_required";
    }
  }

  if (
    input.academicEligibility === "ENROLLED_ONLY" &&
    !isEnrolled(input.user.academicStatus)
  ) {
    return "academic_status_required";
  }
  if (
    input.academicEligibility === "ENROLLED_OR_LEAVE" &&
    !isEnrolled(input.user.academicStatus) &&
    !isOnLeave(input.user.academicStatus)
  ) {
    return "academic_status_required";
  }
  return null;
};
