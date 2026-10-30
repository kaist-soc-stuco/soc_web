const assert = require("node:assert/strict");
const test = require("node:test");
const { ArticleCreateSchema, ArticleUpdateSchema, resolveFaqCategory, Permissions } = require("@soc/contracts");
const { ArticleService } = require("../dist/apps/api/src/features/board/article.service.js");

test("FAQ categories preserve legacy groups and prefer an explicitly selected category", () => {
  assert.equal(resolveFaqCategory({ titleKo: "과비는 어떻게 납부하나요?" }), "fees");
  assert.equal(resolveFaqCategory({ titleKo: "제목을 변경한 질문", faqCategory: "account" }), "account");
  assert.equal(resolveFaqCategory({ titleKo: "과비는 어떻게 납부하나요?", faqCategory: "events-surveys" }), "events-surveys");
  assert.equal(resolveFaqCategory({ titleKo: "새 질문" }), "other");
  assert.equal(resolveFaqCategory({ titleKo: "비밀 건의사항과 공식 답변은 누가 볼 수 있나요?" }), "communication");
  assert.equal(resolveFaqCategory({ titleKo: "졸업 요건과 교과목 이수 순서는 어디서 확인하나요?" }), "academics");
  assert.equal(resolveFaqCategory({ titleKo: "기업 후원이나 제휴를 제안하려면 어떻게 하나요?" }), "council");
  assert.equal(resolveFaqCategory({ titleKo: "비밀 건의사항과 공식 답변은 누가 볼 수 있나요?", faqCategory: "account" }), "account");
});

test("FAQ category survives request validation and unknown categories are rejected", () => {
  assert.equal(ArticleCreateSchema.parse({ titleKo: "질문", contentKo: "답변", visibilityScope: "PUBLIC", faqCategory: "fees" }).faqCategory, "fees");
  assert.deepEqual(ArticleUpdateSchema.parse({ faqCategory: "account" }), { faqCategory: "account" });
  for (const faqCategory of ["communication", "academics", "council"]) {
    assert.equal(ArticleCreateSchema.parse({ titleKo: "질문", contentKo: "답변", visibilityScope: "PUBLIC", faqCategory }).faqCategory, faqCategory);
    assert.deepEqual(ArticleUpdateSchema.parse({ faqCategory }), { faqCategory });
  }
  assert.equal(ArticleUpdateSchema.safeParse({ faqCategory: "unknown" }).success, false);
});

test("FAQ creation and category-only edits pass the category to persistence", async () => {
  let created;
  let updated;
  const service = new ArticleService(
    { findByCode: async () => ({ boardId: 1, isActive: true }) },
    {
      createArticle: async (input) => { created = input; return { articleId: "1" }; },
      findPermissionInfo: async () => ({ status: "PUBLISHED" }),
      updateArticle: async (_boardId, _id, input) => { updated = input; return { articleId: "1" }; },
    },
  );
  const manager = { id: "test-manager", permission: Permissions.MANAGE_SITE_CONTENT };
  await service.createFaqArticle({ titleKo: "질문", contentKo: "답변", visibilityScope: "PUBLIC", faqCategory: "fees" }, manager);
  assert.equal(created.payload.faqCategory, "fees");
  await service.updateFaqArticle("1", { faqCategory: "events-surveys" }, manager);
  assert.deepEqual(updated, { faqCategory: "events-surveys" });
  await assert.rejects(() => service.updateFaqArticle("1", { faqCategory: "other" }, { id: "student", permission: 0 }), /insufficient_permission/);
});
