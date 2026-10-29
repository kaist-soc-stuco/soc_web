"""Acceptance tests against the disposable product QA stack (never a live site)."""
from __future__ import annotations

import argparse
import base64
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys
import time
import traceback
from urllib.parse import urlsplit
from urllib.request import urlopen
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/security_qa"))
import browser_security_e2e as auth  # noqa: E402

ARTIFACTS = ROOT / "output/product-e2e"


class AcceptanceSuite:
    def __init__(self, browser, app_url: str):
        self.browser = browser
        self.base = app_url
        self.contexts = {}
        self.pages = []
        self.page_errors = []
        self.marker = "QA-" + uuid4().hex[:8]
        auth.BASE_URL = app_url

    def page(self, actor="admin"):
        first_visit = actor not in self.contexts
        if first_visit:
            context = self.browser.new_context(viewport={"width": 1440, "height": 1000}, locale="ko-KR", timezone_id="Asia/Seoul")
            context.set_default_timeout(20000)
            context.set_default_navigation_timeout(45000)
            context.tracing.start(screenshots=True, snapshots=True)
            self.contexts[actor] = context
        page = self.contexts[actor].new_page()
        self.pages.append(page)
        page.on("pageerror", lambda error: self.page_errors.append(str(error)))
        if first_visit and actor != "guest":
            profile = "new" if actor == "other" else actor
            auth.login(page, profile, consent=profile != "new")
        else:
            page.goto(self.base)
        return page

    def api(self, page, path, method="GET", body=None, status=200):
        result = auth.api_json(page, "/api" + path, method=method, body=body)
        assert result["status"] == status, f"{method} {path}: expected {status}, got {result['status']}: {result['body']}"
        return result["body"]

    def editor(self, page, path, title):
        page.goto(self.base + path)
        title_input = page.locator("input[data-editor-title]:visible").first
        expect(title_input).to_be_visible()
        title_input.fill(title)
        return page.locator('.ProseMirror[contenteditable="true"]:visible').first

    def publish_article(self, page, code):
        with page.expect_response(lambda response: response.request.method == "POST" and urlsplit(response.url).path == f"/api/boards/{code}/articles", timeout=30000) as saved:
            page.get_by_role("button", name="등록", exact=True).first.click()
        response = saved.value
        assert response.status == 201, f"article publication failed: {response.status} {response.text()}"
        article = response.json()
        page.wait_for_url(re.compile(r"/(?:events|board/[^/]+)/" + str(article["articleId"]) + r"$"))
        return article["articleId"]

    def test_auth_consent_and_permissions(self):
        admin = self.page()
        assert self.api(admin, "/auth/session")["authenticated"]
        student = self.page("student")
        self.api(student, "/surveys", status=403)
        # The request is otherwise valid; permission checks must reject it.
        self.api(student, "/boards/_EVENT/articles", method="POST", status=403,
                 body={"titleKo": "Unauthorized event", "contentKo": "<p>Blocked</p>", "visibilityScope": "PUBLIC"})
        self.api(student, "/surveys", method="POST", status=403,
                 body={"titleKo": "Unauthorized survey", "isAlwaysOpen": True})
        temporary = self.page("new")
        assert self.api(temporary, "/auth/session")["storageMode"] == "temporary"
        auth.logout(temporary)
        assert not self.api(temporary, "/auth/session")["authenticated"]
        # A previously registered user must also be able to log back in without
        # being trapped waiting for a consent dialog that is no longer shown.
        auth.logout(student)
        assert auth.login(student, "student", consent=True)["storageMode"] == "persisted"

    def test_editor_title_lock_and_clear_formatting(self):
        page = self.page()
        title = self.marker + " 서식 제거 확인"
        editor = self.editor(page, "/board/notice/write", title)
        title_input = page.locator("input[data-editor-title]:visible").first
        title_input.focus()
        expect(page.get_by_role("button", name="굵게 (Ctrl+B)", exact=True)).to_be_disabled()
        title_input.press("Control+b")
        expect(title_input).to_have_value(title)
        assert title_input.evaluate("node => node.tagName === 'INPUT' && !node.isContentEditable")
        editor.click()
        page.get_by_role("button", name="굵게 (Ctrl+B)", exact=True).click()
        page.get_by_role("button", name="기울임 (Ctrl+I)", exact=True).click()
        editor.press_sequentially("서식을 지워도 남아야 하는 본문")
        expect(editor.locator("strong em, em strong")).to_have_count(1)
        editor.press("Control+a")
        page.get_by_role("button", name="더보기", exact=True).click()
        page.get_by_role("menuitem", name="서식 지우기", exact=True).click()
        expect(editor.locator("strong,em,u,s,[style]")).to_have_count(0)
        expect(editor).to_contain_text("서식을 지워도 남아야 하는 본문")
        expect(title_input).to_have_value(title)
        article_id = self.publish_article(page, "notice")
        persisted = self.api(page, f"/boards/notice/articles/{article_id}")
        assert persisted["titleKo"] == title
        assert "<strong>" not in persisted["contentKo"] and "남아야 하는 본문" in persisted["contentKo"]

    def test_editor_image_and_formatting_round_trip(self):
        page = self.page()
        title = self.marker + " 본문 중간 이미지"
        editor = self.editor(page, "/board/notice/write", title)
        editor.fill("이미지 앞 문단")
        editor.press("End")
        editor.press("Enter")
        page.get_by_role("button", name="굵게 (Ctrl+B)", exact=True).click()
        page.get_by_role("button", name="기울임 (Ctrl+I)", exact=True).click()
        page.get_by_role("button", name="밑줄 (Ctrl+U)", exact=True).click()
        editor.press_sequentially("서식 유지 문단")
        editor.press("Enter")
        for label in ["굵게 (Ctrl+B)", "기울임 (Ctrl+I)", "밑줄 (Ctrl+U)"]:
            page.get_by_role("button", name=label, exact=True).click()
        image = ARTIFACTS / "inline-fixture.png"
        image.write_bytes(base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jB1sAAAAASUVORK5CYII="))
        with page.expect_file_chooser() as chooser:
            page.get_by_role("button", name="이미지 삽입", exact=True).click()
        chooser.value.set_files(image)
        expect(editor.locator("img")).to_have_count(1)
        expect(editor.locator("img")).to_have_attribute("src", re.compile(r"/api/assets/"))
        editor.press("Control+End")
        editor.press("ArrowDown")
        editor.press("Enter")
        editor.press_sequentially("이미지 뒤 문단")
        editor.press("Enter")
        page.get_by_role("button", name="글머리 기호 목록", exact=True).click()
        editor.press_sequentially("첫 번째 목록")
        editor.press("Enter")
        editor.press_sequentially("두 번째 목록")
        editor.press("Enter")
        editor.press("Enter")
        page.get_by_role("button", name="링크 삽입", exact=True).click()
        link_dialog = page.get_by_role("dialog", name="링크 추가", exact=True)
        link_dialog.get_by_role("textbox", name="표시할 텍스트", exact=True).fill("참고 링크")
        link_dialog.get_by_role("textbox", name="링크 URL", exact=True).fill("https://example.com/qa")
        link_dialog.get_by_role("button", name="적용", exact=True).click()
        expect(editor).to_contain_text("이미지 뒤 문단")
        article_id = self.publish_article(page, "notice")
        article = self.api(page, f"/boards/notice/articles/{article_id}")
        html = article["contentKo"]
        assert html.index("이미지 앞 문단") < html.index("<img") < html.index("이미지 뒤 문단"), html
        assert all(tag in html for tag in ["<strong>", "<em>", "<u>", "<ul>", "<li>"]), html
        assert 'href="https://example.com/qa"' in html
        image_url = re.search(r'<img[^>]+src="([^"]+)"', html).group(1)
        page.reload()
        body = page.locator(".rich-content").filter(has=page.locator("img")).first
        expect(body).to_contain_text("이미지 앞 문단")
        expect(body.locator("img")).to_have_count(1)
        expect(page.locator(f'img[src$="{image_url}"]')).to_have_count(1)
        page.wait_for_function("url => Array.from(document.images).some(image => image.src.endsWith(url) && image.complete && image.naturalWidth > 0)", arg=image_url)
        assert page.request.get(self.base + image_url).status == 200
        # Load the actual edit form and save again, rather than just inspecting
        # the same in-memory editor that produced the original HTML.
        page.goto(self.base + f"/board/notice/{article_id}/edit")
        editor = page.locator('.ProseMirror[contenteditable="true"]:visible').first
        expect(editor.locator("img")).to_have_count(1)
        editor.locator("p").last.click()
        editor.press("End")
        editor.press("Enter")
        editor.press_sequentially("수정 후 유지")
        with page.expect_response(lambda r: r.request.method == "PATCH" and urlsplit(r.url).path == f"/api/boards/notice/articles/{article_id}") as edited:
            page.get_by_role("button", name="수정", exact=True).first.click()
        assert edited.value.status == 200
        page.wait_for_url(self.base + f"/board/notice/{article_id}")
        expect(page.locator(".rich-content").filter(has=page.locator("img")).first).to_contain_text("수정 후 유지")
        saved = self.api(page, f"/boards/notice/articles/{article_id}")["contentKo"]
        assert saved.index("이미지 앞 문단") < saved.index("<img") < saved.index("이미지 뒤 문단") < saved.index("수정 후 유지"), saved
        assert saved.count("<img") == 1 and all(tag in saved for tag in ["<strong>", "<em>", "<u>", "<ul>", "<li>"])
        assert 'href="https://example.com/qa"' in saved

    def test_event_creation_and_public_visibility(self):
        page = self.page()
        title = self.marker + " 행사 작성"
        editor = self.editor(page, "/events/write", title)
        editor.fill("참여 방법과 행사 안내 본문")
        page.get_by_role("checkbox", name="상시 진행", exact=True).check()
        page.get_by_role("textbox", name="행사 장소", exact=True).fill("N1 전산학부 라운지")
        page.get_by_role("textbox", name="카드 요약 설명", exact=True).fill("함께 만드는 행사")
        article_id = self.publish_article(page, "_EVENT")
        guest = self.page("guest")
        article = self.api(guest, f"/boards/_EVENT/articles/{article_id}")
        assert article["titleKo"] == title and "참여 방법" in article["contentKo"]
        assert article["eventLocation"] == "N1 전산학부 라운지"
        guest.goto(self.base + "/events?q=" + title)
        expect(guest.get_by_text(title, exact=True)).to_be_visible()
        guest.get_by_text(title, exact=True).click()
        expect(guest.get_by_role("heading", name=title, exact=True)).to_be_visible()

    def test_secret_suggestion_author_and_admin_only(self):
        student = self.page("student")
        title = self.marker + " 비밀 건의"
        editor = self.editor(student, "/board/suggestions/write", title)
        editor.fill("다른 사용자에게 노출되면 안 되는 건의 본문")
        secret = student.get_by_role("checkbox", name="비밀글로 작성", exact=True)
        expect(secret).to_be_visible()
        student.set_viewport_size({"width": 390, "height": 844})
        expect(secret).to_be_hidden()
        student.locator(".board-write-settings > summary").click()
        secret.check()
        student.set_viewport_size({"width": 1440, "height": 1000})
        expect(secret).to_be_visible()
        expect(secret).to_be_checked()
        article_id = self.publish_article(student, "suggestions")
        path = f"/boards/suggestions/articles/{article_id}"
        assert self.api(student, path)["isSecret"] is True
        admin = self.page()
        assert self.api(admin, path)["titleKo"] == title
        guest = self.page("guest")
        result = auth.api_json(guest, "/api" + path)
        assert result["status"] in (401, 403, 404), result
        assert "노출되면 안 되는" not in json.dumps(result, ensure_ascii=False)
        other = self.page("other")
        result = auth.api_json(other, "/api" + path)
        assert result["status"] in (403, 404), result
        assert "노출되면 안 되는" not in json.dumps(result, ensure_ascii=False)

    def test_event_date_time_round_trip(self):
        page = self.page()
        editor = self.editor(page, "/events/write", self.marker + " 행사 일정")
        editor.fill("날짜와 시간을 지정한 행사")
        today = page.evaluate("new Date().toLocaleDateString('sv-SE')")
        for label, hour, minute in [("시작", "14", "30"), ("종료", "16", "45")]:
            page.get_by_role("button", name=label + " 날짜", exact=True).click()
            page.locator('button[data-today="true"]').click()
            page.get_by_role("button", name=re.compile("^" + label + " 시간(?::|$)")).click()
            page.get_by_role("listbox", name="시", exact=True).get_by_role("option", name=hour, exact=True).click()
            page.get_by_role("listbox", name="분", exact=True).get_by_role("option", name=minute, exact=True).click()
            page.keyboard.press("Escape")
        expect(page.locator("#event-start-date")).to_have_value(today + "T14:30")
        expect(page.locator("#event-end-date")).to_have_value(today + "T16:45")
        page.get_by_role("button", name="등록", exact=True).first.click()
        expect(page.get_by_text("행사 일정 또는 상시 여부, 그리고 간단한 설명은 필수입니다.", exact=True)).to_be_visible()
        page.get_by_role("textbox", name="카드 요약 설명", exact=True).fill("일정을 지정한 행사 안내")
        page.get_by_role("textbox", name="행사 장소", exact=True).fill("N1 강의실")
        article_id = self.publish_article(page, "_EVENT")
        article = self.api(page, f"/boards/_EVENT/articles/{article_id}")
        kst = timezone(timedelta(hours=9))
        for key, expected in [("eventStartDate", "14:30"), ("eventEndDate", "16:45")]:
            stored = datetime.fromisoformat(article[key].replace("Z", "+00:00")).astimezone(kst)
            assert stored.strftime("%Y-%m-%dT%H:%M") == today + "T" + expected, article

    def test_survey_create_publish_and_respond(self):
        admin = self.page()
        title = self.marker + " 설문 작성"
        admin.goto(self.base + "/admin/surveys/new")
        admin.get_by_role("textbox", name="국문 섹션 제목", exact=True).fill(title)
        admin.get_by_role("textbox", name="영문 섹션 제목", exact=True).fill("Acceptance survey")
        admin.get_by_role("textbox", name="국문 섹션 설명", exact=True).fill("직접 생성한 설문의 게시 및 응답 확인")
        admin.get_by_role("textbox", name="국문 질문", exact=True).fill("가장 필요한 개선은 무엇인가요?")
        admin.get_by_role("textbox", name="영문 질문", exact=True).fill("What should improve?")
        expect(admin.get_by_role("checkbox", name="필수 입력란입니다", exact=True)).to_be_checked()
        admin.wait_for_url(re.compile(r"/admin/surveys/[0-9a-f-]+/edit"), timeout=30000)
        survey_id = re.search(r"/surveys/([0-9a-f-]+)/edit", admin.url).group(1)
        guest = self.page("guest")
        draft_list = self.api(guest, "/surveys/list/public?page=1&pageSize=50&q=" + title)
        assert not any(item["id"] == survey_id for item in draft_list["items"]), draft_list
        admin.get_by_role("button", name="질문 추가", exact=True).click()
        # Adding a question awaits create + reorder requests; until they settle,
        # the previous question's editor is still on screen.
        expect(admin.get_by_role("textbox", name="국문 질문", exact=True)).to_have_text("질문")
        admin.get_by_role("textbox", name="국문 질문", exact=True).fill("참여하고 싶은 활동은 무엇인가요?")
        admin.get_by_role("textbox", name="영문 질문", exact=True).fill("Which activity?")
        admin.get_by_role("button", name="질문 유형", exact=True).click()
        admin.get_by_role("option", name="객관식 질문", exact=True).click()
        admin.get_by_role("textbox", name="1번 국문 옵션", exact=True).fill("학부 행사")
        admin.get_by_role("textbox", name="1번 영문 옵션", exact=True).fill("Events")
        admin.get_by_role("textbox", name="선택지 추가", exact=True).focus()
        admin.get_by_role("textbox", name="2번 국문 옵션", exact=True).fill("학습 모임")
        admin.get_by_role("textbox", name="2번 영문 옵션", exact=True).fill("Study group")
        pending_autosave = []
        question_save_pattern = "**/api/surveys/" + survey_id + "/sections/*/questions/*"
        def hold_question_save(route):
            if (route.request.method == "PATCH" and re.search(r"/questions/[0-9a-f-]+$", urlsplit(route.request.url).path)
                    and not pending_autosave):
                pending_autosave.append(route)
            else:
                route.continue_()
        admin.route(question_save_pattern, hold_question_save)
        admin.get_by_text("필수 입력란입니다", exact=True).click()
        expect(admin.get_by_role("checkbox", name="필수 입력란입니다", exact=True)).to_be_checked()
        admin.get_by_role("tab", name="설정", exact=True).click()
        admin.get_by_role("checkbox", name="상시 설문", exact=True).check()
        deadline = time.monotonic() + 10
        while not pending_autosave and time.monotonic() < deadline:
            admin.wait_for_timeout(25)
        assert pending_autosave, "The question autosave did not start"
        admin.get_by_role("button", name="게시", exact=True).click()
        # Let the real request reach the API only after clicking Publish. This
        # reproduces the autosave/commit race without replacing server responses.
        pending_autosave[0].continue_()
        admin.unroute(question_save_pattern, hold_question_save)
        admin.wait_for_url(re.compile(r"/admin/surveys/[0-9a-f-]+/edit"), timeout=30000)
        survey_id = re.search(r"/surveys/([0-9a-f-]+)/edit", admin.url).group(1)
        expect(admin.get_by_role("button", name="게시됨", exact=True)).to_be_visible()
        definition = self.api(admin, f"/surveys/{survey_id}")
        assert definition["isPublished"] is True, definition
        questions = [question for section in definition["sections"] for question in section["questions"]]
        assert len(questions) == 2 and all(question["isRequired"] for question in questions), questions
        assert {question["questionType"] for question in questions} == {"short_text", "single_choice"}, questions
        student = self.page("student")
        student.goto(self.base + f"/survey/{survey_id}")
        student.get_by_role("button", name="제출", exact=True).click()
        expect(student.get_by_text("필수 질문입니다", exact=False).first).to_be_visible()
        self.api(student, f"/surveys/{survey_id}/responses", method="POST", body={"answers": []}, status=400)
        student.locator("main input[type=text]:visible, main textarea:visible").first.fill("공용 공간 개선")
        student.get_by_text("학부 행사", exact=True).click()
        expect(student.locator('input[type="radio"]:checked')).to_have_count(1)
        with student.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == f"/api/surveys/{survey_id}/responses") as submitted:
            student.get_by_role("button", name="제출", exact=True).click()
        assert submitted.value.status == 201, submitted.value.text()
        submitted_answers = submitted.value.request.post_data_json
        self.api(student, f"/surveys/{survey_id}/responses", method="POST", body=submitted_answers, status=409)
        self.api(student, f"/surveys/{survey_id}/analytics", status=403)
        self.api(student, f"/surveys/{survey_id}/responses", status=403)
        responses = self.api(admin, f"/surveys/{survey_id}/responses")
        assert responses["total"] == 1, responses
        student.reload()
        expect(student.get_by_text("이미 참여한 설문입니다", exact=True)).to_be_visible()
        student.goto(self.base + f"/survey/{survey_id}/results")
        expect(student.get_by_text("결과가 공개되지 않은 설문입니다", exact=True)).to_be_visible()
        expect(student.get_by_text("공용 공간 개선", exact=True)).to_have_count(0)
        guest = self.page("guest")
        public = self.api(guest, "/surveys/list/public?page=1&pageSize=50&q=" + title)
        assert any(item["id"] == survey_id for item in public["items"]), public
        guest.goto(self.base + f"/survey/{survey_id}")
        expect(guest.get_by_text("로그인이 필요한 설문입니다", exact=True)).to_be_visible()

    def close(self):
        for context in self.contexts.values():
            context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--app-url", default="http://127.0.0.1:38765")
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--only", help="Run one test during local debugging")
    args = parser.parse_args()
    if args.app_url != "http://127.0.0.1:38765":
        raise SystemExit("Only the disposable loopback fixture is allowed.")
    health = json.load(urlopen(args.app_url + "/__local-sso/health", timeout=5))
    assert health.get("kind") == "synthetic-local-sso"
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    expect.set_options(timeout=15000)
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.headed)
        suite = AcceptanceSuite(browser, args.app_url)
        names = [name for name in AcceptanceSuite.__dict__ if name.startswith("test_") and (not args.only or args.only in name)]
        if not names:
            raise SystemExit("No matching acceptance test")
        for name in names:
            print(f"RUN {name}", flush=True)
            started = time.monotonic()
            error = None
            suite.page_errors.clear()
            try:
                getattr(suite, name)()
                assert not suite.page_errors, "Unhandled browser errors: " + "\n".join(suite.page_errors)
            except Exception:
                error = traceback.format_exc()
                print(error, flush=True)
                for index, page in enumerate(suite.pages):
                    try:
                        page.screenshot(path=str(ARTIFACTS / f"{name}-{index}.png"), full_page=True)
                    except Exception:
                        pass
            for actor, context in suite.contexts.items():
                context.tracing.stop(**({"path": str(ARTIFACTS / f"{name}-{actor}.zip")} if error else {}))
                if not error:
                    context.tracing.start(screenshots=True, snapshots=True)
            for page in suite.pages:
                page.close()
            suite.pages.clear()
            if error:
                suite.close()
                suite.contexts.clear()
            results.append({"test": name, "status": "failed" if error else "passed", "seconds": round(time.monotonic() - started, 2), "error": error})
            (ARTIFACTS / "report.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"{'FAIL' if error else 'PASS'} {name}", flush=True)
        suite.close()
        browser.close()
    (ARTIFACTS / "report.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    if any(result["status"] != "passed" for result in results):
        raise SystemExit(1)


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    main()
