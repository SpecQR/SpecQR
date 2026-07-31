import {
  createSegments,
  encodeUtf8,
  getSegmentByteCount,
  getSegmentTextCharacterCount,
  getSegmentsBitLength,
  isAlphanumeric,
  isBinaryInput,
  isKanji,
  isNumeric,
  prependEciSegment,
  prependFnc1Segment,
  prependFnc1SecondSegment,
  prependStructuredAppendSegment,
  toByteArray
} from "../encoding/modes.js";
import {
  getFnc1SecondApplicationIndicatorCodeword,
  getStructuredAppendDiagnostics,
  isControlSegment
} from "../encoding/control-segments.js";
import {
  ERROR_CORRECTION_LEVEL_ORDER,
  ERROR_CORRECTION_LEVELS,
  getCharacterCountBitLength,
  getDataCodewordCount,
  getRawCodewordCount,
  getSize
} from "../core/tables.js";
import {
  DataTooLongError,
  InvalidGs1Error,
  InvalidInputError,
  InvalidModeError,
  InvalidVersionError
} from "../errors.js";
import { getGs1ElementStringDiagnostics } from "../gs1/validator.js";
import { countCodePoints, getUtf8CanonicalInfo } from "./bytes.js";

export function getCapacity(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new InvalidInputError("getCapacity options must be an object");
  }

  const { version } = options;
  if (!Number.isInteger(version) || version < 1 || version > 40) {
    throw new InvalidVersionError(`version must be an integer from 1 to 40; got ${version}`);
  }

  const errorCorrectionLevel = normalizeCapacityErrorCorrection(options);
  const mode = Object.hasOwn(options, "mode") ? options.mode : null;
  if (mode !== null && !["numeric", "alphanumeric", "byte", "kanji"].includes(mode)) {
    throw new InvalidModeError(`mode must be "numeric", "alphanumeric", "byte", or "kanji"; got ${mode}`);
  }

  const controlBits = Object.hasOwn(options, "controlBits") ? options.controlBits : 0;
  if (!Number.isInteger(controlBits) || controlBits < 0) {
    throw new InvalidInputError(`controlBits must be a non-negative integer; got ${controlBits}`);
  }

  const dataCodewords = getDataCodewordCount(version, errorCorrectionLevel);
  const totalCodewords = getRawCodewordCount(version);
  const capacityBits = dataCodewords * 8;
  const base = {
    version,
    errorCorrectionLevel,
    size: getSize(version),
    dataCodewords,
    totalCodewords,
    capacityBits,
    mode,
    characterCountBits: null,
    modeIndicatorBits: null,
    controlBits,
    payloadBits: null,
    maxCharacters: null,
    maxBytes: null
  };

  if (mode === null) {
    return base;
  }

  const characterCountBits = getCharacterCountBitLength(version, mode);
  const modeIndicatorBits = 4;
  const payloadBits = Math.max(0, capacityBits - controlBits - modeIndicatorBits - characterCountBits);
  const maxPayload = getMaxPayloadCount(mode, payloadBits);

  return {
    ...base,
    characterCountBits,
    modeIndicatorBits,
    payloadBits,
    maxCharacters: mode === "byte" ? null : maxPayload,
    maxBytes: mode === "byte" ? maxPayload : null
  };
}

export function selectPlanForInput(input, options, selectOptions = {}) {
  const gs1Validation = getGs1ValidationForInput(input, options);
  const preflight = getInputCapacityPreflight(input, options);
  if (preflight?.tooLong) {
    if (selectOptions.allowOverflow) {
      const overflow = createInputPreflightOverflowPlan(input, options, preflight.version);
      return makePlanImmutable(gs1Validation ? { ...overflow, gs1Validation } : overflow);
    }
    throwDataTooLongFromPreflight(
      options,
      preflight.version,
      preflight.requiredBits,
      preflight.capacityBits
    );
  }
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
    options,
    selectOptions
  );
  return makePlanImmutable(gs1Validation ? { ...plan, gs1Validation } : plan);
}

export function selectPlanForManualSegments(segments, options, selectOptions = {}) {
  const createSegmentsWithControls = () => prependStructuredAppendSegment(
    prependFnc1SecondSegment(
      prependFnc1Segment(prependEciSegment(segments, options.eci), options.gs1),
      options.fnc1Second
    ),
    options.structuredAppend
  );
  const segmentsWithControls = createSegmentsWithControls();
  const preflight = getManualSegmentsCapacityPreflight(segmentsWithControls, options);
  if (preflight.tooLong) {
    if (selectOptions.allowOverflow) {
      return makePlanImmutable(
        createPreflightOverflowPlan(segmentsWithControls, options, preflight.version)
      );
    }
    throwDataTooLongFromPreflight(
      options,
      preflight.version,
      preflight.requiredBits,
      preflight.capacityBits
    );
  }
  return makePlanImmutable(
    selectPlan(
      createSegmentsWithControls,
      options,
      selectOptions
    )
  );
}

export function getDiagnosticMode(segments) {
  const dataSegments = segments.filter((segment) => !isControlSegment(segment));
  const mode = dataSegments[0]?.mode ?? "byte";
  return dataSegments.every((segment) => segment.mode === mode) ? mode : "mixed";
}

export function getSegmentDiagnostics(segment, version) {
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

export function getInputByteCount(input) {
  return isBinaryInput(input) ? toByteArray(input).length : encodeUtf8(input).length;
}

export function getSegmentsInputByteCount(segments) {
  return segments.reduce((total, segment) => total + getSegmentByteCount(segment), 0);
}

function normalizeCapacityErrorCorrection(options) {
  const hasLevel = Object.hasOwn(options, "errorCorrectionLevel");
  const hasAlias = Object.hasOwn(options, "errorCorrection");
  const level = hasLevel ? options.errorCorrectionLevel : hasAlias ? options.errorCorrection : "M";

  if (hasLevel && hasAlias && options.errorCorrectionLevel !== options.errorCorrection) {
    throw new InvalidInputError("errorCorrectionLevel and errorCorrection must match when both are provided");
  }
  if (!ERROR_CORRECTION_LEVELS[level]) {
    throw new InvalidInputError(`errorCorrectionLevel must be one of L, M, Q, H; got ${level}`);
  }
  return level;
}

function getMaxPayloadCount(mode, payloadBits) {
  switch (mode) {
    case "numeric": {
      const groups = Math.floor(payloadBits / 10);
      const remaining = payloadBits - groups * 10;
      return groups * 3 + (remaining >= 7 ? 2 : remaining >= 4 ? 1 : 0);
    }
    case "alphanumeric": {
      const pairs = Math.floor(payloadBits / 11);
      return pairs * 2 + (payloadBits - pairs * 11 >= 6 ? 1 : 0);
    }
    case "byte":
      return Math.floor(payloadBits / 8);
    case "kanji":
      return Math.floor(payloadBits / 13);
    default:
      throw new InvalidModeError(`Unsupported mode: ${mode}`);
  }
}

function getInputCapacityPreflight(input, options) {
  const targetVersion = options.version === "auto" ? options.maxVersion : options.version;
  const capacityBits = getDataCodewordCount(targetVersion, options.errorCorrectionLevel) * 8;
  const controlBits = getOptionControlBitLength(options);
  let lowerBoundBits;

  if (isBinaryInput(input)) {
    if (options.mode !== "auto" && options.mode !== "byte") {
      return null;
    }
    const byteLength = getBinaryInputLengthForPreflight(input);
    lowerBoundBits = controlBits +
      4 +
      getCharacterCountBitLength(targetVersion, "byte") +
      byteLength * 8;
  } else if (typeof input !== "string") {
    return null;
  } else if (options.mode === "numeric") {
    if (!isNumeric(input)) {
      return null;
    }
    lowerBoundBits = controlBits +
      4 +
      getCharacterCountBitLength(targetVersion, "numeric") +
      getNumericPayloadBitLength(input.length);
  } else if (options.mode === "alphanumeric") {
    if (!isAlphanumeric(input)) {
      return null;
    }
    lowerBoundBits = controlBits +
      4 +
      getCharacterCountBitLength(targetVersion, "alphanumeric") +
      getAlphanumericPayloadBitLength(input.length);
  } else if (options.mode === "byte") {
    const byteLength = getUtf8CanonicalInfo(input).byteLength;
    lowerBoundBits = controlBits +
      4 +
      getCharacterCountBitLength(targetVersion, "byte") +
      byteLength * 8;
  } else if (options.mode === "kanji") {
    if (!isKanji(input)) {
      return null;
    }
    const characterCount = countCodePoints(input);
    lowerBoundBits = controlBits +
      4 +
      getCharacterCountBitLength(targetVersion, "kanji") +
      characterCount * 13;
  } else {
    const characterCount = countCodePoints(input);
    const allowedModes = options.eci === false
      ? ["numeric", "alphanumeric", "byte", "kanji"]
      : ["numeric", "alphanumeric", "byte"];
    const minimumCountBits = Math.min(
      ...allowedModes.map((mode) => getCharacterCountBitLength(targetVersion, mode))
    );
    lowerBoundBits = controlBits +
      4 +
      minimumCountBits +
      getNumericPayloadBitLength(characterCount);
  }

  return {
    version: targetVersion,
    requiredBits: lowerBoundBits,
    capacityBits,
    tooLong: lowerBoundBits > capacityBits
  };
}

function getManualSegmentsCapacityPreflight(segments, options) {
  const targetVersion = options.version === "auto" ? options.maxVersion : options.version;
  const capacityBits = getDataCodewordCount(targetVersion, options.errorCorrectionLevel) * 8;
  const lowerBoundBits = getSegmentsBitLength(segments, targetVersion);
  return {
    version: targetVersion,
    requiredBits: lowerBoundBits,
    capacityBits,
    tooLong: lowerBoundBits > capacityBits
  };
}

function createInputPreflightOverflowPlan(input, options, version) {
  const segments = prependStructuredAppendSegment(
    prependFnc1SecondSegment(
      prependFnc1Segment(
        createSegments(input, options.mode, version, false, options.eci),
        options.gs1
      ),
      options.fnc1Second
    ),
    options.structuredAppend
  );
  return createPreflightOverflowPlan(segments, options, version);
}

function createPreflightOverflowPlan(segments, options, version) {
  return {
    ...createPlan(() => segments, version, options),
    versionSelection: options.version === "auto" ? "auto-range" : "fixed",
    fits: false
  };
}

function throwDataTooLongFromPreflight(options, version, requiredBits, capacityBits) {
  if (options.version === "auto") {
    throw new DataTooLongError(
      `Input requires more capacity than versions ${options.minVersion}..${options.maxVersion} at error correction ${options.errorCorrectionLevel}`
    );
  }
  throw new DataTooLongError(
    `Input requires at least ${requiredBits} bits, but version ${version}-${options.errorCorrectionLevel} has ${capacityBits} data bits`
  );
}

function getOptionControlBitLength(options) {
  let bitLength = 0;
  if (options.structuredAppend !== false) {
    bitLength += 20;
  }
  if (options.fnc1Second !== false) {
    bitLength += 12;
  }
  if (options.gs1) {
    bitLength += 4;
  }
  if (options.eci !== false) {
    bitLength += options.eci < 128 ? 12 : options.eci < 16384 ? 20 : 28;
  }
  return bitLength;
}

function getBinaryInputLengthForPreflight(input) {
  if (Array.isArray(input)) {
    for (let index = 0; index < input.length; index += 1) {
      const byte = input[index];
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
        return 0;
      }
    }
    return input.length;
  }
  if (input instanceof ArrayBuffer) {
    return input.byteLength;
  }
  return input.byteLength;
}

function getNumericPayloadBitLength(length) {
  const groups = Math.floor(length / 3);
  const remainder = length % 3;
  return groups * 10 + (remainder === 1 ? 4 : remainder === 2 ? 7 : 0);
}

function getAlphanumericPayloadBitLength(length) {
  return Math.floor(length / 2) * 11 + (length % 2) * 6;
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

function selectPlan(createSegmentsForVersion, options, { allowOverflow = false } = {}) {
  if (options.version !== "auto") {
    if (allowOverflow) {
      const plan = createPlan(createSegmentsForVersion, options.version, options);
      if (plan.dataBitLength > getDataCodewordCount(options.version, options.errorCorrectionLevel) * 8) {
        return {
          ...plan,
          versionSelection: "fixed",
          fits: false
        };
      }
      return withBoostedErrorCorrection({
        ...plan,
        versionSelection: "fixed",
        fits: true
      }, options);
    }
    return withBoostedErrorCorrection({
      ...ensureFits(createSegmentsForVersion, options.version, options),
      versionSelection: "fixed",
      fits: true
    }, options);
  }

  let overflowPlan = null;
  for (let version = options.minVersion; version <= options.maxVersion; version += 1) {
    const plan = createPlan(createSegmentsForVersion, version, options);
    if (plan.dataBitLength <= getDataCodewordCount(version, options.errorCorrectionLevel) * 8) {
      return withBoostedErrorCorrection({
        ...plan,
        versionSelection: "auto-minimum",
        fits: true
      }, options);
    }
    overflowPlan = plan;
  }

  if (allowOverflow) {
    return {
      ...overflowPlan,
      versionSelection: "auto-range",
      fits: false
    };
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

function makePlanImmutable(plan) {
  Object.freeze(plan.segments);
  return Object.freeze(plan);
}
