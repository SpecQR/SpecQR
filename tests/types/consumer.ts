import type { Buffer } from "node:buffer";
import * as specqr from "specqr";
import {
  QRCode,
  createGs1DigitalLink,
  generate,
  generateSegments,
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  getGs1AiInfo,
  getSupportedGs1Ais,
  mergeStructuredAppendParts,
  parseGs1DigitalLink,
  parseGs1ElementString,
  validateGs1Elements,
  validateGs1ElementString,
  type GS1AiInfo,
  type GS1DigitalLinkParseResult,
  type GS1ElementStringParseResult,
  type GS1ElementStringValidationResult,
  type GS1ValidationError,
  type GS1ValidationResult,
  type QRCodeDiagnosticResult,
  type QRMatrix,
  type QRStructuredAppendMergeResult,
  type QRStructuredAppendResult,
  type QRStructuredAppendSegmentsResult
} from "specqr";
import {
  toPngBuffer,
  toPngBufferFromSegments,
  writePngFile,
  writePngFileFromSegments
} from "specqr/node";
import {
  toBlob,
  toBlobFromSegments,
  toImageData,
  toImageDataFromSegments,
  toObjectURL,
  toObjectURLFromSegments
} from "specqr/browser";

function expectType<T>(_value: T): void {}

const matrix = generate("https://example.com", { output: "matrix" });
expectType<QRMatrix>(matrix);
expectType<boolean>(matrix[0][0]);

const diagnosticResult = QRCode.generate("https://example.com", {
  diagnostics: true,
  fnc1Second: "37",
  mode: "alphanumeric"
});
expectType<QRCodeDiagnosticResult>(diagnosticResult);
expectType<"first-position" | "second-position" | null>(diagnosticResult.diagnostics.fnc1);

const lowLevelStructuredAppend = generate("HELLO", {
  output: "matrix",
  structuredAppend: { index: 1, total: 2, parity: 65 }
});
expectType<QRMatrix>(lowLevelStructuredAppend);

const segmentsResult = generateSegments([
  { mode: "fnc1-second", applicationIndicator: "37" },
  { mode: "alphanumeric", data: "AA1234BBB112" }
], {
  diagnostics: true
});
expectType<QRCodeDiagnosticResult>(segmentsResult);
expectType<number | null>(segmentsResult.diagnostics.fnc1Second.applicationIndicatorCodeword);

const parsedRaw = parseGs1ElementString("010491234567890410ABC123\x1D17251231");
expectType<GS1ElementStringParseResult>(parsedRaw);
expectType<string>(parsedRaw.elements[0].ai);
expectType<boolean>(QRCode.parseGs1ElementString("010491234567890417251231").hasSeparators);

const supportedAis = getSupportedGs1Ais();
expectType<GS1AiInfo[]>(supportedAis);
expectType<GS1AiInfo | null>(getGs1AiInfo("01"));
expectType<GS1AiInfo[]>(QRCode.getSupportedGs1Ais());
expectType<GS1AiInfo | null>(QRCode.getGs1AiInfo("3102"));

const elementValidation = validateGs1Elements([{ ai: "01", value: "04912345678904" }]);
expectType<GS1ValidationResult>(elementValidation);
if (!elementValidation.ok) {
  expectType<GS1ValidationError>(elementValidation.errors[0]);
}

const rawValidation = validateGs1ElementString("010491234567890417251231");
expectType<GS1ElementStringValidationResult>(rawValidation);
expectType<GS1ElementStringValidationResult>(QRCode.validateGs1ElementString("010491234567890417251231"));
if (rawValidation.ok) {
  expectType<boolean>(rawValidation.hasSeparators);
  expectType<string>(rawValidation.elements[0].value);
}

const digitalLink = createGs1DigitalLink(parsedRaw, { baseUrl: "https://example.com" });
expectType<string>(digitalLink);
const parsedDigitalLink = parseGs1DigitalLink(digitalLink);
expectType<GS1DigitalLinkParseResult>(parsedDigitalLink);
expectType<string | null>(parsedDigitalLink.primary?.value ?? null);

const staticDigitalLink = QRCode.createGs1DigitalLink([{ ai: "01", value: "04912345678904" }], {
  baseUrl: new URL("https://example.com/base/")
});
expectType<string>(staticDigitalLink);
expectType<GS1DigitalLinkParseResult>(QRCode.parseGs1DigitalLink(staticDigitalLink));

const structuredAppendSet = generateStructuredAppend("A".repeat(31), {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric",
  output: "matrix"
});
expectType<QRStructuredAppendResult<QRMatrix>>(structuredAppendSet);
expectType<number>(structuredAppendSet.diagnostics.symbols[0].sequenceIndicator);

const structuredAppendDiagnosticSet = QRCode.generateStructuredAppend("A".repeat(31), {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric",
  output: "matrix",
  diagnostics: true
});
expectType<QRStructuredAppendResult<QRCodeDiagnosticResult>>(structuredAppendDiagnosticSet);
expectType<QRCodeDiagnosticResult>(structuredAppendDiagnosticSet.symbols[0]);

const structuredAppendSegmentsSet = generateSegmentsStructuredAppend([
  { mode: "alphanumeric", data: "ABCDEFGHIJKLMNOPQRSTU" },
  { mode: "numeric", data: "12345678901234567890" }
], {
  version: 1,
  errorCorrectionLevel: "L",
  output: "svg"
});
expectType<QRStructuredAppendSegmentsResult<string>>(structuredAppendSegmentsSet);
expectType<string>(structuredAppendSegmentsSet.symbols[0]);

const staticStructuredAppendSegmentsSet = QRCode.generateSegmentsStructuredAppend([
  { mode: "byte", bytes: Uint8Array.from([1, 2, 3, 4]) }
], {
  version: 1,
  errorCorrectionLevel: "L",
  output: "png"
});
expectType<QRStructuredAppendSegmentsResult<Uint8Array>>(staticStructuredAppendSegmentsSet);
expectType<Uint8Array>(staticStructuredAppendSegmentsSet.symbols[0]);

const mergedString = mergeStructuredAppendParts([
  { index: 1, total: 2, parity: 65, data: "HELLO " },
  { index: 2, total: 2, parity: 65, data: "WORLD" }
]);
expectType<QRStructuredAppendMergeResult<string>>(mergedString);
expectType<string>(mergedString.data);

const mergedBinary = QRCode.mergeStructuredAppendParts([
  { index: 1, total: 2, parity: 0, data: Uint8Array.from([0, 1]) },
  { index: 2, total: 2, parity: 0, data: new Uint8Array([2, 3]) }
]);
expectType<QRStructuredAppendMergeResult<Uint8Array>>(mergedBinary);
expectType<Uint8Array>(mergedBinary.data);

const pngBuffer = toPngBuffer("https://example.com");
expectType<Buffer>(pngBuffer);
expectType<Buffer>(toPngBufferFromSegments([{ mode: "byte", data: "hello" }]));
expectType<Promise<void>>(writePngFile("/tmp/specqr.png", "https://example.com"));
expectType<Promise<void>>(writePngFileFromSegments("/tmp/specqr-segments.png", [
  { mode: "byte", bytes: Uint8Array.from([0, 255]) }
]));

expectType<Blob>(toBlob("https://example.com"));
expectType<Blob>(toBlobFromSegments([{ mode: "numeric", data: "12345" }]));
expectType<ImageData>(toImageData("https://example.com"));
expectType<ImageData>(toImageDataFromSegments([{ mode: "alphanumeric", data: "HELLO" }]));
expectType<string>(toObjectURL("https://example.com"));
expectType<string>(toObjectURLFromSegments([{ mode: "kanji", data: "漢字" }]));

// @ts-expect-error validateGs1DigitalLink is intentionally not public in v2.0.0.
specqr.validateGs1DigitalLink;
