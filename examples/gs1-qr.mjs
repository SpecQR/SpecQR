import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  appendGtinCheckDigit,
  createGs1ElementString,
  parseGs1HumanReadable,
  QRCode
} from "specqr";

const gtin = appendGtinCheckDigit("0491234567890");
const elements = parseGs1HumanReadable(`(01)${gtin}(17)251231(10)LOT-A`);
const data = createGs1ElementString(elements);
const outputPath = process.argv[2] ?? join(tmpdir(), "specqr-gs1-example.svg");

const result = QRCode.generate(data, {
  gs1: true,
  output: "matrix",
  diagnostics: true,
  errorCorrectionLevel: "M"
});

await writeFileEnsured(outputPath, result.svg);

console.log(JSON.stringify({
  outputPath,
  gtin,
  version: result.diagnostics.version,
  maskPattern: result.diagnostics.maskPattern,
  warnings: result.diagnostics.warnings.map((warning) => warning.code)
}, null, 2));

async function writeFileEnsured(filePath, contents) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}
