"""Mobile interaction regressions on the disposable synthetic product QA stack."""
from pathlib import Path
import argparse
import json
import re
import time
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright
from browser_product_e2e import AcceptanceSuite

BASE = "http://127.0.0.1:38765"
OUT = Path(__file__).resolve().parents[2] / "output/product-e2e/mobile"


class MobileSuite(AcceptanceSuite):
    def page(self, actor="admin"):
        page = super().page(actor)
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
        disclosure = page.locator(".mobile-fee-disclosure")
        expect(disclosure).to_have_attribute("aria-expanded", "false")
        self.capture(page, "01-mypage")
        disclosure.click()
        expect(page.locator("#fee-consent-content")).to_be_visible()
        disclosure.click()
        expect(page.locator("#fee-consent-content")).to_be_hidden()
        page.get_by_role("button", name="스크랩", exact=True).click()
        expect(page.get_by_role("tab", name="활동 내역")).to_have_attribute("aria-selected", "true")
        self.capture(page, "02-mypage-activity")
        page.goto(BASE + "/mypage#fee-consent")
        expect(page.locator("#fee-consent-content")).to_be_visible()
        for width in [320, 390]:
            page.set_viewport_size({"width": width, "height": 844})
            self.no_overflow(page)

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

    def test_desktop_views_and_admin_access_remain(self):
        page = self.page()
        page.set_viewport_size({"width": 1440, "height": 1000})
        page.goto(BASE + "/mypage")
        expect(page.locator(".mobile-mypage-heading")).to_be_hidden()
        expect(page.locator("#fee-consent-content")).to_be_visible()
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
    args = parser.parse_args()
    health = json.load(urlopen(BASE + "/__local-sso/health", timeout=5))
    assert health.get("kind") == "synthetic-local-sso", "Refusing to test a live site"
    OUT.mkdir(parents=True, exist_ok=True)
    expect.set_options(timeout=15000)
    results = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.headed)
        suite = MobileSuite(browser, BASE)
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
                print("FAIL", name, str(error), flush=True)
                suite.pages[-1].screenshot(path=str(OUT / (name + "-failure.png")), full_page=True)
                results.append({"test": name, "passed": False, "error": str(error)})
        (OUT / ("results-selected.json" if args.only else "results.json")).write_text(json.dumps({"results": results, "pageErrors": suite.page_errors}, ensure_ascii=False, indent=2), encoding="utf-8")
        suite.close()
        browser.close()
    raise SystemExit(1 if any(not result["passed"] for result in results) else 0)


if __name__ == "__main__":
    main()
