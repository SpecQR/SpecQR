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
export interface QRStructuredAppendOptions {
  index: number;
  total: number;
  parity: number;
}

export type QRSegmentInput =
  | ({ mode: "structured-append" } & QRStructuredAppendOptions)
  | { mode: "fnc1" }
  | { mode: "fnc1-second"; applicationIndicator: string }
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
  fnc1Second?: false | string;
  structuredAppend?: false | QRStructuredAppendOptions;
  diagnostics?: boolean;
  printDpi?: number | null;
}

export interface QRSegmentDiagnostics {
  mode: "structured-append" | "fnc1" | "fnc1-second" | "eci" | "numeric" | "alphanumeric" | "byte" | "kanji";
  assignmentNumber?: number;
  applicationIndicator?: string;
  applicationIndicatorCodeword?: number;
  index?: number;
  total?: number;
  parity?: number;
  sequenceIndex?: number;
  sequenceTotal?: number;
  sequenceIndicator?: number;
  characterCount: number;
  byteCount: number;
  bitLength: number;
}

export interface QRControlSegmentDiagnostics {
  mode: "structured-append" | "fnc1" | "fnc1-second" | "eci";
  assignmentNumber?: number;
  applicationIndicator?: string;
  applicationIndicatorCodeword?: number;
  index?: number;
  total?: number;
  parity?: number;
  sequenceIndex?: number;
  sequenceTotal?: number;
  sequenceIndicator?: number;
}

export interface QRFnc1SecondDiagnostics {
  enabled: boolean;
  applicationIndicator: string | null;
  applicationIndicatorCodeword: number | null;
}

export interface QRStructuredAppendDiagnostics {
  enabled: boolean;
  index: number | null;
  total: number | null;
  parity: number | null;
  sequenceIndex: number | null;
  sequenceTotal: number | null;
  sequenceIndicator: number | null;
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
    | "SCAN_RISK"
    | "STRUCTURED_APPEND_MAX_SYMBOLS_NEAR_LIMIT"
    | "STRUCTURED_APPEND_DECODER_SUPPORT_VARIES";
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

export interface QRGs1ValidationDiagnostics {
  enabled: boolean;
  elementCount: number | null;
  ais: string[];
  hasSeparators: boolean;
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
  controlSegments: QRControlSegmentDiagnostics[];
  eciAssignmentNumber: number | null;
  fnc1: "first-position" | "second-position" | null;
  fnc1Second: QRFnc1SecondDiagnostics;
  structuredAppend: QRStructuredAppendDiagnostics;
  gs1: boolean;
  gs1Validation: QRGs1ValidationDiagnostics;
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

export type QRGenerateResult = QRMatrix | string | Uint8Array | QRCodeDiagnosticResult;

export interface QRStructuredAppendGenerateOptions extends Omit<
  QRCodeOptions,
  "eci" | "gs1" | "fnc1Second" | "structuredAppend" | "boostErrorCorrection"
> {
  maxSymbols?: number;
}

export interface QRStructuredAppendSegmentsGenerateOptions extends Omit<
  QRCodeOptions,
  "mode" | "encoding" | "optimizeSegments" | "eci" | "gs1" | "fnc1Second" | "structuredAppend" | "boostErrorCorrection"
> {
  maxSymbols?: number;
}

export interface QRStructuredAppendSymbolDiagnostics {
  index: number;
  total: number;
  parity: number;
  sequenceIndex: number;
  sequenceTotal: number;
  sequenceIndicator: number;
  inputStart: number;
  inputLength: number;
  byteStart: number;
  byteLength: number;
  version: Version;
  errorCorrectionLevel: ErrorCorrectionLevel;
  dataBitLength: number;
  capacityBits: number;
  remainingBits: number;
  maskPattern: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export interface QRStructuredAppendSummaryDiagnostics {
  version: Version;
  errorCorrectionLevel: ErrorCorrectionLevel;
  versionSelection: "fixed" | "auto-minimum";
  versionSelectionReason: string;
  total: number;
  parity: number;
  byteLength: number;
  inputLength: number;
  maxSymbols: number;
  splitStrategy: "greedy-largest-fitting";
  symbols: QRStructuredAppendSymbolDiagnostics[];
  warnings: QRWarning[];
}

export interface QRStructuredAppendSplitUnitDiagnostics {
  sourceSegmentIndex: number;
  mode: "numeric" | "alphanumeric" | "byte" | "kanji";
  unitStart: number;
  unitLength: number;
  byteStart: number;
  byteLength: number;
}

export interface QRStructuredAppendSegmentsSymbolDiagnostics {
  index: number;
  total: number;
  parity: number;
  sequenceIndex: number;
  sequenceTotal: number;
  sequenceIndicator: number;
  sourceSegmentStart: number;
  sourceSegmentEnd: number;
  splitUnitStart: number;
  splitUnitLength: number;
  byteStart: number;
  byteLength: number;
  version: Version;
  errorCorrectionLevel: ErrorCorrectionLevel;
  dataBitLength: number;
  capacityBits: number;
  remainingBits: number;
  maskPattern: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

export interface QRStructuredAppendSegmentsSummaryDiagnostics {
  version: Version;
  errorCorrectionLevel: ErrorCorrectionLevel;
  versionSelection: "fixed" | "auto-minimum";
  versionSelectionReason: string;
  total: number;
  parity: number;
  byteLength: number;
  inputLength: number;
  segmentCount: number;
  maxSymbols: number;
  splitStrategy: "segment-boundary-byte-chunk";
  splitUnits: QRStructuredAppendSplitUnitDiagnostics[];
  symbols: QRStructuredAppendSegmentsSymbolDiagnostics[];
  warnings: QRWarning[];
}

export interface QRStructuredAppendResult<TSymbol = QRGenerateResult> {
  symbols: TSymbol[];
  total: number;
  parity: number;
  inputLength: number;
  byteLength: number;
  diagnostics: QRStructuredAppendSummaryDiagnostics;
}

export interface QRStructuredAppendSegmentsResult<TSymbol = QRGenerateResult> {
  symbols: TSymbol[];
  total: number;
  parity: number;
  inputLength: number;
  byteLength: number;
  diagnostics: QRStructuredAppendSegmentsSummaryDiagnostics;
}

export type QRStructuredAppendBinaryPartData = Uint8Array | ArrayBuffer | ArrayBufferView;
export type QRStructuredAppendPartData = string | QRStructuredAppendBinaryPartData;

export interface QRStructuredAppendDecodedPart<TData extends QRStructuredAppendPartData = QRStructuredAppendPartData> {
  index: number;
  total: number;
  parity: number;
  data: TData;
}

export interface QRStructuredAppendMergeOptions {}

export interface QRStructuredAppendMergedPart {
  index: number;
  total: number;
  parity: number;
  dataType: "string" | "binary";
  byteLength: number;
}

export interface QRStructuredAppendMergeDiagnostics {
  partCount: number;
  total: number;
  parity: number;
  dataType: "string" | "binary";
  byteLength: number;
  missing: number[];
  duplicate: number[];
  parityCheck: {
    expected: number;
    actual: number;
    matches: true;
  };
}

export interface QRStructuredAppendMergeResult<TData extends string | Uint8Array = string | Uint8Array> {
  data: TData;
  total: number;
  parity: number;
  parts: QRStructuredAppendMergedPart[];
  diagnostics: QRStructuredAppendMergeDiagnostics;
}

export function generate(input: QRInput, options?: QRCodeOptions & { diagnostics: true }): QRCodeDiagnosticResult;
export function generate(input: QRInput, options?: QRCodeOptions & { output: "matrix"; diagnostics?: false }): QRMatrix;
export function generate(input: QRInput, options?: QRCodeOptions & { output: "png"; diagnostics?: false }): Uint8Array;
export function generate(input: QRInput, options?: QRCodeOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): string;

export function generateStructuredAppend(input: QRInput, options?: QRStructuredAppendGenerateOptions & { diagnostics: true }): QRStructuredAppendResult<QRCodeDiagnosticResult>;
export function generateStructuredAppend(input: QRInput, options?: QRStructuredAppendGenerateOptions & { output: "matrix"; diagnostics?: false }): QRStructuredAppendResult<QRMatrix>;
export function generateStructuredAppend(input: QRInput, options?: QRStructuredAppendGenerateOptions & { output: "png"; diagnostics?: false }): QRStructuredAppendResult<Uint8Array>;
export function generateStructuredAppend(input: QRInput, options?: QRStructuredAppendGenerateOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): QRStructuredAppendResult<string>;

export function generateSegmentsStructuredAppend(segments: QRSegmentInput[], options?: QRStructuredAppendSegmentsGenerateOptions & { diagnostics: true }): QRStructuredAppendSegmentsResult<QRCodeDiagnosticResult>;
export function generateSegmentsStructuredAppend(segments: QRSegmentInput[], options?: QRStructuredAppendSegmentsGenerateOptions & { output: "matrix"; diagnostics?: false }): QRStructuredAppendSegmentsResult<QRMatrix>;
export function generateSegmentsStructuredAppend(segments: QRSegmentInput[], options?: QRStructuredAppendSegmentsGenerateOptions & { output: "png"; diagnostics?: false }): QRStructuredAppendSegmentsResult<Uint8Array>;
export function generateSegmentsStructuredAppend(segments: QRSegmentInput[], options?: QRStructuredAppendSegmentsGenerateOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): QRStructuredAppendSegmentsResult<string>;

export function mergeStructuredAppendParts(parts: QRStructuredAppendDecodedPart<string>[], options?: QRStructuredAppendMergeOptions): QRStructuredAppendMergeResult<string>;
export function mergeStructuredAppendParts(parts: QRStructuredAppendDecodedPart<QRStructuredAppendBinaryPartData>[], options?: QRStructuredAppendMergeOptions): QRStructuredAppendMergeResult<Uint8Array>;
export function mergeStructuredAppendParts(parts: QRStructuredAppendDecodedPart[], options?: QRStructuredAppendMergeOptions): QRStructuredAppendMergeResult;

export function generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { diagnostics: true }): QRCodeDiagnosticResult;
export function generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output: "matrix"; diagnostics?: false }): QRMatrix;
export function generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output: "png"; diagnostics?: false }): Uint8Array;
export function generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): string;

export function drawToCanvas<T extends QRCanvasTarget>(target: T, input: QRInput, options?: QRCodeOptions): T;

export interface GS1Element {
  ai: string;
  value: string;
}

export interface GS1ElementStringParseResult {
  elements: GS1Element[];
  hasSeparators: boolean;
}

export type GS1AiLength =
  | { type: "fixed"; exact: number }
  | { type: "variable"; min: number; max: number };

export type GS1ValueKind = "numeric" | "text" | "date" | "decimal";
export type GS1CheckDigitRule = "none" | "gtin" | "sscc";
export type GS1DigitalLinkRole = "primary-key" | "key-qualifier" | "data-attribute" | "not-supported";
export type GS1SeparatorRequirement = "none" | "required-when-followed";

export interface GS1AiInfo {
  ai: string;
  label: string;
  length: GS1AiLength;
  valueKind: GS1ValueKind;
  checkDigitRule: GS1CheckDigitRule;
  digitalLinkRole: GS1DigitalLinkRole;
  digitalLinkPathForPrimary?: string[];
  separator: GS1SeparatorRequirement;
}

export type GS1ValidationContext = "element-string" | "digital-link";

export interface GS1ValidationOptions {
  context?: GS1ValidationContext;
  allowUnsupportedAi?: false;
  collectAllErrors?: boolean;
}

export type GS1ValidationErrorCode =
  | "GS1_UNSUPPORTED_AI"
  | "GS1_INVALID_LENGTH"
  | "GS1_INVALID_CHARSET"
  | "GS1_MISSING_SEPARATOR"
  | "GS1_UNEXPECTED_SEPARATOR"
  | "GS1_INVALID_CHECK_DIGIT"
  | "GS1_INVALID_DIGITAL_LINK_PLACEMENT"
  | "GS1_DIGITAL_LINK_INVALID_URI"
  | "GS1_DIGITAL_LINK_FRAGMENT_NOT_ALLOWED"
  | "GS1_INVALID_PERCENT_ENCODING"
  | "GS1_DIGITAL_LINK_UNKNOWN_QUERY"
  | "GS1_DUPLICATE_AI"
  | "GS1_INVALID_INPUT";

export interface GS1ValidationError {
  code: GS1ValidationErrorCode;
  message: string;
  ai?: string;
  value?: string;
  key?: string;
  offset?: number;
  elementIndex?: number;
  reason?: string;
  expected?: unknown;
}

export type GS1ValidationWarningCode =
  | "GS1_DIGITAL_LINK_HTTP"
  | "GS1_DIGITAL_LINK_QUERY_ONLY"
  | "GS1_DIGITAL_LINK_UNKNOWN_QUERY_PRESERVED"
  | "GS1_SEPARATOR_NOT_NEEDED"
  | "GS1_CATALOG_PARTIAL";

export interface GS1ValidationWarning {
  code: GS1ValidationWarningCode;
  message: string;
  ai?: string;
  key?: string;
  value?: string;
  elementIndex?: number;
  count?: number;
  reason?: string;
}

export interface GS1ValidationSuccess {
  ok: true;
  elements: GS1Element[];
  warnings: GS1ValidationWarning[];
}

export interface GS1ValidationFailure {
  ok: false;
  errors: GS1ValidationError[];
  warnings: GS1ValidationWarning[];
}

export type GS1ValidationResult = GS1ValidationSuccess | GS1ValidationFailure;

export interface GS1ElementStringValidationSuccess extends GS1ValidationSuccess {
  hasSeparators: boolean;
}

export type GS1ElementStringValidationFailure = GS1ValidationFailure;
export type GS1ElementStringValidationResult =
  | GS1ElementStringValidationSuccess
  | GS1ElementStringValidationFailure;

export interface GS1DigitalLinkOptions {
  baseUrl: string | URL;
  primaryAi?: "00" | "01" | "414";
  pathAis?: string[];
}

export interface GS1DigitalLinkParseOptions {
  primaryAi?: "00" | "01" | "414";
  unknownQuery?: "preserve" | "reject";
}

export interface GS1DigitalLinkUnknownQuery {
  key: string;
  value: string;
}

export interface GS1DigitalLinkParseResult {
  elements: GS1Element[];
  primary: GS1Element | null;
  pathElements: GS1Element[];
  queryElements: GS1Element[];
  unknownQuery: GS1DigitalLinkUnknownQuery[];
}

export interface GS1DigitalLinkValidationOptions {
  primaryAi?: "00" | "01" | "414";
  unknownQuery?: "preserve" | "reject";
}

export interface GS1DigitalLinkNormalizeOptions {
  primaryAi?: "00" | "01" | "414";
  unknownQuery?: "preserve" | "reject";
  mode?: "specqr-deterministic";
}

export interface GS1DigitalLinkValidationSuccess {
  ok: true;
  result: GS1DigitalLinkParseResult;
  warnings: GS1ValidationWarning[];
}

export type GS1DigitalLinkValidationFailure = GS1ValidationFailure;
export type GS1DigitalLinkValidationResult =
  | GS1DigitalLinkValidationSuccess
  | GS1DigitalLinkValidationFailure;

export const GS1_FNC1_SEPARATOR: "\x1D";
export function createGs1ElementString(elements: GS1Element[]): string;
export function createGs1DigitalLink(
  input: GS1Element[] | GS1ElementStringParseResult,
  options: GS1DigitalLinkOptions
): string;
export function parseGs1DigitalLink(
  uri: string | URL,
  options?: GS1DigitalLinkParseOptions
): GS1DigitalLinkParseResult;
export function validateGs1DigitalLink(
  uri: string | URL,
  options?: GS1DigitalLinkValidationOptions
): GS1DigitalLinkValidationResult;
export function normalizeGs1DigitalLink(
  uri: string | URL,
  options?: GS1DigitalLinkNormalizeOptions
): string;
export function parseGs1HumanReadable(input: string): GS1Element[];
export function parseGs1ElementString(input: string): GS1ElementStringParseResult;
export function getSupportedGs1Ais(): GS1AiInfo[];
export function getGs1AiInfo(ai: string): GS1AiInfo | null;
export function validateGs1Elements(elements: GS1Element[], options?: GS1ValidationOptions): GS1ValidationResult;
export function validateGs1ElementString(
  input: string,
  options?: GS1ValidationOptions
): GS1ElementStringValidationResult;
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
  static generateStructuredAppend(input: QRInput, options?: QRStructuredAppendGenerateOptions & { diagnostics: true }): QRStructuredAppendResult<QRCodeDiagnosticResult>;
  static generateStructuredAppend(input: QRInput, options?: QRStructuredAppendGenerateOptions & { output: "matrix"; diagnostics?: false }): QRStructuredAppendResult<QRMatrix>;
  static generateStructuredAppend(input: QRInput, options?: QRStructuredAppendGenerateOptions & { output: "png"; diagnostics?: false }): QRStructuredAppendResult<Uint8Array>;
  static generateStructuredAppend(input: QRInput, options?: QRStructuredAppendGenerateOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): QRStructuredAppendResult<string>;
  static generateSegmentsStructuredAppend(segments: QRSegmentInput[], options?: QRStructuredAppendSegmentsGenerateOptions & { diagnostics: true }): QRStructuredAppendSegmentsResult<QRCodeDiagnosticResult>;
  static generateSegmentsStructuredAppend(segments: QRSegmentInput[], options?: QRStructuredAppendSegmentsGenerateOptions & { output: "matrix"; diagnostics?: false }): QRStructuredAppendSegmentsResult<QRMatrix>;
  static generateSegmentsStructuredAppend(segments: QRSegmentInput[], options?: QRStructuredAppendSegmentsGenerateOptions & { output: "png"; diagnostics?: false }): QRStructuredAppendSegmentsResult<Uint8Array>;
  static generateSegmentsStructuredAppend(segments: QRSegmentInput[], options?: QRStructuredAppendSegmentsGenerateOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): QRStructuredAppendSegmentsResult<string>;
  static mergeStructuredAppendParts(parts: QRStructuredAppendDecodedPart<string>[], options?: QRStructuredAppendMergeOptions): QRStructuredAppendMergeResult<string>;
  static mergeStructuredAppendParts(parts: QRStructuredAppendDecodedPart<QRStructuredAppendBinaryPartData>[], options?: QRStructuredAppendMergeOptions): QRStructuredAppendMergeResult<Uint8Array>;
  static mergeStructuredAppendParts(parts: QRStructuredAppendDecodedPart[], options?: QRStructuredAppendMergeOptions): QRStructuredAppendMergeResult;
  static generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { diagnostics: true }): QRCodeDiagnosticResult;
  static generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output: "matrix"; diagnostics?: false }): QRMatrix;
  static generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output: "png"; diagnostics?: false }): Uint8Array;
  static generateSegments(segments: QRSegmentInput[], options?: QRCodeOptions & { output?: "svg" | "svg-data-url" | "png-data-url"; diagnostics?: false }): string;
  static drawToCanvas<T extends QRCanvasTarget>(target: T, input: QRInput, options?: QRCodeOptions): T;
  static createGs1ElementString(elements: GS1Element[]): string;
  static createGs1DigitalLink(
    input: GS1Element[] | GS1ElementStringParseResult,
    options: GS1DigitalLinkOptions
  ): string;
  static parseGs1DigitalLink(
    uri: string | URL,
    options?: GS1DigitalLinkParseOptions
  ): GS1DigitalLinkParseResult;
  static validateGs1DigitalLink(
    uri: string | URL,
    options?: GS1DigitalLinkValidationOptions
  ): GS1DigitalLinkValidationResult;
  static normalizeGs1DigitalLink(
    uri: string | URL,
    options?: GS1DigitalLinkNormalizeOptions
  ): string;
  static parseGs1HumanReadable(input: string): GS1Element[];
  static parseGs1ElementString(input: string): GS1ElementStringParseResult;
  static getSupportedGs1Ais(): GS1AiInfo[];
  static getGs1AiInfo(ai: string): GS1AiInfo | null;
  static validateGs1Elements(elements: GS1Element[], options?: GS1ValidationOptions): GS1ValidationResult;
  static validateGs1ElementString(input: string, options?: GS1ValidationOptions): GS1ElementStringValidationResult;
  static calculateGs1CheckDigit(digits: string): string;
  static validateGs1CheckDigit(digitsWithCheckDigit: string): boolean;
  static calculateGtinCheckDigit(gtinWithoutCheckDigit: string): string;
  static appendGtinCheckDigit(gtinWithoutCheckDigit: string): string;
  static validateGtinCheckDigit(gtin: string): boolean;
  static calculateSsccCheckDigit(ssccWithoutCheckDigit: string): string;
  static appendSsccCheckDigit(ssccWithoutCheckDigit: string): string;
  static validateSsccCheckDigit(sscc: string): boolean;
}
