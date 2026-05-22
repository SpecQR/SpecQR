import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  appendGtinCheckDigit,
  createGs1DigitalLink,
  parseGs1HumanReadable,
  QRCode
} from "specqr";

const gtin = appendGtinCheckDigit("0491234567890");
const elements = parseGs1HumanReadable(`(01)${gtin}(10)LOT-A(17)251231`);
const uri = createGs1DigitalLink(elements, {
  baseUrl: "https://example.com"
});
const outputPath = process.argv[2] ?? join(tmpdir(), "specqr-gs1-digital-link-example.svg");

const result = QRCode.generate(uri, {
  output: "matrix",
  diagnostics: true,
  errorCorrectionLevel: "M"
});

await writeFileEnsured(outputPath, result.svg);

console.log(JSON.stringify({
  outputPath,
  uri,
  version: result.diagnostics.version,
  maskPattern: result.diagnostics.maskPattern,
  warnings: result.diagnostics.warnings.map((warning) => warning.code)
}, null, 2));

async function writeFileEnsured(filePath, contents) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}
