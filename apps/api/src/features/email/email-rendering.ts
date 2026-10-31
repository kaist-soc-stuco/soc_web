import { load } from "cheerio";
import sanitizeHtml from "sanitize-html";

export interface EmailAttachment {
  assetId: string;
  filename: string;
  content: Buffer;
  contentType: string;
  cid?: string;
}

export interface EmailRecipient {
  email: string;
  nameKo: string;
  studentNumber: string | null;
}

const color = [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d.,%\s]+\)$/i, /^hsla?\([\d.,%\s]+\)$/i, /^[a-z]+$/i];
const size = [/^(?:0|\d+(?:\.\d+)?(?:px|pt|em|rem|%))$/i];

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

export function renderBulkEmailTemplate(value: string, recipient: EmailRecipient, html = false): string {
  const variables: Record<string, string> = { 이름: recipient.nameKo, 학번: recipient.studentNumber ?? "", 이메일: recipient.email };
  return value.replace(/\{\{\s*([^{}]+?)\s*\}\}|\{(이름|학번|이메일)\}/g, (match, doubleKey: string | undefined, singleKey: string | undefined) => {
    const replacement = variables[(doubleKey ?? singleKey ?? "").trim()];
    return replacement === undefined ? match : html ? escapeHtml(replacement) : replacement;
  });
}

export function sanitizeBulkEmailHtml(value: string): string {
  const safe = sanitizeHtml(value, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, "img"],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      "*": ["style"],
      a: ["href", "name", "target", "title"],
      img: ["src", "alt", "title", "width", "height", "data-align"],
      ol: ["start"],
      td: ["colspan", "rowspan", "width", "height"],
      th: ["colspan", "rowspan", "width", "height"],
    },
    allowedSchemes: ["http", "https", "mailto", "cid"],
    allowProtocolRelative: false,
    allowedStyles: { "*": {
      color, "background-color": color, "font-size": size,
      "font-weight": [/^(?:normal|bold|[1-9]00)$/], "font-style": [/^(?:normal|italic|oblique)$/],
      "text-decoration": [/^(?:none|underline|line-through|overline)(?: (?:underline|line-through|overline))*$/],
      "text-align": [/^(?:left|center|right|justify)$/],
      "white-space": [/^(?:normal|pre|pre-wrap|pre-line)$/],
      "line-height": [/^(?:normal|\d+(?:\.\d+)?(?:px|pt|em|rem|%)?)$/],
      width: [...size, /^auto$/], height: [...size, /^auto$/], "max-width": size,
      "margin-top": size, "margin-bottom": size,
      "margin-left": [...size, /^auto$/], "margin-right": [...size, /^auto$/],
      "padding-top": size, "padding-bottom": size, "padding-left": size, "padding-right": size,
      "border-collapse": [/^(?:collapse|separate)$/],
    } },
  });
  const $ = load(safe, null, false);
  // These styles otherwise exist only in the website's stylesheet.
  const defaults = (selector: string, styles: Record<string, string>) => {
    $(selector).each((_, element) => {
      const node = $(element);
      for (const [property, value] of Object.entries(styles)) {
        if (!node.css(property)) node.css(property, value);
      }
    });
  };
  defaults("blockquote", {
    "border-left": "4px solid #006e3f", "background-color": "#f5f9fb",
    padding: "14px 20px", margin: "24px 0", color: "#485969",
    "font-style": "italic", "border-radius": "0 8px 8px 0",
  });
  defaults("pre", {
    "background-color": "#1b252b", color: "#eaf0f5", padding: "20px",
    "border-radius": "12px", "font-family": 'Menlo, Consolas, "Courier New", monospace',
    "font-size": "14px", "line-height": "1.48", "overflow-x": "auto",
    "max-width": "100%", "white-space": "pre", margin: "24px 0",
  });
  defaults("pre code", {
    "background-color": "transparent", color: "inherit", padding: "0",
    "border-radius": "0", "font-size": "inherit", "font-family": "inherit",
    "overflow-wrap": "normal", "word-break": "normal", "white-space": "inherit",
  });
  defaults("code", {
    "background-color": "#eaf0f5", color: "#ad3454", padding: "2px 6px",
    "border-radius": "4px", "font-family": 'Menlo, Consolas, "Courier New", monospace',
    "font-size": "0.85em",
  });
  $("p").each((_, element) => {
    const node = $(element);
    if (!node.css("margin-top")) node.css("margin-top", "0");
    if (!node.css("margin-bottom")) node.css("margin-bottom", node.is(":last-child") ? "0" : "6px");
    if (!node.css("line-height")) node.css("line-height", "1.48");
    if (!node.contents().length) node.append("<br>");
  });
  $("a[href]").each((_, element) => {
    const node = $(element);
    if (!node.css("color")) node.css("color", "#2563eb");
    if (!node.css("text-decoration")) node.css("text-decoration", "underline");
  });
  $("img").each((_, element) => {
    const node = $(element);
    const align = node.attr("data-align");
    node.css({ display: "block", "max-width": "100%" });
    if (!node.css("height")) node.css("height", "auto");
    if (align || !node.css("margin-left")) node.css("margin-left", align === "center" || align === "right" ? "auto" : "0");
    if (align || !node.css("margin-right")) node.css("margin-right", align === "right" ? "0" : "auto");
    node.removeAttr("data-align");
  });
  return $.root().html() ?? "";
}

function inlineAssetId(source: string): string | undefined {
  const direct = /^asset:(\d+)$/.exec(source);
  if (direct) return direct[1];
  try { return /^\/(?:api\/)?(?:v\d+\/)?assets\/(\d+)\/content$/.exec(new URL(source, "https://email.invalid").pathname)?.[1]; }
  catch { return undefined; }
}

export function collectEmailAttachmentIds(assetIds: string[], content: string, contentType: "plain" | "html"): string[] {
  const ids = new Set(assetIds);
  if (contentType === "html") {
    const $ = load(content, null, false);
    $("img[src]").each((_, element) => {
      const id = inlineAssetId($(element).attr("src")!);
      if (id) ids.add(id);
    });
  }
  return [...ids];
}

function inlineImageSources(value: string, attachments: EmailAttachment[]): string {
  const $ = load(value, null, false);
  const byId = new Map(attachments.filter(file => file.cid && file.contentType.startsWith("image/")).map(file => [file.assetId, file.cid!]));
  $("img[src]").each((_, element) => {
    const node = $(element);
    const id = inlineAssetId(node.attr("src")!);
    const cid = id && byId.get(id);
    if (cid) node.attr("src", `cid:${cid}`);
  });
  return $.root().html() ?? "";
}

export function emailHtmlToText(value: string): string {
  const $ = load(value, null, false);
  $("script,style,iframe,object").remove();
  $("br").replaceWith("\n");
  $("img").each((_, element) => { $(element).replaceWith($("<span>").text($(element).attr("alt") ?? "")); });
  $("a[href]").each((_, element) => {
    const node = $(element), href = node.attr("href")!;
    if (node.text().trim() !== href) node.append($("<span>").text(` (${href})`));
  });
  $("p,h1,h2,h3,h4,h5,h6,div,blockquote,pre,tr").append("\n");
  $("li").each((_, element) => {
    const node = $(element), parent = node.parent();
    const prefix = parent.is("ol") ? `${(Number(parent.attr("start")) || 1) + node.prevAll("li").length}. ` : "• ";
    node.prepend(prefix).append("\n");
  });
  $("td,th").append("\t");
  return $.root().text().replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function prepareEmailBody(content: string, contentType: "plain" | "html", attachments: EmailAttachment[]) {
  const html = contentType === "html" ? sanitizeBulkEmailHtml(inlineImageSources(content, attachments)) : undefined;
  return {
    content: html === undefined ? content : emailHtmlToText(html),
    ...(html === undefined ? {} : { html }),
    ...(attachments.length ? { attachments: attachments.map(({ assetId: _assetId, cid, ...file }) => {
      const inline = Boolean(cid && html?.includes(`src="cid:${cid}"`));
      return { ...file, ...(inline ? { cid, contentDisposition: "inline" } : { contentDisposition: "attachment" }) };
    }) } : {}),
  };
}
