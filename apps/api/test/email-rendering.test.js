const assert = require("node:assert/strict");
const test = require("node:test");
const { load } = require("cheerio");
const { prepareEmailBody, renderBulkEmailTemplate, sanitizeBulkEmailHtml } = require("../dist/apps/api/src/features/email/email-rendering.js");
const { BulkEmailService } = require("../dist/apps/api/src/features/email/bulk-email.service.js");

const image = { assetId: "12", filename: "poster.png", content: Buffer.from("synthetic-image"), contentType: "image/png", cid: "soc-asset-12" };
const file = { assetId: "13", filename: "안내.pdf", content: Buffer.from("synthetic-pdf"), contentType: "application/pdf" };

test("email HTML keeps editor formatting and safe links while dropping executable HTML and CSS", () => {
  const $ = load(sanitizeBulkEmailHtml(`<p><span style="color:#008855;background-color:rgb(255, 240, 0);font-size:24px;position:fixed;background-image:url(javascript:bad)">서식</span> <strong>굵게</strong><em>기울임</em><u>밑줄</u><s>취소선</s></p><ol start="3"><li>목록</li></ol><table><tr><td colspan="2" style="text-align:center">셀</td></tr></table><a href="https://example.invalid/?q=1&amp;r=2">링크</a><a href="javascript:alert(1)">위험</a><script>alert(1)</script><img src="cid:soc-asset-12" onerror="bad()">`), null, false);
  assert.equal($("strong").text(), "굵게");
  assert.equal($("em").text(), "기울임");
  assert.equal($("u").text(), "밑줄");
  assert.equal($("s").text(), "취소선");
  assert.equal($("span").css("color"), "#008855");
  assert.equal($("span").css("font-size"), "24px");
  assert.match($("span").css("background-color"), /rgb/);
  assert.equal($("span").css("position"), undefined);
  assert.equal($("span").css("background-image"), undefined);
  assert.equal($("ol").attr("start"), "3");
  assert.equal($("td").attr("colspan"), "2");
  assert.equal($("a").first().attr("href"), "https://example.invalid/?q=1&r=2");
  assert.equal($("a").last().attr("href"), undefined);
  assert.equal($("script").length, 0);
  assert.equal($("img").attr("src"), "cid:soc-asset-12");
  assert.equal($("img").attr("onerror"), undefined);
  const custom = load(sanitizeBulkEmailHtml('<p style="margin-bottom:24px">간격</p><img src="https://example.invalid/a.png" style="margin-left:auto;margin-right:auto;height:80px">'), null, false);
  assert.equal(custom("p").css("margin-bottom"), "24px");
  assert.equal(custom("img").css("margin-left"), "auto");
  assert.equal(custom("img").css("height"), "80px");
});

test("body images retain size and alignment and are embedded separately from normal attachments", () => {
  const unusedImage = { ...image, assetId: "123", cid: "soc-asset-123", filename: "attachment.png" };
  const body = prepareEmailBody('<p>본문</p><img src="/api/assets/12/content" width="320" data-align="center" alt="포스터"><a href="asset:12">그대로</a><p>asset:12</p>', "html", [image, file, unusedImage]);
  const $ = load(body.html, null, false);
  assert.equal($("img").attr("src"), "cid:soc-asset-12");
  assert.equal($("img").attr("width"), "320");
  assert.equal($("img").css("margin-left"), "auto");
  assert.equal($("img").css("margin-right"), "auto");
  assert.equal($("img").css("max-width"), "100%");
  assert.equal($("img").attr("data-align"), undefined);
  assert.ok($("p").last().text().includes("asset:12"));
  assert.equal(body.attachments[0].cid, image.cid);
  assert.equal(body.attachments[0].contentDisposition, "inline");
  assert.equal(body.attachments[1].contentDisposition, "attachment");
  assert.equal(body.attachments[1].filename, "안내.pdf");
  assert.deepEqual(body.attachments[1].content, file.content);
  assert.equal(body.attachments[2].cid, undefined);
  assert.equal(body.attachments[2].contentDisposition, "attachment");
});

test("image matching uses complete asset IDs and accepts actual content URLs", () => {
  for (const source of ["asset:12", "/api/v1/assets/12/content", "https://example.invalid/api/assets/12/content?download=1"]) {
    const body = prepareEmailBody(`<img src="${source}">`, "html", [image]);
    assert.equal(load(body.html)("img").attr("src"), "cid:soc-asset-12");
  }
  const body = prepareEmailBody('<img src="asset:123">', "html", [image]);
  assert.equal(body.attachments[0].cid, undefined);
});

test("HTML fallback text preserves paragraphs, breaks, list entries, image descriptions and link targets", () => {
  const body = prepareEmailBody('<p>첫 문단<br>다음 줄</p><p>둘째 문단</p><ul><li>항목 1</li><li>항목 2</li></ul><a href="https://example.invalid/form">신청하기</a><img src="https://example.invalid/image.png" alt="포스터 &amp; 안내">', "html", []);
  assert.match(body.content, /첫 문단\n다음 줄\n둘째 문단/);
  assert.match(body.content, /• 항목 1\n• 항목 2/);
  assert.match(body.content, /신청하기 \(https:\/\/example.invalid\/form\)/);
  assert.match(body.content, /포스터 & 안내/);
  assert.equal(prepareEmailBody('<ol start="3"><li>셋째</li><li>넷째</li></ol>', "html", []).content, "3. 셋째\n4. 넷째");
});

test("personalization preserves literal special characters without treating replacement values as templates", () => {
  const recipient = { nameKo: 'A & B <팀> "이름" {이메일}', studentNumber: "20260001", email: "student@example.invalid" };
  const template = "{{이름}} / {학번} / {{ 이메일 }}";
  assert.equal(renderBulkEmailTemplate(template, recipient), `${recipient.nameKo} / 20260001 / student@example.invalid`);
  const html = renderBulkEmailTemplate(`<p>${template}</p>`, recipient, true);
  assert.equal(load(html)("p").text(), `${recipient.nameKo} / 20260001 / student@example.invalid`);
  assert.equal(load(html)("팀").length, 0);
  assert.equal(renderBulkEmailTemplate("{{학번}}", { ...recipient, studentNumber: null }), "");
});

test("plain mail keeps newlines and image files remain downloadable attachments", () => {
  const body = prepareEmailBody("첫 줄\n둘째 줄 <literal>", "plain", [image]);
  assert.equal(body.content, "첫 줄\n둘째 줄 <literal>");
  assert.equal(body.html, undefined);
  assert.equal(body.attachments[0].cid, undefined);
  assert.equal(body.attachments[0].contentDisposition, "attachment");
});

test("personalized delivery sends each recipient their own subject and safe HTML with valid message IDs", async () => {
  const service = Object.create(BulkEmailService.prototype);
  const sent = [];
  service.emailDeliveryService = { send: async input => { sent.push(input); return { dryRun: true, acceptedCount: 1 }; } };
  await service.deliverPersonalized([
    { nameKo: "A & B", studentNumber: "20260001", email: "a@example.invalid" },
    { nameKo: "C <팀>", studentNumber: "20260002", email: "b@example.invalid" },
  ], { subject: "{{이름}} {{학번}}", content: '<p>{{이름}} / {{학번}}</p><img src="asset:12">', contentType: "html" }, [image, file], "<synthetic@example.invalid>");
  assert.equal(sent[0].subject, "A & B 20260001");
  assert.equal(sent[1].subject, "C <팀> 20260002");
  assert.equal(load(sent[1].html)("p").text(), "C <팀> / 20260002");
  assert.deepEqual(sent.map(item => item.recipients), [["a@example.invalid"], ["b@example.invalid"]]);
  assert.deepEqual(sent.map(item => item.messageId), ["<synthetic.1@example.invalid>", "<synthetic.2@example.invalid>"]);
  assert.equal(sent[1].attachments[0].cid, "soc-asset-12");
});
