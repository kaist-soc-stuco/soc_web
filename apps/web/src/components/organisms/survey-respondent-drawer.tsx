import type { SurveyResponseUserRecord } from "@soc/contracts";

import { AdminDrawer } from "@/components/ui/admin-drawer";
import { AdminStatusBadge } from "@/components/ui/admin-status-badge";

export function SurveyRespondentDrawer({
  onClose,
  user,
}: {
  onClose: () => void;
  user: SurveyResponseUserRecord | null;
}) {
  return (
    <AdminDrawer
      open={Boolean(user)}
      onClose={onClose}
      title="응답자 상세 정보"
      width="max-w-xl"
    >
      {user ? (
        <div className="space-y-5">
          <section className="rounded-xl bg-slate-50 px-4 py-4">
            <h3 className="text-lg font-semibold text-slate-950">
              {user.nameKo ?? "비로그인 응답"}
              {user.nameEn && user.nameEn !== user.nameKo ? (
                <span className="font-normal text-slate-500"> · {user.nameEn}</span>
              ) : null}
            </h3>
            <dl className="mt-4 grid gap-x-5 gap-y-4 text-sm sm:grid-cols-2">
              <RespondentDetailItem label="학번" value={user.stdNo ?? ""} />
              <RespondentDetailItem label="이메일" value={user.email ?? ""} />
              <RespondentDetailItem label="전화번호" value={user.phoneNumber ?? ""} />
              <RespondentDetailItem label="소속" value={user.departmentKo ?? ""} />
              <RespondentDetailItem label="주전공" value={user.primaryMajor ?? ""} />
              <RespondentDetailItem label="복수전공" value={user.doubleMajor ?? ""} />
              <RespondentDetailItem label="부전공" value={user.minor ?? ""} />
              <RespondentDetailItem label="학적 상태" value={user.academicStatus ?? ""} />
            </dl>
          </section>
          <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
            <span className="text-sm font-normal text-slate-600">과비 납부 상태</span>
            <AdminStatusBadge tone={user.feeStatus === "PAID" ? "positive" : "neutral"}>
              {user.feeStatus === "PAID"
                ? "완납"
                : user.feeStatus === "PARTIAL"
                  ? "부분 납부"
                  : user.feeStatus === "UNPAID"
                    ? "미납"
                    : "기록 없음"}
            </AdminStatusBadge>
          </div>
        </div>
      ) : null}
    </AdminDrawer>
  );
}

function RespondentDetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-normal text-slate-900">{value}</dd>
    </div>
  );
}
