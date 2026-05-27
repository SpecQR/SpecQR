import {
  appendGtinCheckDigit,
  createGs1DigitalLink,
  createGs1ElementString,
  generateStructuredAppend,
  mergeStructuredAppendParts,
  normalizeGs1DigitalLink,
  parseGs1DigitalLink,
  parseGs1ElementString,
  parseGs1HumanReadable,
  QRCode,
  validateGs1DigitalLink,
  type GS1DigitalLinkParseResult,
  type GS1DigitalLinkValidationResult,
  type GS1ElementStringParseResult,
  type QRCodeDiagnosticResult,
  type QRStructuredAppendResult
} from "specqr";
import { writePngFile } from "specqr/node";

const svg: string = QRCode.generate("https://example.com", {
  errorCorrectionLevel: "M",
  output: "svg"
});

const detailed: QRCodeDiagnosticResult = QRCode.generate("https://example.com", {
  diagnostics: true,
  output: "matrix"
});

const gtin = appendGtinCheckDigit("0491234567890");
const elements = parseGs1HumanReadable(`(01)${gtin}(17)251231(10)LOT-A`);
const gs1Data = createGs1ElementString(elements);
const parsedGs1: GS1ElementStringParseResult = parseGs1ElementString(gs1Data);
const gs1DigitalLink = createGs1DigitalLink(parsedGs1, { baseUrl: "https://example.com" });
const parsedDigitalLink: GS1DigitalLinkParseResult = parseGs1DigitalLink(gs1DigitalLink);
const validatedDigitalLink: GS1DigitalLinkValidationResult = validateGs1DigitalLink(gs1DigitalLink);
const normalizedDigitalLink: string = normalizeGs1DigitalLink(gs1DigitalLink);

const gs1Svg: string = QRCode.generate(gs1Data, {
  gs1: true,
  output: "svg"
});

const structured: QRStructuredAppendResult<string> = generateStructuredAppend("A".repeat(31), {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric",
  output: "svg"
});

const merged = mergeStructuredAppendParts([
  { index: 2, total: 2, parity: 65, data: "AAAAAAAAAA" },
  { index: 1, total: 2, parity: 65, data: "A".repeat(21) }
]);

await writePngFile("qr.png", "https://example.com", {
  scale: 8,
  margin: 4
});

console.log(
  svg.length,
  detailed.diagnostics.version,
  gs1Svg.length,
  parsedGs1.elements.length,
  parsedDigitalLink.elements.length,
  validatedDigitalLink.ok,
  normalizedDigitalLink.length,
  structured.total,
  merged.data.length
);
