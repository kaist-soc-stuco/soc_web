"""Mobile interaction regressions on the disposable synthetic product QA stack."""
from pathlib import Path
import argparse
import base64
import json
import re
import time
import traceback
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright
from browser_product_e2e import AcceptanceSuite, auth

BASE = "http://127.0.0.1:38765"
OUT = Path(__file__).resolve().parents[2] / "output/product-e2e/mobile"


class MobileSuite(AcceptanceSuite):
    context_options = {**AcceptanceSuite.context_options, "viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True}

    def page(self, actor="admin"):
        page = super().page(actor)
        # Finish the initial fixture page before immediately navigating elsewhere.
        # WebKit reports in-flight fetches cancelled by a hard navigation as page errors.
        page.wait_for_load_state("networkidle")
        page.set_viewport_size({"width": 390, "height": 844})
        return page

    def capture(self, page, name):
        page.mouse.move(2, 2)
        page.screenshot(path=str(OUT / f"{name}.png"), full_page=name.startswith("12-"))

    def no_overflow(self, page):
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), page.url

    def test_my_page_and_profile_navigation(self):
        page = self.page()
        page.goto(BASE + "/events")
        page.locator('.home-header-utilities button[aria-label$="프로필"]').click()
        page.wait_for_url(BASE + "/mypage")
        expect(page.get_by_role("heading", name="마이페이지", exact=True)).to_be_visible()
        expect(page.locator(".mobile-mypage-identity")).to_contain_text("90990001")
        expect(page.locator("#fee-consent")).to_have_count(0)
        self.capture(page, "01-mypage")
        page.get_by_role("button", name="스크랩", exact=True).click()
        expect(page.get_by_role("tab", name="활동 내역")).to_have_attribute("aria-selected", "true")
        self.capture(page, "02-mypage-activity")
        page.goto(BASE + "/mypage#fee-consent")
        expect(page.locator("#fee-consent")).to_have_count(0)
        for width in [320, 390]:
            page.set_viewport_size({"width": width, "height": 844})
            self.no_overflow(page)

    def test_menu_header_seam_and_close_at_bottom(self):
        page = self.page("guest")
        # Long-page DOM snapshots dwarf this geometry check, particularly in WebKit.
        page.context.tracing.stop()
        page.context.tracing.start(screenshots=False, snapshots=False)
        samples = []
        for width in [320, 390, 430, 768, 1024]:
            page.set_viewport_size({"width": width, "height": 844})
            for path in ["/", "/about"]:
                print(f"CHECK header {width}px {path}", flush=True)
                page.goto(BASE + path)
                page.locator("main").first.wait_for()
                page.wait_for_load_state("networkidle")
                header = page.locator("[data-site-header]")
                for at_bottom in [False, True]:
                    page.evaluate("bottom => window.scrollTo(0, bottom ? document.documentElement.scrollHeight : 0)", at_bottom)
                    page.wait_for_timeout(60)
                    before = page.evaluate("scrollY")
                    assert abs(header.bounding_box()["y"]) < .5, (width, path, at_bottom, header.bounding_box())
                    trigger = page.locator('button[aria-controls="mobile-primary-navigation"]')
                    trigger.click()
                    menu = page.locator("#mobile-primary-navigation")
                    expect(menu).to_be_visible()
                    menu.evaluate("async el => { await Promise.race([Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {}))), new Promise(done => setTimeout(done, 1000))]); }")
                    expect(menu).to_have_css("opacity", "1")
                    bounds = header.bounding_box()
                    gap = menu.bounding_box()["y"] - bounds["y"] - bounds["height"]
                    assert abs(gap) < .5, ("Menu seam", width, path, at_bottom, gap)
                    frames = page.evaluate("""async () => {
                      const frames = []; const start = performance.now();
                      document.querySelector('button[aria-controls="mobile-primary-navigation"]').click();
                      await new Promise(done => { const timeout = setTimeout(done, 1000); const tick = () => {
                        const header = document.querySelector('[data-site-header]');
                        const main = header.querySelector('.site-header-main');
                        const rect = header.getBoundingClientRect(); const row = main.getBoundingClientRect();
                        const menu = document.querySelector('#mobile-primary-navigation');
                        frames.push({top:rect.top,bottom:rect.bottom,rowTop:row.top,rowBottom:row.bottom,
                          gap:menu ? menu.getBoundingClientRect().top - rect.bottom : 0,
                          opacity:getComputedStyle(header).opacity, visible:!!header.offsetHeight});
                        if(performance.now()-start<350) requestAnimationFrame(tick); else {clearTimeout(timeout);done();}
                      }; requestAnimationFrame(tick); }); return frames;
                    }""")
                    assert len(frames) >= 2 and all(frame["visible"] and abs(frame["top"]) < .5 and abs(frame["rowTop"]) < .5 and frame["opacity"] == "1" and frame["gap"] < .5 for frame in frames), (width, path, at_bottom, frames)
                    expect(menu).to_have_count(0)
                    assert abs(page.evaluate("scrollY") - before) <= 1, ("Scroll position changed", width, path, before, page.evaluate("scrollY"))
                    samples.append({"width":width,"path":path,"bottom":at_bottom,"gap":gap,"frames":len(frames)})
                if width == 390 and path == "/about": self.capture(page,"menu-header-bottom")
        (OUT / "menu-header-geometry.json").write_text(json.dumps(samples,ensure_ascii=False,indent=2),encoding="utf-8")

    def test_menu_and_notification_sheet(self):
        page = self.page()
        page.goto(BASE + "/mypage")
        page.get_by_role("button", name="메뉴 열기", exact=True).click()
        menu = page.locator("#mobile-primary-navigation")
        expect(menu).to_be_visible()
        expect(menu.locator(".mobile-nav-profile")).to_contain_text("90990001")
        expect(menu.get_by_role("link", name="관리자 콘솔")).to_have_attribute("href", "/admin/moderation")
        assert menu.locator(".mobile-nav-profile").bounding_box()["y"] < menu.locator("nav").bounding_box()["y"]
        expect(page.get_by_role("button", name="알림", exact=True)).to_be_hidden()
        self.capture(page, "03-menu")
        page.locator('button[aria-controls="mobile-primary-navigation"]').click()
        page.get_by_role("button", name="알림", exact=True).click()
        sheet = page.locator(".mobile-notification-sheet")
        expect(sheet).to_be_visible()
        page.wait_for_timeout(350)
        assert abs(sheet.bounding_box()["y"] + sheet.bounding_box()["height"] - 844) <= 1
        self.capture(page, "04-notifications")
        page.keyboard.press("Escape")
        expect(sheet).to_be_hidden()

    def test_search_composition_debounce_and_sheet_drag(self):
        page = self.page()
        page.goto(BASE + "/")
        page.get_by_role("button", name="통합검색", exact=True).click()
        field = page.locator("#mobile-site-search-input")
        requests = []
        page.on("request", lambda request: requests.append(request.url) if "/api/" in request.url and re.search(r"[?&](q|query)=", request.url) else None)
        field.fill("ㅁ")
        page.wait_for_timeout(400)
        expect(page.locator(".mobile-search-preview")).to_have_count(0)
        expect(page.locator(".mobile-search-submit")).to_have_count(0)
        assert not requests, requests
        field.dispatch_event("compositionstart")
        field.fill("학부")
        field.press("Enter")
        assert "/search" not in page.url
        page.wait_for_timeout(400)
        expect(page.locator(".mobile-search-preview")).to_have_count(0)
        assert not requests, requests
        field.dispatch_event("compositionend")
        page.wait_for_timeout(150)
        assert not requests, requests
        expect(page.locator(".mobile-search-preview")).to_be_visible()
        expect(page.locator(".mobile-search-preview")).not_to_have_attribute("aria-busy", "true")
        assert requests
        overlay = page.locator(".mobile-search-overlay")
        assert "미리보기" not in overlay.inner_text()
        expect(overlay.get_by_text("검색 결과", exact=True)).to_have_count(0)
        assert field.evaluate("el => getComputedStyle(el.parentElement.querySelector('svg')).width") == "18px"
        margins = page.locator(".mobile-search-form").evaluate("el => { const left=el.querySelector(':scope > svg').getBoundingClientRect(); const right=el.querySelector('button svg').getBoundingClientRect(); return [left.left, innerWidth-right.right]; }")
        assert abs(margins[0] - margins[1]) <= 1, margins
        self.capture(page, "05-search-panel")
        page.locator(".mobile-search-submit").click()
        page.wait_for_url(re.compile(r"/search\?q="))
        expect(page.locator(".search-query-status")).to_be_visible()
        assert page.locator(".search-query-status").evaluate("el => getComputedStyle(el).paddingTop === getComputedStyle(el).paddingBottom")
        page.get_by_role("button", name="필터", exact=True).click()
        dialog = page.get_by_role("dialog", name="검색 필터", exact=True)
        expect(dialog).to_be_visible()
        page.wait_for_timeout(350)
        handle = dialog.locator(".mobile-sheet-handle")
        rect = handle.bounding_box()
        x, y = rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x, y - 110, steps=8)
        box = dialog.bounding_box()
        assert box["y"] + box["height"] >= 843, box
        page.mouse.up()
        page.wait_for_timeout(350)
        self.capture(page, "06-sheet-upward-drag")
        rect = handle.bounding_box()
        x, y = rect["x"] + rect["width"] / 2, rect["y"] + rect["height"] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x, y + 190, steps=10)
        page.mouse.up()
        expect(dialog).to_be_hidden()
        assert page.evaluate("getComputedStyle(document.body).overflow") != "hidden"

    def test_post_detail_header_actions_and_menu(self):
        page = self.page()
        created = self.api(page, "/boards/notice/articles", method="POST", status=201, body={"titleKo": self.marker + " 모바일 게시글", "contentKo": "<p>모바일 상세 화면을 확인합니다.</p>", "visibilityScope": "PUBLIC"})
        page.goto(BASE + "/")
        home_header = page.locator("header.site-header-home")
        expect(home_header).to_be_visible()
        home_height = home_header.bounding_box()["height"]
        page.goto(BASE + f"/board/notice/{created['articleId']}")
        # The loading shell briefly has its own header before the article mounts.
        expect(page.get_by_role("heading", name=self.marker + " 모바일 게시글", exact=True)).to_be_visible()
        expect(page.locator(".mobile-detail-header")).to_be_visible()
        assert abs(page.locator(".mobile-detail-header").bounding_box()["height"] - home_height) <= 1
        expect(page.locator(".article-adjacent-navigation")).to_be_hidden()
        engagement = page.locator(".mobile-article-engagement")
        expect(engagement).to_be_visible()
        assert engagement.evaluate("el => getComputedStyle(el).borderTopWidth === '1px' && getComputedStyle(el).borderBottomWidth === '1px'")
        page.get_by_role("button", name="게시글 더보기", exact=True).click()
        actions = page.locator(".mobile-detail-menu")
        expect(actions).to_be_visible()
        assert all(box["height"] >= 47 for box in actions.get_by_role("menuitem").evaluate_all("nodes => nodes.map(el=>({height:el.getBoundingClientRect().height}))"))
        self.capture(page, "07-post-actions")

    def test_event_fab_and_mobile_admin_allowlist(self):
        page = self.page()
        page.goto(BASE + "/events")
        fab = page.locator(".board-write-fab")
        expect(fab).to_be_visible()
        expect(fab).to_have_attribute("href", "/events/write")
        self.capture(page, "08-event-fab")
        page.goto(BASE + "/surveys")
        expect(page.locator('a[href="/admin/surveys/new"]')).to_be_hidden()
        expect(page.locator(".board-write-fab")).to_have_count(0)
        page.goto(BASE + "/admin/surveys/new")
        expect(page.get_by_role("heading", name="PC에서 이용해 주세요")).to_be_visible()
        expect(page.locator('input[name="titleKo"]')).to_have_count(0)
        self.capture(page, "09-admin-guard")
        page.get_by_role("button", name="이용 가능한 관리 메뉴").click()
        nav = page.get_by_role("dialog").get_by_role("navigation", name="관리자 메뉴", exact=True)
        links = nav.locator("a")
        expect(links).to_have_count(5)
        paths = links.evaluate_all("nodes => nodes.map(el=>el.getAttribute('href'))")
        assert set(paths) == {"/admin/moderation", "/admin/calendar", "/admin/contacts", "/admin/faq", "/admin/boards"}, paths
        assert all(height >= 47 for height in links.evaluate_all("nodes=>nodes.map(el=>el.getBoundingClientRect().height)"))
        self.capture(page, "10-admin-menu")
        for path in paths:
            page.goto(BASE + path)
            expect(page.locator(".mobile-admin-guard")).to_have_count(0)
            self.no_overflow(page)
        page.goto(BASE + "/admin")
        page.wait_for_url(BASE + "/admin/moderation")

    def test_calendar_month_week_and_continuous_agenda(self):
        page = self.page()
        # Select the synthetic fixture month without changing the authentication clock.
        page.goto(BASE + "/calendar?selected=2026-10-30")
        calendar = page.locator(".mobile-public-calendar")
        expect(calendar).to_be_visible()
        expect(page.get_by_role("button", name="캘린더 연동", exact=True)).to_be_visible()
        dates = calendar.locator(".mobile-calendar-date")
        assert dates.count() in [35, 42]
        month = calendar.locator(".mobile-calendar-title")
        month.click()
        expect(dates).to_have_count(7)
        month.click()
        assert dates.count() in [35, 42]
        expect(page.locator(".mobile-calendar-agenda-group").first).to_be_visible()
        ids = page.locator(".mobile-calendar-agenda-group a[href]").evaluate_all("nodes=>nodes.map(el=>el.getAttribute('href'))")
        assert len(ids) == len(set(ids)), ids
        self.capture(page, "11-calendar")
        expect(page.get_by_role("combobox", name="일정 종류", exact=True)).to_have_count(0)
        expect(page.get_by_text("다가오는 일정", exact=True)).to_have_count(0)
        expect(page.locator(".calendar-page-heading")).to_have_count(0)
        expect(page.locator(".mobile-calendar-event-card").first).to_be_visible()
        expect(page.locator(".mobile-calendar-timeline .calendar-agenda-marker")).to_have_count(0)
        connect = calendar.get_by_role("button", name="캘린더 연동", exact=True)
        next_month = calendar.get_by_role("button", name="다음 달", exact=True)
        assert connect.bounding_box()["x"] > next_month.bounding_box()["x"]
        connect.click()
        sheet = page.get_by_role("dialog", name="캘린더 연동", exact=True)
        expect(sheet.get_by_role("link", name="Google 캘린더에 추가", exact=True)).to_be_visible()
        sheet.get_by_role("button", name="캘린더 연동 닫기", exact=True).click()
        expect(sheet).to_be_hidden()
        self.no_overflow(page)

    def test_usage_event_registration_survey_and_network_retry(self):
        admin, student = self.page(), self.page("student")
        title = self.marker + " 모바일 참가 신청"
        event = self.api(admin, "/boards/_EVENT/articles", method="POST", status=201, body={
            "titleKo": title, "contentKo": "<p>모바일에서 참가 신청합니다.</p>", "visibilityScope": "PUBLIC",
            "eventStartDate": (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(),
            "eventEndDate": (datetime.now(timezone.utc) + timedelta(days=2, hours=2)).isoformat(),
        })
        survey = self.api(admin, "/surveys", method="POST", status=201, body={
            "titleKo": title, "isKoreanOnly": True, "isAlwaysOpen": True, "allowResponseEdit": True,
            "connectedArticleId": str(event["articleId"]),
        })
        path = f"/surveys/{survey['id']}"
        sections = [self.api(admin, path + "/sections", method="POST", status=201,
                            body={"titleKo": name, "sortOrder": i}) for i, name in enumerate(("신청 정보", "추가 정보"))]
        def question(section, title, kind, order, **extra):
            return self.api(admin, path + f"/sections/{section['id']}/questions", method="POST", status=201,
                            body={"titleKo": title, "questionType": kind, "sortOrder": order, "isRequired": True, **extra})
        name = question(sections[0], "참가자 이름", "short_text", 0)
        choice = question(sections[0], "참가 유형", "dropdown", 1,
                          options=[{"value": "student", "labelKo": "학부생"}, {"value": "other", "labelKo": "기타"}])
        day = question(sections[1], "희망 날짜", "date", 0)
        clock = question(sections[1], "희망 시간", "time", 1)
        upload = question(sections[1], "참고 파일", "file_upload", 2,
                          config={"maxFiles": 1, "allowedMimeTypes": ["image/png"], "maxSizeBytes": 100000})
        self.api(admin, path, method="PATCH", body={"isPublished": True})
        student.goto(BASE + f"/events/{event['articleId']}")
        cta = student.locator("[data-survey-cta] a")
        expect(cta).to_be_visible()
        assert abs(cta.bounding_box()["width"] - student.locator("[data-survey-cta]").bounding_box()["width"]) <= 2
        with student.expect_popup() as opened:
            cta.tap()
        form = opened.value
        self.pages.append(form)
        form.on("pageerror", lambda error: self.page_errors.append(str(error)))
        form.wait_for_url(BASE + f"/survey/{survey['id']}")
        form.get_by_role("button", name="다음", exact=True).click()
        expect(form.get_by_text("필수 질문입니다", exact=False).first).to_be_visible()
        form.locator('main input[type="text"]').fill("모바일 참가자")
        native = form.get_by_role("combobox", name=re.compile("참가 유형"))
        assert native.evaluate("el=>el.tagName") == "SELECT"
        native.select_option("student")
        form.get_by_role("button", name="다음", exact=True).click()
        form.locator('input[type="date"]').fill("2026-11-02")
        form.locator('input[type="time"]').fill("18:30")
        for width in (320, 390):
            form.set_viewport_size({"width": width, "height": 844})
            self.no_overflow(form)
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5uUAAAAASUVORK5CYII=")
        form.locator('input[type="file"]').set_input_files({"name": "mobile-response.png", "mimeType": "image/png", "buffer": png})
        expect(form.get_by_text("mobile-response.png", exact=True)).to_be_visible()
        form.reload()
        expect(form.locator('main input[type="text"]')).to_have_value("모바일 참가자")
        expect(native).to_have_value("student")
        form.get_by_role("button", name="다음", exact=True).click()
        expect(form.locator('input[type="date"]')).to_have_value("2026-11-02")
        expect(form.locator('input[type="time"]')).to_have_value("18:30")
        expect(form.get_by_text("mobile-response.png", exact=True)).to_be_visible()
        def disconnect(route):
            if route.request.method == "POST": route.abort("failed")
            else: route.continue_()
        form.route("**/api" + path + "/responses", disconnect)
        form.get_by_role("button", name="제출", exact=True).click()
        expect(form.get_by_role("button", name="제출", exact=True)).to_be_enabled()
        assert self.api(admin, path + "/responses")["total"] == 0
        form.unroute("**/api" + path + "/responses", disconnect)
        with form.expect_response(lambda r: r.request.method == "POST" and urlsplit(r.url).path == "/api" + path + "/responses") as saved:
            form.get_by_role("button", name="제출", exact=True).click()
        assert saved.value.status == 201, saved.value.text()
        response = self.api(form, path + "/responses/mine")
        answers = {item["questionId"]: item["content"] for item in response["answers"]}
        assert answers[name["id"]]["text"] == "모바일 참가자" and answers[choice["id"]]["value"] == "student"
        assert answers[day["id"]]["date"] == "2026-11-02" and answers[clock["id"]]["time"] == "18:30"
        assert len(answers[upload["id"]]["assetIds"]) == 1
        form.reload()
        expect(form.get_by_text("이전에 제출한 응답을 수정하는 중입니다.", exact=False)).to_be_visible()
        form.locator('main input[type="text"]').fill("수정한 모바일 참가자")
        form.get_by_role("button", name="다음", exact=True).click()
        with form.expect_response(lambda r: r.request.method == "PATCH" and urlsplit(r.url).path == "/api" + path + "/responses/mine") as updated:
            form.get_by_role("button", name="저장", exact=True).click()
        assert updated.value.status == 200, updated.value.text()
        assert self.api(admin, path + "/responses")["total"] == 1
        self.no_overflow(form)
        self.capture(form, "13-mobile-survey")
        guest = self.page("guest")
        guest.goto(BASE + f"/survey/{survey['id']}")
        guest.get_by_role("link", name="로그인", exact=True).click()
        guest.wait_for_url(re.compile(r"/__local-sso/authorize(?:\?|$)"))
        guest.get_by_role("button", name=auth.PROFILE_LABELS["student"], exact=True).click()
        guest.wait_for_url(BASE + f"/survey/{survey['id']}")
        expect(guest.get_by_role("heading", name=title, exact=True)).to_be_visible()

    def test_usage_roadmap_course_sheet_and_filters(self):
        page = self.page("student")
        page.goto(BASE + "/life/roadmap")
        field = page.get_by_role("searchbox", name="과목 검색", exact=True)
        field.fill("CS10001")
        row = page.locator(".mobile-roadmap-course-row").first
        expect(row).to_be_visible()
        for width in (320, 390):
            page.set_viewport_size({"width": width, "height": 844})
            self.no_overflow(page)
        row.click()
        sheet = page.locator(".mobile-course-sheet")
        expect(sheet).to_be_visible()
        page.wait_for_timeout(400)
        initial = sheet.bounding_box()
        tabs = sheet.get_by_role("tablist", name="과목 상세 탭", exact=True)
        sheet.get_by_role("tab", name=re.compile("개설 분반")).click()
        page.wait_for_timeout(200)
        assert abs(sheet.bounding_box()["height"] - initial["height"]) <= 2
        assert sheet.locator(".roadmap-course-code").evaluate("el=>getComputedStyle(el).whiteSpace") == "nowrap"
        top = tabs.bounding_box()["y"]
        scroll = sheet.locator(".roadmap-details-scroll")
        assert scroll.evaluate("el=>{el.scrollTop=240;return el.scrollTop;}") > 0
        assert abs(tabs.bounding_box()["y"] - top) <= 1
        sheet.get_by_role("tab", name="기본 정보", exact=True).click()
        assert abs(sheet.bounding_box()["height"] - initial["height"]) <= 2
        self.capture(page, "14-mobile-course")
        sheet.get_by_role("button", name="과목 상세 닫기", exact=True).click()
        expect(sheet).to_be_hidden()
        assert page.evaluate("getComputedStyle(document.body).overflow") != "hidden"
        trigger = page.get_by_role("button", name="필터", exact=True)
        trigger.tap()
        filters = page.get_by_role("dialog", name="과목 필터", exact=True)
        filters.get_by_role("combobox", name="학기", exact=True).select_option("2026-spring")
        filters.get_by_role("switch").check()
        filters.get_by_role("button", name="적용", exact=True).click()
        expect(trigger.locator(".mobile-filter-active-dot")).to_be_visible()
        page.reload()
        expect(field).to_have_value("CS10001")
        trigger.click()
        expect(filters.get_by_role("combobox", name="학기", exact=True)).to_have_value("2026-spring")
        expect(filters.get_by_role("switch")).to_be_checked()
        filters.get_by_role("button", name="초기화", exact=True).click()
        filters.get_by_role("button", name="적용", exact=True).click()
        expect(trigger.locator(".mobile-filter-active-dot")).to_have_count(0)
        field.fill("")
        self.no_overflow(page)

    def test_usage_discovery_filter_apply_cancel_and_reload(self):
        page = self.page("student")
        for path in ("/events", "/surveys"):
            page.goto(BASE + path)
            trigger = page.get_by_role("button", name="필터", exact=True)
            expect(trigger.locator(".mobile-filter-active-dot")).to_have_count(0)
            trigger.click()
            sheet = page.get_by_role("dialog", name="필터", exact=True)
            expect(sheet.get_by_role("radio").first).to_have_attribute("value", "all")
            sheet.get_by_role("radio", name=re.compile("지난 행사|종료된 설문")).check()
            sheet.get_by_label("시작일", exact=True).fill("2026-01-01")
            sheet.get_by_label("종료일", exact=True).fill("2026-12-31")
            sheet.get_by_role("button", name="적용", exact=True).click()
            expect(trigger.locator(".mobile-filter-active-dot")).to_be_visible()
            assert "state=closed" in page.url and "from=2026-01-01" in page.url and "to=2026-12-31" in page.url
            page.reload()
            trigger.click()
            expect(sheet.get_by_role("radio", name=re.compile("지난 행사|종료된 설문"))).to_be_checked()
            expect(sheet.locator('input[type="date"]').first).to_have_value("2026-01-01")
            sheet.locator('input[type="date"]').first.fill("2026-02-01")
            page.keyboard.press("Escape")
            expect(sheet).to_be_hidden()
            assert "from=2026-01-01" in page.url
            trigger.click()
            expect(sheet.locator('input[type="date"]').first).to_have_value("2026-01-01")
            sheet.get_by_role("button", name="초기화", exact=True).click()
            sheet.get_by_role("button", name="적용", exact=True).click()
            expect(trigger.locator(".mobile-filter-active-dot")).to_have_count(0)
            assert "from=" not in page.url and "to=" not in page.url
            expect(page.get_by_role("radiogroup")).to_have_count(0)
            self.no_overflow(page)

    def test_usage_mobile_write_scrap_and_notification_navigation(self):
        admin, student = self.page(), self.page("student")
        title, body = self.marker + " 모바일 작성", self.marker + " 모바일 본문"
        student.set_viewport_size({"width": 320, "height": 568})
        self.editor(student, "/board/suggestions/write", title).fill(body)
        self.no_overflow(student)
        article_id = self.publish_article(student, "suggestions")
        student.set_viewport_size({"width": 390, "height": 844})
        expect(student.get_by_role("heading", name=title, exact=True)).to_be_visible()
        scrap = student.get_by_role("button", name="스크랩", exact=True)
        scrap.click()
        expect(scrap).to_have_attribute("aria-pressed", "true")
        reply = self.marker + " 모바일 알림 댓글"
        self.api(admin, f"/boards/suggestions/articles/{article_id}/comments", method="POST", status=201, body={"content": reply})
        student.goto(BASE + "/mypage")
        student.get_by_role("button", name="스크랩", exact=True).click()
        expect(student.get_by_role("link").filter(has_text=title).first).to_be_visible()
        student.get_by_role("button", name="알림", exact=True).click()
        sheet = student.get_by_role("dialog", name="알림", exact=True)
        notice = sheet.get_by_role("button").filter(has_text=title)
        expect(notice).to_be_visible()
        notice.click()
        student.wait_for_url(re.compile(f"/board/suggestions/{article_id}#comment-"))
        expect(sheet).to_be_hidden()
        expect(student.locator("#article-comments").get_by_text(reply, exact=True)).to_be_visible()
        notifications = self.api(student, "/notifications")
        assert any(item["isRead"] and title in (item.get("bodyKo") or "") for item in notifications["items"]), notifications
        assert student.evaluate("getComputedStyle(document.body).overflow") != "hidden"
        self.no_overflow(student)
        self.capture(student, "15-mobile-notification")
        for code in ("notice", "_EVENT"):
            event_fields = {"eventStartDate": (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()} if code == "_EVENT" else {}
            article = self.api(admin, f"/boards/{code}/articles", method="POST", status=201,
                               body={"titleKo": title + " " + code, "contentKo": "<p>게시판별 알림 이동을 확인합니다.</p>", "visibilityScope": "PUBLIC", **event_fields})
            self.api(student, f"/boards/{code}/articles/{article['articleId']}/comments", method="POST", status=201, body={"content": reply})
            admin.goto(BASE + "/mypage")
            admin.get_by_role("button", name="알림", exact=True).click()
            admin.get_by_role("dialog", name="알림", exact=True).get_by_role("button").filter(has_text=title + " " + code).click()
            route = "events" if code == "_EVENT" else "board/notice"
            admin.wait_for_url(re.compile(f"/{route}/{article['articleId']}#comment-"))

    def test_usage_notifications_refresh_and_unread_queue(self):
        admin, student = self.page(), self.page("student")
        title = self.marker + " 알림 대기열"
        article = self.api(student, "/boards/suggestions/articles", method="POST", status=201,
                           body={"titleKo": title, "contentKo": "<p>읽지 않은 알림을 확인합니다.</p>", "visibilityScope": "PUBLIC"})
        article_id = article["articleId"]
        with student.expect_response(lambda r: r.request.method == "GET" and urlsplit(r.url).path == "/api/notifications"):
            student.goto(BASE + "/mypage")
        for index in range(6):
            self.api(admin, f"/boards/suggestions/articles/{article_id}/comments", method="POST", status=201,
                     body={"content": f"{self.marker} 답변 {index + 1}"})
        for index in range(6):
            if index:
                student.goto(BASE + "/mypage")
            student.get_by_role("button", name="알림", exact=True).click()
            sheet = student.get_by_role("dialog", name="알림", exact=True)
            notice = sheet.get_by_role("button").filter(has_text=title).first
            expect(notice, f"Unread notification {index + 1}/6 must remain reachable").to_be_visible()
            notice.click()
            student.wait_for_url(re.compile(f"/board/suggestions/{article_id}#comment-"))
            expect(sheet).to_be_hidden()
        records = self.api(student, "/notifications?pageSize=50")["items"]
        own = [item for item in records if title in (item.get("bodyKo") or "")]
        assert len(own) == 6 and all(item["isRead"] for item in own), own

    def test_usage_faq_search_categories_and_language(self):
        admin, student = self.page(), self.page("student")
        title, translated, keyword = self.marker + " 과비 안내", self.marker + " Fee FAQ", self.marker + " 본문검색어"
        long_url = "https://example.invalid/" + "long-unbroken-link" * 24
        faq = self.api(admin, "/boards/faq/articles", method="POST", status=201, body={
            "titleKo": title, "titleEn": translated, "visibilityScope": "PUBLIC", "faqCategory": "fees",
            "contentKo": f"<p>{'안내 본문입니다. ' * 40}</p><p>{keyword}</p><p><a href='{long_url}'>{long_url}</a></p>",
            "contentEn": "<p>Please contact the council for payment inquiries.</p>",
        })
        student.set_viewport_size({"width": 320, "height": 844})
        student.goto(BASE + "/board/faq")
        search = student.get_by_role("searchbox", name="FAQ 검색", exact=True)
        search.fill(title)
        question = student.get_by_role("button", name=title, exact=True)
        question.click()
        answer = student.get_by_role("region", name=title, exact=True)
        expect(answer).to_contain_text(keyword)
        self.no_overflow(student)
        search.fill(keyword)
        expect(question).to_be_visible()
        trigger = student.get_by_role("button", name="필터", exact=True)
        trigger.click()
        sheet = student.get_by_role("dialog", name="FAQ 필터", exact=True)
        sheet.get_by_role("radio", name="계정·이용", exact=True).check()
        sheet.get_by_role("button", name="적용", exact=True).click()
        expect(question).to_have_count(0)
        trigger.click()
        sheet.get_by_role("radio", name="과비 납부", exact=True).check()
        sheet.get_by_role("button", name="적용", exact=True).click()
        expect(question).to_be_visible()
        expect(trigger.locator(".mobile-filter-active-dot")).to_be_visible()
        student.get_by_role("button", name="메뉴 열기", exact=True).click()
        student.get_by_role("button", name="영어로 전환", exact=True).click()
        student.keyboard.press("Escape")
        expect(student.locator("#mobile-primary-navigation")).to_be_hidden()
        expect(student.get_by_role("button", name=translated, exact=True)).to_be_visible()
        expect(student.get_by_role("region", name=translated, exact=True)).to_contain_text("Please contact the council")
        self.no_overflow(student)
        student.get_by_role("button", name="Open menu", exact=True).click()
        student.get_by_role("button", name="Switch to Korean", exact=True).click()
        student.keyboard.press("Escape")
        expect(question).to_be_visible()
        self.api(admin, f"/boards/faq/articles/{faq['articleId']}", method="DELETE")

    def test_fee_status_has_no_separate_consent(self):
        admin, page = self.page(), self.page("student")
        user_id = self.api(page, "/auth/session")["userId"]
        fee_before = self.api(admin, f"/users/{user_id}/fee-status")
        fee_requests = []
        page.on("request", lambda request: fee_requests.append(request.url)
                if "/users/me/fee-consent" in request.url else None)
        page.goto(BASE + "/mypage")
        expect(page.get_by_role("heading", name="마이페이지", exact=True)).to_be_visible()
        expect(page.locator("#fee-consent")).to_have_count(0)
        expect(page.get_by_text("과비 개인정보 동의", exact=True)).to_have_count(0)
        assert self.api(admin, f"/users/{user_id}/fee-status")["status"] == fee_before["status"]
        assert not fee_requests, fee_requests
        page.set_viewport_size({"width": 320, "height": 568})
        self.no_overflow(page)

    def test_desktop_views_and_admin_access_remain(self):
        page = self.page()
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.goto(BASE + "/mypage")
        expect(page.locator(".mobile-mypage-heading")).to_be_hidden()
        expect(page.locator("#fee-consent")).to_have_count(0)
        page.locator('.home-header-utilities button[aria-label$="프로필"]').click()
        expect(page.get_by_role("button", name="로그아웃", exact=True)).to_be_visible()
        page.goto(BASE + "/calendar")
        expect(page.locator(".mobile-public-calendar")).to_have_count(0)
        page.goto(BASE + "/admin/content")
        expect(page.locator(".mobile-admin-guard")).to_have_count(0)
        expect(page.locator("aside").get_by_role("link", name="유저 관리", exact=True)).to_be_visible()
        self.capture(page, "12-desktop-admin")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--only", action="append", help="Run matching scenario names")
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--browser", choices=["chromium", "webkit"], default="chromium")
    args = parser.parse_args()
    health = json.load(urlopen(BASE + "/__local-sso/health", timeout=5))
    assert health.get("kind") == "synthetic-local-sso", "Refusing to test a live site"
    OUT.mkdir(parents=True, exist_ok=True)
    expect.set_options(timeout=15000)
    results = []
    with sync_playwright() as playwright:
        browser = getattr(playwright, args.browser).launch(headless=not args.headed)
        suite = MobileSuite(browser, BASE)
        device = dict(playwright.devices["iPhone 13" if args.browser == "webkit" else "Pixel 7"])
        device.pop("default_browser_type", None)
        suite.context_options = {**suite.context_options, **device, "viewport": {"width": 390, "height": 844}}
        names = [name for name in MobileSuite.__dict__ if name.startswith("test_") and (not args.only or any(term in name for term in args.only))]
        if not names:
            raise SystemExit("No matching scenario")
        for name in names:
            print("RUN", name, flush=True)
            started = time.monotonic()
            suite.page_errors.clear()
            try:
                getattr(suite, name)()
                assert not suite.page_errors, "Unhandled browser errors: " + "\n".join(suite.page_errors)
                print("PASS", name, flush=True)
                results.append({"test": name, "passed": True, "seconds": round(time.monotonic() - started, 1)})
            except Exception as error:
                print("FAIL", name, traceback.format_exc(), flush=True)
                suite.pages[-1].screenshot(path=str(OUT / (name + "-failure.png")), full_page=True)
                results.append({"test": name, "passed": False, "error": str(error)})
            for actor, context in suite.contexts.items():
                context.tracing.stop(**({"path": str(OUT / f"{name}-{args.browser}-{actor}.zip")} if not results[-1]["passed"] else {}))
                context.tracing.start(screenshots=True, snapshots=True)
            for page in suite.pages:
                page.close()
            suite.pages.clear()
        suffix = "" if args.browser == "chromium" else "-" + args.browser
        (OUT / (f"results{suffix}-selected.json" if args.only else f"results{suffix}.json")).write_text(json.dumps({"browser": args.browser, "results": results, "pageErrors": suite.page_errors}, ensure_ascii=False, indent=2), encoding="utf-8")
        suite.close()
        browser.close()
    raise SystemExit(1 if any(not result["passed"] for result in results) else 0)


if __name__ == "__main__":
    main()
