import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { msToIso, nowMs } from "@soc/shared";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TextInput } from "@/components/ui/text-input";
import { useCurrentSession } from "@/hooks/use-current-session";
import { getDraftStorageKey } from "@/lib/draft-storage";

import type { AttachedAsset } from "./board-write-form-sections";

export interface BoardTemplateSnapshot {
  boardCode: string;
  titleKo: string;
  titleEn: string;
  contentKo: string;
  contentEn: string;
  isAnonymous: boolean;
  isPinned: boolean;
  homeVisible?: boolean;
  homeOrder?: string;
  isSecret: boolean;
  allowComment: boolean;
  isKoreanOnly: boolean;
  isAllDay: boolean;
  isEventAlwaysOpen: boolean;
  eventStartDate: string;
  eventEndDate: string;
  eventLocation: string;
  eventLocationEn: string;
  eventDescriptionKo: string;
  eventDescriptionEn: string;
  selectedSurveyId: string;
  assets: AttachedAsset[];
}

interface StoredBoardTemplate extends BoardTemplateSnapshot {
  id: string;
  name: string;
  description: string;
  updatedAt: string;
}

interface ArticleTemplateControlProps {
  boardCode: string;
  lang: string;
  snapshot: BoardTemplateSnapshot;
  onApply: (snapshot: BoardTemplateSnapshot) => void;
}

function readTemplates(storageKey: string | null) {
  if (typeof window === "undefined") return [] as StoredBoardTemplate[];
  if (!storageKey) return [] as StoredBoardTemplate[];

  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is StoredBoardTemplate =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as StoredBoardTemplate).id === "string" &&
        typeof (item as StoredBoardTemplate).name === "string" &&
        typeof (item as StoredBoardTemplate).boardCode === "string",
    );
  } catch {
    return [];
  }
}

function writeTemplates(storageKey: string | null, templates: StoredBoardTemplate[]) {
  if (!storageKey) return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(templates));
  } catch {
    // The editor remains usable when browser storage is unavailable.
  }
}

function firstBodyLine(value: string) {
  const text = value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .trim();
  return text.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

export function ArticleTemplateControl({
  boardCode,
  lang,
  snapshot,
  onApply,
}: ArticleTemplateControlProps) {
  const { data: session, isLoading: sessionLoading } = useCurrentSession();
  const storageKey =
    !sessionLoading && session?.authenticated && session.userId
      ? getDraftStorageKey("article-template", "collection", session)
      : null;
  const [templates, setTemplates] = useState<StoredBoardTemplate[]>([]);
  const [loadedStorageKey, setLoadedStorageKey] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");

  useEffect(() => {
    setTemplates(readTemplates(storageKey));
    setLoadedStorageKey(storageKey);
    setOpen(false);
  }, [storageKey]);

  const currentTemplates = useMemo(() => {
    if (loadedStorageKey !== storageKey) return [];
    return templates.filter((template) => template.boardCode === boardCode);
  }, [boardCode, loadedStorageKey, storageKey, templates]);

  const saveTemplate = () => {
    if (!storageKey || loadedStorageKey !== storageKey) return;
    const name = templateName.trim();
    const description = firstBodyLine(snapshot.contentKo);
    if (!name || !description) {
      setError(
        lang === "ko"
          ? "템플릿 이름과 본문을 입력해 주세요."
          : "Enter a template name and content.",
      );
      return;
    }

    const template: StoredBoardTemplate = {
      ...snapshot,
      assets: snapshot.assets.map((asset) => ({ ...asset })),
      id:
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `article-template-${nowMs()}`,
      name,
      description,
      updatedAt: msToIso(nowMs()),
    };
    const next = [template, ...templates];
    setTemplates(next);
    writeTemplates(storageKey, next);
    setError(null);
    setTemplateName("");
  };

  const deleteTemplate = (templateId: string) => {
    if (!storageKey || loadedStorageKey !== storageKey) return;
    const next = templates.filter((template) => template.id !== templateId);
    setTemplates(next);
    writeTemplates(storageKey, next);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-8 text-sm !font-medium"
        onClick={() => {
          setError(null);
          setTemplateName(snapshot.titleKo.trim());
          setOpen(true);
        }}
      >

        {lang === "ko" ? "템플릿 관리" : "Manage templates"}
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={lang === "ko" ? "템플릿 관리" : "Manage templates"}
        size="standard"
      >
        <div className="space-y-5">
          <section className="space-y-3 border-b border-slate-100 pb-5">
            <h3 className="text-sm font-medium text-slate-800">{lang === "ko" ? "새 템플릿 생성" : "Create a template"}</h3>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <TextInput
                aria-label={lang === "ko" ? "템플릿 이름" : "Template name"}
                placeholder={lang === "ko" ? "템플릿 이름" : "Template name"}
                value={templateName}
                onChange={(event) => setTemplateName(event.currentTarget.value)}
                containerClassName="flex-1"
              />
              <Button type="button" onClick={saveTemplate} className="shrink-0">
                {lang === "ko" ? "현재 글 저장" : "Save current post"}
              </Button>
            </div>
          </section>
          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-normal text-rose-700" role="alert">
              {error}
            </p>
          ) : null}

          <section>
            {currentTemplates.length === 0 ? (
              <p className="py-6 text-center text-sm font-normal text-slate-500">
                {lang === "ko" ? "저장된 양식이 없습니다." : "No saved templates."}
              </p>
            ) : (
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {currentTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="group flex items-center gap-3 px-3 py-3 transition-colors hover:bg-slate-50"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onApply({
                          ...template,
                          assets: template.assets.map((asset) => ({ ...asset })),
                        });
                        setOpen(false);
                      }}
                      className="min-w-0 flex-1 text-left outline-none"
                    >
                      <p className="truncate text-sm font-medium text-slate-800">{template.name}</p>
                      {template.description ? (
                        <p className="mt-0.5 truncate text-xs font-normal text-slate-500">
                          {template.description}
                        </p>
                      ) : null}
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`${template.name} ${lang === "ko" ? "삭제" : "Delete"}`}
                      data-tooltip={lang === "ko" ? "템플릿 삭제" : "Delete template"}
                      onClick={() => deleteTemplate(template.id)}
                      className="size-8 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </Modal>
    </>
  );
}
