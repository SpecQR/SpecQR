import {
  QRCode,
  generate,
  generateSegments,
  getGs1AiInfo,
  getSupportedGs1Ais,
  type GS1AiInfo,
  type QRCanvasContextLike,
  type QRCanvasLike,
  type QRCanvasTarget,
  type QRCodeDiagnosticResult,
  type QRMatrix
} from "specqr";

function expectType<T>(_value: T): void {}

const matrix = generate("baseline", { output: "matrix" });
const diagnostic = generateSegments(
  [{ mode: "byte", data: "baseline" }],
  { diagnostics: true }
);
expectType<QRMatrix>(matrix);
expectType<QRCodeDiagnosticResult>(diagnostic);
expectType<string>(QRCode.generate("baseline", { output: "svg" }));

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

const target: QRCanvasTarget = canvas;
expectType<QRCanvasLike>(QRCode.drawToCanvas(target, "baseline"));

const aiInfo = getGs1AiInfo("10");
if (aiInfo) {
  const compatibleMutableInfo: GS1AiInfo = aiInfo;
  compatibleMutableInfo.label = "consumer-local label";
  if (compatibleMutableInfo.length.type === "variable") {
    compatibleMutableInfo.length.max = 20;
  }
  compatibleMutableInfo.digitalLinkPathForPrimary?.push("01");
}

const supported = getSupportedGs1Ais();
const first = supported[0];
if (first) {
  supported.push(first);
}
