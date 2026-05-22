import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.join(root, "dist", "pages");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

for (const directory of ["playground", "src", "examples"]) {
  await cp(path.join(root, directory), path.join(outputDir, directory), {
    recursive: true
  });
}

await writeFile(path.join(outputDir, "index.html"), `<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="refresh" content="0; url=./playground/">
    <title>SpecQR Playground</title>
  </head>
  <body>
    <p><a href="./playground/">SpecQR Playground</a></p>
  </body>
</html>
`);

console.log(`Built GitHub Pages artifact at ${path.relative(root, outputDir)}`);
