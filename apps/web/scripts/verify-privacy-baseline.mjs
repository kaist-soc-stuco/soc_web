import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const browserRoots = [join(root, 'src'), join(root, 'public'), join(root, 'dist')];
const forbiddenPatterns = [
  { label: 'literal email address', pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu },
  {
    label: 'literal Korean phone number',
    pattern: /(?:^|[^\d])(?:\+82[\s.-]?\(?(?:10|[2-9]\d?)\)?[\s.-]?\d{3,4}[\s.-]?\d{4}|\(?(?:0(?:10|11|16|17|18|19|2|3[1-3]|4[1-4]|5[1-5]|6[1-4]))\)?[\s.-]?\d{3,4}[\s.-]?\d{4}|1[5-8]\d{2}[\s.-]\d{4})(?!\d)/u,
  },
  {
    label: 'literal international phone number',
    pattern: /(?:^|[^\d])(?:\+\d{1,3}[\s.-]?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}|00\d{1,3}[\s.-]?\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}|\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4})(?!\d)/u,
  },
  {
    label: 'browser contact-row or mock-contact fallback',
    pattern: /\b(?:admin)?contacts?(?:[-_]?rows|[-_]?data|[-_]?mock|[-_]?fallback)\b|\bmock[-_]?contacts?(?:[-_]?rows|[-_]?data|[-_]?fallback)?\b/iu,
  },
];

function isText(buffer) {
  let controlBytes = 0;
  for (const byte of buffer) {
    if (byte === 0) return false;
    if (byte < 9 || (byte > 13 && byte < 32)) controlBytes += 1;
  }
  return controlBytes / Math.max(buffer.length, 1) < 0.1;
}

async function collectTextFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectTextFiles(path)));
    } else if (entry.isFile() && isText(await readFile(path))) {
      files.push(path);
    }
  }
  return files;
}

const violations = [];
for (const directory of browserRoots) {
  for (const file of (await collectTextFiles(directory)).filter(
    (candidate) => !relative(root, candidate).startsWith(`src${join('/', 'test')}`),
  )) {
    const contents = (await readFile(file)).toString('utf8');
    for (const { label, pattern } of forbiddenPatterns) {
      if (pattern.test(contents)) {
        violations.push(`${relative(root, file)}: ${label}`);
      }
    }
  }
}

const staticConsumers = [
  'src/pages/admin-dashboard-page.tsx',
  'src/pages/admin-page.tsx',
  'src/pages/roadmap-page.tsx',
];
for (const file of staticConsumers) {
  const contents = await readFile(join(root, file), 'utf8');
  if (!contents.includes("@/lib/static-site-content")) {
    violations.push(`${file}: approved static content is not sourced from static-site-content`);
  }
}
const adminContactsPage = 'src/pages/admin-contacts-page.tsx';
const adminContactsContents = await readFile(join(root, adminContactsPage), 'utf8');
if (/(?:\bfrom\s*|\bimport\s*\()\s*['"]@\/lib\/mock-data['"]/u.test(adminContactsContents)) {
  violations.push(`${adminContactsPage}: admin contacts must not import mock-data`);
}

if (violations.length > 0) {
  violations.sort((left, right) => left.localeCompare(right));
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Privacy baseline verified for browser source and production bundle.');
}
