import { useMemo, useState } from "react";
import { FileText, Save, Trash2 } from "lucide-react";
import { msToIso, nowMs } from "@soc/shared";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

import type { AttachedAsset } from "./board-write-form-sections";

const STORAGE_KEY = "soc:admin:board-article-templates";

export interface BoardTemplateSnapshot {
  boardCode: string;
  titleKo: string;
  titleEn: string;
  contentKo: string;
  contentEn: string;
  isAnonymous: boolean;
  isPinned: boolean;
  isSecret: boolean;
  allowComment: boolean;
  isKoreanOnly: boolean;
  isAllDay: boolean;
  isEventAlwaysOpen: boolean;
  eventStartDate: string;
  eventEndDate: string;
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

function readTemplates() {
  if (typeof window === "undefined") return [] as StoredBoardTemplate[];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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

function writeTemplates(templates: StoredBoardTemplate[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
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
  const [templates, setTemplates] = useState<StoredBoardTemplate[]>(readTemplates);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentTemplates = useMemo(() => {
    return templates.filter((template) => template.boardCode === boardCode);
  }, [boardCode, templates]);

  const saveTemplate = () => {
    const name = snapshot.titleKo.trim();
    const description = firstBodyLine(snapshot.contentKo);
    if (!name || !description) {
      setError(
        lang === "ko"
          ? "국문 제목과 본문을 입력해 주세요."
          : "Enter a Korean title and content.",
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
    writeTemplates(next);
    setError(null);
  };

  const deleteTemplate = (templateId: string) => {
    const next = templates.filter((template) => template.id !== templateId);
    setTemplates(next);
    writeTemplates(next);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-[var(--ui-control-height)] !font-medium"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        <FileText aria-hidden="true" />
        템플릿
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="템플릿"
        headerActions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-[var(--ui-control-height)] !font-medium"
            onClick={saveTemplate}
          >
            <Save aria-hidden="true" />
            저장
          </Button>
        }
        className="max-w-2xl"
      >
        <div className="space-y-5">
          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-normal text-rose-700" role="alert">
              {error}
            </p>
          ) : null}

          <section>
            {currentTemplates.length === 0 ? (
              <p className="py-6 text-center text-sm font-normal text-slate-500">
                저장된 양식이 없습니다.
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
                      aria-label={`${template.name} 삭제`}
                      title="템플릿 삭제"
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
