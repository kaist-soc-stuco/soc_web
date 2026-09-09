"""Stateful browser-context security checks for the isolated local stack.

The test uses the repository's synthetic Python SSO fixture and a fresh
Playwright browser context. It never prints cookies, bearer values, student
numbers, emails, or local-storage contents. The target must be a disposable
environment; the test creates only local synthetic users and browser drafts.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from typing import Any, NoReturn
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page, TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright


DEFAULT_APP_URL = "http://192.168.0.3:28765"
PROFILE_LABELS = {
    "admin": "모바일 QA 관리자",
    "student": "모바일 QA 학생",
    "new": "모바일 QA 동의테스트",
}
PROFILE_STUDENT_NUMBERS = {"90990001", "90990002", "90990003"}
AUTH_STORAGE_KEY = "soc.auth.state"
SURVEY_DRAFT_PREFIX = "soc:draft:survey-response:"
CURRENT_STEP = "startup"


def fail(message: str) -> "NoReturn":
    raise AssertionError(message)


def expect(condition: bool, message: str) -> None:
    if not condition:
        fail(message)


def mark(step: str) -> None:
    global CURRENT_STEP
    CURRENT_STEP = step


def wait_for_home(page: Page) -> None:
    for _ in range(80):
        if urlsplit(page.url).path == "/":
            return
        page.wait_for_timeout(250)
    fail(f"application did not return home before the browser timeout: {page.url}")


def login(page: Page, profile: str, *, consent: bool) -> dict[str, Any]:
    consent_label = "동의하고 저장" if consent else "저장하지 않고 계속"
    completed = False
    for attempt in range(3):
        try:
            mark(f"login:{profile}:start")
            page.goto(f"{BASE_URL}/login", wait_until="commit")
            mark(f"login:{profile}:fake-sso")
            fake_sso_profile_buttons = page.locator(
                'form[action="/__local-sso/approve"] button[name="profile"]'
            )
            fake_sso_profile_buttons.first.wait_for(state="visible", timeout=10000)
            expect(
                urlsplit(page.url).path == "/__local-sso/authorize",
                "login did not reach the synthetic SSO",
            )
            page.get_by_role("button", name=PROFILE_LABELS[profile], exact=True).click(
                no_wait_after=True
            )
            mark(f"login:{profile}:consent")
            consent_button = page.get_by_role("button", name=consent_label, exact=True)
            consent_button.wait_for(state="visible", timeout=10000)
            consent_url = urlsplit(page.url)
            expect(
                consent_url.path == "/login"
                and "consent-required" in parse_qs(consent_url.query).get("status", []),
                "login did not reach the consent screen",
            )
            consent_button.click()
            mark(f"login:{profile}:home")
            wait_for_home(page)
            completed = True
            break
        except PlaywrightTimeoutError:
            if attempt == 2:
                raise
            page.goto(BASE_URL, wait_until="commit")
            page.wait_for_timeout(500)

    expect(completed, f"login did not complete for synthetic profile {profile}")
    session = api_json(page, "/api/auth/session")
    body = session["body"] or {}
    page.locator(
        'button[aria-label*="프로필"]:visible, button[aria-label*="profile"]:visible, '
        'button[aria-label*="세션 로그아웃"]:visible, button[aria-label*="temporary session"]:visible'
    ).first.wait_for(state="visible")
    expect(urlsplit(page.url).path == "/", "consent did not return to the application home")

    expect(session["status"] == 200, f"session status was {session['status']}")
    expect(body.get("authenticated") is True, "login did not produce an authenticated browser session")
    expect(body.get("draftNamespace"), "authenticated session did not expose an opaque draft namespace")
    expect(body.get("storageMode") == ("persisted" if consent else "temporary"), "unexpected auth storage mode")
    return body


def logout(page: Page) -> None:
    profile_button = page.locator(
        'button[aria-label*="프로필"]:visible, button[aria-label*="profile"]:visible'
    ).first
    if profile_button.count() > 0:
        mark("logout:open-menu")
        profile_button.click()
        logout_button = page.get_by_role("button", name="로그아웃", exact=True)
    else:
        mark("logout:temporary-button")
        logout_button = page.locator(
            'button[aria-label*="세션 로그아웃"]:visible, button[aria-label*="temporary session"]:visible'
        ).first
    logout_button.wait_for(state="visible")
    logout_button.click()
    mark("logout:home")
    # /api/auth/session is itself an auth-rate-limited endpoint. A polling
    # loop here would make this fixture fail its own request budget and would
    # not prove logout more strongly than the browser state plus the next
    # login transition. The next login() call verifies a fresh session.
    page.wait_for_function(
        "key => !sessionStorage.getItem(key)",
        arg=AUTH_STORAGE_KEY,
    )
    wait_for_home(page)
    expect(
        not page.evaluate("key => sessionStorage.getItem(key)", AUTH_STORAGE_KEY),
        "logout left the temporary auth state in sessionStorage",
    )


def api_json(page: Page, path: str, *, method: str = "GET", body: Any = None) -> dict[str, Any]:
    return page.evaluate(
        """
async ({path, method, body}) => {
          const headers = new Headers(body === null ? undefined : {"Content-Type": "application/json"});
          try {
            const stored = JSON.parse(sessionStorage.getItem("soc.auth.state") || "null");
            const accessToken = stored?.temporarySession?.accessToken;
            if (typeof accessToken === "string" && accessToken) {
              headers.set("Authorization", `Bearer ${accessToken}`);
            }
          } catch (_) {}
          const response = await fetch(path, {
            method,
            headers,
            body: body === null ? undefined : JSON.stringify(body),
          });
          let parsed = null;
          try { parsed = await response.json(); } catch (_) {}
          return {status: response.status, body: parsed};
        }
        """,
        {"path": path, "method": method, "body": body},
    )


def storage_snapshot(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        () => ({
          localKeys: Object.keys(localStorage),
          sessionKeys: Object.keys(sessionStorage),
          localValues: Object.fromEntries(Object.keys(localStorage).map((key) => [key, localStorage.getItem(key)])),
        })
        """
    )


def assert_opaque_draft_keys(snapshot: dict[str, Any]) -> list[str]:
    keys = [key for key in snapshot["localKeys"] if key.startswith(SURVEY_DRAFT_PREFIX)]
    expect(keys, "no survey draft key was created")
    for key in keys:
        lowered = key.lower()
        expect("eyj" not in lowered, "a bearer token was used as a draft key")
        expect("email" not in lowered and "student" not in lowered, "PII label was used as a draft key")
        expect(not any(number in key for number in PROFILE_STUDENT_NUMBERS), "student number was used as a draft key")
    return keys


def get_public_survey_id(page: Page) -> str:
    mark("survey:list")
    result = api_json(page, "/api/surveys/list/public?page=1&pageSize=1")
    expect(result["status"] == 200, f"public survey list failed with {result['status']}")
    items = (result["body"] or {}).get("items", [])
    expect(items, "isolated seed did not provide a public survey")
    survey_id = items[0].get("id") or items[0].get("surveyId")
    expect(isinstance(survey_id, str) and survey_id, "public survey did not contain a survey id")
    return survey_id


def create_browser_draft(page: Page, survey_id: str, marker: str) -> tuple[str, str]:
    mark(f"draft:create:{marker}")
    page.goto(f"{BASE_URL}/survey/{survey_id}", wait_until="domcontentloaded")
    page.locator("main input[type=text]:visible, main textarea:visible").first.fill(marker)
    page.wait_for_function(
        """prefix => Object.keys(localStorage).some((key) => key.startsWith(prefix))""",
        arg=SURVEY_DRAFT_PREFIX,
    )
    snapshot = storage_snapshot(page)
    keys = assert_opaque_draft_keys(snapshot)
    matching = [key for key in keys if marker in (snapshot["localValues"].get(key) or "")]
    expect(matching, "the browser answer was not persisted to the current user's draft")
    return keys[-1], marker


def assert_new_user_does_not_restore_previous_draft(page: Page, survey_id: str, old_key: str, marker: str, new_marker: str) -> str:
    mark(f"draft:switch:{new_marker}")
    page.goto(f"{BASE_URL}/survey/{survey_id}", wait_until="domcontentloaded")
    page.wait_for_function(
        """prefix => document.readyState === "complete" && Object.keys(localStorage).some((key) => key.startsWith(prefix))""",
        arg=SURVEY_DRAFT_PREFIX,
    )
    page.locator("main input[type=text]:visible, main textarea:visible").first.fill(new_marker)
    page.wait_for_function(
        """prefix => Object.keys(localStorage).filter((key) => key.startsWith(prefix)).length >= 2""",
        arg=SURVEY_DRAFT_PREFIX,
    )
    snapshot = storage_snapshot(page)
    keys = assert_opaque_draft_keys(snapshot)
    expect(old_key in keys, "the original local draft disappeared unexpectedly")
    expect(
        marker not in page.locator("main").inner_text(),
        "the previous user's draft marker was restored into the new user's page",
    )
    values = [snapshot["localValues"].get(key) or "" for key in keys]
    expect(sum(marker in value for value in values) == 1, "the previous user's answer was copied into another draft")
    expect(sum(new_marker in value for value in values) == 1, "the new user's answer was not kept in the new draft")
    new_keys = [key for key in keys if key != old_key]
    expect(new_keys, "the new user did not get a distinct draft namespace")
    return new_keys[-1]


def assert_no_sensitive_storage_key(page: Page) -> None:
    snapshot = storage_snapshot(page)
    all_keys = snapshot["localKeys"] + snapshot["sessionKeys"]
    for key in all_keys:
        lowered = key.lower()
        expect("email" not in lowered and "student" not in lowered, "PII label appeared in browser storage key")
        expect(not any(number in key for number in PROFILE_STUDENT_NUMBERS), "student number appeared in browser storage key")


def run() -> None:
    global BASE_URL
    parser = argparse.ArgumentParser()
    parser.add_argument("--app-url", default=os.environ.get("SECURITY_E2E_APP_URL", DEFAULT_APP_URL))
    parser.add_argument("--headed", action="store_true")
    parser.add_argument(
        "--scenario",
        choices=("all", "temporary", "persisted"),
        default="all",
        help="Run both account-switch scenarios or one isolated scenario.",
    )
    args = parser.parse_args()
    BASE_URL = args.app_url.rstrip("/")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=not args.headed)
        context = browser.new_context(viewport={"width": 390, "height": 844}, locale="ko-KR")
        page = context.new_page()
        auth_response_events: list[str] = []

        def track_auth_response(response: Any) -> None:
            if "/api/auth/" in urlsplit(response.url).path:
                auth_response_events.append(
                    f"{urlsplit(response.url).path}:{response.status}"
                )

        page.on("response", track_auth_response)
        try:
            survey_id = None

            if args.scenario in ("all", "temporary"):
                # Temporary A -> logout -> temporary B.
                first = login(page, "student", consent=False)
                expect(first["storageMode"] == "temporary", "temporary A did not use temporary storage")
                survey_id = get_public_survey_id(page)
                temp_a_key, marker_a = create_browser_draft(page, survey_id, "security-e2e-temporary-a")
                logout(page)
                second = login(page, "new", consent=False)
                expect(second["draftNamespace"] != first["draftNamespace"], "temporary accounts reused a draft namespace")
                temp_b_key = assert_new_user_does_not_restore_previous_draft(page, survey_id, temp_a_key, marker_a, "security-e2e-temporary-b")
                expect(temp_b_key != temp_a_key, "temporary B reused A's draft key")
                assert_no_sensitive_storage_key(page)
                logout(page)
                if args.scenario == "temporary":
                    print("PASS: fake SSO browser context, temporary A→logout→B, draft isolation, opaque storage keys")
                    return

            if args.scenario in ("all", "persisted"):
                # Permanent A -> logout -> permanent B.
                third = login(page, "student", consent=True)
                expect(third["storageMode"] == "persisted", "permanent A did not use persisted storage")
                if survey_id is None:
                    survey_id = get_public_survey_id(page)
                persisted_a_key, marker_b = create_browser_draft(page, survey_id, "security-e2e-persisted-a")
                logout(page)
                fourth = login(page, "new", consent=True)
                expect(fourth["draftNamespace"] != third["draftNamespace"], "permanent accounts reused a draft namespace")
                persisted_b_key = assert_new_user_does_not_restore_previous_draft(page, survey_id, persisted_a_key, marker_b, "security-e2e-persisted-b")
                expect(persisted_b_key != persisted_a_key, "permanent B reused A's draft key")
                assert_no_sensitive_storage_key(page)
                print(
                    "PASS: fake SSO browser context, persisted A→logout→B, "
                    "draft isolation, opaque storage keys"
                    if args.scenario == "persisted"
                    else "PASS: fake SSO browser context, temporary A→logout→B, "
                    "persisted A→logout→B, draft isolation, opaque storage keys"
                )
        except PlaywrightTimeoutError as error:
            raise AssertionError(
                f"browser E2E timed out during {CURRENT_STEP} at {page.url}; "
                f"auth responses={auth_response_events}"
            ) from error
        except PlaywrightError as error:
            raise AssertionError(
                f"browser E2E browser request failed during {CURRENT_STEP} at {page.url}; "
                f"auth responses={auth_response_events}"
            ) from error
        finally:
            context.close()
            browser.close()


if __name__ == "__main__":
    try:
        run()
    except (AssertionError, KeyError, TypeError, ValueError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
