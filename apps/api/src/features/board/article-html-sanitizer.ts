import sanitizeHtml, { type IOptions } from "sanitize-html";
import { isSafeUrlReference } from "@soc/contracts";

const isSafeImageSource = (value: string | undefined) => {
  const source = value?.trim() ?? "";
  return (
    isSafeUrlReference(source, ["http:", "https:"], false) ||
    /^\/(?:api\/)?(?:v\d+\/)?assets\/\d+\/content(?:[?#].*)?$/i.test(source)
  );
};

const ARTICLE_HTML_SANITIZE_OPTIONS: IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "hr",
    "a",
    "span",
    "img",
  ],
  allowedAttributes: {
    a: [
      "href",
      { name: "target", values: ["_blank"] },
      {
        name: "rel",
        multiple: true,
        values: ["noopener", "noreferrer"],
      },
    ],
    ol: ["start"],
    span: ["style"],
    img: ["src", "alt"],
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  allowedStyles: {
    span: {
      color: [
        /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
        /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i,
      ],
      "font-size": [/^(?:14|16|18|22)px$/],
    },
  },
  parseStyleAttributes: true,
  exclusiveFilter: (frame) => frame.tag === "img" && !isSafeImageSource(frame.attribs.src),
  transformTags: {
    a: (tagName, attributes) => {
      const href = attributes.href?.trim();
      if (!href || !isSafeUrlReference(href)) {
        const { href: _href, rel: _rel, target: _target, ...withoutLink } = attributes;
        return { tagName: "span", attribs: withoutLink };
      }

      if (attributes.target === "_blank") {
        return {
          tagName,
          attribs: {
            ...attributes,
            rel: "noopener noreferrer",
          },
        };
      }

      const { rel: _rel, target: _target, ...safeAttributes } = attributes;
      return { tagName, attribs: safeAttributes };
    },
  },
};

export const sanitizeArticleHtml = (html: string): string =>
  sanitizeHtml(html, ARTICLE_HTML_SANITIZE_OPTIONS);
