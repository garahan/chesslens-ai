import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}
const files = walk("dist").filter((path) => !path.endsWith("/sw.js"));
const template = readFileSync("scripts/service-worker.js", "utf8");
const assetHashes = Object.fromEntries(
  files.map((file) => [
    "/" + file.slice(5),
    createHash("sha256").update(readFileSync(file)).digest("hex"),
  ]),
);
const hash = createHash("sha256").update(template);
for (const file of files.sort()) hash.update(file).update(readFileSync(file));
const version = hash.digest("hex").slice(0, 16);
const urls = files.map((file) => "/" + file.slice(5));
const worker = template
  .replace("__VERSION__", version)
  .replace("__PRECACHE__", JSON.stringify(urls))
  .replace("__ASSET_HASHES__", JSON.stringify(assetHashes));
writeFileSync("dist/sw.js", worker);
console.log(
  `Offline cache ${version}: ${urls.length} local assets, including scanner and Stockfish`,
);
