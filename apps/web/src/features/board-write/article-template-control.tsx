import { useMemo, useState } from "react";
import { FileText, Plus, Trash2 } from "lucide-react";
import { msToIso, nowMs } from "@soc/shared";

import { AdminFormField } from "@/components/ui/admin-page";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { UiInput } from "@/components/ui/form-control";

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
  boardLabel: string;
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

export function ArticleTemplateControl({
  boardCode,
  boardLabel,
  lang,
  snapshot,
  onApply,
}: ArticleTemplateControlProps) {
  const [templates, setTemplates] = useState<StoredBoardTemplate[]>(readTemplates);
  const [open, setOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentTemplates = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return templates
      .filter((template) => template.boardCode === boardCode)
      .filter((template) =>
        !query
          ? true
          : `${template.name} ${template.description}`
              .toLocaleLowerCase()
              .includes(query),
      );
  }, [boardCode, search, templates]);

  const saveTemplate = () => {
    if (!name.trim() || !snapshot.titleKo.trim() || !snapshot.contentKo.trim()) {
      setError(
        lang === "ko"
          ? "템플릿 이름과 국문 제목·본문을 입력해 주세요."
          : "Enter a template name, Korean title, and content.",
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
      name: name.trim(),
      description: description.trim(),
      updatedAt: msToIso(nowMs()),
    };
    const next = [template, ...templates];
    setTemplates(next);
    writeTemplates(next);
    setName("");
    setDescription("");
    setError(null);
    setSaveOpen(false);
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
        size="sm"
        onClick={() => {
          setError(null);
          setSearch("");
          setSaveOpen(false);
          setOpen(true);
        }}
      >
        <FileText aria-hidden="true" />
        템플릿
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="템플릿 양식 선택"
        className="max-w-2xl"
      >
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <UiInput
              aria-label="템플릿 검색"
              spellCheck={false}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="템플릿 검색"
              className="h-9 min-w-0 flex-1 text-sm font-normal"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setError(null);
                setSaveOpen((current) => !current);
              }}
              className="shrink-0"
            >
              <Plus aria-hidden="true" />
              현재 작성 내용을 새 템플릿으로 저장
            </Button>
          </div>

          <p className="text-xs font-normal text-slate-500">
            {boardLabel} 게시판에서 사용할 관리자 전용 템플릿입니다.
          </p>

          {error ? (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-normal text-rose-700" role="alert">
              {error}
            </p>
          ) : null}

          {saveOpen ? (
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
              <AdminFormField label="템플릿 이름">
                <UiInput
                  spellCheck={false}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="템플릿 이름"
                  maxLength={100}
                  className="h-9 text-sm font-normal"
                />
              </AdminFormField>
              <AdminFormField label="설명 (선택)">
                <UiInput
                  spellCheck={false}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="설명"
                  maxLength={255}
                  className="h-9 text-sm font-normal"
                />
              </AdminFormField>
              <div className="flex justify-end gap-2 sm:col-span-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSaveOpen(false)}>
                  취소
                </Button>
                <Button type="button" size="sm" onClick={saveTemplate}>
                  저장
                </Button>
              </div>
            </div>
          ) : null}

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">저장된 양식</h3>
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
