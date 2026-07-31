import {
  QRCode,
  drawToCanvas,
  generate,
  generateSegments,
  type QRCodeDiagnosticResult,
  type QRCodeOptions,
  type QRGenerateResult,
  type QRMatrix
} from "specqr";
import {
  toBlob,
  toBlobFromSegments,
  toImageData,
  toImageDataFromSegments,
  toObjectURL,
  toObjectURLFromSegments
} from "specqr/browser";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends
  (<Value>() => Value extends Right ? 1 : 2)
    ? true
    : false;
type Assert<Condition extends true> = Condition;

const htmlCanvas = document.createElement("canvas");
const canvasResult = drawToCanvas(htmlCanvas, "browser");
type _CanvasResult = Assert<Equal<typeof canvasResult, HTMLCanvasElement>>;

const context = htmlCanvas.getContext("2d");
if (context) {
  const contextResult = QRCode.drawToCanvas(context, "browser");
  type _ContextResult = Assert<
    Equal<typeof contextResult, CanvasRenderingContext2D>
  >;
}

const matrix = generate("browser", { output: "matrix" });
const diagnostics = generateSegments(
  [{ mode: "byte", data: "browser" }],
  { diagnostics: true }
);
type _Matrix = Assert<Equal<typeof matrix, QRMatrix>>;
type _Diagnostics = Assert<
  Equal<typeof diagnostics, QRCodeDiagnosticResult>
>;

declare const dynamicOptions: QRCodeOptions;
const dynamic = QRCode.generate("browser", dynamicOptions);
type _Dynamic = Assert<Equal<typeof dynamic, QRGenerateResult>>;

const blob = toBlob("browser");
const segmentedBlob = toBlobFromSegments([
  { mode: "alphanumeric", data: "BROWSER" }
]);
const imageData = toImageData("browser");
const segmentedImageData = toImageDataFromSegments([
  { mode: "numeric", data: "12345" }
]);
const objectUrl = toObjectURL("browser");
const segmentedObjectUrl = toObjectURLFromSegments([
  { mode: "byte", data: "browser" }
]);
type _Blob = Assert<Equal<typeof blob, Blob>>;
type _SegmentedBlob = Assert<Equal<typeof segmentedBlob, Blob>>;
type _ImageData = Assert<Equal<typeof imageData, ImageData>>;
type _SegmentedImageData = Assert<
  Equal<typeof segmentedImageData, ImageData>
>;
type _ObjectUrl = Assert<Equal<typeof objectUrl, string>>;
type _SegmentedObjectUrl = Assert<
  Equal<typeof segmentedObjectUrl, string>
>;
