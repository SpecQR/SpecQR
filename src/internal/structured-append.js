import {
  createSegmentOptimizationBitLengthTracker,
  isAlphanumeric,
  isBinaryInput,
  isNumeric,
  normalizeManualSegments,
  normalizeManualSegmentsPreservingBinary
} from "../encoding/modes.js";
import {
  CONTROL_SEGMENT_MODES,
  isControlSegment
} from "../encoding/control-segments.js";
import {
  getCharacterCountBitLength,
  getDataCodewordCount
} from "../core/tables.js";
import {
  DataTooLongError,
  InvalidGs1Error,
  InvalidInputError,
  InvalidModeError
} from "../errors.js";
import { normalizeOptions } from "../options.js";
import { canEncodeKanjiModeCharacter } from "../encoding/shift-jis.js";
import {
  countCodePoints,
  getUtf8CanonicalInfo
} from "./bytes.js";
import { buildResultArtifact } from "./build.js";
import { createArtifactDiagnostics } from "./diagnostics-adapter.js";
import {
  getInputByteCount,
  getSegmentsInputByteCount,
  selectPlanForInput,
  selectPlanForManualSegments
} from "./planning.js";
import { renderResultArtifact } from "./render-result.js";

const STRUCTURED_APPEND_HEADER_BITS = 20;
const TEXT_INDEX_STRIDE = 64;

export function generateStructuredAppend(input, options = {}) {
  const normalized = normalizeStructuredAppendGenerateOptions(options);
  const inputInfo = createStructuredAppendInputInfo(input, normalized);
  const selected = selectStructuredAppendSplit(inputInfo, normalized);
  const symbols = [];
  const symbolDiagnostics = [];

  selected.chunks.forEach((chunk, index) => {
    const symbolOptions = createStructuredAppendSymbolOptions(normalized, selected.version, {
      index: index + 1,
      total: selected.chunks.length,
      parity: inputInfo.parity
    });
    const inputBytes = getInputByteCount(chunk.value);
    const plan = selectPlanForInput(chunk.value, symbolOptions);
    const artifact = buildResultArtifact(plan, symbolOptions);
    const diagnosticOptions = {
      ...symbolOptions,
      output: "matrix",
      diagnostics: true
    };
    const diagnostics = createArtifactDiagnostics(artifact, diagnosticOptions, inputBytes);
    symbolDiagnostics.push(createStructuredAppendSymbolDiagnostics({
      chunk,
      diagnostics
    }));

    symbols.push(normalized.diagnostics
      ? renderResultArtifact(artifact, diagnosticOptions, inputBytes, diagnostics)
      : renderResultArtifact(artifact, symbolOptions, inputBytes));
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
  const inputInfo = createStructuredAppendSegmentsInputInfo(
    normalizedSegments,
    normalized
  );
  const selected = selectStructuredAppendSegmentsSplit(inputInfo, normalized);
  const symbols = [];
  const symbolDiagnostics = [];

  selected.chunks.forEach((chunk, index) => {
    const symbolOptions = createStructuredAppendSymbolOptions(normalized, selected.version, {
      index: index + 1,
      total: selected.chunks.length,
      parity: inputInfo.parity
    });
    const symbolSegments = normalizeManualSegments(chunk.segments);
    const inputBytes = getSegmentsInputByteCount(symbolSegments);
    const plan = selectPlanForManualSegments(symbolSegments, symbolOptions);
    const artifact = buildResultArtifact(plan, symbolOptions);
    const diagnosticOptions = {
      ...symbolOptions,
      output: "matrix",
      diagnostics: true
    };
    const diagnostics = createArtifactDiagnostics(artifact, diagnosticOptions, inputBytes);
    symbolDiagnostics.push(createStructuredAppendSegmentsSymbolDiagnostics({
      chunk,
      diagnostics
    }));

    symbols.push(normalized.diagnostics
      ? renderResultArtifact(artifact, diagnosticOptions, inputBytes, diagnostics)
      : renderResultArtifact(artifact, symbolOptions, inputBytes));
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

export function calculateStructuredAppendSegmentsParity(segments, options = {}) {
  validateStructuredAppendSegmentsParityOptions(options);
  const normalizedSegments = normalizeStructuredAppendManualSegments(
    segments,
    "calculateStructuredAppendSegmentsParity"
  );
  return getStructuredAppendSegmentsCanonicalInfo(
    normalizedSegments,
    "calculateStructuredAppendSegmentsParity"
  ).parity;
}

function normalizeStructuredAppendGenerateOptions(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new InvalidInputError("generateStructuredAppend options must be an object");
  }

  if (
    Object.hasOwn(options, "diagnostics") &&
    options.diagnostics !== undefined &&
    typeof options.diagnostics !== "boolean"
  ) {
    throw new InvalidInputError(
      "generateStructuredAppend diagnostics must be a boolean"
    );
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

  const structuredAppendDiagnostics =
    normalizeSegmentsStructuredAppendDiagnostics(
      Object.hasOwn(options, "diagnostics")
        ? options.diagnostics
        : undefined
    );

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
    optimizeSegments: true,
    diagnostics:
      structuredAppendDiagnostics.symbolResults === "diagnostics"
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
    boostErrorCorrection: false,
    structuredAppendDiagnostics
  };
}

function normalizeSegmentsStructuredAppendDiagnostics(value) {
  if (value === undefined || value === false) {
    return {
      splitUnits: "summary",
      symbolResults: "output"
    };
  }
  if (value === true) {
    return {
      splitUnits: "summary",
      symbolResults: "diagnostics"
    };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new InvalidInputError(
      "generateSegmentsStructuredAppend diagnostics must be a boolean or an object"
    );
  }

  const supportedKeys = new Set(["splitUnits", "symbolResults"]);
  const unsupportedKey = Reflect.ownKeys(value).find(
    (key) => typeof key !== "string" || !supportedKeys.has(key)
  );
  if (unsupportedKey !== undefined) {
    throw new InvalidInputError(
      `Unsupported generateSegmentsStructuredAppend diagnostics option: ${String(unsupportedKey)}`
    );
  }

  const splitUnits =
    !Object.hasOwn(value, "splitUnits") ||
    value.splitUnits === undefined
      ? "summary"
      : value.splitUnits;
  if (splitUnits !== "summary" && splitUnits !== "full") {
    throw new InvalidInputError(
      `diagnostics.splitUnits must be "summary" or "full"; got ${String(splitUnits)}`
    );
  }

  const symbolResults =
    !Object.hasOwn(value, "symbolResults") ||
    value.symbolResults === undefined
      ? "diagnostics"
      : value.symbolResults;
  if (
    symbolResults !== "output" &&
    symbolResults !== "diagnostics"
  ) {
    throw new InvalidInputError(
      `diagnostics.symbolResults must be "output" or "diagnostics"; got ${String(symbolResults)}`
    );
  }

  return { splitUnits, symbolResults };
}

function createStructuredAppendInputInfo(input, normalized) {
  if (isBinaryInput(input)) {
    if (normalized.mode !== "auto" && normalized.mode !== "byte") {
      throw new InvalidModeError(
        `Binary input can only be encoded in byte mode; got ${normalized.mode}`
      );
    }
    const bytes = normalizeStructuredAppendBinaryInput(input);
    if (bytes.length === 0) {
      throw new InvalidInputError(
        "generateStructuredAppend requires input that can be split into at least two non-empty symbols"
      );
    }
    const parity = calculateByteSequenceParity(bytes);
    const metrics = {
      binary: true,
      inputLength: bytes.length,
      byteLength: bytes.length,
      parity
    };
    assertStructuredAppendTotalCapacity(metrics, normalized);
    return createBinaryStructuredAppendSource(bytes, metrics);
  }

  const text = assertStructuredAppendTextInput(input);
  validateStructuredAppendTextMode(text, normalized.mode);
  const canonical = getUtf8CanonicalInfo(text);
  const inputLength = countCodePoints(text);
  if (inputLength === 0) {
    throw new InvalidInputError(
      "generateStructuredAppend requires input that can be split into at least two non-empty symbols"
    );
  }
  const metrics = {
    binary: false,
    inputLength,
    byteLength: canonical.byteLength,
    parity: canonical.parity
  };
  assertStructuredAppendTotalCapacity(metrics, normalized);
  return createTextStructuredAppendSource(text, metrics);
}

function assertStructuredAppendTextInput(input) {
  if (typeof input !== "string") {
    throw new InvalidInputError(`QR input must be a string, Uint8Array, ArrayBuffer, or ArrayBuffer view; got ${typeof input}`);
  }
  return input;
}

function normalizeStructuredAppendBinaryInput(input) {
  if (Array.isArray(input)) {
    for (let index = 0; index < input.length; index += 1) {
      const byte = input[index];
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
        throw new InvalidInputError(
          `input[${index}] must be an integer from 0 to 255; got ${byte}`
        );
      }
    }
    return input;
  }
  if (input instanceof Uint8Array) {
    return input;
  }
  if (input instanceof ArrayBuffer) {
    return new Uint8Array(input);
  }
  return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
}

function calculateByteSequenceParity(bytes) {
  let parity = 0;
  for (const byte of bytes) {
    parity ^= byte;
  }
  return parity;
}

function validateStructuredAppendTextMode(text, mode) {
  if (mode === "numeric" && !isNumeric(text)) {
    throw new InvalidModeError("numeric mode can only encode decimal digits 0-9");
  }
  if (mode === "alphanumeric" && !isAlphanumeric(text)) {
    throw new InvalidModeError(
      "alphanumeric mode can only encode: 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:"
    );
  }
  if (mode === "kanji") {
    for (const character of text) {
      if (!canEncodeKanjiModeCharacter(character)) {
        throw new InvalidModeError(
          `kanji mode cannot encode character: ${character}`
        );
      }
    }
  }
}

function assertStructuredAppendTotalCapacity(metrics, normalized) {
  const version = getStructuredAppendCapacityVersion(normalized);
  const capacityBits =
    getDataCodewordCount(version, normalized.errorCorrectionLevel) * 8;
  const mode = metrics.binary ? "byte" : normalized.mode;
  let payloadBits;
  let characterCountBits;

  if (mode === "byte") {
    payloadBits = metrics.byteLength * 8;
    characterCountBits = getCharacterCountBitLength(version, "byte");
  } else if (mode === "numeric") {
    payloadBits = getNumericPayloadBitLength(metrics.inputLength);
    characterCountBits = getCharacterCountBitLength(version, "numeric");
  } else if (mode === "alphanumeric") {
    payloadBits = getAlphanumericPayloadBitLength(metrics.inputLength);
    characterCountBits = getCharacterCountBitLength(
      version,
      "alphanumeric"
    );
  } else if (mode === "kanji") {
    payloadBits = metrics.inputLength * 13;
    characterCountBits = getCharacterCountBitLength(version, "kanji");
  } else {
    payloadBits = getNumericPayloadBitLength(metrics.inputLength);
    characterCountBits = Math.min(
      getCharacterCountBitLength(version, "numeric"),
      getCharacterCountBitLength(version, "alphanumeric"),
      getCharacterCountBitLength(version, "byte"),
      getCharacterCountBitLength(version, "kanji")
    );
  }

  const payloadCapacityPerSymbol = Math.max(
    0,
    capacityBits -
      STRUCTURED_APPEND_HEADER_BITS -
      4 -
      characterCountBits
  );
  if (payloadBits > payloadCapacityPerSymbol * normalized.maxSymbols) {
    throwStructuredAppendTooLong(normalized, false);
  }
}

function getStructuredAppendCapacityVersion(normalized) {
  return normalized.version === "auto"
    ? normalized.maxVersion
    : normalized.version;
}

function createBinaryStructuredAppendSource(bytes, metrics) {
  return {
    ...metrics,
    canFitRange(start, length, normalized, version) {
      void start;
      return getStructuredAppendSingleSegmentBits(
        "byte",
        length,
        length,
        version
      ) <= getStructuredAppendSymbolCapacityBits(
        normalized,
        version
      );
    },
    findLargestFittingPrefix(position, maxLength, normalized, version) {
      void position;
      const payloadBits = getStructuredAppendSymbolCapacityBits(
        normalized,
        version
      ) -
        4 -
        getCharacterCountBitLength(version, "byte");
      return Math.min(maxLength, Math.max(0, Math.floor(payloadBits / 8)));
    },
    makeChunk(start, length) {
      return {
        value: sliceByteSequence(bytes, start, start + length),
        inputStart: start,
        inputLength: length,
        byteStart: start,
        byteLength: length
      };
    }
  };
}

function createTextStructuredAppendSource(text, metrics) {
  const index = createSparseTextIndex(text, metrics.inputLength);
  return {
    ...metrics,
    canFitRange(start, length, normalized, version) {
      const dataBits = getTextRangeDataBitLength(
        index,
        start,
        length,
        normalized,
        version
      );
      return dataBits <= getStructuredAppendSymbolCapacityBits(
        normalized,
        version
      );
    },
    findLargestFittingPrefix(position, maxLength, normalized, version) {
      if (normalized.mode === "auto") {
        return findLargestAutoTextPrefix(
          index,
          position,
          maxLength,
          normalized,
          version
        );
      }
      return findLargestFittingLength(maxLength, (length) =>
        getTextRangeDataBitLength(
          index,
          position,
          length,
          normalized,
          version
        ) <= getStructuredAppendSymbolCapacityBits(normalized, version)
      );
    },
    makeChunk(start, length) {
      const range = index.getRange(start, length);
      return {
        value: text.slice(range.utf16Start, range.utf16End),
        inputStart: start,
        inputLength: length,
        byteStart: range.byteStart,
        byteLength: range.byteLength
      };
    }
  };
}

function getStructuredAppendSymbolCapacityBits(normalized, version) {
  return getDataCodewordCount(version, normalized.errorCorrectionLevel) * 8 -
    STRUCTURED_APPEND_HEADER_BITS;
}

function getStructuredAppendSingleSegmentBits(
  mode,
  unitLength,
  byteLength,
  version
) {
  let payloadBits;
  if (mode === "numeric") {
    payloadBits = getNumericPayloadBitLength(unitLength);
  } else if (mode === "alphanumeric") {
    payloadBits = getAlphanumericPayloadBitLength(unitLength);
  } else if (mode === "kanji") {
    payloadBits = unitLength * 13;
  } else {
    payloadBits = byteLength * 8;
  }
  return 4 + getCharacterCountBitLength(version, mode) + payloadBits;
}

function getTextRangeDataBitLength(
  index,
  start,
  length,
  normalized,
  version
) {
  if (normalized.mode !== "auto") {
    const range = index.getRange(start, length);
    return getStructuredAppendSingleSegmentBits(
      normalized.mode,
      length,
      range.byteLength,
      version
    );
  }

  if (normalized.optimizeSegments) {
    const tracker = createSegmentOptimizationBitLengthTracker(version, true);
    let bitLength = 0;
    index.forEachRange(start, length, (unit) => {
      bitLength = tracker.append(unit.character);
    });
    return bitLength;
  }

  return getUnoptimizedTextRangeBitLength(index, start, length, version);
}

function findLargestAutoTextPrefix(
  index,
  start,
  maxLength,
  normalized,
  version
) {
  const capacityBits = getStructuredAppendSymbolCapacityBits(
    normalized,
    version
  );
  let best = 0;

  if (normalized.optimizeSegments) {
    const tracker = createSegmentOptimizationBitLengthTracker(version, true);
    index.forEachRange(start, maxLength, (unit, relativeIndex) => {
      const bitLength = tracker.append(unit.character);
      if (bitLength <= capacityBits) {
        best = relativeIndex + 1;
        return undefined;
      }
      return false;
    });
    return best;
  }

  let allNumeric = true;
  let allAlphanumeric = true;
  let allKanji = true;
  let byteLength = 0;
  index.forEachRange(start, maxLength, (unit, relativeIndex) => {
    allNumeric &&= /^[0-9]$/.test(unit.character);
    allAlphanumeric &&=
      /^[A-Z0-9 $%*+\-./:]$/.test(unit.character);
    allKanji &&= canEncodeKanjiModeCharacter(unit.character);
    byteLength += unit.byteLength;
    const unitLength = relativeIndex + 1;
    const mode = allNumeric
      ? "numeric"
      : allAlphanumeric
        ? "alphanumeric"
        : allKanji
          ? "kanji"
          : "byte";
    const bitLength = getStructuredAppendSingleSegmentBits(
      mode,
      unitLength,
      byteLength,
      version
    );
    if (bitLength <= capacityBits) {
      best = unitLength;
      return undefined;
    }
    return false;
  });
  return best;
}

function getUnoptimizedTextRangeBitLength(index, start, length, version) {
  let allNumeric = true;
  let allAlphanumeric = true;
  let allKanji = true;
  let byteLength = 0;
  index.forEachRange(start, length, (unit) => {
    allNumeric &&= /^[0-9]$/.test(unit.character);
    allAlphanumeric &&=
      /^[A-Z0-9 $%*+\-./:]$/.test(unit.character);
    allKanji &&= canEncodeKanjiModeCharacter(unit.character);
    byteLength += unit.byteLength;
  });
  const mode = allNumeric
    ? "numeric"
    : allAlphanumeric
      ? "alphanumeric"
      : allKanji
        ? "kanji"
        : "byte";
  return getStructuredAppendSingleSegmentBits(
    mode,
    length,
    byteLength,
    version
  );
}

function findLargestFittingLength(maxLength, fits) {
  let low = 1;
  let high = maxLength;
  let best = 0;
  while (low <= high) {
    const length = Math.floor((low + high) / 2);
    if (fits(length)) {
      best = length;
      low = length + 1;
    } else {
      high = length - 1;
    }
  }
  return best;
}

function sliceByteSequence(bytes, start, end) {
  return Array.isArray(bytes)
    ? bytes.slice(start, end)
    : bytes.subarray(start, end);
}

function createSparseTextIndex(text, inputLength) {
  const checkpoints = [{
    unitIndex: 0,
    utf16Index: 0,
    byteOffset: 0
  }];
  let unitIndex = 0;
  let utf16Index = 0;
  let byteOffset = 0;

  while (unitIndex < inputLength) {
    const unit = readTextUnit(text, utf16Index);
    unitIndex += 1;
    utf16Index += unit.utf16Length;
    byteOffset += unit.byteLength;
    if (unitIndex % TEXT_INDEX_STRIDE === 0) {
      checkpoints.push({ unitIndex, utf16Index, byteOffset });
    }
  }

  function locate(targetUnitIndex) {
    if (
      !Number.isInteger(targetUnitIndex) ||
      targetUnitIndex < 0 ||
      targetUnitIndex > inputLength
    ) {
      throw new RangeError(`Text unit index out of range: ${targetUnitIndex}`);
    }
    const checkpoint =
      checkpoints[Math.floor(targetUnitIndex / TEXT_INDEX_STRIDE)];
    let currentUnit = checkpoint.unitIndex;
    let currentUtf16 = checkpoint.utf16Index;
    let currentByte = checkpoint.byteOffset;
    while (currentUnit < targetUnitIndex) {
      const unit = readTextUnit(text, currentUtf16);
      currentUnit += 1;
      currentUtf16 += unit.utf16Length;
      currentByte += unit.byteLength;
    }
    return {
      unitIndex: currentUnit,
      utf16Index: currentUtf16,
      byteOffset: currentByte
    };
  }

  return {
    forEachRange(start, length, callback) {
      const begin = locate(start);
      let currentUtf16 = begin.utf16Index;
      let currentByte = begin.byteOffset;
      for (let relativeIndex = 0; relativeIndex < length; relativeIndex += 1) {
        const unit = readTextUnit(text, currentUtf16);
        const shouldContinue = callback({
          ...unit,
          unitIndex: start + relativeIndex,
          utf16Index: currentUtf16,
          byteOffset: currentByte
        }, relativeIndex);
        currentUtf16 += unit.utf16Length;
        currentByte += unit.byteLength;
        if (shouldContinue === false) {
          break;
        }
      }
    },
    getRange(start, length) {
      const begin = locate(start);
      const end = locate(start + length);
      return {
        utf16Start: begin.utf16Index,
        utf16End: end.utf16Index,
        byteStart: begin.byteOffset,
        byteLength: end.byteOffset - begin.byteOffset
      };
    }
  };
}

function readTextUnit(text, utf16Index) {
  const codePoint = text.codePointAt(utf16Index);
  const utf16Length = codePoint > 0xFFFF ? 2 : 1;
  return {
    character: text.slice(utf16Index, utf16Index + utf16Length),
    utf16Length,
    byteLength: getUtf8CodePointByteLength(codePoint)
  };
}

function getUtf8CodePointByteLength(codePoint) {
  if (codePoint <= 0x7F) {
    return 1;
  }
  if (codePoint <= 0x7FF) {
    return 2;
  }
  if (codePoint <= 0xFFFF) {
    return 3;
  }
  return 4;
}

function getNumericPayloadBitLength(length) {
  const groups = Math.floor(length / 3);
  const remainder = length % 3;
  return groups * 10 + (remainder === 1 ? 4 : remainder === 2 ? 7 : 0);
}

function getAlphanumericPayloadBitLength(length) {
  return Math.floor(length / 2) * 11 + (length % 2) * 6;
}

function throwStructuredAppendTooLong(normalized, manual) {
  if (normalized.version !== "auto") {
    throw new DataTooLongError(
      manual
        ? `Input segments cannot be split into ${normalized.maxSymbols} or fewer version ${normalized.version}-${normalized.errorCorrectionLevel} Structured Append symbols`
        : `Input cannot be split into ${normalized.maxSymbols} or fewer version ${normalized.version}-${normalized.errorCorrectionLevel} Structured Append symbols`
    );
  }
  throw new DataTooLongError(
    manual
      ? `Input segments cannot be split into ${normalized.maxSymbols} or fewer Structured Append symbols for versions ${normalized.minVersion}..${normalized.maxVersion} at error correction ${normalized.errorCorrectionLevel}`
      : `Input cannot be split into ${normalized.maxSymbols} or fewer Structured Append symbols for versions ${normalized.minVersion}..${normalized.maxVersion} at error correction ${normalized.errorCorrectionLevel}`
  );
}

function validateStructuredAppendSegmentsParityOptions(options = {}) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new InvalidInputError("calculateStructuredAppendSegmentsParity options must be an object");
  }

  if (Object.hasOwn(options, "gs1")) {
    throw new InvalidGs1Error("calculateStructuredAppendSegmentsParity cannot be combined with GS1/FNC1 options");
  }
  if (Object.hasOwn(options, "fnc1Second")) {
    throw new InvalidModeError("calculateStructuredAppendSegmentsParity cannot be combined with FNC1 second position options");
  }

  const unsupportedOption = Object.keys(options)[0];
  if (unsupportedOption !== undefined) {
    throw new InvalidModeError(`Unsupported calculateStructuredAppendSegmentsParity option: ${unsupportedOption}`);
  }
}

function normalizeStructuredAppendManualSegments(segments, label = "generateSegmentsStructuredAppend") {
  const normalizedSegments =
    normalizeManualSegmentsPreservingBinary(segments);
  if (normalizedSegments.length === 0) {
    throw new InvalidInputError(label === "generateSegmentsStructuredAppend"
      ? "generateSegmentsStructuredAppend requires at least two non-empty data split units"
      : `${label} requires at least one non-empty data segment`);
  }

  for (const segment of normalizedSegments) {
    if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_FIRST) {
      throw new InvalidGs1Error(`${label} cannot be combined with manual FNC1 first position segments`);
    }
    if (segment.mode === CONTROL_SEGMENT_MODES.FNC1_SECOND) {
      throw new InvalidModeError(`${label} cannot be combined with manual FNC1 second position segments`);
    }
    if (segment.mode === CONTROL_SEGMENT_MODES.ECI) {
      throw new InvalidModeError(`${label} cannot be combined with manual ECI segments`);
    }
    if (segment.mode === CONTROL_SEGMENT_MODES.STRUCTURED_APPEND) {
      throw new InvalidModeError(`${label} owns the Structured Append header; manual structured-append segments are not supported`);
    }
    if (isControlSegment(segment)) {
      throw new InvalidModeError(`${label} does not support manual ${segment.mode} control segments`);
    }
  }

  return normalizedSegments;
}

function createStructuredAppendSegmentsInputInfo(
  segments,
  normalized,
  label = "generateSegmentsStructuredAppend"
) {
  const descriptors = [];
  let byteStart = 0;
  let splitUnitStart = 0;
  let parity = 0;

  segments.forEach((segment, sourceSegmentIndex) => {
    const segmentCanonical = getStructuredAppendSegmentCanonicalInfo(segment);
    const descriptor = createStructuredAppendSegmentDescriptor({
      segment,
      sourceSegmentIndex,
      byteStart,
      splitUnitStart,
      canonical: segmentCanonical,
      label
    });
    descriptors.push(descriptor);
    byteStart += segmentCanonical.byteLength;
    splitUnitStart += descriptor.splitUnitCount;
    parity ^= segmentCanonical.parity;
  });

  if (splitUnitStart === 0) {
    throw new InvalidInputError(label === "generateSegmentsStructuredAppend"
      ? "generateSegmentsStructuredAppend requires input that can be split into at least two non-empty split units"
      : `${label} requires at least one non-empty data segment`);
  }

  assertStructuredAppendSegmentsTotalCapacity(
    descriptors,
    normalized
  );
  for (const descriptor of descriptors) {
    if (descriptor.mode === "byte" && descriptor.byteKind === "text") {
      descriptor.textIndex = createSparseTextIndex(
        descriptor.segment.text,
        descriptor.splitUnitCount
      );
    }
  }

  return {
    segments,
    descriptors,
    splitUnitCount: splitUnitStart,
    inputLength: segments.length,
    byteLength: byteStart,
    parity,
    canFitRange(start, length, options, version) {
      return getStructuredAppendSegmentsRangeBitLength(
        descriptors,
        start,
        length,
        version
      ) <= getDataCodewordCount(
        version,
        options.errorCorrectionLevel
      ) * 8;
    },
    findLargestFittingPrefix(position, maxLength, options, version) {
      return findLargestFittingLength(maxLength, (length) =>
        getStructuredAppendSegmentsRangeBitLength(
          descriptors,
          position,
          length,
          version
        ) <= getDataCodewordCount(
          version,
          options.errorCorrectionLevel
        ) * 8
      );
    },
    makeChunk(start, length) {
      return createStructuredAppendSegmentsChunk(
        descriptors,
        start,
        length
      );
    },
    materializeSplitUnits() {
      return materializeStructuredAppendSplitUnits(
        descriptors,
        splitUnitStart
      );
    }
  };
}

function getStructuredAppendSegmentsCanonicalInfo(segments, label) {
  let byteLength = 0;
  let parity = 0;

  segments.forEach((segment, index) => {
    const info = getStructuredAppendSegmentCanonicalInfo(segment);
    if (info.byteLength === 0) {
      throw new InvalidInputError(`segments[${index}] must include non-empty data for ${label}`);
    }
    byteLength += info.byteLength;
    parity ^= info.parity;
  });

  return { byteLength, parity };
}

function getStructuredAppendSegmentCanonicalInfo(segment) {
  if (segment.mode === "byte" && segment.bytes !== undefined) {
    let parity = 0;
    for (const byte of segment.bytes) {
      parity ^= byte;
    }
    return { byteLength: segment.bytes.length, parity };
  }

  if (segment.mode === "numeric" || segment.mode === "alphanumeric") {
    let parity = 0;
    for (let index = 0; index < segment.text.length; index += 1) {
      parity ^= segment.text.charCodeAt(index);
    }
    return { byteLength: segment.text.length, parity };
  }

  return getUtf8CanonicalInfo(segment.text);
}

function createStructuredAppendSegmentDescriptor({
  segment,
  sourceSegmentIndex,
  byteStart,
  splitUnitStart,
  canonical,
  label
}) {
  const characterLength = segment.bytes === undefined
    ? countCodePoints(segment.text)
    : 0;
  const splitUnitCount = segment.mode === "byte"
    ? segment.bytes === undefined
      ? characterLength
      : segment.bytes.length
    : characterLength > 0
      ? 1
      : 0;

  if (splitUnitCount === 0) {
    throw new InvalidInputError(
      `segments[${sourceSegmentIndex}] must include non-empty data for ${label}`
    );
  }

  let payloadBitLength;
  if (segment.mode === "numeric") {
    payloadBitLength = getNumericPayloadBitLength(characterLength);
  } else if (segment.mode === "alphanumeric") {
    payloadBitLength = getAlphanumericPayloadBitLength(characterLength);
  } else if (segment.mode === "kanji") {
    payloadBitLength = characterLength * 13;
  } else {
    payloadBitLength = canonical.byteLength * 8;
  }

  return {
    sourceSegmentIndex,
    mode: segment.mode,
    segment,
    splitUnitStart,
    splitUnitCount,
    characterLength,
    byteStart,
    byteLength: canonical.byteLength,
    payloadBitLength,
    byteKind: segment.mode === "byte"
      ? segment.bytes === undefined
        ? "text"
        : "binary"
      : null,
    textIndex: null
  };
}

function assertStructuredAppendSegmentsTotalCapacity(descriptors, normalized) {
  const version = getStructuredAppendCapacityVersion(normalized);
  const capacityBits =
    getDataCodewordCount(version, normalized.errorCorrectionLevel) * 8;
  const requiredDataBits = descriptors.reduce(
    (total, descriptor) =>
      total +
      4 +
      getCharacterCountBitLength(version, descriptor.mode) +
      descriptor.payloadBitLength,
    0
  );
  const availableDataBits = normalized.maxSymbols * Math.max(
    0,
    capacityBits - STRUCTURED_APPEND_HEADER_BITS
  );

  if (requiredDataBits > availableDataBits) {
    throwStructuredAppendTooLong(normalized, true);
  }
}

function getStructuredAppendSegmentsRangeBitLength(
  descriptors,
  start,
  length,
  version
) {
  let bitLength = STRUCTURED_APPEND_HEADER_BITS;
  forEachStructuredAppendDescriptorRange(
    descriptors,
    start,
    length,
    (descriptor, localStart, localLength) => {
      const byteLength = getDescriptorRangeByteLength(
        descriptor,
        localStart,
        localLength
      );
      const unitLength = descriptor.mode === "byte"
        ? localLength
        : descriptor.characterLength;
      bitLength += getStructuredAppendSingleSegmentBits(
        descriptor.mode,
        unitLength,
        byteLength,
        version
      );
    }
  );
  return bitLength;
}

function createStructuredAppendSegmentsChunk(descriptors, start, length) {
  const segments = [];
  let sourceSegmentStart = null;
  let sourceSegmentEnd = null;
  let byteStart = null;
  let byteLength = 0;

  forEachStructuredAppendDescriptorRange(
    descriptors,
    start,
    length,
    (descriptor, localStart, localLength) => {
      const rangeByteStart = getDescriptorRangeByteStart(
        descriptor,
        localStart
      );
      const rangeByteLength = getDescriptorRangeByteLength(
        descriptor,
        localStart,
        localLength
      );
      sourceSegmentStart ??= descriptor.sourceSegmentIndex;
      sourceSegmentEnd = descriptor.sourceSegmentIndex + 1;
      byteStart ??= rangeByteStart;
      byteLength += rangeByteLength;
      segments.push(
        materializeStructuredAppendSegmentRange(
          descriptor,
          localStart,
          localLength
        )
      );
    }
  );

  return {
    segments,
    sourceSegmentStart: sourceSegmentStart ?? 0,
    sourceSegmentEnd: sourceSegmentEnd ?? 0,
    splitUnitStart: start,
    splitUnitLength: length,
    byteStart: byteStart ?? 0,
    byteLength
  };
}

function forEachStructuredAppendDescriptorRange(
  descriptors,
  start,
  length,
  callback
) {
  const end = start + length;
  for (const descriptor of descriptors) {
    const descriptorStart = descriptor.splitUnitStart;
    const descriptorEnd = descriptorStart + descriptor.splitUnitCount;
    if (descriptorEnd <= start) {
      continue;
    }
    if (descriptorStart >= end) {
      break;
    }
    const overlapStart = Math.max(start, descriptorStart);
    const overlapEnd = Math.min(end, descriptorEnd);
    callback(
      descriptor,
      overlapStart - descriptorStart,
      overlapEnd - overlapStart
    );
  }
}

function getDescriptorRangeByteStart(descriptor, localStart) {
  if (descriptor.mode !== "byte") {
    return descriptor.byteStart;
  }
  if (descriptor.byteKind === "binary") {
    return descriptor.byteStart + localStart;
  }
  return descriptor.byteStart +
    descriptor.textIndex.getRange(localStart, 0).byteStart;
}

function getDescriptorRangeByteLength(descriptor, localStart, localLength) {
  if (descriptor.mode !== "byte") {
    return descriptor.byteLength;
  }
  if (descriptor.byteKind === "binary") {
    return localLength;
  }
  return descriptor.textIndex.getRange(localStart, localLength).byteLength;
}

function materializeStructuredAppendSegmentRange(
  descriptor,
  localStart,
  localLength
) {
  if (descriptor.mode !== "byte") {
    return { ...descriptor.segment };
  }
  if (descriptor.byteKind === "binary") {
    return {
      mode: "byte",
      bytes: sliceByteSequence(
        descriptor.segment.bytes,
        localStart,
        localStart + localLength
      )
    };
  }
  const range = descriptor.textIndex.getRange(localStart, localLength);
  return {
    mode: "byte",
    text: descriptor.segment.text.slice(
      range.utf16Start,
      range.utf16End
    )
  };
}

function materializeStructuredAppendSplitUnits(
  descriptors,
  splitUnitCount
) {
  const splitUnits = new Array(splitUnitCount);
  let outputIndex = 0;

  for (const descriptor of descriptors) {
    if (descriptor.mode !== "byte") {
      splitUnits[outputIndex] = {
        sourceSegmentIndex: descriptor.sourceSegmentIndex,
        mode: descriptor.mode,
        unitStart: 0,
        unitLength: descriptor.characterLength,
        byteStart: descriptor.byteStart,
        byteLength: descriptor.byteLength
      };
      outputIndex += 1;
      continue;
    }

    if (descriptor.byteKind === "binary") {
      for (
        let unitStart = 0;
        unitStart < descriptor.splitUnitCount;
        unitStart += 1
      ) {
        splitUnits[outputIndex] = {
          sourceSegmentIndex: descriptor.sourceSegmentIndex,
          mode: "byte",
          unitStart,
          unitLength: 1,
          byteStart: descriptor.byteStart + unitStart,
          byteLength: 1
        };
        outputIndex += 1;
      }
      continue;
    }

    descriptor.textIndex.forEachRange(
      0,
      descriptor.splitUnitCount,
      (unit, unitStart) => {
        splitUnits[outputIndex] = {
          sourceSegmentIndex: descriptor.sourceSegmentIndex,
          mode: "byte",
          unitStart,
          unitLength: 1,
          byteStart: descriptor.byteStart + unit.byteOffset,
          byteLength: unit.byteLength
        };
        outputIndex += 1;
      }
    );
  }

  return splitUnits;
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
      const completed = materializeStructuredAppendAttempt(
        inputInfo,
        attempt
      );
      return {
        ...completed,
        versionSelection: "fixed",
        versionSelectionReason: `Version ${completed.version} was requested explicitly.`
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
      const completed = materializeStructuredAppendAttempt(
        inputInfo,
        attempt
      );
      return {
        ...completed,
        versionSelection: "auto-minimum",
        versionSelectionReason: `Version ${version} is the smallest version in ${normalized.minVersion}..${normalized.maxVersion} that can split the payload into ${completed.chunks.length} Structured Append symbols at error correction ${normalized.errorCorrectionLevel}.`
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
  if (
    inputInfo.canFitRange(
      0,
      inputInfo.inputLength,
      normalized,
      version
    )
  ) {
    return { status: "single", version };
  }

  const ranges = [];
  let position = 0;

  while (position < inputInfo.inputLength) {
    if (ranges.length >= normalized.maxSymbols) {
      return { status: "too-long", version };
    }

    const remaining = inputInfo.inputLength - position;
    const maxPrefixLength = ranges.length === 0 ? remaining - 1 : remaining;
    if (maxPrefixLength < 1) {
      return { status: "single", version };
    }

    const prefixLength = inputInfo.findLargestFittingPrefix(
      position,
      maxPrefixLength,
      normalized,
      version
    );
    if (prefixLength < 1) {
      return { status: "too-long", version };
    }

    ranges.push({ start: position, length: prefixLength });
    position += prefixLength;
  }

  return ranges.length >= 2
    ? { status: "ok", version, ranges }
    : { status: "single", version };
}

function materializeStructuredAppendAttempt(inputInfo, attempt) {
  return {
    status: attempt.status,
    version: attempt.version,
    chunks: attempt.ranges.map(({ start, length }) =>
      inputInfo.makeChunk(start, length)
    )
  };
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
      const completed = materializeStructuredAppendAttempt(
        inputInfo,
        attempt
      );
      return {
        ...completed,
        versionSelection: "fixed",
        versionSelectionReason: `Version ${completed.version} was requested explicitly.`
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
      const completed = materializeStructuredAppendAttempt(
        inputInfo,
        attempt
      );
      return {
        ...completed,
        versionSelection: "auto-minimum",
        versionSelectionReason: `Version ${version} is the smallest version in ${normalized.minVersion}..${normalized.maxVersion} that can split the manual segments into ${completed.chunks.length} Structured Append symbols at error correction ${normalized.errorCorrectionLevel}.`
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
  if (
    inputInfo.canFitRange(
      0,
      inputInfo.splitUnitCount,
      normalized,
      version
    )
  ) {
    return { status: "single", version };
  }
  if (inputInfo.splitUnitCount < 2) {
    return { status: "too-long", version };
  }

  const ranges = [];
  let position = 0;

  while (position < inputInfo.splitUnitCount) {
    if (ranges.length >= normalized.maxSymbols) {
      return { status: "too-long", version };
    }

    const remaining = inputInfo.splitUnitCount - position;
    const maxPrefixLength = ranges.length === 0 ? remaining - 1 : remaining;
    if (maxPrefixLength < 1) {
      return { status: "single", version };
    }

    const prefixLength = inputInfo.findLargestFittingPrefix(
      position,
      maxPrefixLength,
      normalized,
      version
    );
    if (prefixLength < 1) {
      return { status: "too-long", version };
    }

    ranges.push({ start: position, length: prefixLength });
    position += prefixLength;
  }

  return ranges.length >= 2
    ? { status: "ok", version, ranges }
    : { status: "single", version };
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

export function createStructuredAppendSegmentsSummaryDiagnostics({
  normalized,
  selected,
  inputInfo,
  symbolDiagnostics
}) {
  const warnings = createStructuredAppendWarnings(normalized, selected.chunks.length);
  const splitUnitsDetail =
    normalized.structuredAppendDiagnostics.splitUnits;
  const summary = {
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
    splitUnitCount: inputInfo.splitUnitCount,
    splitUnitsDetail,
    ...(splitUnitsDetail === "full"
      ? { splitUnits: inputInfo.materializeSplitUnits() }
      : {}),
    symbols: symbolDiagnostics,
    warnings
  };
  return summary;
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
