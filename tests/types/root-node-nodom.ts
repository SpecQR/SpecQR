import type { Buffer } from "node:buffer";
import {
  QRCode,
  drawToCanvas,
  generate,
  generateSegments,
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  type QRCanvasContextLike,
  type QRCanvasLike,
  type QRCodeDiagnosticResult,
  type QRCodeOptions,
  type QRGenerateResult,
  type QRMatrix,
  type QRStructuredAppendGenerateOptions,
  type QRStructuredAppendResult,
  type QRStructuredAppendSegmentsFullDiagnostics,
  type QRStructuredAppendSegmentsGenerateOptions,
  type QRStructuredAppendSegmentsResult,
  type QRStructuredAppendSegmentsStandardDiagnostics
} from "specqr";
import { toPngBuffer, toPngBufferFromSegments } from "specqr/node";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Condition extends true> = Condition;

const segments = [{ mode: "byte", data: "typed" }] as const;

const defaultOutput = generate("typed");
const matrixOutput = generate("typed", { output: "matrix" });
const pngOutput = generate("typed", { output: "png" });
const dataUrlOutput = generate("typed", { output: "png-data-url" });
const diagnosticOutput = generate("typed", { diagnostics: true });
type _DefaultOutput = Assert<Equal<typeof defaultOutput, string>>;
type _MatrixOutput = Assert<Equal<typeof matrixOutput, QRMatrix>>;
type _PngOutput = Assert<Equal<typeof pngOutput, Uint8Array>>;
type _DataUrlOutput = Assert<Equal<typeof dataUrlOutput, string>>;
type _DiagnosticOutput = Assert<
  Equal<typeof diagnosticOutput, QRCodeDiagnosticResult>
>;

declare const dynamicOptions: QRCodeOptions;
const dynamicNamed = generate("typed", dynamicOptions);
const dynamicStatic = QRCode.generate("typed", dynamicOptions);
const dynamicSegments = generateSegments(
  [{ mode: "byte", data: "typed" }],
  dynamicOptions
);
const dynamicStaticSegments = QRCode.generateSegments(
  [{ mode: "byte", data: "typed" }],
  dynamicOptions
);
type _DynamicNamed = Assert<Equal<typeof dynamicNamed, QRGenerateResult>>;
type _DynamicStatic = Assert<Equal<typeof dynamicStatic, QRGenerateResult>>;
type _DynamicSegments = Assert<Equal<typeof dynamicSegments, QRGenerateResult>>;
type _DynamicStaticSegments = Assert<
  Equal<typeof dynamicStaticSegments, QRGenerateResult>
>;

declare const structuredOptions: QRStructuredAppendGenerateOptions;
declare const structuredSegmentsOptions: QRStructuredAppendSegmentsGenerateOptions;
const dynamicStructured = generateStructuredAppend(
  "A".repeat(31),
  structuredOptions
);
const dynamicStructuredStatic = QRCode.generateStructuredAppend(
  "A".repeat(31),
  structuredOptions
);
const dynamicStructuredSegments = generateSegmentsStructuredAppend(
  [{ mode: "byte", data: "A".repeat(64) }],
  structuredSegmentsOptions
);
const dynamicStructuredSegmentsStatic =
  QRCode.generateSegmentsStructuredAppend(
    [{ mode: "byte", data: "A".repeat(64) }],
    structuredSegmentsOptions
  );
type _DynamicStructured = Assert<
  Equal<typeof dynamicStructured, QRStructuredAppendResult>
>;
type _DynamicStructuredStatic = Assert<
  Equal<typeof dynamicStructuredStatic, QRStructuredAppendResult>
>;
type _DynamicStructuredSegments = Assert<
  Equal<typeof dynamicStructuredSegments, QRStructuredAppendSegmentsResult>
>;
type _DynamicStructuredSegmentsStatic = Assert<
  Equal<
    typeof dynamicStructuredSegmentsStatic,
    QRStructuredAppendSegmentsResult
  >
>;

const standardStructuredSegments = generateSegmentsStructuredAppend(
  [{ mode: "byte", data: "A".repeat(64) }],
  {
    version: 1,
    errorCorrectionLevel: "L",
    output: "matrix"
  }
);
const diagnosticStructuredSegments =
  QRCode.generateSegmentsStructuredAppend(
    [{ mode: "byte", data: "A".repeat(64) }],
    {
      version: 1,
      errorCorrectionLevel: "L",
      diagnostics: true
    }
  );
const fullStructuredSegments = generateSegmentsStructuredAppend(
  [{ mode: "byte", data: "A".repeat(64) }],
  {
    version: 1,
    errorCorrectionLevel: "L",
    diagnostics: { splitUnits: "full" }
  }
);
const fullPngStructuredSegments =
  QRCode.generateSegmentsStructuredAppend(
    [{ mode: "byte", data: "A".repeat(64) }],
    {
      version: 1,
      errorCorrectionLevel: "L",
      output: "png",
      diagnostics: {
        splitUnits: "full",
        symbolResults: "output"
      }
    }
  );
const summarySvgStructuredSegments =
  generateSegmentsStructuredAppend(
    [{ mode: "byte", data: "A".repeat(64) }],
    {
      version: 1,
      errorCorrectionLevel: "L",
      diagnostics: {
        splitUnits: "summary",
        symbolResults: "output"
      }
    }
  );
type _StandardStructuredSegments = Assert<
  Equal<
    typeof standardStructuredSegments,
    QRStructuredAppendSegmentsResult<
      QRMatrix,
      QRStructuredAppendSegmentsStandardDiagnostics
    >
  >
>;
type _DiagnosticStructuredSegments = Assert<
  Equal<
    typeof diagnosticStructuredSegments,
    QRStructuredAppendSegmentsResult<
      QRCodeDiagnosticResult,
      QRStructuredAppendSegmentsStandardDiagnostics
    >
  >
>;
type _FullStructuredSegments = Assert<
  Equal<
    typeof fullStructuredSegments,
    QRStructuredAppendSegmentsResult<
      QRCodeDiagnosticResult,
      QRStructuredAppendSegmentsFullDiagnostics
    >
  >
>;
type _FullPngStructuredSegments = Assert<
  Equal<
    typeof fullPngStructuredSegments,
    QRStructuredAppendSegmentsResult<
      Uint8Array,
      QRStructuredAppendSegmentsFullDiagnostics
    >
  >
>;
type _SummarySvgStructuredSegments = Assert<
  Equal<
    typeof summarySvgStructuredSegments,
    QRStructuredAppendSegmentsResult<
      string,
      QRStructuredAppendSegmentsStandardDiagnostics
    >
  >
>;
// @ts-expect-error Standard diagnostics have no splitUnits property.
standardStructuredSegments.diagnostics.splitUnits;
if (dynamicStructuredSegments.diagnostics.splitUnitsDetail === "full") {
  const splitUnitCount: number =
    dynamicStructuredSegments.diagnostics.splitUnits.length;
  void splitUnitCount;
} else {
  // @ts-expect-error The discriminated summary branch omits splitUnits.
  dynamicStructuredSegments.diagnostics.splitUnits;
}

const context: QRCanvasContextLike = {
  fillStyle: "#000000",
  fillRect(_x, _y, _width, _height) {}
};
const canvas: QRCanvasLike = {
  width: 0,
  height: 0,
  getContext(contextId) {
    return contextId === "2d" ? context : null;
  }
};
context.canvas = canvas;
const renderedCanvas = drawToCanvas(canvas, "typed");
const renderedContext = QRCode.drawToCanvas(context, "typed");
type _CanvasReturn = Assert<Equal<typeof renderedCanvas, QRCanvasLike>>;
type _ContextReturn = Assert<
  Equal<typeof renderedContext, QRCanvasContextLike>
>;

const buffer = toPngBuffer("typed");
const segmentedBuffer = toPngBufferFromSegments([
  { mode: segments[0].mode, data: segments[0].data }
]);
type _Buffer = Assert<Equal<typeof buffer, Buffer>>;
type _SegmentedBuffer = Assert<Equal<typeof segmentedBuffer, Buffer>>;
