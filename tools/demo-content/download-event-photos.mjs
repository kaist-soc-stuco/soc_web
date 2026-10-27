import { readFile, writeFile, mkdir } from "node:fs/promises";

const sources = JSON.parse(await readFile(new URL("./event-photo-sources.json", import.meta.url), "utf8"));
const directory = new URL("../../apps/api/uploads/assets/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const source of sources) {
  const response = await fetch(source.imageUrl);
  if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) throw new Error(`Photo download failed: ${source.articleId}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(new URL(source.filename, directory), buffer);
  console.log(`${source.articleId}: ${buffer.length} bytes (${source.photographer})`);
}
