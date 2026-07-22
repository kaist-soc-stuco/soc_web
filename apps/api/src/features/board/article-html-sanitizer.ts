import sanitizeHtml, { type IOptions } from "sanitize-html";

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
  },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  allowProtocolRelative: false,
  parseStyleAttributes: false,
  transformTags: {
    a: (tagName, attributes) => {
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
