export type ErrorCorrectionLevel = "L" | "M" | "Q" | "H";
export type Version = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
  11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
  21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 |
  31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40;

export type QRMatrix = boolean[][];
export type QROutput = "matrix" | "svg" | "svg-data-url" | "png" | "png-data-url";
export type QRBinaryInput = Uint8Array | ArrayBuffer | ArrayBufferView | readonly number[];
export type QRInput = string | QRBinaryInput;

export type QRTextSegmentMode = "numeric" | "alphanumeric" | "kanji";
export type QRSegmentInput =
  | { mode: "fnc1" }
  | { mode: "eci"; assignmentNumber: number }
  | { mode: QRTextSegmentMode; data: string }
  | { mode: QRTextSegmentMode; text: string }
  | { mode: "byte"; data: string | QRBinaryInput | readonly number[] }
  | { mode: "byte"; text: string }
  | { mode: "byte"; bytes: QRBinaryInput | readonly number[] };

export interface QRCanvasLike {
  width: number;
  height: number;
  getContext(contextId: "2d"): QRCanvasContextLike | null;
}

export interface QRCanvasContextLike {
  canvas?: QRCanvasLike;
  fillStyle: string;
  fillRect(x: number, y: number, width: number, height: number): void;
}

export type QRCanvasTarget = QRCanvasLike | QRCanvasContextLike;

export interface QRCodeOptions {
  errorCorrectionLevel?: ErrorCorrectionLevel;
  version?: Version | "auto";
  minVersion?: Version;
  maxVersion?: Version;
  maskPattern?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | "auto";
  mode?: "auto" | "numeric" | "alphanumeric" | "byte" | "kanji";
  encoding?: "utf-8";
  margin?: number;
  scale?: number;
  foreground?: string;
  background?: string;
  output?: QROutput;
  optimizeSegments?: boolean;
  boostErrorCorrection?: boolean;
  eci?: boolean | number;
  gs1?: boolean;
  diagnostics?: boolean;
  printDpi?: number | null;
}

export interface QRSegmentDiagnostics {
  mode: "fnc1" | "eci" | "numeric" | "alphanumeric" | "byte" | "kanji";
  assignmentNumber?: number;
  characterCount: number;
  byteCount: number;
  bitLength: number;
}

export interface QRWarning {
  code:
    | "QUIET_ZONE_TOO_SMALL"
    | "COLOR_CONTRAST_UNKNOWN"
    | "COLOR_CONTRAST_LOW"
    | "COLOR_CONTRAST_MODERATE"
    | "COLOR_ALPHA_USED"
    | "CAPACITY_NEAR_LIMIT"
    | "PRINT_MODULE_TOO_SMALL"
    | "RASTER_SCALE_SMALL"
    | "SCAN_RISK";
  severity: "info" | "warning";
  message: string;
  details?: Record<string, unknown>;
}

export interface QRColorDiagnostics {
  ratio: number | null;
  foregroundAlpha: number | null;
  backgroundAlpha: number | null;
  isInspectable: boolean;
  isStrong: boolean;
  isSufficient: boolean;
}

export interface QRPrintDiagnostics {
  dpi: number | null;
  modulePixels: number;
  moduleSizeMm: number | null;
  symbolSizeMm: number | null;
  recommendedMinimumModuleSizeMm: number;
  isModuleSizeSufficient: boolean | null;
}

export interface QRQuietZoneDiagnostics {
  modules: number;
  recommendedModules: number;
  isSufficient: boolean;
}

export interface QRDiagnostics {
  version: Version;
  size: number;
  errorCorrectionLevel: ErrorCorrectionLevel;
  requestedErrorCorrectionLevel: ErrorCorrectionLevel;
  boostedErrorCorrection: boolean;
  versionSelection: "fixed" | "auto-minimum";
  versionSelectionReason: string;
  maskPattern: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  maskPenalty: number;
  maskPenalties: Array<{ maskPattern: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7; penalty: number }>;
  maskSelectionReason: string;
  mode: "numeric" | "alphanumeric" | "byte" | "kanji" | "mixed";
  eciAssignmentNumber: number | null;
  fnc1: "first-position" | null;
  gs1: boolean;
  segments: QRSegmentDiagnostics[];
  dataBitLength: number;
  capacityBits: number;
  remainingBits: number;
  capacityUtilization: number;
  inputBytes: number;
  dataCodewords: number;
  errorCorrectionCodewords: number;
  totalCodewords: number;
  quietZone: QRQuietZoneDiagnostics;
  colors: QRColorDiagnostics;
  print: QRPrintDiagnostics;
  warnings: QRWarning[];
}

export interface QRCodeDiagnosticResult {
  matrix: QRMatrix;
  svg: string;
  diagnostics: QRDiagnostics;
}

export function generate(input: QRInput, options?: QRCodeOptions & { diagnostics: true }): QRCodeDiagnosticResult;
export function generate(input: QRInput, options?: QRCodeOptions & { output: "matrix"; diagnostics?: false }): QRMatrix;
export function generate(input: QRInput, options?: QRCodeOptions & { output: "png"; diagnostics?: false }): Uint8Array;
export function generate(input: QRInput, options?: QRCodeOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): string;

export function generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { diagnostics: true }): QRCodeDiagnosticResult;
export function generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output: "matrix"; diagnostics?: false }): QRMatrix;
export function generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output: "png"; diagnostics?: false }): Uint8Array;
export function generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): string;

export function drawToCanvas<T extends QRCanvasTarget>(target: T, input: QRInput, options?: QRCodeOptions): T;

export interface GS1Element {
  ai: string;
  value: string;
}

export const GS1_FNC1_SEPARATOR: "\x1D";
export function createGs1ElementString(elements: GS1Element[]): string;
export function parseGs1HumanReadable(input: string): GS1Element[];
export function calculateGs1CheckDigit(digits: string): string;
export function validateGs1CheckDigit(digitsWithCheckDigit: string): boolean;
export function calculateGtinCheckDigit(gtinWithoutCheckDigit: string): string;
export function appendGtinCheckDigit(gtinWithoutCheckDigit: string): string;
export function validateGtinCheckDigit(gtin: string): boolean;
export function calculateSsccCheckDigit(ssccWithoutCheckDigit: string): string;
export function appendSsccCheckDigit(ssccWithoutCheckDigit: string): string;
export function validateSsccCheckDigit(sscc: string): boolean;

export class SpecQRError extends Error {
  readonly code: string;
}

export class DataTooLongError extends SpecQRError {
  readonly code: "DATA_TOO_LONG";
}

export class InvalidInputError extends SpecQRError {
  readonly code: "INVALID_INPUT";
}

export class InvalidVersionError extends SpecQRError {
  readonly code: "INVALID_VERSION";
}

export class InvalidModeError extends SpecQRError {
  readonly code: "INVALID_MODE";
}

export class InvalidColorError extends SpecQRError {
  readonly code: "INVALID_COLOR";
}

export class InvalidEciError extends SpecQRError {
  readonly code: "INVALID_ECI";
}

export class InvalidGs1Error extends SpecQRError {
  readonly code: "INVALID_GS1";
}

export class InvalidOutputError extends SpecQRError {
  readonly code: "INVALID_OUTPUT";
}

export class InvalidCanvasTargetError extends SpecQRError {
  readonly code: "INVALID_CANVAS_TARGET";
}

export class QRCode {
  static generate(input: QRInput, options?: QRCodeOptions & { diagnostics: true }): QRCodeDiagnosticResult;
  static generate(input: QRInput, options?: QRCodeOptions & { output: "matrix"; diagnostics?: false }): QRMatrix;
  static generate(input: QRInput, options?: QRCodeOptions & { output: "png"; diagnostics?: false }): Uint8Array;
  static generate(input: QRInput, options?: QRCodeOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): string;
  static generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { diagnostics: true }): QRCodeDiagnosticResult;
  static generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output: "matrix"; diagnostics?: false }): QRMatrix;
  static generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output: "png"; diagnostics?: false }): Uint8Array;
  static generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): string;
  static drawToCanvas<T extends QRCanvasTarget>(target: T, input: QRInput, options?: QRCodeOptions): T;
  static createGs1ElementString(elements: GS1Element[]): string;
  static parseGs1HumanReadable(input: string): GS1Element[];
  static calculateGs1CheckDigit(digits: string): string;
  static validateGs1CheckDigit(digitsWithCheckDigit: string): boolean;
  static calculateGtinCheckDigit(gtinWithoutCheckDigit: string): string;
  static appendGtinCheckDigit(gtinWithoutCheckDigit: string): string;
  static validateGtinCheckDigit(gtin: string): boolean;
  static calculateSsccCheckDigit(ssccWithoutCheckDigit: string): string;
  static appendSsccCheckDigit(ssccWithoutCheckDigit: string): string;
  static validateSsccCheckDigit(sscc: string): boolean;
}
