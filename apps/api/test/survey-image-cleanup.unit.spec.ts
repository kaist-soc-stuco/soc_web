import { describe, expect, it } from 'vitest';

import { parseCleanupOptions } from '../src/commands/survey-image-cleanup';

const invalidOptions: Array<[string[], NodeJS.ProcessEnv]> = [
  [['0'], {}],
  [['1001'], {}],
  [['25', '59999'], {}],
  [['25', '2592000001'], {}],
  [['25', 'invalid'], {}],
  [['25', '60000', 'unexpected'], {}],
  [[], { SURVEY_IMAGE_CLEANUP_BATCH_SIZE: 'invalid' }],
  [[], { SURVEY_IMAGE_CLEANUP_GRACE_MS: '59999' }],
];

describe('survey image cleanup command options', () => {
  it('uses conservative default batch and grace values', () => {
    expect(parseCleanupOptions([], {})).toEqual({ batchSize: 25, graceMs: 3_600_000 });
  });

  it('accepts bounded positional arguments and environment values', () => {
    expect(parseCleanupOptions(['--', '1000', '2592000000'], {})).toEqual({
      batchSize: 1000,
      graceMs: 2_592_000_000,
    });
    expect(parseCleanupOptions([], {
      SURVEY_IMAGE_CLEANUP_BATCH_SIZE: '5',
      SURVEY_IMAGE_CLEANUP_GRACE_MS: '60000',
    })).toEqual({ batchSize: 5, graceMs: 60_000 });
  });

  it.each(invalidOptions)('rejects invalid bounds', (args, env) => {
    expect(() => parseCleanupOptions(args, env)).toThrow();
  });
});
