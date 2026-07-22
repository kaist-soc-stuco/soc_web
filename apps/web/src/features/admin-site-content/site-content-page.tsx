import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createApiClient } from "@soc/api-client";
import type { SiteContentKey } from "@soc/contracts";
import { isoToMs, nowMs } from "@soc/shared";
import {
  CheckCircle2,
  FileText,
  Home,
  Languages,
  PanelBottom,
  RotateCcw,
  Save,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AuthGuard } from "@/components/guards/auth-guard";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  getSiteContentDefinition,
  SITE_CONTENT_DEFINITIONS,
  SITE_CONTENT_QUERY_KEY,
  type SiteContentDefinition,
} from "@/features/site-content/site-content";
import { resolveApiBaseUrl } from "@/lib/api-base-url";
import { Permissions } from "@/lib/permissions";

const ADMIN_SITE_CONTENT_QUERY_KEY = ["admin", "site-content"] as const;
const INITIAL_CONTENT_DEFINITION = SITE_CONTENT_DEFINITIONS[0];

const GROUPS = [
  {
    id: "home" as const,
    description: "첫 화면의 핵심 메시지와 이동 버튼",
    icon: Home,
    label: "홈",
  },
  {
    id: "about" as const,
    description: "SOC 소개와 생활 로드맵 안내",
    icon: FileText,
    label: "소개·로드맵",
  },
  {
    id: "footer" as const,
    description: "모든 공개 페이지의 하단 정보",
    icon: PanelBottom,
    label: "푸터",
  },
] as const;

interface Draft {
  source: string;
  valueEn: string;
  valueKo: string;
}

type ConfirmRequest = ReturnType<typeof useConfirmDialog>["confirm"];

const DIRTY_HISTORY_MARKER = "socCmsDirtyGuard";

function formatUpdatedAt(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = isoToMs(value);
  if (!Number.isFinite(timestamp)) return null;

  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function useUnsavedContentGuard(
  isDirty: boolean,
  requestConfirm: ConfirmRequest,
) {
  const navigate = useNavigate();
  const confirmRef = useRef(requestConfirm);
  const guardActiveRef = useRef(false);
  const markerRef = useRef<string | null>(null);
  const previousDirtyRef = useRef(false);
  const promptPendingRef = useRef(false);

  useEffect(() => {
    confirmRef.current = requestConfirm;
  }, [requestConfirm]);

  useEffect(() => {
    const wasDirty = previousDirtyRef.current;
    previousDirtyRef.current = isDirty;

    if (!wasDirty || isDirty || !guardActiveRef.current) return;

    if (window.history.state?.[DIRTY_HISTORY_MARKER] === markerRef.current) {
      guardActiveRef.current = false;
      markerRef.current = null;
      window.history.back();
    }
  }, [isDirty]);

  useEffect(() => {
    if (!isDirty || guardActiveRef.current) return;

    const marker = `${nowMs()}-${Math.random()}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const currentState =
      window.history.state && typeof window.history.state === "object"
        ? window.history.state
        : {};

    window.history.pushState(
      { ...currentState, [DIRTY_HISTORY_MARKER]: marker },
      "",
      currentUrl,
    );
    guardActiveRef.current = true;
    markerRef.current = marker;

    const confirmDiscard = async () => {
      if (promptPendingRef.current) return false;

      promptPendingRef.current = true;
      try {
        return await confirmRef.current({
          title: "저장하지 않은 변경 사항을 버릴까요?",
          description:
            "이 페이지를 벗어나면 현재 입력한 한·영 문구가 사라집니다.",
          confirmLabel: "변경 사항 버리기",
          tone: "danger",
        });
      } finally {
        promptPendingRef.current = false;
      }
    };

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = true;
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        !(event.target instanceof Element)
      ) {
        return;
      }

      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (
        !anchor ||
        (anchor.target && anchor.target !== "_self") ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      const targetUrl = new URL(anchor.href, window.location.href);
      if (targetUrl.origin !== window.location.origin) return;

      const targetPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
      if (targetPath === currentUrl) return;

      event.preventDefault();
      void confirmDiscard().then((confirmed) => {
        if (!confirmed) return;

        guardActiveRef.current = false;
        markerRef.current = null;
        navigate(targetPath, { replace: true });
      });
    };

    const handlePopState = () => {
      if (!guardActiveRef.current) return;

      void confirmDiscard().then((confirmed) => {
        if (confirmed) {
          guardActiveRef.current = false;
          markerRef.current = null;
          window.history.back();
          return;
        }

        const restoredState =
          window.history.state && typeof window.history.state === "object"
            ? window.history.state
            : {};
        window.history.pushState(
          { ...restoredState, [DIRTY_HISTORY_MARKER]: marker },
          "",
          currentUrl,
        );
      });
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty, navigate]);
}

export function SiteContentPage() {
  return (
    <AuthGuard requirePermission={Permissions.MANAGE_CONTENT}>
      <SiteContentPageContent />
    </AuthGuard>
  );
}

function SiteContentPageContent() {
  const apiClient = useMemo(
    () => createApiClient({ baseUrl: resolveApiBaseUrl() }),
    [],
  );
  const queryClient = useQueryClient();
  const { confirm: requestConfirm, ConfirmDialog } = useConfirmDialog();
  const [selectedKey, setSelectedKey] = useState<SiteContentKey>(
    INITIAL_CONTENT_DEFINITION.key,
  );
  const [draft, setDraft] = useState<Draft>(
    {
      source: `${INITIAL_CONTENT_DEFINITION.key}:fallback`,
      valueKo: INITIAL_CONTENT_DEFINITION.valueKo,
      valueEn: INITIAL_CONTENT_DEFINITION.valueEn,
    },
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<
    { tone: "success" | "error"; text: string } | undefined
  >();

  const contentQuery = useQuery({
    queryKey: ADMIN_SITE_CONTENT_QUERY_KEY,
    queryFn: () => apiClient.getAdminSiteContent(),
  });

  const definition = getSiteContentDefinition(selectedKey);
  const storedRecord = contentQuery.data?.items.find(
    (item) => item.key === selectedKey,
  );
  const baselineSource = `${selectedKey}:${storedRecord?.updatedAt ?? "fallback"}`;

  useEffect(() => {
    setDraft({
      source: baselineSource,
      valueKo: storedRecord?.valueKo ?? definition.valueKo,
      valueEn: storedRecord?.valueEn ?? definition.valueEn,
    });
  }, [baselineSource, definition, storedRecord]);

  const baseline = {
    valueKo: storedRecord?.valueKo ?? definition.valueKo,
    valueEn: storedRecord?.valueEn ?? definition.valueEn,
  };
  const isDirty =
    draft.source === baselineSource &&
    (draft.valueKo !== baseline.valueKo || draft.valueEn !== baseline.valueEn);
  const canSave =
    isDirty &&
    draft.valueKo.trim().length > 0 &&
    draft.valueEn.trim().length > 0 &&
    !saving;

  useUnsavedContentGuard(isDirty, requestConfirm);

  const refreshContent = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ADMIN_SITE_CONTENT_QUERY_KEY }),
      queryClient.invalidateQueries({ queryKey: SITE_CONTENT_QUERY_KEY }),
    ]);
  };

  const handleSelect = async (key: SiteContentKey) => {
    if (key === selectedKey) return;

    if (isDirty) {
      const confirmed = await requestConfirm({
        title: "저장하지 않은 변경 사항을 버릴까요?",
        description:
          "다른 영역으로 이동하면 현재 입력한 한·영 문구가 사라집니다.",
        confirmLabel: "변경 사항 버리기",
        tone: "danger",
      });
      if (!confirmed) return;
    }

    setSelectedKey(key);
    setMessage(undefined);
  };

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    setMessage(undefined);
    try {
      await apiClient.upsertSiteContent(selectedKey, {
        valueKo: draft.valueKo.trim(),
        valueEn: draft.valueEn.trim(),
      });
      await refreshContent();
      setMessage({ tone: "success", text: "공개 사이트 콘텐츠를 저장했습니다." });
    } catch {
      setMessage({
        tone: "error",
        text: "저장하지 못했습니다. 권한과 입력 내용을 확인해 주세요.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreFallback = async () => {
    if (!storedRecord) {
      setDraft({
        source: baselineSource,
        valueKo: definition.valueKo,
        valueEn: definition.valueEn,
      });
      return;
    }

    const confirmed = await requestConfirm({
      title: "기본 문구로 복원하시겠습니까?",
      description:
        "저장된 한·영 문구를 삭제하고 코드에 포함된 검증된 기본 문구를 즉시 공개합니다.",
      confirmLabel: "기본값으로 복원",
      tone: "danger",
    });
    if (!confirmed) return;

    setSaving(true);
    setMessage(undefined);
    try {
      await apiClient.deleteSiteContent(selectedKey);
      await refreshContent();
      setMessage({ tone: "success", text: "기본 문구로 복원했습니다." });
    } catch {
      setMessage({ tone: "error", text: "기본값으로 복원하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50/70 pb-16 text-slate-950">
      {ConfirmDialog}
      <main className="mx-auto w-full max-w-[1440px] px-5 py-8 lg:px-10">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-6 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-kaist-darkgreen">
              <Languages aria-hidden="true" className="h-4 w-4" />
              Public content CMS
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
              사이트 콘텐츠
            </h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-6 text-slate-500">
              홈·소개·로드맵·푸터에 노출되는 문구를 관리합니다. 공개 화면의
              언어 누락을 막기 위해 한국어와 영어를 항상 함께 저장합니다.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">
            <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
            저장 즉시 공개 화면에 반영
          </div>
        </header>

        {contentQuery.isError && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            콘텐츠 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
          </div>
        )}

        <div className="mt-7 grid gap-6 xl:grid-cols-[21rem_minmax(0,1fr)]">
          <aside className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:sticky xl:top-6">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-black text-slate-800">편집할 영역</h2>
              <p className="mt-1 text-xs font-medium text-slate-400">
                기본값은 서버 장애 시에도 안전하게 표시됩니다.
              </p>
            </div>
            <nav className="max-h-[calc(100vh-15rem)] overflow-y-auto p-2" aria-label="사이트 콘텐츠 영역">
              {GROUPS.map((group) => {
                const Icon = group.icon;
                const items = SITE_CONTENT_DEFINITIONS.filter(
                  (item) => item.group === group.id,
                );

                return (
                  <section key={group.id} className="mb-3 last:mb-0">
                    <div className="flex items-start gap-3 px-3 pb-2 pt-3">
                      <div className="mt-0.5 rounded-lg bg-kaist-lightgreen/15 p-2 text-kaist-darkgreen">
                        <Icon aria-hidden="true" className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-xs font-black text-slate-700">{group.label}</h3>
                        <p className="mt-0.5 text-[11px] font-medium leading-4 text-slate-400">
                          {group.description}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {items.map((item) => (
                        <ContentNavigationItem
                          definition={item}
                          isSelected={selectedKey === item.key}
                          isStored={Boolean(
                            contentQuery.data?.items.some(
                              (record) => record.key === item.key,
                            ),
                          )}
                          key={item.key}
                          onSelect={() => void handleSelect(item.key)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </nav>
          </aside>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-black text-slate-900">
                    {definition.labelKo}
                  </h2>
                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                      storedRecord
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {storedRecord ? "CMS 저장값" : "코드 기본값"}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  {definition.helpKo}
                </p>
                <code className="mt-2 inline-block rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-500">
                  {definition.key}
                </code>
              </div>
              {storedRecord?.updatedAt && (
                <p className="shrink-0 text-xs font-semibold text-slate-400">
                  최근 수정 {formatUpdatedAt(storedRecord.updatedAt)}
                </p>
              )}
            </div>

            <div className="grid gap-6 p-6 lg:grid-cols-2 lg:p-8">
              <LocalizedField
                definition={definition}
                language="한국어"
                onChange={(valueKo) => setDraft((current) => ({ ...current, valueKo }))}
                value={draft.valueKo}
              />
              <LocalizedField
                definition={definition}
                language="English"
                onChange={(valueEn) => setDraft((current) => ({ ...current, valueEn }))}
                value={draft.valueEn}
              />
            </div>

            <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5 lg:px-8">
              {message && (
                <div
                  className={`mb-4 rounded-xl border px-4 py-3 text-sm font-bold ${
                    message.tone === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                  role="status"
                >
                  {message.text}
                </div>
              )}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => void handleRestoreFallback()}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw aria-hidden="true" className="h-4 w-4" />
                  기본 문구로 복원
                </button>
                <div className="flex items-center justify-end gap-3">
                  {isDirty && (
                    <span className="text-xs font-bold text-amber-700">
                      저장하지 않은 변경 사항
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-kaist-darkgreen px-5 text-sm font-black text-white transition-colors hover:bg-kaist-darkgreen/90 disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    <Save aria-hidden="true" className="h-4 w-4" />
                    {saving ? "저장 중..." : "한·영 문구 저장"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function ContentNavigationItem({
  definition,
  isSelected,
  isStored,
  onSelect,
}: {
  definition: SiteContentDefinition;
  isSelected: boolean;
  isStored: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs font-bold transition-colors ${
        isSelected
          ? "bg-kaist-darkgreen text-white"
          : "text-slate-600 hover:bg-slate-50 hover:text-kaist-darkgreen"
      }`}
    >
      <span>{definition.labelKo}</span>
      <span
        className={`h-2 w-2 rounded-full ${
          isStored
            ? isSelected
              ? "bg-emerald-300"
              : "bg-emerald-500"
            : isSelected
              ? "bg-white/40"
              : "bg-slate-200"
        }`}
        aria-label={isStored ? "CMS 저장값 사용 중" : "코드 기본값 사용 중"}
      />
    </button>
  );
}

function LocalizedField({
  definition,
  language,
  onChange,
  value,
}: {
  definition: SiteContentDefinition;
  language: "한국어" | "English";
  onChange: (value: string) => void;
  value: string;
}) {
  const inputClassName =
    "mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition focus:border-kaist-darkgreen focus:ring-4 focus:ring-kaist-darkgreen/10";

  return (
    <label className="block">
      <span className="flex items-center justify-between gap-3 text-xs font-black text-slate-700">
        {language}
        <span className="font-semibold text-slate-400">{value.length.toLocaleString()}자</span>
      </span>
      {definition.multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={definition.key === "about.intro.body" ? 9 : 5}
          maxLength={20_000}
          required
          className={`${inputClassName} resize-y`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={20_000}
          required
          className={inputClassName}
        />
      )}
      {!value.trim() && (
        <span className="mt-2 block text-xs font-bold text-red-600">
          공개 화면의 언어 누락을 막기 위해 필수로 입력해 주세요.
        </span>
      )}
    </label>
  );
}
