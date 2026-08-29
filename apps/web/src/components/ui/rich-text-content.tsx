import { useMemo } from "react";
import { resolveAssetUrl } from "@/lib/asset-url";

const ALLOWED_TAGS = new Set([
  "P",
  "BR",
  "STRONG",
  "B",
  "EM",
  "I",
  "U",
  "S",
  "STRIKE",
  "H1",
  "H2",
  "H3",
  "UL",
  "OL",
  "LI",
  "BLOCKQUOTE",
  "PRE",
  "CODE",
  "HR",
  "A",
  "SPAN",
  "IMG",
]);

const SAFE_STYLE_VALUE = {
  color: /^(?:#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\))$/i,
  "font-size": /^(?:14|16|18|22)px$/,
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function sanitizeForDisplay(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";

  // Legacy/plain descriptions should remain text, not become HTML.
  if (!/<[a-z][\s\S]*>/i.test(trimmed) || typeof DOMParser === "undefined") {
    return escapeHtml(value).replace(/\r?\n/g, "<br />");
  }

  const document = new DOMParser().parseFromString(
    `<div>${trimmed}</div>`,
    "text/html",
  );
  const root = document.body.firstElementChild;
  if (!root) return "";

  Array.from(root.querySelectorAll("*"))
    .reverse()
    .forEach((element) => {
      if (!ALLOWED_TAGS.has(element.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED"].includes(element.tagName)) {
          element.remove();
          return;
        }
        element.replaceWith(...Array.from(element.childNodes));
        return;
      }

      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        if (name === "style" && element.tagName === "SPAN") {
          const safeStyles = attribute.value
            .split(";")
            .map((declaration) => declaration.trim())
            .filter(Boolean)
            .flatMap((declaration) => {
              const separator = declaration.indexOf(":");
              if (separator < 0) return [];
              const property = declaration.slice(0, separator).trim().toLowerCase();
              const styleValue = declaration.slice(separator + 1).trim();
              const matcher = SAFE_STYLE_VALUE[property as keyof typeof SAFE_STYLE_VALUE];
              return matcher?.test(styleValue) ? [`${property}: ${styleValue}`] : [];
            });
          if (safeStyles.length > 0) {
            element.setAttribute("style", safeStyles.join("; "));
          } else {
            element.removeAttribute("style");
          }
          continue;
        }

        if (element.tagName === "IMG" && name === "src") {
          try {
            const rawSource = attribute.value.trim();
            if (
              !/^https?:\/\//i.test(rawSource) &&
              !/^\/(?:api\/)?(?:v\d+\/)?assets\/\d+\/content(?:[?#].*)?$/i.test(rawSource) &&
              !/^asset:\d+$/.test(rawSource)
            ) {
              element.remove();
              continue;
            }
            const resolved = resolveAssetUrl(rawSource);
            const url = new URL(resolved, window.location.origin);
            if (!["http:", "https:"].includes(url.protocol)) {
              element.removeAttribute(attribute.name);
            } else {
              element.setAttribute("src", url.toString());
            }
          } catch {
            element.removeAttribute(attribute.name);
          }
          continue;
        }

        if (element.tagName === "IMG" && name === "alt") continue;

        if (element.tagName === "A" && ["href", "target", "rel"].includes(name)) {
          if (name === "href") {
            try {
              const url = new URL(attribute.value, window.location.origin);
              if (!["http:", "https:", "mailto:", "tel:"].includes(url.protocol)) {
                element.removeAttribute(attribute.name);
              }
            } catch {
              element.removeAttribute(attribute.name);
            }
          }
          continue;
        }

        if (element.tagName === "OL" && name === "start") continue;
        element.removeAttribute(attribute.name);
      }

      if (element.tagName === "A" && element.getAttribute("target") === "_blank") {
        element.setAttribute("rel", "noopener noreferrer");
      }

      if (element.tagName === "IMG") {
        element.setAttribute("draggable", "false");
      }
    });

  return root.innerHTML;
}

export function stripRichText(value: string | null | undefined) {
  if (!value) return "";
  if (typeof DOMParser === "undefined") {
    return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  const document = new DOMParser().parseFromString(value, "text/html");
  return document.body.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

interface RichTextContentProps {
  content: string | null | undefined;
  className?: string;
}

export function RichTextContent({ content, className = "" }: RichTextContentProps) {
  const html = useMemo(() => sanitizeForDisplay(content ?? ""), [content]);
  if (!html) return null;

  return (
    <div
      className={`rich-content select-text [overflow-wrap:anywhere] ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
