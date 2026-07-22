const assert = require("node:assert/strict");
const test = require("node:test");
const { BadRequestException } = require("@nestjs/common");

const {
  ArticleService,
} = require("../dist/apps/api/src/features/board/article.service.js");

const board = {
  boardId: 1,
  isActive: true,
  managePermissionBit: 0,
  writePermissionBit: 0,
};

const createPayload = (contentKo, contentEn) => ({
  titleKo: "제목",
  contentKo,
  ...(contentEn === undefined ? {} : { contentEn }),
  visibilityScope: "PUBLIC",
});

const createServiceHarness = () => {
  const calls = {
    create: [],
    update: [],
  };
  const boardRepository = {
    findByCode: async () => board,
  };
  const articleRepository = {
    createArticle: async (input) => {
      calls.create.push(input);
      return { articleId: "1", boardId: 1, postedAt: "2026-07-15T00:00:00.000Z" };
    },
    findPermissionInfo: async () => ({
      authorUserId: "user-1",
      status: "PUBLISHED",
    }),
    updateArticle: async (boardId, articleId, payload) => {
      calls.update.push({ articleId, boardId, payload });
      return { articleId, updatedAt: "2026-07-15T00:00:00.000Z" };
    },
  };

  return {
    calls,
    service: new ArticleService(boardRepository, articleRepository),
  };
};

const assertNoExecutableHtml = (html) => {
  assert.doesNotMatch(html, /<script|<svg|<iframe|<img/i);
  assert.doesNotMatch(html, /\bon[a-z]+\s*=/i);
  assert.doesNotMatch(html, /(?:javascript|data)\s*:/i);
  assert.doesNotMatch(html, /\bstyle\s*=/i);
};

test("create sanitizes both localized article bodies before persistence", async () => {
  const { calls, service } = createServiceHarness();
  const maliciousKo = [
    '<h1 onclick="alert(1)">안전한 제목</h1>',
    '<p>본문 <strong>굵게</strong><script>alert(1)</script></p>',
    '<a href="jav&#x61;script:alert(1)" onmouseover="alert(2)">위험 링크</a>',
    '<a href="https://example.com/path" target="_blank" rel="noopener noreferrer">안전 링크</a>',
    '<img src="x" onerror="alert(3)">',
  ].join("");
  const maliciousEn =
    '<p style="background:url(javascript:alert(4))">English</p><svg><a href="javascript:alert(5)">x</a></svg>';

  await service.createArticle(
    "공지",
    createPayload(maliciousKo, maliciousEn),
    { id: "user-1", permission: 0 },
  );

  assert.equal(calls.create.length, 1);
  const stored = calls.create[0].payload;
  assertNoExecutableHtml(stored.contentKo);
  assertNoExecutableHtml(stored.contentEn);
  assert.match(stored.contentKo, /<h1>안전한 제목<\/h1>/);
  assert.match(stored.contentKo, /<strong>굵게<\/strong>/);
  assert.match(
    stored.contentKo,
    /<a href="https:\/\/example\.com\/path" target="_blank" rel="noopener noreferrer">안전 링크<\/a>/,
  );
  assert.match(stored.contentEn, /<p>English<\/p>/);
});

test("update sanitizes only supplied article bodies and preserves safe editor formatting", async () => {
  const { calls, service } = createServiceHarness();
  const safeFormatting = [
    "<h2>소제목</h2>",
    "<p>본문 <strong>굵게</strong> <em>기울임</em> <u>밑줄</u> <s>취소선</s><br>다음 줄</p>",
    "<blockquote>인용</blockquote>",
    "<ul><li>항목</li></ul>",
    "<ol><li>순서</li></ol>",
    "<pre><code>const answer = 42;</code></pre>",
    '<a href="/board/공지">내부 링크</a>',
  ].join("");

  await service.updateArticle(
    "공지",
    "1",
    {
      contentEn:
        safeFormatting +
        '<iframe srcdoc="<script>alert(1)</script>"></iframe><a href="//evil.example">protocol relative</a>',
    },
    { id: "user-1", permission: 0 },
  );

  assert.equal(calls.update.length, 1);
  const stored = calls.update[0].payload;
  assert.equal(stored.contentKo, undefined);
  assertNoExecutableHtml(stored.contentEn);
  for (const tag of [
    "h2",
    "p",
    "strong",
    "em",
    "u",
    "s",
    "br",
    "blockquote",
    "ul",
    "li",
    "ol",
    "pre",
    "code",
  ]) {
    assert.match(stored.contentEn, new RegExp(`<${tag}(?:>| )`, "i"));
  }
  assert.match(stored.contentEn, /<a href="\/board\/공지">내부 링크<\/a>/);
  assert.match(stored.contentEn, />protocol relative<\/a>/);
});

test("create rejects a required body that becomes empty after sanitization", async () => {
  const { calls, service } = createServiceHarness();

  await assert.rejects(
    service.createArticle(
      "공지",
      createPayload('<script src="https://evil.example/payload.js"></script>'),
      { id: "user-1", permission: 0 },
    ),
    (error) =>
      error instanceof BadRequestException &&
      error.message === "content_empty_after_sanitization",
  );

  assert.equal(calls.create.length, 0);
});

test("update rejects a supplied required body that becomes empty after sanitization", async () => {
  const { calls, service } = createServiceHarness();

  await assert.rejects(
    service.updateArticle(
      "공지",
      "1",
      { contentKo: "<style>body { display: none }</style>" },
      { id: "user-1", permission: 0 },
    ),
    (error) =>
      error instanceof BadRequestException &&
      error.message === "content_empty_after_sanitization",
  );

  assert.equal(calls.update.length, 0);
});
