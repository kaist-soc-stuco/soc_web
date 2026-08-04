const { chromium } = require('node:module').createRequire(require('node:path').resolve('apps/web/package.json'))('@playwright/test');
const fs = require('node:fs');
const SOURCE_HASH = 'sha256:c79ce2a107c1d2ded7070b21d0f9589db0ba0cb643d74a4a0d3678166ab7135e';

const localized = (value) => ({ value, translationUnavailable: false });
const survey = (locale) => ({
  id: 'survey-1', revision: 1, definitionVersion: 1, locale,
  title: localized(locale === 'ko' ? '공개 설문' : 'Public survey'), description: null,
  state: 'OPEN', guestAllowed: true, phoneRequired: false, feeRestriction: 'ANY', cap: null,
  opensAt: null, closesAt: null, editDeadlineAt: null, responseRetentionDays: 365,
  updatedAt: '2026-08-01T00:00:00.000Z', sections: [{
    id: 'section-1', ordinal: 0, title: localized(locale === 'ko' ? '질문' : 'Questions'), description: null,
    questions: [{ id: 'question-1', ordinal: 0, type: 'SINGLE_CHOICE', prompt: localized(locale === 'ko' ? '참여하시겠습니까?' : 'Will you participate?'), helpText: null, required: true, validationRegex: null, numberMin: null, numberMax: null, dateMin: null, dateMax: null, choices: [{ id: 'choice-1', ordinal: 0, value: localized(locale === 'ko' ? '참여' : 'Attend') }] }]
  }]
});

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 320, height: 700 } });
  const requests = [];
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${route.request().method()} ${url.pathname}${url.search}`);
    if (url.pathname === '/api/surveys/survey-1') return route.fulfill({ json: survey(url.searchParams.get('locale') === 'en' ? 'en' : 'ko') });
    if (url.pathname === '/api/surveys/survey-1/responses/me') return route.fulfill({ json: { response: null } });
    if (url.pathname === '/api/surveys/content-relations') return route.fulfill({ json: { items: [] } });
    if (url.pathname === '/api/auth/session') return route.fulfill({ json: { authenticated: false } });
    return route.fulfill({ json: {} });
  });
  await page.goto('http://127.0.0.1:4173/survey/survey-1');
  await page.getByLabel('언어').selectOption('en');
  await page.getByRole('heading', { name: 'Public survey' }).waitFor();
  const body = await page.locator('body').innerText();
  const transcript = {
    sourceHash: SOURCE_HASH,
    scenario: 'mocked public-survey locale/privacy responsive browser flow',
    viewport: { width: 320, height: 700 },
    steps: ['navigate /survey/survey-1', 'change locale ko -> en', 'assert English heading and radio'],
    requests,
    assertions: {
      englishHeading: await page.getByRole('heading', { name: 'Public survey' }).isVisible(),
      englishChoice: await page.getByRole('radio', { name: 'Attend' }).isVisible(),
      privateTermsAbsent: !/phone|hash|ciphertext|reviewer/i.test(body),
      noHorizontalOverflow: await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      scrollWidth: await page.evaluate(() => document.documentElement.scrollWidth),
      innerWidth: await page.evaluate(() => window.innerWidth)
    }
  };
  await page.screenshot({ path: 'qa-artifacts/survey-public-320-en.png', fullPage: true });
  fs.writeFileSync('qa-artifacts/survey-browser-transcript.json', `${JSON.stringify(transcript, null, 2)}\n`);
  await browser.close();
  if (!Object.values(transcript.assertions).filter((value) => typeof value === 'boolean').every(Boolean)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
