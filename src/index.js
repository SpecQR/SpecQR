import { interleaveCodewords } from "./core/codewords.js";
import { buildMatrix } from "./core/matrix.js";
import {
  createSegments,
  encodeSegments,
  encodeUtf8,
  getSegmentByteCount,
  getSegmentTextCharacterCount,
  getSegmentsBitLength,
  isBinaryInput,
  normalizeManualSegments,
  prependEciSegment,
  prependFnc1Segment,
  prependFnc1SecondSegment,
  prependStructuredAppendSegment,
  toByteArray
} from "./encoding/modes.js";
import {
  CONTROL_SEGMENT_MODES,
  getControlSegmentDiagnostics,
  getFirstEciAssignmentNumber,
  getFirstFnc1Mode,
  getFirstFnc1SecondApplicationIndicator,
  getFirstFnc1SecondApplicationIndicatorCodeword,
  getFnc1SecondApplicationIndicatorCodeword,
  getFirstStructuredAppend,
  getFirstStructuredAppendEncodedValues,
  getStructuredAppendDiagnostics,
  isControlSegment
} from "./encoding/control-segments.js";
import { ERROR_CORRECTION_LEVEL_ORDER, getDataCodewordCount, getSize } from "./core/tables.js";
import { createDiagnostics } from "./diagnostics.js";
import {
  appendGtinCheckDigit,
  appendSsccCheckDigit,
  calculateGs1CheckDigit,
  calculateGtinCheckDigit,
  calculateSsccCheckDigit,
  createGs1DigitalLink,
  createGs1ElementString,
  GS1_FNC1_SEPARATOR,
  parseGs1DigitalLink,
  parseGs1HumanReadable,
  validateGs1CheckDigit,
  validateGtinCheckDigit,
  validateSsccCheckDigit
} from "./gs1.js";
import {
  getGs1ElementStringDiagnostics,
  parseGs1ElementString as parseRawGs1ElementString
} from "./gs1/validator.js";
import { DataTooLongError, InvalidGs1Error, InvalidInputError, InvalidModeError, InvalidOutputError } from "./errors.js";
import { normalizeOptions } from "./options.js";
import { renderCanvas } from "./render/canvas.js";
import { renderPng, renderPngDataUrl } from "./render/png.js";
import { renderSvg, renderSvgDataUrl } from "./render/svg.js";
import { mergeStructuredAppendParts } from "./structured-append.js";

export {
  appendGtinCheckDigit,
  appendSsccCheckDigit,
  calculateGs1CheckDigit,
  calculateGtinCheckDigit,
  calculateSsccCheckDigit,
  createGs1DigitalLink,
  createGs1ElementString,
  GS1_FNC1_SEPARATOR,
  parseGs1DigitalLink,
  parseGs1HumanReadable,
  validateGs1CheckDigit,
  validateGtinCheckDigit,
  validateSsccCheckDigit
} from "./gs1.js";

export { mergeStructuredAppendParts } from "./structured-append.js";

export {
  DataTooLongError,
  InvalidCanvasTargetError,
  InvalidColorError,
  InvalidEciError,
  InvalidGs1Error,
  InvalidInputError,
  InvalidModeError,
  InvalidOutputError,
  InvalidVersionError,
  SpecQRError
} from "./errors.js";

export class QRCode {
  static generate(input, options = {}) {
    return generate(input, options);
  }

  static generateStructuredAppend(input, options = {}) {
    return generateStructuredAppend(input, options);
  }

  static generateSegmentsStructuredAppend(segments, options = {}) {
    return generateSegmentsStructuredAppend(segments, options);
  }

  static mergeStructuredAppendParts(parts, options = {}) {
    return mergeStructuredAppendParts(parts, options);
  }

  static generateSegments(segments, options = {}) {
    return generateSegments(segments, options);
  }

  static drawToCanvas(target, input, options = {}) {
    return drawToCanvas(target, input, options);
  }

  static createGs1ElementString(elements) {
    return createGs1ElementString(elements);
  }

  static createGs1DigitalLink(input, options) {
    return createGs1DigitalLink(input, options);
  }

  static parseGs1DigitalLink(uri, options) {
    return parseGs1DigitalLink(uri, options);
  }

  static parseGs1HumanReadable(input) {
    return parseGs1HumanReadable(input);
  }

  static parseGs1ElementString(input) {
    return parseGs1ElementString(input);
  }

  static calculateGs1CheckDigit(digits) {
    return calculateGs1CheckDigit(digits);
  }

  static validateGs1CheckDigit(digitsWithCheckDigit) {
    return validateGs1CheckDigit(digitsWithCheckDigit);
  }

  static calculateGtinCheckDigit(gtinWithoutCheckDigit) {
    return calculateGtinCheckDigit(gtinWithoutCheckDigit);
  }

  static appendGtinCheckDigit(gtinWithoutCheckDigit) {
    return appendGtinCheckDigit(gtinWithoutCheckDigit);
  }

  static validateGtinCheckDigit(gtin) {
    return validateGtinCheckDigit(gtin);
  }

  static calculateSsccCheckDigit(ssccWithoutCheckDigit) {
    return calculateSsccCheckDigit(ssccWithoutCheckDigit);
  }

  static appendSsccCheckDigit(ssccWithoutCheckDigit) {
    return appendSsccCheckDigit(ssccWithoutCheckDigit);
  }

  static validateSsccCheckDigit(sscc) {
    return validateSsccCheckDigit(sscc);
  }
}

export function generate(input, options = {}) {
  const normalized = normalizeOptions(options);
  const plan = selectPlanForInput(input, normalized);
  return renderResult(plan, normalized, getInputByteCount(input));
}

export function generateStructuredAppend(input, options = {}) {
  const normalized = normalizeStructuredAppendGenerateOptions(options);
  const inputInfo = createStructuredAppendInputInfo(input);
  const selected = selectStructuredAppendSplit(inputInfo, normalized);
  const symbols = [];
  const symbolDiagnostics = [];

  selected.chunks.forEach((chunk, index) => {
    const symbolOptions = createStructuredAppendSymbolOptions(normalized, selected.version, {
      index: index + 1,
      total: selected.chunks.length,
      parity: inputInfo.parity
    });
    const diagnosticResult = generate(chunk.value, {
      ...symbolOptions,
      output: "matrix",
      diagnostics: true
    });
    symbolDiagnostics.push(createStructuredAppendSymbolDiagnostics({
      chunk,
      diagnostics: diagnosticResult.diagnostics
    }));

    symbols.push(normalized.diagnostics
      ? diagnosticResult
      : generate(chunk.value, symbolOptions));
  });

  return {
    symbols,
    total: symbols.length,
    parity: inputInfo.parity,
    inputLength: inputInfo.inputLength,
    byteLength: inputInfo.byteLength,
    diagnostics: createStructuredAppendSummaryDiagnostics({
      normalized,
      selected,
      inputInfo,
      symbolDiagnostics
    })
  };
}

export function generateSegmentsStructuredAppend(segments, options = {}) {
  const normalized = normalizeSegmentsStructuredAppendGenerateOptions(options);
  const normalizedSegments = normalizeStructuredAppendManualSegments(segments);
  const inputInfo = createStructuredAppendSegmentsInputInfo(normalizedSegments);
  const selected = selectStructuredAppendSegmentsSplit(inputInfo, normalized);
  const symbols = [];
  const symbolDiagnostics = [];

  selected.chunks.forEach((chunk, index) => {
    const symbolOptions = createStructuredAppendSymbolOptions(normalized, selected.version, {
      index: index + 1,
      total: selected.chunks.length,
      parity: inputInfo.parity
    });
    const diagnosticResult = generateSegments(chunk.segments, {
      ...symbolOptions,
      output: "matrix",
      diagnostics: true
    });
    symbolDiagnostics.push(createStructuredAppendSegmentsSymbolDiagnostics({
      chunk,
      diagnostics: diagnosticResult.diagnostics
    }));

    symbols.push(normalized.diagnostics
      ? diagnosticResult
      : generateSegments(chunk.segments, symbolOptions));
  });

  return {
    symbols,
    total: symbols.length,
    parity: inputInfo.parity,
    inputLength: inputInfo.inputLength,
    byteLength: inputInfo.byteLength,
    diagnostics: createStructuredAppendSegmentsSummaryDiagnostics({
      normalized,
      selected,
      inputInfo,
      symbolDiagnostics
    })
  };
}

export function generateSegments(segments, options = {}) {
  const normalized = normalizeOptions(options);
  const normalizedSegments = normalizeManualSegments(segments);
  const plan = selectPlanForManualSegments(normalizedSegments, normalized);
  return renderResult(plan, normalized, getSegmentsInputByteCount(normalizedSegments));
}

export function drawToCanvas(target, input, options = {}) {
  const normalized = normalizeOptions({
    ...options,
    output: "matrix",
    diagnostics: false
  });
  const matrix = generate(input, {
    ...normalized,
    output: "matrix",
    diagnostics: false
  });

  return renderCanvas(target, matrix, normalized);
}

export function parseGs1ElementString(input) {
  const elements = parseRawGs1ElementString(input);
  return {
    elements,
    hasSeparators: input.includes(GS1_FNC1_SEPARATOR)
  };
}

function renderResult(plan, normalized, inputBytes) {
  const capacityBits = getDataCodewordCount(plan.version, plan.errorCorrectionLevel) * 8;
  const data = encodeSegments(plan.segments, plan.version, plan.errorCorrectionLevel);
  const interleaved = interleaveCodewords(data, plan.version, plan.errorCorrectionLevel);
  const built = buildMatrix(
    interleaved.codewords,
    plan.version,
    plan.errorCorrectionLevel,
    normalized.maskPattern
  );
  const svg = normalized.output === "svg" || normalized.output === "svg-data-url" || normalized.diagnostics
    ? renderSvg(built.matrix, normalized)
    : undefined;

  if (normalized.diagnostics) {
    return {
      matrix: built.matrix,
      svg,
      diagnostics: createDiagnostics({
        plan,
        built,
        options: normalized,
        inputBytes,
        capacityBits,
        interleaved,
        getSize,
        getDiagnosticMode,
        getControlSegmentDiagnostics,
        getFirstEciAssignmentNumber,
        getFirstFnc1Mode,
        getFirstFnc1SecondApplicationIndicator,
        getFirstFnc1SecondApplicationIndicatorCodeword,
        getFirstStructuredAppend,
        getFirstStructuredAppendEncodedValues,
        gs1Validation: plan.gs1Validation,
        getSegmentDiagnostics: (segment) => getSegmentDiagnostics(segment, plan.version)
      })
    };
  }

  switch (normalized.output) {
    case "matrix":
      return built.matrix;
    case "svg":
      return svg;
    case "svg-data-url":
      return renderSvgDataUrl(built.matrix, normalized);
    case "png":
      return renderPng(built.matrix, normalized);
    case "png-data-url":
      return renderPngDataUrl(built.matrix, normalized);
    default:
      throw new InvalidOutputError(`Unsupported output: ${normalized.output}`);
  }
}

function selectPlanForInput(input, options) {
  const gs1Validation = getGs1ValidationForInput(input, options);
  const plan = selectPlan(
    (version) => prependStructuredAppendSegment(
      prependFnc1SecondSegment(
        prependFnc1Segment(
          createSegments(input, options.mode, version, options.optimizeSegments, options.eci),
          options.gs1
        ),
        options.fnc1Second
      ),
      options.structuredAppend
    ),
    options
  );
  return gs1Validation ? { ...plan, gs1Validation } : plan;
}

function selectPlanForManualSegments(segments, options) {
  return selectPlan(
    () => prependStructuredAppendSegment(
      prependFnc1SecondSegment(
        prependFnc1Segment(prependEciSegment(segments, options.eci), options.gs1),
        options.fnc1Second
      ),
      options.structuredAppend
    ),
    options
  );
}

function normalizeStructuredAppendGenerateOptions(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new InvalidInputError("generateStructuredAppend options must be an object");
  }

  if (Object.hasOwn(options, "errorCorrection")) {
    throw new InvalidModeError("generateStructuredAppend uses errorCorrectionLevel; errorCorrection is not supported");
  }
  if (Object.hasOwn(options, "mask")) {
    throw new InvalidModeError("generateStructuredAppend uses maskPattern; mask is not supported");
  }
  if (Object.hasOwn(options, "parity")) {
    throw new InvalidModeError("generateStructuredAppend computes parity from the original payload bytes; parity override is not supported");
  }
  if (Object.hasOwn(options, "structuredAppend") && options.structuredAppend !== false) {
    throw new InvalidModeError("generateStructuredAppend owns the Structured Append header; structuredAppend option is not supported");
  }

  const maxSymbols = Object.hasOwn(options, "maxSymbols") ? options.maxSymbols : 16;
  if (!Number.isInteger(maxSymbols) || maxSymbols < 2 || maxSymbols > 16) {
    throw new InvalidModeError(`maxSymbols must be an integer from 2 to 16; got ${maxSymbols}`);
  }

  const normalized = normalizeOptions(options);
  if (normalized.eci !== false) {
    throw new InvalidModeError("generateStructuredAppend cannot be combined with ECI in this implementation");
  }
  if (normalized.gs1) {
    throw new InvalidGs1Error("generateStructuredAppend cannot be combined with gs1: true in this implementation");
  }
  if (normalized.fnc1Second !== false) {
    throw new InvalidModeError("generateStructuredAppend cannot be combined with FNC1 second position in this implementation");
  }
  if (normalized.boostErrorCorrection) {
    throw new InvalidModeError("generateStructuredAppend does not support boostErrorCorrection in this implementation");
  }

  return {
    ...normalized,
    maxSymbols,
    eci: false,
    gs1: false,
    fnc1Second: false,
    structuredAppend: false,
    boostErrorCorrection: false
  };
}

function normalizeSegmentsStructuredAppendGenerateOptions(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new InvalidInputError("generateSegmentsStructuredAppend options must be an object");
  }

  if (Object.hasOwn(options, "mode")) {
    throw new InvalidModeError("generateSegmentsStructuredAppend uses caller-provided segment modes; mode is not supported");
  }
  if (Object.hasOwn(options, "encoding")) {
    throw new InvalidModeError("generateSegmentsStructuredAppend uses existing manual byte encoding behavior; encoding is not supported");
  }
  if (Object.hasOwn(options, "optimizeSegments")) {
    throw new InvalidModeError("generateSegmentsStructuredAppend preserves manual segments; optimizeSegments is not supported");
  }
  if (Object.hasOwn(options, "errorCorrection")) {
    throw new InvalidModeError("generateSegmentsStructuredAppend uses errorCorrectionLevel; errorCorrection is not supported");
  }
  if (Object.hasOwn(options, "mask")) {
    throw new InvalidModeError("generateSegmentsStructuredAppend uses maskPattern; mask is not supported");
  }
  if (Object.hasOwn(options, "parity")) {
    throw new InvalidModeError("generateSegmentsStructuredAppend computes parity from the manual segment payload bytes; parity override is not supported");
  }
  if (Object.hasOwn(options, "structuredAppend") && options.structuredAppend !== false) {
    throw new InvalidModeError("generateSegmentsStructuredAppend owns the Structured Append header; structuredAppend option is not supported");
  }

  const maxSymbols = Object.hasOwn(options, "maxSymbols") ? options.maxSymbols : 16;
  if (!Number.isInteger(maxSymbols) || maxSymbols < 2 || maxSymbols > 16) {
    throw new InvalidModeError(`maxSymbols must be an integer from 2 to 16; got ${maxSymbols}`);
  }

  const normalized = normalizeOptions({
    ...options,
    mode: "auto",
    encoding: "utf-8",
    optimizeSegments: true
  });
  if (normalized.eci !== false) {
    throw new InvalidModeError("generateSegmentsStructuredAppend cannot be combined with ECI in this implementation");
  }
  if (normalized.gs1) {
    throw new InvalidGs1Error("generateSegmentsStructuredAppend cannot be combined with gs1: true in this implementation");
  }
  if (normalized.fnc1Second !== false) {
    throw new InvalidModeError("generateSegmentsStructuredAppend cannot be combined with FNC1 second position in this implementation");
  }
  if (normalized.boostErrorCorrection) {
    throw new InvalidModeError("generateSegmentsStructuredAppend does not support boostErrorCorrection in this implementation");
  }

  return {
    ...normalized,
    maxSymbols,
    eci: false,
    gs1: false,
    fnc1Second: false,
    structuredAppend: false,
    boostErrorCorrection: false
  };
}

function createStructuredAppendInputInfo(input) {
  const binary = isBinaryInput(input);
  const units = binary ? toByteArray(input) : Array.from(assertStructuredAppendTextInput(input));
  const byteLengths = binary ? units.map(() => 1) : units.map((unit) => encodeUtf8(unit).length);
  const bytes = binary ? units : encodeUtf8(input);

  if (units.length === 0) {
    throw new InvalidInputError("generateStructuredAppend requires input that can be split into at least two non-empty symbols");
  }

  const byteStarts = [];
  let offset = 0;
  for (const byteLength of byteLengths) {
    byteStarts.push(offset);
    offset += byteLength;
  }

  return {
    binary,
    units,
    byteLengths,
    byteStarts,
    inputLength: units.length,
    byteLength: bytes.length,
    parity: bytes.reduce((parity, byte) => parity ^ byte, 0),
    makeChunk: (start, length) => {
      const unitSlice = units.slice(start, start + length);
      const byteLength = byteLengths.slice(start, start + length).reduce((total, value) => total + value, 0);
      return {
        value: binary ? Uint8Array.from(unitSlice) : unitSlice.join(""),
        inputStart: start,
        inputLength: length,
        byteStart: byteStarts[start] ?? 0,
        byteLength
      };
    }
  };
}

function assertStructuredAppendTextInput(input) {
  if (typeof input !== "string") {
    throw new InvalidInputError(`QR input must be a string, Uint8Array, ArrayBuffer, or ArrayBuffer view; got ${typeof input}`);
  }
  return input;
}

function normalizeStructuredAppendManualSegments(segments) {
  const normalizedSegments = normalizeManualSegments(segments);
  if (normalizedSegments.length === 0) {
    throw new InvalidInputError("generateSegmentsStructuredAppend requires at least two non-empty data split units");
  }

  for (const segment of normalizedSegments) {
    if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST) {
      throw new InvalidGs1Error("generateSegmentsStructuredAppend cannot be combined with manual FNC1 first position segments");
    }
    if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_SECOND) {
      throw new InvalidModeError("generateSegmentsStructuredAppend cannot be combined with manual FNC1 second position segments");
    }
    if (segment.mode === CONTROL_SEGMENT_MODES.ECI) {
      throw new InvalidModeError("generateSegmentsStructuredAppend cannot be combined with manual ECI segments");
    }
    if (segment.mode === CONTROL_SEGMENT_MODES.STRUCTURED_APPEND) {
      throw new InvalidModeError("generateSegmentsStructuredAppend owns the Structured Append header; manual structured-append segments are not supported");
    }
    if (isControlSegment(segment)) {
      throw new InvalidModeError(`generateSegmentsStructuredAppend does not support manual ${segment.mode} control segments`);
    }
  }

  return normalizedSegments;
}

function createStructuredAppendSegmentsInputInfo(segments) {
  const splitUnits = [];
  const canonicalBytes = [];

  segments.forEach((segment, sourceSegmentIndex) => {
    const byteStart = canonicalBytes.length;
    const segmentBytes = getStructuredAppendSegmentCanonicalBytes(segment);
    canonicalBytes.push(...segmentBytes);
    const segmentUnits = createStructuredAppendSegmentSplitUnits({
      segment,
      sourceSegmentIndex,
      byteStart
    });
    if (segmentUnits.length === 0) {
      throw new InvalidInputError(`segments[${sourceSegmentIndex}] must include non-empty data for generateSegmentsStructuredAppend`);
    }
    splitUnits.push(...segmentUnits);
  });

  if (splitUnits.length === 0) {
    throw new InvalidInputError("generateSegmentsStructuredAppend requires input that can be split into at least two non-empty split units");
  }

  return {
    segments,
    splitUnits,
    inputLength: segments.length,
    byteLength: canonicalBytes.length,
    parity: canonicalBytes.reduce((parity, byte) => parity ^ byte, 0),
    makeChunk: (start, length) => createStructuredAppendSegmentsChunk(splitUnits, start, length)
  };
}

function getStructuredAppendSegmentCanonicalBytes(segment) {
  if (segment.mode === "byte") {
    return segment.bytes !== undefined ? segment.bytes : encodeUtf8(segment.text);
  }
  if (segment.mode === "kanji") {
    return encodeUtf8(segment.text);
  }
  return Array.from(segment.text, (character) => character.charCodeAt(0));
}

function createStructuredAppendSegmentSplitUnits({ segment, sourceSegmentIndex, byteStart }) {
  if (segment.mode === "byte") {
    return segment.bytes !== undefined
      ? createBinaryByteSegmentSplitUnits({ segment, sourceSegmentIndex, byteStart })
      : createTextByteSegmentSplitUnits({ segment, sourceSegmentIndex, byteStart });
  }

  const characterLength = Array.from(segment.text).length;
  if (characterLength === 0) {
    return [];
  }
  return [{
    sourceSegmentIndex,
    mode: segment.mode,
    unitStart: 0,
    unitLength: characterLength,
    byteStart,
    byteLength: getStructuredAppendSegmentCanonicalBytes(segment).length,
    segment: { ...segment }
  }];
}

function createBinaryByteSegmentSplitUnits({ segment, sourceSegmentIndex, byteStart }) {
  return segment.bytes.map((byte, index) => ({
    sourceSegmentIndex,
    mode: "byte",
    unitStart: index,
    unitLength: 1,
    byteStart: byteStart + index,
    byteLength: 1,
    byteKind: "binary",
    bytes: [byte]
  }));
}

function createTextByteSegmentSplitUnits({ segment, sourceSegmentIndex, byteStart }) {
  let offset = 0;
  return Array.from(segment.text, (character, index) => {
    const bytes = encodeUtf8(character);
    const unit = {
      sourceSegmentIndex,
      mode: "byte",
      unitStart: index,
      unitLength: 1,
      byteStart: byteStart + offset,
      byteLength: bytes.length,
      byteKind: "text",
      text: character
    };
    offset += bytes.length;
    return unit;
  });
}

function createStructuredAppendSegmentsChunk(splitUnits, start, length) {
  const units = splitUnits.slice(start, start + length);
  return {
    segments: materializeStructuredAppendSegmentsChunk(units),
    sourceSegmentStart: Math.min(...units.map((unit) => unit.sourceSegmentIndex)),
    sourceSegmentEnd: Math.max(...units.map((unit) => unit.sourceSegmentIndex)) + 1,
    splitUnitStart: start,
    splitUnitLength: length,
    byteStart: units[0]?.byteStart ?? 0,
    byteLength: units.reduce((total, unit) => total + unit.byteLength, 0)
  };
}

function materializeStructuredAppendSegmentsChunk(units) {
  const pieces = [];

  for (const unit of units) {
    const last = pieces.at(-1);
    if (
      unit.mode === "byte" &&
      last?.sourceSegmentIndex === unit.sourceSegmentIndex &&
      last.byteKind === unit.byteKind
    ) {
      if (unit.byteKind === "binary") {
        last.segment.bytes.push(...unit.bytes);
      } else {
        last.segment.text += unit.text;
      }
      continue;
    }

    pieces.push({
      sourceSegmentIndex: unit.sourceSegmentIndex,
      byteKind: unit.byteKind,
      segment: createStructuredAppendChunkSegment(unit)
    });
  }

  return pieces.map((piece) => piece.segment);
}

function createStructuredAppendChunkSegment(unit) {
  if (unit.mode !== "byte") {
    return { ...unit.segment };
  }
  if (unit.byteKind === "binary") {
    return { mode: "byte", bytes: [...unit.bytes] };
  }
  return { mode: "byte", text: unit.text };
}

function selectStructuredAppendSplit(inputInfo, normalized) {
  if (normalized.version !== "auto") {
    const attempt = attemptStructuredAppendSplitAtVersion(inputInfo, normalized, normalized.version);
    if (attempt.status === "single") {
      throw new InvalidInputError(
        `Input fits in one version ${normalized.version}-${normalized.errorCorrectionLevel} symbol; use generate() or the low-level structuredAppend option instead`
      );
    }
    if (attempt.status === "ok") {
      return {
        ...attempt,
        versionSelection: "fixed",
        versionSelectionReason: `Version ${attempt.version} was requested explicitly.`
      };
    }
    throw new DataTooLongError(
      `Input cannot be split into ${normalized.maxSymbols} or fewer version ${normalized.version}-${normalized.errorCorrectionLevel} Structured Append symbols`
    );
  }

  let sawTooLong = false;
  let sawSingle = false;
  for (let version = normalized.minVersion; version <= normalized.maxVersion; version += 1) {
    const attempt = attemptStructuredAppendSplitAtVersion(inputInfo, normalized, version);
    if (attempt.status === "ok") {
      return {
        ...attempt,
        versionSelection: "auto-minimum",
        versionSelectionReason: `Version ${version} is the smallest version in ${normalized.minVersion}..${normalized.maxVersion} that can split the payload into ${attempt.chunks.length} Structured Append symbols at error correction ${normalized.errorCorrectionLevel}.`
      };
    }
    if (attempt.status === "single") {
      sawSingle = true;
    } else {
      sawTooLong = true;
    }
  }

  if (sawTooLong) {
    throw new DataTooLongError(
      `Input cannot be split into ${normalized.maxSymbols} or fewer Structured Append symbols for versions ${normalized.minVersion}..${normalized.maxVersion} at error correction ${normalized.errorCorrectionLevel}`
    );
  }
  if (sawSingle) {
    throw new InvalidInputError("Input fits in one symbol in the selected version range; use generate() or the low-level structuredAppend option instead");
  }
  throw new DataTooLongError(
    `Input cannot be split into Structured Append symbols for versions ${normalized.minVersion}..${normalized.maxVersion}`
  );
}

function attemptStructuredAppendSplitAtVersion(inputInfo, normalized, version) {
  const wholeChunk = inputInfo.makeChunk(0, inputInfo.inputLength);
  if (canFitStructuredAppendChunk(wholeChunk.value, normalized, version)) {
    return { status: "single", version };
  }

  const chunks = [];
  let position = 0;

  while (position < inputInfo.inputLength) {
    if (chunks.length >= normalized.maxSymbols) {
      return { status: "too-long", version };
    }

    const remaining = inputInfo.inputLength - position;
    const maxPrefixLength = chunks.length === 0 ? remaining - 1 : remaining;
    if (maxPrefixLength < 1) {
      return { status: "single", version };
    }

    const prefixLength = findLargestFittingStructuredAppendPrefix({
      inputInfo,
      normalized,
      version,
      position,
      maxPrefixLength
    });
    if (prefixLength < 1) {
      return { status: "too-long", version };
    }

    chunks.push(inputInfo.makeChunk(position, prefixLength));
    position += prefixLength;
  }

  return chunks.length >= 2
    ? { status: "ok", version, chunks }
    : { status: "single", version };
}

function findLargestFittingStructuredAppendPrefix({ inputInfo, normalized, version, position, maxPrefixLength }) {
  let low = 1;
  let high = maxPrefixLength;
  let best = 0;

  while (low <= high) {
    const length = Math.floor((low + high) / 2);
    const chunk = inputInfo.makeChunk(position, length);
    if (canFitStructuredAppendChunk(chunk.value, normalized, version)) {
      best = length;
      low = length + 1;
    } else {
      high = length - 1;
    }
  }

  return best;
}

function selectStructuredAppendSegmentsSplit(inputInfo, normalized) {
  if (normalized.version !== "auto") {
    const attempt = attemptStructuredAppendSegmentsSplitAtVersion(inputInfo, normalized, normalized.version);
    if (attempt.status === "single") {
      throw new InvalidInputError(
        `Input segments fit in one version ${normalized.version}-${normalized.errorCorrectionLevel} symbol; use generateSegments() or the low-level structuredAppend option instead`
      );
    }
    if (attempt.status === "ok") {
      return {
        ...attempt,
        versionSelection: "fixed",
        versionSelectionReason: `Version ${attempt.version} was requested explicitly.`
      };
    }
    throw new DataTooLongError(
      `Input segments cannot be split into ${normalized.maxSymbols} or fewer version ${normalized.version}-${normalized.errorCorrectionLevel} Structured Append symbols`
    );
  }

  let sawTooLong = false;
  let sawSingle = false;
  for (let version = normalized.minVersion; version <= normalized.maxVersion; version += 1) {
    const attempt = attemptStructuredAppendSegmentsSplitAtVersion(inputInfo, normalized, version);
    if (attempt.status === "ok") {
      return {
        ...attempt,
        versionSelection: "auto-minimum",
        versionSelectionReason: `Version ${version} is the smallest version in ${normalized.minVersion}..${normalized.maxVersion} that can split the manual segments into ${attempt.chunks.length} Structured Append symbols at error correction ${normalized.errorCorrectionLevel}.`
      };
    }
    if (attempt.status === "single") {
      sawSingle = true;
    } else {
      sawTooLong = true;
    }
  }

  if (sawTooLong) {
    throw new DataTooLongError(
      `Input segments cannot be split into ${normalized.maxSymbols} or fewer Structured Append symbols for versions ${normalized.minVersion}..${normalized.maxVersion} at error correction ${normalized.errorCorrectionLevel}`
    );
  }
  if (sawSingle) {
    throw new InvalidInputError("Input segments fit in one symbol in the selected version range; use generateSegments() or the low-level structuredAppend option instead");
  }
  throw new DataTooLongError(
    `Input segments cannot be split into Structured Append symbols for versions ${normalized.minVersion}..${normalized.maxVersion}`
  );
}

function attemptStructuredAppendSegmentsSplitAtVersion(inputInfo, normalized, version) {
  const wholeChunk = inputInfo.makeChunk(0, inputInfo.splitUnits.length);
  if (canFitStructuredAppendSegmentsChunk(wholeChunk, normalized, version)) {
    return { status: "single", version };
  }
  if (inputInfo.splitUnits.length < 2) {
    return { status: "too-long", version };
  }

  const chunks = [];
  let position = 0;

  while (position < inputInfo.splitUnits.length) {
    if (chunks.length >= normalized.maxSymbols) {
      return { status: "too-long", version };
    }

    const remaining = inputInfo.splitUnits.length - position;
    const maxPrefixLength = chunks.length === 0 ? remaining - 1 : remaining;
    if (maxPrefixLength < 1) {
      return { status: "single", version };
    }

    const prefixLength = findLargestFittingStructuredAppendSegmentsPrefix({
      inputInfo,
      normalized,
      version,
      position,
      maxPrefixLength
    });
    if (prefixLength < 1) {
      return { status: "too-long", version };
    }

    chunks.push(inputInfo.makeChunk(position, prefixLength));
    position += prefixLength;
  }

  return chunks.length >= 2
    ? { status: "ok", version, chunks }
    : { status: "single", version };
}

function findLargestFittingStructuredAppendSegmentsPrefix({ inputInfo, normalized, version, position, maxPrefixLength }) {
  let low = 1;
  let high = maxPrefixLength;
  let best = 0;

  while (low <= high) {
    const length = Math.floor((low + high) / 2);
    const chunk = inputInfo.makeChunk(position, length);
    if (canFitStructuredAppendSegmentsChunk(chunk, normalized, version)) {
      best = length;
      low = length + 1;
    } else {
      high = length - 1;
    }
  }

  return best;
}

function canFitStructuredAppendChunk(input, normalized, version) {
  try {
    selectPlanForInput(input, createStructuredAppendSymbolOptions(normalized, version, {
      index: 1,
      total: 2,
      parity: 0
    }));
    return true;
  } catch (error) {
    if (error instanceof DataTooLongError) {
      return false;
    }
    throw error;
  }
}

function canFitStructuredAppendSegmentsChunk(chunk, normalized, version) {
  try {
    selectPlanForManualSegments(chunk.segments, createStructuredAppendSymbolOptions(normalized, version, {
      index: 1,
      total: 2,
      parity: 0
    }));
    return true;
  } catch (error) {
    if (error instanceof DataTooLongError) {
      return false;
    }
    throw error;
  }
}

function createStructuredAppendSymbolOptions(normalized, version, structuredAppend) {
  return {
    ...normalized,
    version,
    minVersion: version,
    maxVersion: version,
    structuredAppend
  };
}

function createStructuredAppendSummaryDiagnostics({ normalized, selected, inputInfo, symbolDiagnostics }) {
  const warnings = createStructuredAppendWarnings(normalized, selected.chunks.length);
  return {
    version: selected.version,
    errorCorrectionLevel: normalized.errorCorrectionLevel,
    versionSelection: selected.versionSelection,
    versionSelectionReason: selected.versionSelectionReason,
    total: selected.chunks.length,
    parity: inputInfo.parity,
    byteLength: inputInfo.byteLength,
    inputLength: inputInfo.inputLength,
    maxSymbols: normalized.maxSymbols,
    splitStrategy: "greedy-largest-fitting",
    symbols: symbolDiagnostics,
    warnings
  };
}

function createStructuredAppendSegmentsSummaryDiagnostics({ normalized, selected, inputInfo, symbolDiagnostics }) {
  const warnings = createStructuredAppendWarnings(normalized, selected.chunks.length);
  return {
    version: selected.version,
    errorCorrectionLevel: normalized.errorCorrectionLevel,
    versionSelection: selected.versionSelection,
    versionSelectionReason: selected.versionSelectionReason,
    total: selected.chunks.length,
    parity: inputInfo.parity,
    byteLength: inputInfo.byteLength,
    inputLength: inputInfo.inputLength,
    segmentCount: inputInfo.segments.length,
    maxSymbols: normalized.maxSymbols,
    splitStrategy: "segment-boundary-byte-chunk",
    splitUnits: inputInfo.splitUnits.map((unit) => ({
      sourceSegmentIndex: unit.sourceSegmentIndex,
      mode: unit.mode,
      unitStart: unit.unitStart,
      unitLength: unit.unitLength,
      byteStart: unit.byteStart,
      byteLength: unit.byteLength
    })),
    symbols: symbolDiagnostics,
    warnings
  };
}

function createStructuredAppendWarnings(normalized, total) {
  const warnings = [];
  if (total === normalized.maxSymbols) {
    warnings.push({
      code: "STRUCTURED_APPEND_MAX_SYMBOLS_NEAR_LIMIT",
      severity: "info",
      message: "The generated Structured Append set uses the configured maximum number of symbols.",
      details: { total, maxSymbols: normalized.maxSymbols }
    });
  }
  if (normalized.diagnostics) {
    warnings.push({
      code: "STRUCTURED_APPEND_DECODER_SUPPORT_VARIES",
      severity: "info",
      message: "Decoder APIs vary in how they expose Structured Append set metadata.",
      details: { total }
    });
  }
  return warnings;
}

function createStructuredAppendSegmentsSymbolDiagnostics({ chunk, diagnostics }) {
  const structuredAppend = diagnostics.structuredAppend;
  return {
    index: structuredAppend.index,
    total: structuredAppend.total,
    parity: structuredAppend.parity,
    sequenceIndex: structuredAppend.sequenceIndex,
    sequenceTotal: structuredAppend.sequenceTotal,
    sequenceIndicator: structuredAppend.sequenceIndicator,
    sourceSegmentStart: chunk.sourceSegmentStart,
    sourceSegmentEnd: chunk.sourceSegmentEnd,
    splitUnitStart: chunk.splitUnitStart,
    splitUnitLength: chunk.splitUnitLength,
    byteStart: chunk.byteStart,
    byteLength: chunk.byteLength,
    version: diagnostics.version,
    errorCorrectionLevel: diagnostics.errorCorrectionLevel,
    dataBitLength: diagnostics.dataBitLength,
    capacityBits: diagnostics.capacityBits,
    remainingBits: diagnostics.remainingBits,
    maskPattern: diagnostics.maskPattern
  };
}

function createStructuredAppendSymbolDiagnostics({ chunk, diagnostics }) {
  const structuredAppend = diagnostics.structuredAppend;
  return {
    index: structuredAppend.index,
    total: structuredAppend.total,
    parity: structuredAppend.parity,
    sequenceIndex: structuredAppend.sequenceIndex,
    sequenceTotal: structuredAppend.sequenceTotal,
    sequenceIndicator: structuredAppend.sequenceIndicator,
    inputStart: chunk.inputStart,
    inputLength: chunk.inputLength,
    byteStart: chunk.byteStart,
    byteLength: chunk.byteLength,
    version: diagnostics.version,
    errorCorrectionLevel: diagnostics.errorCorrectionLevel,
    dataBitLength: diagnostics.dataBitLength,
    capacityBits: diagnostics.capacityBits,
    remainingBits: diagnostics.remainingBits,
    maskPattern: diagnostics.maskPattern
  };
}

function getGs1ValidationForInput(input, options) {
  if (!options.gs1) {
    return null;
  }
  if (isBinaryInput(input)) {
    throw new InvalidGs1Error("gs1 input must be a raw GS1 element string, not binary input");
  }
  if (typeof input !== "string") {
    throw new InvalidGs1Error("gs1 input must be a raw GS1 element string");
  }
  return getGs1ElementStringDiagnostics(input);
}

function selectPlan(createSegmentsForVersion, options) {
  if (options.version !== "auto") {
    return withBoostedErrorCorrection({
      ...ensureFits(createSegmentsForVersion, options.version, options),
      versionSelection: "fixed"
    }, options);
  }

  for (let version = options.minVersion; version <= options.maxVersion; version += 1) {
    const plan = createPlan(createSegmentsForVersion, version, options);
    if (plan.dataBitLength <= getDataCodewordCount(version, options.errorCorrectionLevel) * 8) {
      return withBoostedErrorCorrection({
        ...plan,
        versionSelection: "auto-minimum"
      }, options);
    }
  }

  throw new DataTooLongError(
    `Input requires more capacity than versions ${options.minVersion}..${options.maxVersion} at error correction ${options.errorCorrectionLevel}`
  );
}

function ensureFits(createSegmentsForVersion, version, options) {
  const plan = createPlan(createSegmentsForVersion, version, options);
  if (plan.dataBitLength > getDataCodewordCount(version, options.errorCorrectionLevel) * 8) {
    const capacityBits = getDataCodewordCount(version, options.errorCorrectionLevel) * 8;
    throw new DataTooLongError(
      `Input requires ${plan.dataBitLength} bits, but version ${version}-${options.errorCorrectionLevel} has ${capacityBits} data bits`
    );
  }

  return plan;
}

function createPlan(createSegmentsForVersion, version, options) {
  const segments = createSegmentsForVersion(version);
  return {
    version,
    segments,
    dataBitLength: getSegmentsBitLength(segments, version),
    errorCorrectionLevel: options.errorCorrectionLevel,
    requestedErrorCorrectionLevel: options.errorCorrectionLevel,
    boostedErrorCorrection: false
  };
}

function withBoostedErrorCorrection(plan, options) {
  if (!options.boostErrorCorrection) {
    return plan;
  }

  let errorCorrectionLevel = options.errorCorrectionLevel;
  const startIndex = ERROR_CORRECTION_LEVEL_ORDER.indexOf(errorCorrectionLevel);

  for (let index = startIndex + 1; index < ERROR_CORRECTION_LEVEL_ORDER.length; index += 1) {
    const candidate = ERROR_CORRECTION_LEVEL_ORDER[index];
    if (plan.dataBitLength <= getDataCodewordCount(plan.version, candidate) * 8) {
      errorCorrectionLevel = candidate;
    }
  }

  return {
    ...plan,
    errorCorrectionLevel,
    boostedErrorCorrection: errorCorrectionLevel !== options.errorCorrectionLevel
  };
}

function getDiagnosticMode(segments) {
  const dataSegments = segments.filter((segment) => !isControlSegment(segment));
  const mode = dataSegments[0]?.mode ?? "byte";
  return dataSegments.every((segment) => segment.mode === mode) ? mode : "mixed";
}

function getSegmentDiagnostics(segment, version) {
  const diagnostics = {
    mode: segment.mode,
    assignmentNumber: segment.assignmentNumber,
    characterCount: getSegmentTextCharacterCount(segment),
    byteCount: getSegmentByteCount(segment),
    bitLength: getSegmentsBitLength([segment], version)
  };
  if (segment.applicationIndicator !== undefined) {
    diagnostics.applicationIndicator = segment.applicationIndicator;
    diagnostics.applicationIndicatorCodeword = getFnc1SecondApplicationIndicatorCodeword(segment.applicationIndicator);
  }
  if (segment.mode === "structured-append") {
    Object.assign(diagnostics, getStructuredAppendDiagnostics(segment));
  }
  return diagnostics;
}

function getInputByteCount(input) {
  return isBinaryInput(input) ? toByteArray(input).length : encodeUtf8(input).length;
}

function getSegmentsInputByteCount(segments) {
  return segments.reduce((total, segment) => total + getSegmentByteCount(segment), 0);
}
