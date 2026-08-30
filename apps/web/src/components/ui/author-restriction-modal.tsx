import type { UserRestrictionCreateRequest } from "@soc/contracts";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { UiSelect, UiTextarea } from "@/components/ui/form-control";

interface AuthorRestrictionModalProps {
  isAnonymous: boolean;
  onClose: () => void;
  onSubmit: (input: UserRestrictionCreateRequest) => Promise<void>;
  open: boolean;
  submitting: boolean;
  targetLabel: string;
}

export function AuthorRestrictionModal({
  isAnonymous,
  onClose,
  onSubmit,
  open,
  submitting,
  targetLabel,
}: AuthorRestrictionModalProps) {
  const [duration, setDuration] =
    useState<UserRestrictionCreateRequest["duration"]>("7_DAYS");
  const [reasonCode, setReasonCode] =
    useState<UserRestrictionCreateRequest["reasonCode"]>("ABUSE");
  const [reasonDetail, setReasonDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setDuration("7_DAYS");
    setReasonCode("ABUSE");
    setReasonDetail("");
    setError(null);
  }, [open]);

  const handleSubmit = async () => {
    setError(null);
    try {
      await onSubmit({ duration, reasonCode, reasonDetail: reasonDetail.trim() || undefined });
    } catch {
      setError("작성자 이용 제한을 적용하지 못했습니다.");
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!submitting) onClose();
      }}
      className="max-w-lg"
      title="작성자 이용 제한"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
            취소
          </Button>
          <Button type="button" variant="destructive" onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? "제재 적용 중..." : "제재 적용"}
          </Button>
        </>
      }
    >
      <div className="grid w-full gap-5">
        <div className="rounded-lg border border-rose-100 bg-rose-50/70 px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">{targetLabel}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {isAnonymous
              ? "익명 게시글의 작성자도 실제 계정 기준으로 이용을 제한합니다."
              : "해당 작성자의 서비스 이용을 일정 기간 제한합니다."}
          </p>
        </div>

        <label className="grid w-full gap-1.5 text-xs font-medium text-slate-600">
          <span>제재 기간</span>
          <UiSelect
            className="w-full"
            value={duration}
            onChange={(event) =>
              setDuration(event.target.value as UserRestrictionCreateRequest["duration"])
            }
          >
            <option value="1_DAY">1일 정지</option>
            <option value="3_DAYS">3일 정지</option>
            <option value="7_DAYS">7일 정지</option>
            <option value="30_DAYS">30일 정지</option>
            <option value="PERMANENT">영구 정지</option>
          </UiSelect>
        </label>

        <label className="grid w-full gap-1.5 text-xs font-medium text-slate-600">
          <span>제재 사유</span>
          <UiSelect
            className="w-full"
            value={reasonCode}
            onChange={(event) =>
              setReasonCode(event.target.value as UserRestrictionCreateRequest["reasonCode"])
            }
          >
            <option value="ABUSE">욕설 및 비방</option>
            <option value="SPAM">도배 및 광고</option>
            <option value="HARASSMENT">괴롭힘 및 혐오</option>
            <option value="GUIDELINE_VIOLATION">커뮤니티 가이드라인 위반</option>
            <option value="OTHER">기타</option>
          </UiSelect>
        </label>

        <label className="grid w-full gap-1.5 text-xs font-medium text-slate-600">
          <span>상세 사유</span>
          <UiTextarea
            rows={4}
            className="w-full resize-y"
            value={reasonDetail}
            onChange={(event) => setReasonDetail(event.target.value)}
            placeholder="관리자 메모를 입력해 주세요."
          />
        </label>

        {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
