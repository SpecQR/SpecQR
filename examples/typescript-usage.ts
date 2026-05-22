import {
  appendGtinCheckDigit,
  createGs1ElementString,
  parseGs1ElementString,
  parseGs1HumanReadable,
  QRCode,
  type GS1ElementStringParseResult,
  type QRCodeDiagnosticResult
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

const gs1Svg: string = QRCode.generate(gs1Data, {
  gs1: true,
  output: "svg"
});

await writePngFile("qr.png", "https://example.com", {
  scale: 8,
  margin: 4
});

console.log(svg.length, detailed.diagnostics.version, gs1Svg.length, parsedGs1.elements.length);
