import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const sourceDirectory = path.resolve(scriptDirectory, "../src");
const forbiddenPatterns = [
  {
    expression: /(?:^|[\s"'`])(?:[a-z]+:)*text-\[(?:\d+(?:\.\d+)?)px\]/g,
    message: "임의 px 글자 크기 대신 tokens.css의 의미 기반 타이포 토큰을 사용하세요.",
  },
  {
    expression: /(?:^|[\s"'`])(?:[a-z]+:)*leading-\[(?:\d+(?:\.\d+)?)px\]/g,
    message: "임의 px 행간 대신 Tailwind 행간 또는 tokens.css의 의미 기반 토큰을 사용하세요.",
  },
];

async function collectTsxFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) return collectTsxFiles(absolutePath);
      return entry.isFile() && entry.name.endsWith(".tsx") ? [absolutePath] : [];
    }),
  );
  return files.flat();
}

const violations = [];
for (const file of await collectTsxFiles(sourceDirectory)) {
  const contents = await readFile(file, "utf8");
  const lines = contents.split(/\r?\n/);
  lines.forEach((line, index) => {
    forbiddenPatterns.forEach(({ expression, message }) => {
      expression.lastIndex = 0;
      if (expression.test(line)) {
        violations.push(`${path.relative(sourceDirectory, file)}:${index + 1} ${message}`);
      }
    });
  });
}

if (violations.length > 0) {
  console.error(["UI unit contract violations:", ...violations.map((item) => `- ${item}`)].join("\n"));
  process.exitCode = 1;
} else {
  console.log("UI unit contract passed.");
}
