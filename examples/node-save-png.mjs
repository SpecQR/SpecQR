import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { writePngFile } from "specqr/node";

const outputPath = process.argv[2] ?? join(tmpdir(), "specqr-node-example.png");

await mkdir(dirname(outputPath), { recursive: true });
await writePngFile(outputPath, "https://github.com/SpecQR/SpecQR", {
  errorCorrectionLevel: "Q",
  margin: 4,
  scale: 8
});

console.log(`Wrote ${outputPath}`);
