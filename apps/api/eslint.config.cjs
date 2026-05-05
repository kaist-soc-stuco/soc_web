// @ts-check
const tsParser = require('@typescript-eslint/parser');

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  { ignores: ['dist/**'] },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      // ── 시간 처리 SSoT 강제 ────────────────────────────────────────────────
      // 모든 시간 연산은 @soc/shared 를 통해야 합니다. CLAUDE.md 참고.
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message:
            'new Date() 사용 금지. @soc/shared 의 nowMs(), isoToMs() 등을 사용하세요. (CLAUDE.md 참고)',
        },
        {
          selector: "MemberExpression[object.name='Date'][property.name='now']",
          message:
            'Date.now() 사용 금지. @soc/shared 의 nowMs() 를 사용하세요. (CLAUDE.md 참고)',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'dayjs',
              message:
                'dayjs 직접 import 금지. @soc/shared 의 시간 유틸리티를 사용하세요. (CLAUDE.md 참고)',
            },
          ],
        },
      ],
    },
  },
];
