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
  toByteArray
} from "./encoding/modes.js";
import { ERROR_CORRECTION_LEVEL_ORDER, getDataCodewordCount, getSize } from "./core/tables.js";
import { createDiagnostics } from "./diagnostics.js";
import {
  appendGtinCheckDigit,
  appendSsccCheckDigit,
  calculateGs1CheckDigit,
  calculateGtinCheckDigit,
  calculateSsccCheckDigit,
  createGs1ElementString,
  GS1_FNC1_SEPARATOR,
  parseGs1HumanReadable,
  validateGs1CheckDigit,
  validateGtinCheckDigit,
  validateSsccCheckDigit
} from "./gs1.js";
import { DataTooLongError, InvalidGs1Error, InvalidOutputError } from "./errors.js";
import { normalizeOptions } from "./options.js";
import { renderCanvas } from "./render/canvas.js";
import { renderPng, renderPngDataUrl } from "./render/png.js";
import { renderSvg, renderSvgDataUrl } from "./render/svg.js";

export {
  appendGtinCheckDigit,
  appendSsccCheckDigit,
  calculateGs1CheckDigit,
  calculateGtinCheckDigit,
  calculateSsccCheckDigit,
  createGs1ElementString,
  GS1_FNC1_SEPARATOR,
  parseGs1HumanReadable,
  validateGs1CheckDigit,
  validateGtinCheckDigit,
  validateSsccCheckDigit
} from "./gs1.js";

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

  static generateSegments(segments, options = {}) {
    return generateSegments(segments, options);
  }

  static drawToCanvas(target, input, options = {}) {
    return drawToCanvas(target, input, options);
  }

  static createGs1ElementString(elements) {
    return createGs1ElementString(elements);
  }

  static parseGs1HumanReadable(input) {
    return parseGs1HumanReadable(input);
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
        getFirstEciAssignmentNumber,
        getFirstFnc1Mode,
        getSegmentDiagnostics: (segment) => ({
          mode: segment.mode,
          assignmentNumber: segment.assignmentNumber,
          characterCount: getSegmentTextCharacterCount(segment),
          byteCount: getSegmentByteCount(segment),
          bitLength: getSegmentsBitLength([segment], plan.version)
        })
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
  if (options.gs1 && isBinaryInput(input)) {
    throw new InvalidGs1Error("gs1 input must be a GS1 element string, not binary input");
  }
  return selectPlan(
    (version) => prependFnc1Segment(
      createSegments(input, options.mode, version, options.optimizeSegments, options.eci),
      options.gs1
    ),
    options
  );
}

function selectPlanForManualSegments(segments, options) {
  return selectPlan(
    () => prependFnc1Segment(prependEciSegment(segments, options.eci), options.gs1),
    options
  );
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
  const dataSegments = segments.filter((segment) => !["eci", "fnc1"].includes(segment.mode));
  const mode = dataSegments[0]?.mode ?? "byte";
  return dataSegments.every((segment) => segment.mode === mode) ? mode : "mixed";
}

function getFirstEciAssignmentNumber(segments) {
  return segments.find((segment) => segment.mode === "eci")?.assignmentNumber ?? null;
}

function getFirstFnc1Mode(segments) {
  return segments.some((segment) => segment.mode === "fnc1") ? "first-position" : null;
}

function getInputByteCount(input) {
  return isBinaryInput(input) ? toByteArray(input).length : encodeUtf8(input).length;
}

function getSegmentsInputByteCount(segments) {
  return segments.reduce((total, segment) => total + getSegmentByteCount(segment), 0);
}
