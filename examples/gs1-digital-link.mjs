import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  appendGtinCheckDigit,
  createGs1DigitalLink,
  normalizeGs1DigitalLink,
  parseGs1DigitalLink,
  parseGs1HumanReadable,
  QRCode,
  validateGs1DigitalLink
} from "specqr";

const gtin = appendGtinCheckDigit("0491234567890");
const elements = parseGs1HumanReadable(`(01)${gtin}(10)LOT-A(17)251231`);
const uri = createGs1DigitalLink(elements, {
  baseUrl: "https://example.com"
});
const inboundUri = `https://example.com/01/${gtin}?17=251231&10=LOT-A&linkType=all`;
const validation = validateGs1DigitalLink(inboundUri);
if (!validation.ok) {
  throw new Error(`Unexpected invalid GS1 Digital Link: ${validation.errors[0].code}`);
}
const parsedInbound = parseGs1DigitalLink(inboundUri);
const normalizedUri = normalizeGs1DigitalLink(inboundUri);
const strictValidation = validateGs1DigitalLink(inboundUri, {
  unknownQuery: "reject"
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
  parsedElements: parsedInbound.elements,
  parsedUnknownQuery: parsedInbound.unknownQuery,
  normalizedUri,
  normalizedIdempotent: normalizeGs1DigitalLink(normalizedUri) === normalizedUri,
  validationWarnings: validation.warnings.map((warning) => warning.code),
  strictRejectError: strictValidation.ok ? null : strictValidation.errors[0].code,
  version: result.diagnostics.version,
  maskPattern: result.diagnostics.maskPattern,
  warnings: result.diagnostics.warnings.map((warning) => warning.code)
}, null, 2));

async function writeFileEnsured(filePath, contents) {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents);
}
