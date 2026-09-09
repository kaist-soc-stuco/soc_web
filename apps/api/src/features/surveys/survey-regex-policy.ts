import { BadRequestException } from "@nestjs/common";
import { Worker } from "node:worker_threads";

/**
 * User-authored regexes are evaluated in a worker that can be terminated.
 * JavaScript's synchronous RegExp engine cannot be interrupted on the API
 * event loop, so Promise.race around RegExp.test would not provide a bound.
 */
export const MAX_SURVEY_REGEX_LENGTH = 256;
export const MAX_REGEX_INPUT_LENGTH = 10_000;
// Include worker startup/IPC overhead in the budget so ordinary short
// patterns do not become false timeouts under a busy test or API process.
// The synchronous RegExp itself still runs in a terminable worker.
export const SURVEY_REGEX_TIMEOUT_MS = 250;

export function assertSafeSurveyRegex(pattern: string): void {
  if (pattern.length > MAX_SURVEY_REGEX_LENGTH) {
    throw new BadRequestException("answer_regex_too_long");
  }

  try {
    // Compilation does not execute the user pattern. All valid JavaScript
    // syntax, including previously rejected lookarounds/backreferences, is
    // supported because execution is isolated below.
    new RegExp(pattern);
  } catch {
    throw new BadRequestException("answer_regex_invalid");
  }
}

export async function testSafeSurveyRegex(
  pattern: string,
  input: string,
): Promise<boolean> {
  assertSafeSurveyRegex(pattern);
  if (input.length > MAX_REGEX_INPUT_LENGTH) {
    throw new BadRequestException("answer_text_too_long");
  }

  return new Promise<boolean>((resolve, reject) => {
    let settled = false;
    const worker = new Worker(REGEX_WORKER_SOURCE, {
      eval: true,
      workerData: { input, pattern },
    });
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      void worker.terminate();
      reject(new BadRequestException("answer_regex_timeout"));
    }, SURVEY_REGEX_TIMEOUT_MS);

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback();
    };

    worker.once("message", (message: { ok?: boolean; result?: boolean }) => {
      finish(() => {
        void worker.terminate();
        if (!message.ok) {
          reject(new BadRequestException("answer_regex_invalid"));
          return;
        }
        resolve(Boolean(message.result));
      });
    });
    worker.once("error", () => {
      finish(() => {
        void worker.terminate();
        reject(new BadRequestException("answer_regex_invalid"));
      });
    });
    worker.once("exit", (code) => {
      if (code !== 0) {
        finish(() => reject(new BadRequestException("answer_regex_invalid")));
      }
    });
  });
}

const REGEX_WORKER_SOURCE = `
  const { parentPort, workerData } = require("node:worker_threads");
  try {
    const result = new RegExp(workerData.pattern).test(workerData.input);
    parentPort.postMessage({ ok: true, result });
  } catch {
    parentPort.postMessage({ ok: false });
  }
`;
