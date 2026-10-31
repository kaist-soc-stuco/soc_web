"""Acceptance tests against the disposable product QA stack (never a live site)."""
from __future__ import annotations

import argparse
import base64
import csv
import io
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import re
import sys
import time
import traceback
import zipfile
import xml.etree.ElementTree as ET
from urllib.parse import urlsplit
from urllib.request import urlopen
from uuid import uuid4

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "tools/security_qa"))
import browser_security_e2e as auth  # noqa: E402

ARTIFACTS = ROOT / "output/product-e2e"
SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"


def xlsx_rows(path):
    """Read actual downloaded workbooks without adding another Excel dependency."""
    with zipfile.ZipFile(path) as book:
        strings = []
        if "xl/sharedStrings.xml" in book.namelist():
            strings = ["".join(item.itertext()) for item in ET.fromstring(book.read("xl/sharedStrings.xml"))]
        rows = []
        for row in ET.fromstring(book.read("xl/worksheets/sheet1.xml")).findall(f".//{{{SHEET_NS}}}row"):
            values = []
            for cell in row:
                column = 0
                for letter in re.match(r"[A-Z]+", cell.attrib["r"]).group():
                    column = column * 26 + ord(letter) - 64
                while len(values) < column:
                    values.append("")
                value = cell.find(f"{{{SHEET_NS}}}v")
                text = (value.text or "") if value is not None else ""
                if cell.get("t") == "inlineStr":
                    text = "".join(cell.find(f"{{{SHEET_NS}}}is").itertext())
                values[column - 1] = strings[int(text)] if cell.get("t") == "s" else text
            rows.append(values)
        return rows


def write_xlsx(path, rows):
    """Create small Unicode workbook fixtures using only the standard library."""
    ET.register_namespace("", SHEET_NS)
    sheet = ET.Element(f"{{{SHEET_NS}}}worksheet")
    ET.SubElement(sheet, f"{{{SHEET_NS}}}dimension", {"ref": f"A1:{chr(64 + max(map(len, rows)))}{len(rows)}"})
    data = ET.SubElement(sheet, f"{{{SHEET_NS}}}sheetData")
    for row_index, values in enumerate(rows, 1):
        row = ET.SubElement(data, f"{{{SHEET_NS}}}row", {"r": str(row_index)})
        for column, value in enumerate(values):
            cell = ET.SubElement(row, f"{{{SHEET_NS}}}c", {"r": f"{chr(65 + column)}{row_index}", "t": "inlineStr"})
            inline = ET.SubElement(cell, f"{{{SHEET_NS}}}is")
            ET.SubElement(inline, f"{{{SHEET_NS}}}t").text = str(value) if value is not None else ""
    parts = {
        "[Content_Types].xml": '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
        "_rels/.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
        "xl/workbook.xml": f'<workbook xmlns="{SHEET_NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
        "xl/_rels/workbook.xml.rels": '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        "xl/worksheets/sheet1.xml": ET.tostring(sheet, encoding="utf-8", xml_declaration=True),
    }
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as workbook:
        for name, contents in parts.items():
            workbook.writestr(name, contents)


class AcceptanceSuite:
    context_options = {"viewport": {"width": 1440, "height": 1000}, "locale": "ko-KR", "timezone_id": "Asia/Seoul"}

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
            context = self.browser.new_context(**self.context_options)
            context.set_default_timeout(20000)
            context.set_default_navigation_timeout(45000)
            context.tracing.start(screenshots=True, snapshots=True)
            self.contexts[actor] = context
        page = self.contexts[actor].new_page()
        self.pages.append(page)
        page.on("pageerror", lambda error: self.page_errors.append(str(error)))
        page.on("console", lambda message: self.page_errors.append(message.text) if message.type == "error" and "React Router caught the following error" in message.text else None)
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

    def field(self, scope, label):
        return scope.get_by_role("group", name=label, exact=True).get_by_role("textbox")

    def publish_article(self, page, code):
        with page.expect_response(lambda response: response.request.method == "POST" and urlsplit(response.url).path == f"/api/boards/{code}/articles", timeout=30000) as saved:
            page.get_by_role("button", name="등록", exact=True).first.click()
        response = saved.value
        assert response.status == 201, f"article publication failed: {response.status} {response.text()}"
        article = response.json()
        page.wait_for_url(re.compile(r"/(?:events|board/[^/]+)/" + str(article["articleId"]) + r"$"))
        return article["articleId"]

    def download_file(self, page, trigger, filename):
        with page.expect_download() as download:
            trigger.click()
        path = ARTIFACTS / f"{self.marker}-{filename}"
        download.value.save_as(path)
        return path

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

    def test_fee_export_payment_retry_and_registration(self):
        admin, student = self.page(), self.page("student")
        admin.goto(self.base + "/admin/finance")
        grid = admin.get_by_role("grid", name="과비 납부 관리표", exact=True)
        expect(grid).to_be_visible()
        exported = self.download_file(admin, admin.get_by_role("button", name="전체 명부 내보내기", exact=True), "fee-export.xlsx")
        audit = self.api(admin, "/audit-logs?action=student_fee.roster.export&pageSize=1")
        assert json.loads(audit["items"][0]["payload"])["reason"] == "", audit
        rows = xlsx_rows(exported)
        assert rows[0][:6] == ["학번", "이름", "입학 연도", "비고", "가입 일시", "누적 수납액"], rows[0]
        note = self.marker + " 기초자료 확인"
        current = next(row for row in self.api(admin, "/users/fee-status/roster")["records"] if row["stdNo"] == "90990002")
        self.api(admin, "/users/fee-status/roster", method="PUT", body={"records": [
            {"stdNo": "90990002", "nameKo": current["nameKo"], "admissionYear": 2026, "paidSemesters": 0, "paidAmount": 0, "note": note, "expectedUpdatedAt": current["updatedAt"]},
            {"stdNo": "90990003", "nameKo": "합성 미가입 신청자", "admissionYear": 2026, "paidSemesters": 1, "paidAmount": 10000, "note": self.marker, "expectedUpdatedAt": None},
        ]})
        admin.reload()
        roster_path = "/users/fee-status/roster"
        roster = self.api(admin, roster_path)["records"]
        member = next(row for row in roster if row["stdNo"] == "90990002")
        applicant = next(row for row in roster if row["stdNo"] == "90990003")
        assert member["note"] == note and applicant["userId"] is None, (member, applicant)
        assert applicant["paidAmount"] == 10000 and applicant["status"] == "PARTIAL", applicant
        self.api(student, roster_path, status=403)
        self.api(student, roster_path + "/export.xlsx", status=403)
        search = admin.get_by_role("searchbox", name="납부 검색", exact=True)
        search.fill("9099000")
        row = grid.get_by_role("row").filter(has_text="90990002")
        row.get_by_role("checkbox").check()
        admin.get_by_role("button", name="선택 납부 처리 (1명)", exact=True).click()
        payment = admin.get_by_role("dialog", name="납부 내역 추가", exact=True)
        amount = payment.get_by_role("group", name="납부 금액 (원)", exact=True).get_by_role("spinbutton")
        expect(amount).to_have_value(str(member["remainingAmount"]))
        expect(amount).to_have_attribute("readonly", "")
        payment.get_by_role("button", name="취소", exact=True).click()
        self.api(admin, "/users/fee-status/payments", method="POST", body={"idempotencyKey": self.marker + "-partial-setup", "payments": [
            {"userId": member["userId"], "amount": 5000, "paymentType": "SIX_SEMESTER_LUMP_SUM", 
             "coverageSemesters": 6, "effectiveStartSemester": "2026-2", "paidAt": "2026-10-30T15:00:00.000Z", "note": self.marker}]})
        admin.reload()
        admin.get_by_role("searchbox", name="납부 검색", exact=True).fill("9099000")
        expect(row).to_contain_text("부분 납부")
        row.get_by_role("checkbox").check()
        grid.get_by_role("row").filter(has_text="90990003").get_by_role("checkbox").check()
        admin.get_by_role("button", name="선택 납부 처리 (2명)", exact=True).click()
        intercepted = []
        def lose_committed_response(route):
            response = route.fetch()
            assert response.status == 201, response.text()
            intercepted.append({"request": route.request.post_data_json, "result": response.json()})
            route.abort("failed")
        admin.route("**/api/users/fee-status/payments", lose_committed_response, times=1)
        payment.get_by_role("button", name="납부 처리", exact=True).click()
        expect(payment.get_by_role("alert")).to_contain_text("다시 시도")
        assert len(intercepted) == 1
        with admin.expect_response(lambda response: response.request.method == "POST" and urlsplit(response.url).path == "/api/users/fee-status/payments") as retried:
            payment.get_by_role("button", name="납부 처리", exact=True).click()
        assert retried.value.status == 201, retried.value.text()
        assert retried.value.request.post_data_json == intercepted[0]["request"], "UI retries must reuse the committed request key"
        expect(payment).to_be_hidden()
        admin.reload()
        for number, history_count in [("90990002", 2), ("90990003", 1)]:
            record = next(row for row in self.api(admin, roster_path)["records"] if row["stdNo"] == number)
            detail = self.api(admin, f"{roster_path}/detail/{number}")
            assert record["status"] == "PAID" and record["remainingAmount"] == 0, record
            assert len(detail["history"]) == history_count, detail
            assert sum(item["amount"] for item in detail["history"]) + record["paidAmount"] == record["totalPaidAmount"], detail
        applicant_before = self.api(admin, f"{roster_path}/detail/90990003")
        new_member = self.page("other")
        auth.login(new_member, "new", consent=True)
        applicant_after = self.api(admin, f"{roster_path}/detail/90990003")
        assert applicant_after["record"]["userId"] and applicant_after["record"]["joinedAt"]
        assert applicant_after["record"]["totalPaidAmount"] == applicant_before["record"]["totalPaidAmount"]
        assert [item["paymentId"] for item in applicant_after["history"]] == [item["paymentId"] for item in applicant_before["history"]]
        admin.reload()
        admin.get_by_role("searchbox", name="납부 검색", exact=True).fill("90990003")
        linked_row = admin.get_by_role("grid", name="과비 납부 관리표", exact=True).get_by_role("row").filter(has_text="90990003")
        expect(linked_row.get_by_role("gridcell", name="가입", exact=True)).to_be_visible()
        expect(linked_row.get_by_role("gridcell", name="완납", exact=True)).to_be_visible()
        self.api(student, "/users/fee-status/payments", method="POST", body=intercepted[0]["request"], status=403)

    def test_board_comments_replies_and_engagement_round_trip(self):
        admin, student = self.page(), self.page("student")
        title = self.marker + " 댓글과 반응"
        self.editor(admin, "/board/notice/write", title).fill("댓글·답글·추천·스크랩을 검증하는 합성 게시글")
        article_id = self.publish_article(admin, "notice")
        path = f"/boards/notice/articles/{article_id}"
        student.goto(self.base + f"/board/notice/{article_id}")
        for label in ["좋아요", "스크랩"]:
            button = student.get_by_role("button", name=label, exact=True)
            button.click()
            expect(button).to_have_attribute("aria-pressed", "true")
            if label == "좋아요":
                expect(button).to_contain_text("1")
        student.reload()
        persisted = self.api(student, path)
        assert persisted["likeCount"] == 1 and persisted["scrapCount"] == 1, persisted
        for label in ["좋아요", "스크랩"]:
            button = student.get_by_role("button", name=label, exact=True)
            expect(button).to_have_attribute("aria-pressed", "true")
            button.click()
            expect(button).to_have_attribute("aria-pressed", "false")
            if label == "좋아요":
                expect(button).to_contain_text("0")
        section = student.locator("#article-comments")
        original, edited, reply = self.marker + " 원문 댓글", self.marker + " 수정 댓글", self.marker + " 남아야 하는 답글"
        section.get_by_role("textbox", name="댓글 입력", exact=True).fill(original)
        with student.expect_response(lambda response: response.request.method == "POST" and urlsplit(response.url).path == "/api" + path + "/comments") as created:
            section.get_by_role("button", name="댓글 등록", exact=True).click()
        assert created.value.status == 201, created.value.text()
        comment_id = created.value.json()["commentId"]
        row = section.get_by_role("article").filter(has_text=original)
        row.get_by_role("button", name="댓글 더보기", exact=True).click()
        student.get_by_role("menuitem", name="수정", exact=True).click()
        row.get_by_role("textbox").fill(edited)
        section.get_by_role("button", name="저장", exact=True).click()
        expect(section.get_by_text(edited, exact=True)).to_be_visible()
        other = self.page("other")
        auth.login(other, "new", consent=True)
        self.api(other, path + f"/comments/{comment_id}", method="PATCH", body={"content": "다른 사람의 수정"}, status=403)
        admin.goto(self.base + f"/board/notice/{article_id}")
        admin.locator("#article-comments").get_by_role("article").filter(has_text=edited).get_by_role("button", name="답글", exact=True).click()
        admin.get_by_role("textbox", name="대댓글 입력", exact=True).fill(reply)
        admin.get_by_role("button", name="대댓글 등록", exact=True).click()
        expect(admin.locator("#article-comments").get_by_text(reply, exact=True)).to_be_visible()
        student.reload()
        expect(section.get_by_text(edited, exact=True)).to_be_visible()
        expect(section.get_by_text(reply, exact=True)).to_be_visible()
        row = section.get_by_role("article").filter(has_text=edited)
        row.get_by_role("button", name="댓글 더보기", exact=True).click()
        student.get_by_role("menuitem", name="삭제", exact=True).click()
        student.get_by_role("dialog", name="댓글을 삭제할까요?", exact=True).get_by_role("button", name="삭제", exact=True).click()
        expect(section.get_by_text("삭제된 댓글입니다.", exact=True)).to_be_visible()
        student.reload()
        expect(section.get_by_text(reply, exact=True)).to_be_visible()
        expect(section.get_by_text(edited, exact=True)).to_have_count(0)
        article = self.api(student, path)
        assert article["likeCount"] == 0 and article["scrapCount"] == 0, article

    def test_survey_branch_attachment_edit_and_export(self):
        admin, student = self.page(), self.page("student")
        # The existing scenario covers UI authoring; this fixture isolates the
        # richer respondent workflow, without mocking any API responses.
        survey = self.api(admin, "/surveys", method="POST", status=201, body={"titleKo": self.marker + " 복합 설문", "isKoreanOnly": True, "isAlwaysOpen": True, "allowResponseEdit": True})
        survey_id = survey["id"]
        base = f"/surveys/{survey_id}"
        gate = self.api(admin, base + "/sections", method="POST", status=201, body={"titleKo": "참여 경로", "sortOrder": 0})
        detail = self.api(admin, base + "/sections", method="POST", status=201, body={"titleKo": "상세 답변", "sortOrder": 1})
        def question(section, title, kind, order, **extra):
            return self.api(admin, base + f"/sections/{section['id']}/questions", method="POST", status=201, body={"titleKo": title, "questionType": kind, "isRequired": True, "sortOrder": order, **extra})
        route_question = question(gate, "참여 경로 선택", "single_choice", 0, options=[{"value": "details", "labelKo": "상세 참여"}, {"value": "skip", "labelKo": "간단 참여"}], config={"goToSectionByValue": {"skip": "SUBMIT"}})
        choices = question(detail, "관심 활동", "multiple_choice", 0, options=[{"value": "workshop", "labelKo": "워크숍"}, {"value": "seminar", "labelKo": "세미나"}])
        date = question(detail, "희망 날짜", "date", 1)
        clock = question(detail, "희망 시간", "time", 2)
        upload = question(detail, "참고 이미지", "file_upload", 3, config={"maxFiles": 1, "allowedMimeTypes": ["image/png"], "maxSizeBytes": 100000})
        self.api(admin, base, method="PATCH", body={"isPublished": True})
        student.set_viewport_size({"width": 390, "height": 844})
        student.goto(self.base + f"/survey/{survey_id}")
        student.get_by_text("상세 참여", exact=True).click()
        student.get_by_role("button", name="다음", exact=True).click()
        student.get_by_text("워크숍", exact=True).click()
        student.get_by_text("세미나", exact=True).click()
        student.locator('input[type="date"]:visible').fill("2026-11-02")
        student.locator('input[type="time"]:visible').fill("18:30")
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5uUAAAAASUVORK5CYII=")
        student.locator('input[type="file"]').set_input_files({"name": "response-fixture.png", "mimeType": "image/png", "buffer": png})
        expect(student.get_by_text("response-fixture.png", exact=True)).to_be_visible()
        with student.expect_response(lambda response: response.request.method == "POST" and urlsplit(response.url).path == "/api" + base + "/responses") as submitted:
            student.get_by_role("button", name="제출", exact=True).click()
        assert submitted.value.status == 201, submitted.value.text()
        before = self.api(student, base + "/responses/mine")
        answers = {answer["questionId"]: answer["content"] for answer in before["answers"]}
        assert set(answers[choices["id"]]["values"]) == {"workshop", "seminar"}
        assert answers[date["id"]]["date"] == "2026-11-02" and answers[clock["id"]]["time"] == "18:30"
        assert len(answers[upload["id"]]["assetIds"]) == 1
        student.reload()
        expect(student.get_by_text("이전에 제출한 응답을 수정하는 중입니다.", exact=False)).to_be_visible()
        student.get_by_role("button", name="다음", exact=True).click()
        expect(student.locator('input[type="date"]:visible')).to_have_value("2026-11-02")
        expect(student.locator('input[type="time"]:visible')).to_have_value("18:30")
        expect(student.get_by_text("response-fixture.png", exact=True)).to_be_visible()
        student.get_by_role("button", name="이전", exact=True).click()
        student.get_by_text("간단 참여", exact=True).click()
        with student.expect_response(lambda response: response.request.method == "PATCH" and urlsplit(response.url).path == "/api" + base + "/responses/mine") as updated:
            student.get_by_role("button", name="저장", exact=True).click()
        assert updated.value.status == 200, updated.value.text()
        after = self.api(student, base + "/responses/mine")
        assert after["id"] == before["id"]
        assert [(answer["questionId"], answer["content"]) for answer in after["answers"]] == [(route_question["id"], {"value": "skip"})], after
        listed = self.api(admin, base + "/responses/with-answers")
        assert listed["total"] == 1 and listed["items"][0]["id"] == before["id"], listed
        admin.goto(self.base + f"/admin/surveys/{survey_id}/edit?tab=responses&view=table")
        table = admin.get_by_role("grid", name="설문 응답표", exact=True)
        expect(table).to_be_visible()
        expect(table).to_contain_text("간단 참여")
        table.get_by_role("row").filter(has_text="간단 참여").click()
        expect(admin.get_by_role("tab", name="개별 보기", exact=True)).to_have_attribute("aria-selected", "true")
        admin.get_by_role("button", name="응답 더보기", exact=True).click()
        exported = self.download_file(admin, admin.get_by_role("menuitem", name="CSV 내보내기", exact=True), "survey.csv")
        csv_rows = list(csv.reader(io.StringIO(exported.read_text(encoding="utf-8-sig"))))
        assert len(csv_rows) == 2, csv_rows
        assert csv_rows[0] == ["응답 일시", "참여 경로 선택", "관심 활동", "희망 날짜", "희망 시간", "참고 이미지"], csv_rows
        assert csv_rows[1][1:] == ["간단 참여", "", "", "", ""], csv_rows

    def test_admin_console_navigation(self):
        admin = self.page()
        failed_requests = []
        admin.on("response", lambda response: failed_requests.append(f"{response.status} {response.url}")
                 if "/api/" in response.url and response.status >= 400 else None)
        admin.goto(self.base + "/admin")
        expect(admin).to_have_url(self.base + "/admin/surveys")
        links = admin.locator('aside a[href^="/admin/"]:visible')
        expect(links.first).to_be_visible()
        destinations = links.evaluate_all("links => links.map(link => link.getAttribute('href'))")
        assert set(destinations) == {"/admin/" + path for path in (
            "content", "boards", "moderation", "faq", "roadmap", "calendar", "surveys",
            "users", "contacts", "finance", "emails", "permissions", "audit-logs")}, destinations
        for destination in destinations:
            admin.locator(f'aside a[href="{destination}"]:visible').click()
            expect(admin).to_have_url(self.base + destination)
            expect(admin.get_by_role("heading", level=1)).to_be_visible()
            admin.wait_for_load_state("networkidle")
            expect(admin.get_by_text(re.compile("불러오지 못|불러올 수 없|오류가 발생"))).to_have_count(0)
            assert not failed_requests, failed_requests

    def test_finance_viewer_admin_entry(self):
        admin, viewer = self.page(), self.page("student")
        view_permission = next(item for item in self.api(admin, "/role-groups/permissions")
                               if item["code"] == "VIEW_FINANCE")
        role = self.api(admin, "/role-groups", method="POST", status=201,
                        body={"nameKo": self.marker + " 과비 조회", "permissionIds": [view_permission["permissionId"]]})
        role_path = f'/role-groups/{role["roleGroupId"]}'
        user_id = self.api(viewer, "/auth/session")["userId"]
        try:
            self.api(admin, role_path + "/users", method="POST", status=201, body={"userId": user_id})
            assert self.api(viewer, "/auth/session")["permission"] & view_permission["bitValue"]
            viewer.goto(self.base + "/admin")
            expect(viewer).to_have_url(self.base + "/admin/finance")
            expect(viewer.get_by_role("grid")).to_be_visible()
            expect(viewer.locator('aside a[href^="/admin/"]:visible')).to_have_count(1)
            expect(viewer.get_by_role("button", name="입금 엑셀 가져오기", exact=True)).to_have_count(0)
            expect(viewer.get_by_role("button", name="전체 명부 내보내기", exact=True)).to_have_count(0)
            self.api(viewer, "/users/fee-status/roster", method="PUT", body={"records": []}, status=403)
            self.api(viewer, "/users/fee-status/roster/export.xlsx", status=403)
        finally:
            self.api(admin, role_path, method="DELETE")

    def test_admin_site_content_round_trip(self):
        admin, guest = self.page(), self.page("guest")
        admin.goto(self.base + "/admin/content")
        for category, label in (("퀵링크", "링크"), ("공약", "공약")):
            title = self.marker + " " + label
            admin.get_by_role("tab", name=category, exact=True).click()
            admin.get_by_role("button", name=category + " 추가", exact=True).click()
            dialog = admin.get_by_role("dialog", name=category + " 추가", exact=True)
            self.field(dialog, "한국어 제목").fill(title)
            self.field(dialog, "영문 제목").fill("QA " + label)
            if category == "퀵링크":
                self.field(dialog, "링크 URL").fill("/events")
                dialog.get_by_role("button", name="추가", exact=True).click()
                expect(admin.get_by_text("올바른 링크 URL을 입력해 주세요. 예: https://youtube.com", exact=True)).to_be_visible()
                expect(dialog).to_be_visible()
                self.field(dialog, "링크 URL").fill("https://klms.kaist.ac.kr/")
            else:
                self.field(dialog, "한국어 본문").fill("학생 의견을 반영합니다.")
                self.field(dialog, "영문 본문").fill("Reflect student feedback.")
            with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/site-content/blocks") as created:
                dialog.get_by_role("button", name="추가", exact=True).click()
            assert created.value.status == 201, created.value.text()
            block_id = created.value.json()["contentBlockId"]
            expect(dialog).to_be_hidden()
            expect(admin.get_by_role("heading", name=title, exact=True)).to_be_visible()
            self.field(admin, "한국어 제목").fill(title + " 수정")
            self.field(admin, "영문 제목").fill("Updated QA " + label)
            if category == "퀵링크":
                self.field(admin, "링크 URL").fill("https://klms.kaist.ac.kr/course/view.php?id=123")
            else:
                self.field(admin, "한국어 본문").fill("수정한 공약 본문입니다.")
                self.field(admin, "영문 본문").fill("Updated pledge body.")
                admin.get_by_role("button", name="이행 상태", exact=True).click()
                admin.get_by_role("option", name="이행 완료", exact=True).click()
            with admin.expect_response(lambda r: r.request.method == "PATCH" and urlsplit(r.url).path == f"/api/site-content/blocks/{block_id}") as saved:
                admin.get_by_role("button", name="저장", exact=True).click()
            assert saved.value.status == 200, saved.value.text()
            admin.reload()
            admin.get_by_role("tab", name=category, exact=True).click()
            admin.get_by_role("complementary", name="콘텐츠 목록").get_by_text(title + " 수정", exact=True).click()
            expect(self.field(admin, "한국어 제목")).to_have_value(title + " 수정")
            expect(self.field(admin, "영문 제목")).to_have_value("Updated QA " + label)
            block = next(item for item in self.api(guest, "/site-content/blocks/public")["items"] if item["contentBlockId"] == block_id)
            if category == "퀵링크":
                expect(self.field(admin, "링크 URL")).to_have_value("https://klms.kaist.ac.kr/course/view.php?id=123")
                assert block["linkUrl"] == "https://klms.kaist.ac.kr/course/view.php?id=123", block
            else:
                expect(self.field(admin, "한국어 본문")).to_have_value("수정한 공약 본문입니다.")
                expect(self.field(admin, "영문 본문")).to_have_value("Updated pledge body.")
                assert block["pledgeStatus"] == "COMPLETED", block
            admin.get_by_role("button", name="삭제", exact=True).click()
            with admin.expect_response(lambda r: r.request.method == "DELETE" and urlsplit(r.url).path.endswith("/" + block_id)) as deleted:
                admin.get_by_role("dialog", name="콘텐츠 삭제", exact=True).get_by_role("button", name="삭제하기", exact=True).click()
            assert deleted.value.status in (200, 204), deleted.value.status
            assert not any(item["contentBlockId"] == block_id for item in self.api(guest, "/site-content/blocks/public")["items"])

    def test_admin_role_membership_and_revocation(self):
        admin, student = self.page(), self.page("student")
        session = self.api(student, "/auth/session")
        title = self.marker + " 사이트 관리자"
        admin.goto(self.base + "/admin/permissions")
        admin.get_by_role("button", name="역할 추가", exact=True).click()
        dialog = admin.get_by_role("dialog", name="역할 추가", exact=True)
        self.field(dialog, "역할 이름").fill(title)
        with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/role-groups") as created:
            dialog.get_by_role("button", name="추가", exact=True).click()
        assert created.value.status == 201, created.value.text()
        role_id = created.value.json()["roleGroupId"]
        role_path = f"/role-groups/{role_id}"
        try:
            admin.get_by_role("tab", name=re.compile("^권한 설정")).click()
            permission = admin.get_by_role("checkbox", name=re.compile("^사이트 설정"))
            with admin.expect_response(lambda r: r.request.method == "PATCH" and urlsplit(r.url).path == "/api" + role_path) as saved:
                permission.check()
            assert saved.value.status == 200, saved.value.text()
            admin.reload()
            admin.get_by_role("option", name=re.compile(re.escape(title))).click()
            admin.get_by_role("tab", name=re.compile("^권한 설정")).click()
            expect(permission).to_be_checked()
            admin.get_by_role("tab", name=re.compile("^구성원")).click()
            admin.get_by_role("button", name="구성원 추가", exact=True).click()
            members = admin.get_by_role("dialog", name=title + " 구성원 편집", exact=True)
            members.get_by_role("searchbox", name="구성원 검색", exact=True).fill("90990002")
            members.get_by_role("checkbox", name=session["nameKo"] + " 선택", exact=True).check()
            with admin.expect_response(lambda r: r.request.method == "PUT" and urlsplit(r.url).path == "/api" + role_path + "/users") as assigned:
                members.get_by_role("button", name="적용", exact=True).click()
            assert assigned.value.status == 200, assigned.value.text()
            assert [item["userId"] for item in self.api(admin, role_path + "/users")] == [session["userId"]]
            student.goto(self.base + "/admin/content")
            expect(student.get_by_role("heading", name="사이트 설정", exact=True)).to_be_visible()
            self.api(student, "/site-content/blocks/admin")
            admin.reload()
            admin.get_by_role("tab", name=re.compile("^구성원")).click()
            admin.get_by_role("button", name=session["nameKo"] + " 제외", exact=True).click()
            with admin.expect_response(lambda r: r.request.method == "PUT" and urlsplit(r.url).path == "/api" + role_path + "/users") as removed:
                admin.get_by_role("dialog", name="구성원 제외", exact=True).get_by_role("button", name="제외", exact=True).click()
            assert removed.value.status == 200, removed.value.text()
            assert self.api(admin, role_path + "/users") == []
            self.api(student, "/site-content/blocks/admin", status=403)
            student.reload()
            expect(student.get_by_role("heading", name="사이트 설정", exact=True)).to_be_hidden()
            admin.get_by_role("button", name="역할 삭제", exact=True).click()
            with admin.expect_response(lambda r: r.request.method == "DELETE" and urlsplit(r.url).path == "/api" + role_path) as deleted:
                admin.get_by_role("dialog", name="역할 삭제", exact=True).get_by_role("button", name="삭제하기", exact=True).click()
            assert deleted.value.status == 200, deleted.value.text()
            admin.reload()
            expect(admin.get_by_role("option", name=re.compile(re.escape(title)))).to_have_count(0)
        finally:
            if any(role["roleGroupId"] == role_id for role in self.api(admin, "/role-groups")):
                self.api(admin, role_path, method="DELETE")

    def test_admin_user_sanctions_and_activation(self):
        admin, student = self.page(), self.page("student")
        session = self.api(student, "/auth/session")
        user_path = "/users/" + session["userId"]
        article_id = self.api(admin, "/boards/notice/articles?limit=20")["items"][0]["articleId"]
        comment_path = f"/boards/notice/articles/{article_id}/comments"
        def open_user():
            admin.goto(self.base + "/admin/users")
            admin.get_by_role("searchbox", name="사용자 검색", exact=True).fill("90990002")
            admin.get_by_role("row", name=session["nameKo"] + " 사용자 상세 정보 열기", exact=True).click()
            return admin.get_by_role("dialog", name=session["nameKo"] + " 상세 정보", exact=True)
        try:
            drawer = open_user()
            drawer.get_by_role("button", name="게시 제한", exact=True).click()
            dialog = admin.get_by_role("dialog", name="글·댓글 작성 제한", exact=True)
            expect(dialog.get_by_role("button", name="제한 적용", exact=True)).to_be_disabled()
            dialog.get_by_role("textbox").fill(self.marker + " 게시 제한 확인")
            with admin.expect_response(lambda r: r.request.method == "PUT" and urlsplit(r.url).path == "/api" + user_path + "/sanctions/posting") as restricted:
                dialog.get_by_role("button", name="제한 적용", exact=True).click()
            assert restricted.value.status == 200, restricted.value.text()
            drawer = open_user()
            expect(drawer.get_by_text("제한됨", exact=True)).to_be_visible()
            assert self.api(admin, user_path + "/sanctions/posting")["suspended"] is True
            self.api(student, comment_path, method="POST", body={"content": self.marker + " 제한 중 댓글"}, status=403)
            drawer.get_by_role("button", name="게시 제한 해제", exact=True).click()
            with admin.expect_response(lambda r: r.request.method == "PUT" and urlsplit(r.url).path == "/api" + user_path + "/sanctions/posting") as unrestricted:
                admin.get_by_role("dialog", name="게시 제한 해제", exact=True).get_by_role("button", name="제한 해제", exact=True).click()
            assert unrestricted.value.status == 200, unrestricted.value.text()
            self.api(student, comment_path, method="POST", body={"content": self.marker + " 제한 해제 후 댓글"}, status=201)
            drawer = open_user()
            expect(drawer.get_by_text("허용됨", exact=True)).to_be_visible()
            drawer.get_by_role("button", name="계정 비활성화", exact=True).click()
            dialog = admin.get_by_role("dialog", name="계정 비활성화", exact=True)
            expect(dialog.get_by_role("button", name="비활성화", exact=True)).to_be_disabled()
            dialog.get_by_role("textbox").fill(self.marker + " 계정 상태 확인")
            with admin.expect_response(lambda r: r.request.method == "PUT" and urlsplit(r.url).path == "/api" + user_path + "/status") as deactivated:
                dialog.get_by_role("button", name="비활성화", exact=True).click()
            assert deactivated.value.status == 200, deactivated.value.text()
            assert self.api(student, "/auth/session")["authenticated"] is False
            drawer = open_user()
            expect(drawer.get_by_text("비활성 계정", exact=True)).to_be_visible()
            drawer.get_by_role("button", name="계정 복구", exact=True).click()
            with admin.expect_response(lambda r: r.request.method == "PUT" and urlsplit(r.url).path == "/api" + user_path + "/status") as restored:
                admin.get_by_role("dialog").filter(has=admin.get_by_role("button", name="복구", exact=True)).get_by_role("button", name="복구", exact=True).click()
            assert restored.value.status == 200, restored.value.text()
            auth.login(student, "student", consent=True)
            assert self.api(student, "/auth/session")["authenticated"] is True
            expect(open_user().get_by_text("활성 계정", exact=True)).to_be_visible()
        finally:
            self.api(admin, user_path + "/status", method="PUT", body={"isActive": True})
            self.api(admin, user_path + "/sanctions/posting", method="PUT", body={"suspended": False})

    def test_admin_survey_question_types_clone_and_delete(self):
        admin, student = self.page(), self.page("student")
        title = self.marker + " 문항 유형"
        types = [("short_text", "단답형"), ("long_text", "장문형"),
                 ("single_choice", "객관식 질문"), ("multiple_choice", "체크박스"),
                 ("dropdown", "드롭다운"), ("file_upload", "파일 업로드"),
                 ("rating", "등급"), ("grid_single", "객관식 그리드"),
                 ("grid_multiple", "체크박스 그리드"), ("date", "날짜"), ("time", "시간")]
        admin.goto(self.base + "/admin/surveys/new")
        admin.get_by_role("textbox", name="국문 섹션 제목", exact=True).fill(title)
        admin.get_by_role("textbox", name="영문 섹션 제목", exact=True).fill("Question types")
        for index, (kind, label) in enumerate(types):
            # Keep the real 45/minute survey budget: bulk UI automation needs
            # a new rate window between batches, unlike ordinary typing.
            if index in (4, 8):
                admin.wait_for_timeout(60_000)
            if index == 6:
                admin.get_by_role("button", name="새 섹션", exact=True).click()
                section = admin.locator(".survey-section-surface.is-selected")
                expect(section.get_by_role("textbox", name="국문 섹션 제목", exact=True)).to_have_text("")
                section.get_by_role("textbox", name="국문 섹션 제목", exact=True).fill("세부 문항")
                section.get_by_role("textbox", name="영문 섹션 제목", exact=True).fill("Detailed questions")
            if index:
                admin.get_by_role("button", name="질문 추가", exact=True).click()
                expect(admin.get_by_role("textbox", name="국문 질문", exact=True)).to_have_text("질문")
            admin.get_by_role("textbox", name="국문 질문", exact=True).fill(f"{index + 1}. {label} 확인")
            admin.get_by_role("textbox", name="영문 질문", exact=True).fill(f"Question {index + 1}: {kind}")
            admin.get_by_role("button", name="질문 유형", exact=True).click()
            admin.get_by_role("option", name=label, exact=True).click()
            if kind in ("single_choice", "multiple_choice", "dropdown"):
                admin.get_by_role("textbox", name="1번 국문 옵션", exact=True).fill("첫 번째 선택")
                admin.get_by_role("textbox", name="1번 영문 옵션", exact=True).fill("First choice")
                admin.get_by_role("textbox", name="선택지 추가", exact=True).focus()
                admin.get_by_role("textbox", name="2번 국문 옵션", exact=True).fill("두 번째 선택")
                admin.get_by_role("textbox", name="2번 영문 옵션", exact=True).fill("Second choice")
            if kind in ("grid_single", "grid_multiple"):
                for dimension in ("행", "열"):
                    labels = admin.get_by_role("textbox", name=re.compile(f"^{dimension} [0-9]+ 국문 라벨$"))
                    expect(labels.first).to_be_visible()
                    for offset in range(labels.count()):
                        labels.nth(offset).fill(f"{dimension} 항목 {offset + 1}")
                        admin.get_by_role("textbox", name=f"{dimension} {offset + 1} 영문 라벨", exact=True).fill(f"Item {offset + 1}")
            if kind == "rating":
                admin.get_by_role("button", name="등급 개수", exact=True).click()
                admin.get_by_role("option", name="7개", exact=True).click()
        admin.get_by_role("tab", name="설정", exact=True).click()
        admin.get_by_role("checkbox", name="상시 설문", exact=True).check()
        admin.get_by_role("button", name="게시", exact=True).click()
        expect(admin.get_by_role("button", name="게시됨", exact=True)).to_be_visible()
        survey_id = re.search(r"/surveys/([0-9a-f-]+)/edit", admin.url).group(1)
        admin.reload()
        definition = self.api(admin, f"/surveys/{survey_id}")
        assert len(definition["sections"]) == 2, definition
        questions = [question for section in definition["sections"] for question in section["questions"]]
        assert [question["questionType"] for question in questions] == [kind for kind, _ in types], questions
        for index, question in enumerate(questions):
            assert re.sub("<[^>]+>", "", question["titleKo"]) == f"{index + 1}. {types[index][1]} 확인", question
            assert re.sub("<[^>]+>", "", question["titleEn"]) == f"Question {index + 1}: {types[index][0]}", question
        assert questions[6]["config"]["ratingMax"] == 7, questions[6]
        student.goto(self.base + f"/survey/{survey_id}")
        student.locator('main input[type="text"]:visible, main textarea:visible').first.fill("원본 설문 응답")
        student.get_by_role("button", name="다음", exact=True).click()
        with student.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == f"/api/surveys/{survey_id}/responses") as submitted:
            student.get_by_role("button", name="제출", exact=True).click()
        assert submitted.value.status == 201, submitted.value.text()
        admin.goto(self.base + "/admin/surveys")
        admin.get_by_role("tab", name="상시 설문", exact=True).click()
        admin.get_by_role("searchbox", name="설문 검색", exact=True).fill(title)
        admin.get_by_role("button", name=title + " 작업 메뉴", exact=True).click()
        with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == f"/api/surveys/{survey_id}/duplicate") as duplicated:
            admin.get_by_role("menuitem", name="설문 복제", exact=True).click()
        assert duplicated.value.status == 201, duplicated.value.text()
        copied_id = duplicated.value.json()["id"]
        copied = self.api(admin, f"/surveys/{copied_id}")
        copied_questions = [question for section in copied["sections"] for question in section["questions"]]
        assert copied["isPublished"] is False
        assert len(copied_questions) == len(questions)
        assert not {question["id"] for question in questions} & {question["id"] for question in copied_questions}
        for original, clone in zip(questions, copied_questions):
            for key in ("titleKo", "titleEn", "questionType", "isRequired", "config"):
                assert original[key] == clone[key], (key, original, clone)
            assert [(option["labelKo"], option["labelEn"]) for option in original["options"]] == [(option["labelKo"], option["labelEn"]) for option in clone["options"]]
        assert self.api(admin, f"/surveys/{copied_id}/responses")["total"] == 0
        assert self.api(admin, f"/surveys/{survey_id}/responses")["total"] == 1
        for deleted_id, deleted_title in ((copied_id, copied["titleKo"]), (survey_id, title)):
            plain_title = re.sub("<[^>]+>", "", deleted_title)
            admin.get_by_role("button", name=plain_title + " 작업 메뉴", exact=True).click()
            admin.get_by_role("menuitem", name="삭제하기", exact=True).click()
            with admin.expect_response(lambda r: r.request.method == "DELETE" and urlsplit(r.url).path == f"/api/surveys/{deleted_id}") as deleted:
                admin.get_by_role("dialog", name="설문조사 삭제", exact=True).get_by_role("button", name="삭제하기", exact=True).click()
            assert deleted.value.status in (200, 204), deleted.value.status
            admin.reload()
            admin.get_by_role("tab", name="상시 설문", exact=True).click()
            admin.get_by_role("searchbox", name="설문 검색", exact=True).fill(title)
            expect(admin.get_by_role("button", name=plain_title + " 작업 메뉴", exact=True)).to_have_count(0)
            self.api(admin, f"/surveys/{deleted_id}", status=404)
        self.api(student, f"/surveys/{survey_id}", status=404)

    def test_admin_board_settings_round_trip(self):
        admin, student, guest = self.page(), self.page("student"), self.page("guest")
        code, title = "qa_" + uuid4().hex[:8], self.marker + " 게시판 설정"
        admin.goto(self.base + "/admin/boards")
        admin.get_by_role("button", name="게시판 추가", exact=True).click()
        drawer = admin.get_by_role("dialog", name="게시판 추가", exact=True)
        self.field(drawer, "게시판 코드").fill(code)
        self.field(drawer, "이름 (한글)").fill(title)
        self.field(drawer, "이름 (영문)").fill("QA board")
        drawer.get_by_role("radio", name="로그인 사용자", exact=True).check()
        for label in ("비로그인 열람 허용", "댓글 허용", "추천/스크랩", "게시판 활성화", "비밀글 허용"):
            drawer.get_by_role("switch", name=label, exact=True).click()
        with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/boards") as created:
            drawer.get_by_role("button", name="추가", exact=True).click()
        assert created.value.status == 201, created.value.text()
        assert created.value.json()["isActive"] is False, created.value.json()
        assert not any(item["code"] == code for item in self.api(guest, "/boards")["items"])
        admin.reload()
        admin.get_by_role("button", name=title + " 게시판 설정 열기", exact=True).click()
        drawer = admin.get_by_role("dialog", name="게시판 설정", exact=True)
        for label in ("비로그인 열람 허용", "댓글 허용", "추천/스크랩", "게시판 활성화"):
            expect(drawer.get_by_role("switch", name=label, exact=True)).to_have_attribute("aria-checked", "false")
        expect(drawer.get_by_role("switch", name="비밀글 허용", exact=True)).to_have_attribute("aria-checked", "true")
        expect(drawer.get_by_role("radio", name="로그인 사용자", exact=True)).to_be_checked()
        drawer.get_by_role("switch", name="게시판 활성화", exact=True).click()
        with admin.expect_response(lambda r: r.request.method == "PATCH" and urlsplit(r.url).path == "/api/boards/" + code) as saved:
            drawer.get_by_role("button", name="저장", exact=True).click()
        assert saved.value.status == 200, saved.value.text()
        board = next(item for item in self.api(admin, "/boards/admin")["items"] if item["code"] == code)
        assert board["isActive"] and not board["allowGuestRead"] and not board["allowComment"] and not board["allowLike"], board
        editor = self.editor(student, f"/board/{code}/write", title + " 게시글")
        editor.fill("새 게시판의 작성 및 열람 권한 확인")
        article_id = self.publish_article(student, code)
        self.api(student, f"/boards/{code}/articles/{article_id}")
        result = auth.api_json(guest, f"/api/boards/{code}/articles/{article_id}")
        assert result["status"] in (401, 403), result
        expect(student.get_by_role("textbox", name="댓글 입력", exact=True)).to_have_count(0)
        admin.goto(self.base + "/admin/boards")
        admin.get_by_role("button", name=title + " 게시판 설정 열기", exact=True).click()
        admin.get_by_role("button", name="게시판 삭제", exact=True).click()
        with admin.expect_response(lambda r: r.request.method == "DELETE" and urlsplit(r.url).path == "/api/boards/" + code + "/permanent") as deleted:
            admin.get_by_role("dialog", name="게시판 삭제", exact=True).get_by_role("button", name="삭제하기", exact=True).click()
        assert deleted.value.status == 200, deleted.value.text()
        admin.reload()
        expect(admin.get_by_role("button", name=title + " 게시판 설정 열기", exact=True)).to_have_count(0)
        assert not any(item["code"] == code for item in self.api(admin, "/boards/admin")["items"])
        self.api(student, f"/boards/{code}/articles/{article_id}", status=404)

    def test_operations_calendar_ics_round_trip(self):
        admin, guest = self.page(), self.page("guest")
        title = self.marker + " 수동 일정"
        admin.goto(self.base + "/admin/calendar")
        admin.get_by_role("button", name="일정 추가", exact=True).click()
        drawer = admin.get_by_role("dialog", name="일정 추가", exact=True)
        self.field(drawer, "국문 제목").fill(title)
        self.field(drawer, "영문 제목").fill("QA calendar event")
        drawer.get_by_role("group", name="시작", exact=True).locator("input").fill("2026-11-04T18:00")
        drawer.get_by_role("group", name="종료", exact=True).locator("input").fill("2026-11-04T19:30")
        self.field(drawer, "장소").fill("합성 강의실")
        with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/calendar/manual") as created:
            drawer.get_by_role("button", name="추가", exact=True).click()
        assert created.value.status == 201, created.value.text()
        event_id = created.value.json()["calendarEventId"]
        expect(drawer).to_be_hidden()
        feed = guest.request.get(self.base + "/api/calendar/feed.ics")
        assert feed.status == 200 and "text/calendar" in feed.headers["content-type"]
        text = re.sub(r"\r?\n[ \t]", "", feed.text())
        event = next(part for part in text.split("BEGIN:VEVENT") if title in part)
        assert "DTSTART:20261104T090000Z" in event and "DTEND:20261104T103000Z" in event, event
        admin.reload()
        admin.get_by_role("searchbox", name="일정 검색", exact=True).fill(title)
        admin.get_by_role("row", name=title + " 설정 열기", exact=True).click()
        drawer = admin.get_by_role("dialog", name="일정 설정", exact=True)
        expect(self.field(drawer, "장소")).to_have_value("합성 강의실")
        drawer.get_by_role("checkbox", name="종일", exact=True).check()
        drawer.get_by_role("group", name="시작", exact=True).locator("input").fill("2026-11-04")
        drawer.get_by_role("group", name="종료", exact=True).locator("input").fill("2026-11-05")
        drawer.get_by_role("button", name="저장", exact=True).click()
        expect(drawer).to_be_hidden()
        text = re.sub(r"\r?\n[ \t]", "", guest.request.get(self.base + "/api/calendar/feed.ics").text())
        event = next(part for part in text.split("BEGIN:VEVENT") if title in part)
        assert "DTSTART;VALUE=DATE:20261104" in event and "DTEND;VALUE=DATE:20261106" in event, event
        admin.get_by_role("row", name=title + " 설정 열기", exact=True).click()
        drawer.get_by_role("button", name="숨김", exact=True).click()
        drawer.get_by_role("button", name="저장", exact=True).click()
        expect(drawer).to_be_hidden()
        assert title not in re.sub(r"\r?\n[ \t]", "", guest.request.get(self.base + "/api/calendar/feed.ics").text())
        imported_title = self.marker + " 가져온 일정"
        fixture = ARTIFACTS / (self.marker + ".ics")
        fixture.write_bytes("\r\n".join(["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SoC QA//EN", "BEGIN:VEVENT",
            "UID:" + self.marker + "@example.invalid", "DTSTAMP:20261030T000000Z", "DTSTART;VALUE=DATE:20261105",
            "DTEND;VALUE=DATE:20261106", "SUMMARY:" + imported_title, "END:VEVENT", "END:VCALENDAR", ""]).encode("utf-8"))
        for _ in range(2):
            with admin.expect_file_chooser() as chooser:
                admin.get_by_role("button", name="ICS 가져오기", exact=True).click()
            with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/calendar/manual/import") as imported:
                chooser.value.set_files(str(fixture))
            assert imported.value.status == 201, imported.value.text()
        managed = self.api(admin, "/calendar/admin/events")["items"]
        assert len([item for item in managed if item["titleKo"] == imported_title]) == 1, managed
        self.api(admin, f"/calendar/manual/{event_id}", method="DELETE")
        assert not any(item["titleKo"] == title for item in self.api(guest, "/calendar/events?from=2026-11-01T00:00:00Z&to=2026-12-01T00:00:00Z")["items"])
        admin.get_by_role("button", name="동기화", exact=True).click()
        with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/calendar/manual/sync-google") as synced:
            admin.get_by_role("menuitem", name="구글 캘린더 동기화", exact=True).click()
        # This fixture has no Google credentials. Actual success/failure/retry
        # is covered separately with a synthetic provider and PostgreSQL.
        assert synced.value.status == 400 and synced.value.json()["message"] == "google_calendar_not_configured", synced.value.text()

    def test_operations_contacts_excel_and_departments(self):
        admin, student, guest = self.page(), self.page("student"), self.page("guest")
        name, department = self.marker + " 부원", self.marker + " 소통·복지부"
        admin.goto(self.base + "/admin/contacts")
        admin.get_by_role("button", name="부서 관리", exact=True).click()
        modal = admin.get_by_role("dialog", name="부서 관리", exact=True)
        self.field(modal, "부서명").fill(department)
        modal.get_by_role("button", name="저장", exact=True).click()
        expect(modal.get_by_role("button", name=department, exact=True)).to_be_visible()
        modal.get_by_role("button", name="취소", exact=True).click()
        admin.get_by_role("button", name="부원 추가", exact=True).click()
        drawer = admin.get_by_role("dialog", name="부원 추가", exact=True)
        for label, value in (("이름", name), ("학번", "90990004"), ("이메일", "qa-contact@example.invalid"), ("전화번호", "010-0012-0034")):
            self.field(drawer, label).fill(value)
        for index, year in ((1, 2026), (2, 2025), (3, 2024)):
            if index > 1:
                drawer.get_by_role("button", name=re.compile("이력 추가")).click()
            drawer.get_by_role("spinbutton", name=f"연도 {index}", exact=True).fill(str(year))
            if index < 3:
                drawer.get_by_role("button", name=f"활동 부서 {index}", exact=True).click()
                admin.get_by_role("option", name=department, exact=True).click()
            drawer.get_by_role("textbox", name=f"직책 {index}", exact=True).fill(("부원", "실무자", "회장")[index - 1])
        drawer.get_by_role("button", name="추가", exact=True).click()
        expect(drawer).to_be_hidden()
        admin.reload()
        admin.get_by_role("searchbox", name=re.compile("검색")).fill(name)
        expect(admin.get_by_text(name, exact=True)).to_be_visible()
        admin.get_by_role("button", name="부서 관리", exact=True).click()
        modal.get_by_role("button", name=department, exact=True).click()
        self.field(modal, "부서명 수정").fill(department + " 수정")
        modal.get_by_role("button", name="저장", exact=True).click()
        expect(modal.get_by_role("button", name=department + " 수정", exact=True)).to_be_visible()
        modal.get_by_role("button", name="취소", exact=True).click()
        contacts = self.api(admin, "/contacts/manage?pageSize=100")["items"]
        contact = next(item for item in contacts if item["nameKo"] == name)
        expected_history = {(2026, department + " 수정", "부원"), (2025, department + " 수정", "실무자"), (2024, "", "회장")}
        assert {(item["year"], item["departmentKo"], item["roleKo"]) for item in contact["activities"]} == expected_history, contact
        exported = self.download_file(admin, admin.get_by_role("button", name="엑셀 내보내기", exact=True), "contacts.xlsx")
        rows = xlsx_rows(exported)
        assert len(rows) == 2 and rows[1][rows[0].index("전화번호")] == "010-0012-0034", rows
        rows[1][rows[0].index("전화번호")] = "010-0099-0088"
        amended = ARTIFACTS / (self.marker + "-contacts.xlsx")
        write_xlsx(amended, rows)
        admin.get_by_role("button", name="엑셀 가져오기", exact=True).click()
        with admin.expect_file_chooser() as chooser:
            admin.get_by_role("dialog", name="부원 명단 가져오기", exact=True).get_by_role("button", name="파일 선택", exact=True).click()
        chooser.value.set_files(str(amended))
        modal = admin.get_by_role("dialog", name="가져올 부원 확인", exact=True)
        modal.get_by_role("checkbox", name="기존 연락망 전체 교체", exact=True).check()
        modal.get_by_role("button", name="불러오기", exact=True).click()
        expect(modal).to_be_hidden()
        admin.reload()
        admin.get_by_role("searchbox", name=re.compile("검색")).fill(name)
        admin.get_by_text(name, exact=True).click()
        drawer = admin.get_by_role("dialog", name="부원 정보 편집", exact=True)
        expect(self.field(drawer, "전화번호")).to_have_value("010-0099-0088")
        contacts = self.api(admin, "/contacts/manage?pageSize=100")["items"]
        assert len(contacts) == 1, contacts
        assert {(item["year"], item["departmentKo"], item["roleKo"]) for item in contacts[0]["activities"]} == expected_history, contacts
        drawer.get_by_role("button", name="취소", exact=True).click()
        admin.get_by_role("button", name="부서 관리", exact=True).click()
        modal = admin.get_by_role("dialog", name="부서 관리", exact=True)
        modal.get_by_role("button", name=department + " 수정 삭제", exact=True).click()
        admin.get_by_role("dialog", name="부서 삭제", exact=True).get_by_role("button", name="삭제하기", exact=True).click()
        expect(modal.get_by_role("button", name=department + " 수정", exact=True)).to_have_count(0)
        modal.get_by_role("button", name="취소", exact=True).click()
        assert {(item["year"], item["departmentKo"], item["roleKo"]) for item in self.api(admin, "/contacts/manage?pageSize=100")["items"][0]["activities"]} == expected_history
        assert self.api(guest, "/contacts")["items"] == []
        self.api(student, "/contacts/manage", status=403)
        self.api(student, "/contacts/manage/export.xlsx", status=403)
        admin.get_by_text(name, exact=True).click()
        admin.get_by_role("dialog", name="부원 정보 편집", exact=True).get_by_role("button", name="부원 삭제", exact=True).click()
        admin.get_by_role("dialog", name="연락처 삭제", exact=True).get_by_role("button", name="삭제하기", exact=True).click()
        admin.reload()
        expect(admin.get_by_text(name, exact=True)).to_have_count(0)

    def test_operations_roadmap_offerings_and_import(self):
        admin, guest = self.page(), self.page("guest")
        code = "CS" + str(90000 + int(uuid4().hex[:6], 16) % 9000)
        new_code = "CS" + str(int(code[2:]) + 1)
        name = self.marker + " 과목"
        admin.goto(self.base + "/admin/roadmap")
        admin.get_by_role("button", name="과목 추가", exact=True).click()
        parent = admin.get_by_role("dialog", name="과목 추가", exact=True)
        for label, value in (("과목코드 *", code), ("국문 과목명 *", name), ("영문 과목명", "QA course"), ("강·실·학", "3:0:3(0)"), ("개설 학기", "S/F")):
            self.field(parent, label).fill(value)
        parent.get_by_role("button", name="추가", exact=True).click()
        expect(parent).to_be_hidden()
        def open_course():
            admin.goto(self.base + "/admin/roadmap")
            admin.get_by_role("searchbox", name="로드맵 검색", exact=True).fill(code)
            admin.get_by_role("button").filter(has_text=code).click()
            return admin.get_by_role("dialog", name=code + " 편집", exact=True)
        parent = open_course()
        self.field(parent, "국문 과목명 *").fill(name + " 임시 수정")
        parent.get_by_role("tab", name=re.compile("^학기별 개설")).click()
        parent.get_by_role("button", name="분반 추가", exact=True).click()
        child = admin.get_by_role("dialog", name="분반 추가", exact=True)
        self.field(child, "분반").fill("취소할 분반")
        child.press("Escape")
        expect(child).to_be_hidden()
        expect(parent).to_be_visible()
        parent.get_by_role("tab", name="기본 정보", exact=True).click()
        expect(self.field(parent, "국문 과목명 *")).to_have_value(name + " 임시 수정")
        self.field(parent, "국문 과목명 *").fill(name)
        parent.get_by_role("tab", name=re.compile("^학기별 개설")).click()
        parent.get_by_role("button", name="분반 추가", exact=True).click()
        child = admin.get_by_role("dialog", name="분반 추가", exact=True)
        values = {"분반": "A", "담당교수": "합성 교수", "강의시간": "월 10:30~12:00\n수 10:30~12:00", "강의실": "E3-1 101\nE3-1 102"}
        for label, value in values.items():
            self.field(child, label).fill(value)
        child.get_by_role("group", name="정원", exact=True).locator("input").fill("40")
        child.get_by_role("group", name="수강인원", exact=True).locator("input").fill("12")
        child.get_by_role("checkbox", name="영어 강의", exact=True).check()
        with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/roadmap/admin/offerings") as created:
            child.get_by_role("button", name="추가", exact=True).click()
        assert created.value.status == 201, created.value.text()
        offering = created.value.json()
        offering_id, original_term = offering["offeringId"], offering["term"]
        parent = open_course()
        parent.get_by_role("tab", name=re.compile("^학기별 개설")).click()
        parent.get_by_role("button", name="분반 A 편집", exact=True).click()
        child = admin.get_by_role("dialog", name="분반 편집", exact=True)
        for label, value in values.items():
            expect(self.field(child, label)).to_have_value(value)
        child.get_by_role("group", name="수강인원", exact=True).locator("input").fill("13")
        child.get_by_role("button", name="저장", exact=True).click()
        expect(parent).to_be_hidden()
        imported_term = "2026-spring" if original_term != "2026-spring" else "2026-fall"
        term_label = "봄학기" if imported_term.endswith("spring") else "가을학기"
        workbook = ARTIFACTS / (self.marker + "-roadmap.xlsx")
        headers = ["개설년도", "개설학기", "개설학과", "과정구분", "과목구분", "교과목코드", "교과목명", "분반", "과거 과목번호", "강 : 실 : 학", "담당교수", "영어", "정원", "수강인원", "강의시간", "강의실", "강의유형"]
        write_xlsx(workbook, [headers, [2026, term_label, "전산학부", "학사과정", "전공필수", "CS." + code[2:], name, "B", "", "3:0:3", "가져온 교수", "Y", 50, 20, "화 13:00~14:30", "E3-1", "대면"],
            [2026, term_label, "전산학부", "학사과정", "전공선택", "CS." + new_code[2:], name + " 신규", "A", "", "3:0:3", "합성 교수", "N", "", "", "목 13:00~14:30", "E3-2", "대면"]])
        for _ in range(2):
            admin.get_by_role("button", name="엑셀 가져오기", exact=True).click()
            with admin.expect_file_chooser() as chooser:
                admin.get_by_role("dialog", name="개설 교과목 가져오기", exact=True).get_by_role("button", name="파일 선택", exact=True).click()
            chooser.value.set_files(str(workbook))
            preview = admin.get_by_role("dialog", name="가져올 교과목 확인", exact=True)
            expect(preview).to_be_visible()
            for checkbox in preview.get_by_role("checkbox").all():
                checkbox.check()
            preview.get_by_role("button", name="이번 학기 반영", exact=True).click()
            expect(preview).to_be_hidden()
        data = self.api(admin, "/roadmap/admin")
        matching = [item for item in data["items"] if item["courseCode"] == code]
        assert len(matching) == 2 and {item["term"] for item in matching} == {original_term, imported_term}, matching
        manual = next(item for item in matching if item["offeringId"] == offering_id)
        assert manual["enrolled"] == 13 and manual["room"] == values["강의실"], manual
        imported = next(item for item in data["items"] if item["courseCode"] == new_code)
        assert imported["capacity"] is None and imported["enrolled"] is None, imported
        assert any(item["courseCode"] == new_code for item in self.api(guest, "/roadmap/offerings")["courses"])
        parent = open_course()
        parent.get_by_role("checkbox", name="로드맵에 표시", exact=True).uncheck()
        parent.get_by_role("button", name="저장", exact=True).click()
        expect(parent).to_be_hidden()
        assert not any(item["courseCode"] == code for item in self.api(guest, "/roadmap/offerings")["courses"])
        parent = open_course()
        parent.get_by_role("tab", name=re.compile("^학기별 개설")).click()
        parent.get_by_role("button", name="분반 A 편집", exact=True).click()
        admin.get_by_role("dialog", name="분반 편집", exact=True).get_by_role("button", name="분반 삭제", exact=True).click()
        admin.get_by_role("dialog", name="분반 삭제", exact=True).get_by_role("button", name="삭제", exact=True).click()
        expect(parent).to_be_hidden()
        assert not any(item["offeringId"] == offering_id for item in self.api(admin, "/roadmap/admin")["items"])

    def test_operations_moderation_search_and_attachment_access(self):
        admin, student, guest = self.page(), self.page("student"), self.page("guest")
        title, filename = self.marker + " 관리 대상", self.marker + ".pdf"
        editor = self.editor(student, "/board/suggestions/write", title)
        editor.fill("숨김과 복구 및 첨부파일 접근을 확인합니다.")
        pdf = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n"
        student.locator('input[type="file"][multiple]').set_input_files({"name": filename, "mimeType": "application/pdf", "buffer": pdf})
        expect(student.get_by_text(filename, exact=True)).to_be_visible()
        article_id = self.publish_article(student, "suggestions")
        article_path = f"/boards/suggestions/articles/{article_id}"
        guest.goto(self.base + f"/board/suggestions/{article_id}")
        attachment = guest.get_by_role("link", name=re.compile(re.escape(filename)))
        expect(attachment).to_be_visible()
        asset_url = self.base + attachment.get_attribute("href")
        response = guest.request.get(asset_url)
        assert response.status == 200 and response.body() == pdf
        assert any(item["articleId"] == article_id for item in self.api(guest, "/articles/search?q=" + title))
        admin.goto(self.base + f"/board/suggestions/{article_id}")
        admin.get_by_role("button", name="게시글 더보기", exact=True).click()
        admin.get_by_role("menuitem", name="숨기기", exact=True).click()
        modal = admin.get_by_role("dialog", name="게시글 숨기기", exact=True)
        modal.get_by_role("textbox").fill(self.marker + " 숨김 사유")
        modal.get_by_role("button", name="숨기기", exact=True).click()
        expect(modal).to_be_hidden()
        assert auth.api_json(guest, "/api" + article_path)["status"] in (403, 404)
        assert guest.request.get(asset_url).status in (401, 403, 404)
        assert not any(item["articleId"] == article_id for item in self.api(guest, "/articles/search?q=" + title))
        assert not any(item["articleId"] == article_id for item in self.api(guest, "/boards/suggestions/articles?limit=50&q=" + title)["items"])
        admin.goto(self.base + "/admin/moderation")
        row = admin.get_by_role("row").filter(has_text=title)
        row.get_by_role("button", name="복구", exact=True).click()
        expect(row).to_have_count(0)
        self.api(guest, article_path)
        assert guest.request.get(asset_url).status == 200
        assert any(item["articleId"] == article_id for item in self.api(guest, "/boards/suggestions/articles?limit=50&q=" + title)["items"])
        student.reload()
        comment = self.marker + " 숨길 댓글"
        student.get_by_role("textbox", name="댓글 입력", exact=True).fill(comment)
        student.get_by_role("button", name="댓글 등록", exact=True).click()
        expect(student.locator("#article-comments").get_by_text(comment, exact=True)).to_be_visible()
        admin.goto(self.base + f"/board/suggestions/{article_id}")
        admin.locator("#article-comments").get_by_role("article").filter(has_text=comment).get_by_role("button", name="댓글 더보기", exact=True).click()
        admin.get_by_role("menuitem", name="숨기기", exact=True).click()
        modal = admin.get_by_role("dialog", name="댓글 숨기기", exact=True)
        modal.get_by_role("textbox").fill(self.marker + " 댓글 사유")
        modal.get_by_role("button", name="숨기기", exact=True).click()
        expect(modal).to_be_hidden()
        assert comment not in json.dumps(self.api(guest, article_path + "/comments"), ensure_ascii=False)
        admin.goto(self.base + "/admin/moderation")
        admin.get_by_role("button", name=re.compile(r"^댓글 \d+")).click()
        row = admin.get_by_role("row").filter(has_text=comment)
        row.get_by_role("button", name="복구", exact=True).click()
        expect(row).to_have_count(0)
        assert comment in json.dumps(self.api(guest, article_path + "/comments"), ensure_ascii=False)
        student.goto(self.base + f"/board/suggestions/{article_id}")
        student.get_by_role("button", name="게시글 더보기", exact=True).click()
        student.get_by_role("menuitem", name="삭제", exact=True).click()
        student.get_by_role("dialog", name="게시글 삭제", exact=True).get_by_role("button", name="삭제", exact=True).click()
        assert auth.api_json(guest, "/api" + article_path)["status"] in (403, 404)
        assert guest.request.get(asset_url).status in (401, 403, 404)
        assert not any(item["articleId"] == article_id for item in self.api(guest, "/articles/search?q=" + title))
        assert not any(item["articleId"] == article_id for item in self.api(guest, "/boards/suggestions/articles?limit=50&q=" + title)["items"])

    def test_operations_sessions_multitab_and_expiry(self):
        page, guest, student = self.page(), self.page("guest"), self.page("student")
        title, body = self.marker + " 만료 중 원고", self.marker + " 자동 저장한 본문"
        editor = self.editor(page, "/board/notice/write", title)
        with page.expect_response(lambda r: r.request.method in ("POST", "PATCH") and "/api/drafts" in r.url
                                  and body in (r.request.post_data or "")) as draft_saved:
            editor.fill(body)
        assert draft_saved.value.status in (200, 201), draft_saved.value.text()
        draft_id = draft_saved.value.json()["draftId"]
        draft_path = f"/board/notice/write?draftId={draft_id}"
        page.goto(self.base + draft_path)
        title_input = page.locator("input[data-editor-title]:visible").first
        expect(title_input).to_have_value(title)
        expect(page.locator('.ProseMirror[contenteditable="true"]:visible').first).to_contain_text(body)
        # Losing the cookies simulates expiry without changing the production
        # session lifetime or clearing the editor's own storage.
        for cookie in self.contexts["admin"].cookies():
            if "csrf" not in cookie["name"].lower():
                self.contexts["admin"].clear_cookies(name=cookie["name"])
        with page.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/boards/notice/articles") as rejected:
            page.get_by_role("button", name="등록", exact=True).first.click()
        assert rejected.value.status == 401, rejected.value.text()
        expect(page.get_by_role("button", name="등록", exact=True).first).to_be_enabled()
        expect(title_input).to_have_value(title)
        expect(page.locator('.ProseMirror[contenteditable="true"]:visible').first).to_contain_text(body)
        assert not any(item["titleKo"] == title for item in self.api(guest, "/boards/notice/articles?limit=50")["items"])
        assert auth.api_json(student, "/api/drafts/" + draft_id)["status"] in (403, 404)
        page.reload()
        page.wait_for_url(re.compile(r"/__local-sso/authorize(?:\?|$)"))
        page.get_by_role("button", name=auth.PROFILE_LABELS["admin"], exact=True).click()
        page.wait_for_url(self.base + draft_path)
        expect(title_input).to_have_value(title)
        expect(page.locator('.ProseMirror[contenteditable="true"]:visible').first).to_contain_text(body)
        pending = []
        def hold_publication(route):
            if route.request.method == "POST":
                pending.append(route)
            else:
                route.continue_()
        page.route("**/api/boards/notice/articles", hold_publication)
        page.get_by_role("button", name="등록", exact=True).first.dblclick(force=True)
        deadline = time.monotonic() + 10
        while not pending and time.monotonic() < deadline:
            page.wait_for_timeout(25)
        assert len(pending) == 1, "A repeated Publish click queued more than one request"
        with page.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/boards/notice/articles") as published:
            pending[0].continue_()
        assert published.value.status == 201, published.value.text()
        page.unroute("**/api/boards/notice/articles", hold_publication)
        page.wait_for_url(re.compile(r"/board/notice/\d+$"))
        assert len([item for item in self.api(guest, "/boards/notice/articles?limit=50")["items"] if item["titleKo"] == title]) == 1
        logout_tab = self.page()
        logout_tab.goto(self.base + "/admin/content")
        logout_tab.get_by_role("button", name="로그아웃", exact=True).click()
        logout_tab.wait_for_url(self.base + "/")
        assert self.api(page, "/auth/session")["authenticated"] is False
        self.api(page, "/site-content/blocks/admin", status=401)
        page.goto(self.base + "/admin/content")
        page.wait_for_url(re.compile(r"/__local-sso/authorize(?:\?|$)"))
        expect(page.get_by_role("heading", name="사이트 설정", exact=True)).to_have_count(0)
        page.get_by_role("button", name=auth.PROFILE_LABELS["admin"], exact=True).click()
        page.wait_for_url(self.base + "/admin/content")
        expect(page.get_by_role("heading", name="사이트 설정", exact=True)).to_be_visible()

    def test_fee_payment_amounts_seoul_date_and_mixed_selection(self):
        admin = self.page()
        start = 90700000 + int(self.marker[3:7], 16) * 10
        numbers = [str(start + i) for i in range(3)]
        base = "/users/fee-status/roster"
        initial = [(2, 10000), (0, 0), (6, 30000)]
        self.api(admin, base, method="PUT", body={"records": [
            {"stdNo": number, "nameKo": f"{self.marker} 납부자 {i + 1}", "admissionYear": 2026,
             "paidSemesters": semesters, "paidAmount": amount, "note": self.marker, "expectedUpdatedAt": None}
            for i, (number, (semesters, amount)) in enumerate(zip(numbers, initial))]})
        required = self.api(admin, "/users/fee-status/policy")["amount"]
        admin.goto(self.base + "/admin/finance")
        grid = admin.get_by_role("grid", name="과비 납부 관리표", exact=True)
        admin.get_by_role("searchbox", name="납부 검색", exact=True).fill(self.marker)
        expect(grid.get_by_role("row")).to_have_count(4)
        admin.clock.set_fixed_time(datetime(2026, 10, 30, 15, 30, tzinfo=timezone.utc))
        grid.get_by_role("row").filter(has_text=numbers[0]).get_by_role("checkbox").check()
        admin.get_by_role("button", name="선택 납부 처리 (1명)", exact=True).click()
        payment = admin.get_by_role("dialog", name="납부 내역 추가", exact=True)
        expect(payment.get_by_role("group", name="납부 일자", exact=True).locator("input")).to_have_value("2026-10-31")
        amount = payment.get_by_role("group", name="납부 금액 (원)", exact=True).get_by_role("spinbutton")
        expect(amount).to_have_value(str(required - 10000))
        expect(amount).to_have_attribute("readonly", "")
        payment.get_by_role("button", name="취소", exact=True).click()
        self.api(admin, "/users/fee-status/payments", method="POST", body={"idempotencyKey": self.marker + "-partial-date-setup", "payments": [
            {"stdNo": numbers[0], "amount": 5000, "paymentType": "PRIOR_PAYMENT_BALANCE", 
             "coverageSemesters": 6, "effectiveStartSemester": "2026-2", "paidAt": "2026-10-30T15:00:00.000Z", "note": self.marker}]})
        admin.reload()
        admin.get_by_role("searchbox", name="납부 검색", exact=True).fill(self.marker)
        detail = self.api(admin, base + "/detail/" + numbers[0])
        assert detail["record"]["totalPaidAmount"] == 15000 and detail["record"]["remainingAmount"] == required - 15000
        assert detail["history"][0]["paidAt"] == "2026-10-30T15:00:00.000Z"
        for number in numbers:
            grid.get_by_role("row").filter(has_text=number).get_by_role("checkbox").check()
        admin.get_by_role("button", name="선택 납부 처리 (2명)", exact=True).click()
        with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/users/fee-status/payments") as completed:
            payment.get_by_role("button", name="납부 처리", exact=True).click()
        assert completed.value.status == 201, completed.value.text()
        sent = completed.value.request.post_data_json["payments"]
        assert {item["stdNo"]: item["amount"] for item in sent} == {numbers[0]: required - 15000, numbers[1]: required}
        expect(payment).to_be_hidden()
        admin.reload()
        admin.get_by_role("searchbox", name="납부 검색", exact=True).fill(self.marker)
        for number, count in ((numbers[0], 2), (numbers[1], 1), (numbers[2], 0)):
            result = self.api(admin, base + "/detail/" + number)
            assert result["record"]["status"] == "PAID" and result["record"]["remainingAmount"] == 0
            assert len(result["history"]) == count
        admin.get_by_role("button", name="납부 상태", exact=True).click()
        admin.get_by_role("option", name="완납", exact=True).click()
        expect(grid.get_by_role("row")).to_have_count(4)
        admin.get_by_role("button", name="납부 상태", exact=True).click()
        admin.get_by_role("option", name="미납", exact=True).click()
        expect(grid.get_by_role("row")).to_have_count(1)

    def test_fee_confirmation_and_cancel_receipt(self):
        admin, student = self.page(), self.page("student")
        start = 90500000 + int(self.marker[3:7], 16)
        numbers = [str(start), str(start + 1)]
        base = "/users/fee-status/roster"
        self.api(admin, base, method="PUT", body={"records": [
            {"stdNo": number, "nameKo": f"{self.marker} 확인{i}", "admissionYear": 2026, "paidSemesters": 0,
             "paidAmount": amount, "note": self.marker, "expectedUpdatedAt": None}
            for i, (number, amount) in enumerate(zip(numbers, [10000, 0]))]})
        admin.goto(self.base + "/admin/finance")
        grid = admin.get_by_role("grid", name="과비 납부 관리표", exact=True)
        admin.get_by_role("searchbox", name="납부 검색", exact=True).fill(self.marker)
        expect(grid.get_by_role("row")).to_have_count(3)
        for number in numbers: grid.get_by_role("row").filter(has_text=number).get_by_role("checkbox").check()
        admin.get_by_role("button", name="선택 납부 처리 (2명)", exact=True).click()
        dialog = admin.get_by_role("dialog", name="납부 내역 추가", exact=True)
        expect(dialog.get_by_role("table", name="일괄 납부 확인표")).to_be_visible()
        for number in numbers: expect(dialog.get_by_role("table")).to_contain_text(number)
        expect(dialog.get_by_role("group", name="납부 유형", exact=True)).to_have_count(0)
        expect(dialog.get_by_role("spinbutton")).to_have_count(0)
        required = self.api(admin, "/users/fee-status/policy")["amount"]
        expect(dialog).to_contain_text(f"합계 {required * 2 - 10000:,}원")
        admin.screenshot(path=str(ARTIFACTS / "fee-bulk-confirmation.png"))
        with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/users/fee-status/payments") as saved:
            dialog.get_by_role("button", name="납부 처리", exact=True).click()
        assert saved.value.status == 201, saved.value.text()
        expect(dialog).to_be_hidden()
        first = self.api(admin, base + "/detail/" + numbers[0])
        payment = first["history"][0]
        cancel_path = "/users/fee-status/payments/" + payment["paymentId"] + "/cancel"
        self.api(student, cancel_path, method="POST", body={"reason":"권한 검증", "expectedUpdatedAt":payment["updatedAt"], "revokeRecognition":True}, status=403)
        grid.get_by_role("row").filter(has_text=numbers[0]).get_by_role("button", name=f"{self.marker} 확인0", exact=True).click()
        admin.get_by_role("button", name="입금 취소", exact=True).click()
        cancel = admin.get_by_role("dialog", name="입금 기록 취소", exact=True)
        cancel.get_by_role("button", name="입금 취소 확정", exact=True).click()
        expect(cancel.get_by_role("alert")).to_contain_text("취소 사유")
        assert self.api(admin, base + "/detail/" + numbers[0])["history"][0]["amount"] == required - 10000
        self.field(cancel, "취소 사유 (필수)").fill("다른 학생을 선택한 입금 오류")
        checkbox = cancel.get_by_role("checkbox", name="이 입금으로 잘못 처리된 완납 인정도 취소", exact=True)
        expect(checkbox).not_to_be_checked()
        checkbox.check()
        with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api" + cancel_path) as cancelled:
            cancel.get_by_role("button", name="입금 취소 확정", exact=True).click()
        assert cancelled.value.status == 201, cancelled.value.text()
        expect(cancel).to_be_hidden()
        after = self.api(admin, base + "/detail/" + numbers[0])
        assert after["record"]["status"] == "PARTIAL" and after["record"]["totalPaidAmount"] == 10000, after
        assert after["history"][0]["amount"] == 0 and "입금 취소" in after["history"][0]["note"]
        logs = self.api(admin, "/audit-logs?action=student_fee_payment.cancel&pageSize=100")["items"]
        log = next(item for item in logs if str(item["targetId"]) == payment["paymentId"])
        payload = json.loads(log["payload"])
        assert payload["before"]["amount"] == required - 10000 and payload["after"]["amount"] == 0
        admin.screenshot(path=str(ARTIFACTS / "fee-cancelled-receipt.png"))

    def test_fee_income_excel_preview_retry_and_duplicates(self):
        admin, student = self.page(), self.page("student")
        number = str(90400000 + int(self.marker[3:7], 16) * 2)
        new_number = str(int(number) + 1)
        existing_name, new_name = self.marker + " 기존", self.marker + " 신규"
        base = "/users/fee-status/roster"
        self.api(admin, base, method="PUT", body={"records": [{"stdNo": number, "nameKo": existing_name,
            "admissionYear": 2026, "paidSemesters": 2, "paidAmount": 10000, "note": self.marker, "expectedUpdatedAt": None}]})
        admin.goto(self.base + "/admin/finance")
        grid = admin.get_by_role("grid", name="과비 납부 관리표", exact=True)
        expect(grid).to_be_visible()
        with admin.expect_download() as downloaded:
            admin.get_by_role("button", name="입금 양식 다운로드", exact=True).click()
        template = ARTIFACTS / (self.marker + "-income-template.xlsx")
        downloaded.value.save_as(template)
        headers = xlsx_rows(template)[0]
        assert headers == ["학번", "이름", "입금액", "입금일", "메모"]
        assert xlsx_rows(template)[1][1] == "홍길동(예시)"
        summary = self.download_file(admin, admin.get_by_role("button", name="전체 명부 내보내기", exact=True), "fee-summary.xlsx")
        admin.get_by_label("입금 엑셀 파일", exact=True).set_input_files(summary)
        expect(admin.get_by_text("입금 등록 양식의 학번·이름·입금액·입금일 열이 필요합니다.", exact=False)).to_be_visible()
        rows = [headers, [number, existing_name, 15000, "2026-10-30", "추가 입금"],
                [number, existing_name, 20000, "2026-10-31", "나머지"],
                [new_number, new_name, 12000, "2026-10-30", "첫 입금"],
                [new_number, new_name, 5000, "2026-10-31", "추가"]]
        imported = ARTIFACTS / (self.marker + "-income.xlsx")
        write_xlsx(imported, rows)
        admin.get_by_label("입금 엑셀 파일", exact=True).set_input_files(imported)
        dialog = admin.get_by_role("dialog", name="입금 등록 확인", exact=True)
        expect(dialog).to_be_visible()
        expect(dialog).to_contain_text("52,000원")
        expect(dialog).to_contain_text("신규 명부 1명")
        expect(dialog.get_by_role("table").get_by_role("row")).to_have_count(5)
        assert len(self.api(admin, base + "/detail/" + number)["history"]) == 0
        dialog.get_by_role("button", name="취소", exact=True).click()
        expect(dialog).to_be_hidden()
        assert not any(row["stdNo"] == new_number for row in self.api(admin, base)["records"])
        admin.get_by_label("입금 엑셀 파일", exact=True).set_input_files(imported)
        expect(dialog).to_be_visible()
        intercepted = []
        def lose_response(route):
            response = route.fetch()
            assert response.status == 201, response.text()
            intercepted.append(route.request.post_data_json)
            route.abort("failed")
        admin.route("**/api/users/fee-status/payments/import", lose_response, times=1)
        dialog.get_by_role("button", name="입금 등록", exact=True).click()
        expect(dialog.get_by_role("alert")).to_contain_text("다시 시도")
        with admin.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api/users/fee-status/payments/import") as retry:
            dialog.get_by_role("button", name="입금 등록", exact=True).click()
        assert retry.value.status == 201, retry.value.text()
        assert retry.value.request.post_data_json == intercepted[0]
        expect(dialog).to_be_hidden()
        first = self.api(admin, base + "/detail/" + number)
        second = self.api(admin, base + "/detail/" + new_number)
        assert first["record"]["paidAmount"] == 10000 and first["record"]["totalPaidAmount"] == 45000
        assert first["record"]["status"] == "PAID" and len(first["history"]) == 2
        assert second["record"]["paidAmount"] == 0 and second["record"]["totalPaidAmount"] == 17000
        assert second["record"]["userId"] is None and len(second["history"]) == 2
        admin.get_by_role("searchbox", name="납부 검색", exact=True).fill(new_number)
        expect(grid.get_by_role("row").filter(has_text=new_number)).to_contain_text("17,000")
        duplicate = ARTIFACTS / (self.marker + "-duplicate-income.xlsx")
        write_xlsx(duplicate, [headers, rows[3]])
        admin.get_by_label("입금 엑셀 파일", exact=True).set_input_files(duplicate)
        expect(dialog).to_contain_text("중복 의심")
        expect(dialog.get_by_role("button", name="입금 등록", exact=True)).to_be_disabled()
        dialog.get_by_role("button", name="취소", exact=True).click()
        invalid = ARTIFACTS / (self.marker + "-wrong-name.xlsx")
        write_xlsx(invalid, [headers, [new_number, "다른 사람", 1000, "2026-10-31", ""]])
        admin.get_by_label("입금 엑셀 파일", exact=True).set_input_files(invalid)
        expect(dialog).to_contain_text("등록된 이름")
        expect(dialog.get_by_role("button", name="입금 등록", exact=True)).to_be_disabled()
        dialog.get_by_role("button", name="취소", exact=True).click()
        self.api(student, "/users/fee-status/payments/import/preview", method="POST", body={"entries": intercepted[0]["entries"]}, status=403)
        self.api(student, "/users/fee-status/payments/import", method="POST", body=intercepted[0], status=403)

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
                if suite.page_errors:
                    error += "\nBrowser errors:\n" + "\n".join(suite.page_errors)
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
