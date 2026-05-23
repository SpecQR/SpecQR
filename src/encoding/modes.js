import { BitBuffer } from "./bit-buffer.js";
import { getCharacterCountBitLength, getDataCodewordCount } from "../core/tables.js";
import { DataTooLongError, InvalidInputError, InvalidModeError } from "../errors.js";
import {
  appendControlSegmentBits,
  getControlSegmentBitLength,
  isControlSegment,
  prependEciSegment,
  prependFnc1Segment,
  prependFnc1SecondSegment,
  prependStructuredAppendSegment,
  validateControlSegment,
  validateEciAssignmentNumber,
  validateManualControlSegments
} from "./control-segments.js";
import {
  assertKanjiModeText,
  canEncodeKanjiModeCharacter,
  getKanjiModeByteCount,
  getKanjiModeValue
} from "./shift-jis.js";

const MODE_INDICATORS = {
  numeric: 0b0001,
  alphanumeric: 0b0010,
  byte: 0b0100,
  kanji: 0b1000
};

const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const ALPHANUMERIC_MAP = new Map(
  Array.from(ALPHANUMERIC_CHARSET, (character, index) => [character, index])
);
const PAD_CODEWORDS = [0xEC, 0x11];
const MODES = ["numeric", "alphanumeric", "kanji", "byte"];

export function encodeUtf8(text) {
  if (typeof text !== "string") {
    throw new InvalidInputError(`QR input must be a string; got ${typeof text}`);
  }

  return Array.from(new TextEncoder().encode(text));
}

export function isBinaryInput(value) {
  return Array.isArray(value) ||
    value instanceof Uint8Array ||
    value instanceof ArrayBuffer ||
    ArrayBuffer.isView(value);
}

export function toByteArray(value, label = "input") {
  if (Array.isArray(value)) {
    return validateByteValues(value, label);
  }
  if (value instanceof Uint8Array) {
    return Array.from(value);
  }
  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value));
  }
  if (ArrayBuffer.isView(value)) {
    return Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
  }

  throw new InvalidInputError(
    `${label} must be a string, Uint8Array, ArrayBuffer, or ArrayBuffer view`
  );
}

export function selectEncodingMode(text, requestedMode) {
  assertText(text);

  if (requestedMode !== "auto") {
    validateTextForMode(text, requestedMode);
    return requestedMode;
  }

  if (text.length > 0 && isNumeric(text)) {
    return "numeric";
  }
  if (text.length > 0 && isAlphanumeric(text)) {
    return "alphanumeric";
  }
  if (text.length > 0 && isKanji(text)) {
    return "kanji";
  }
  return "byte";
}

export function getModeBitLength(text, mode, version) {
  validateTextForMode(text, mode);
  return getSegmentBitLength({ mode, text }, version);
}

export function encodeMode(text, mode, version, errorCorrectionLevel) {
  validateTextForMode(text, mode);
  return encodeSegments([{ mode, text }], version, errorCorrectionLevel);
}

export function createSegments(input, requestedMode, version, optimizeSegments = true, eciAssignmentNumber = false) {
  if (isBinaryInput(input)) {
    if (requestedMode !== "auto" && requestedMode !== "byte") {
      throw new InvalidModeError(`Binary input can only be encoded in byte mode; got ${requestedMode}`);
    }
    return prependEciSegment([{ mode: "byte", bytes: toByteArray(input) }], eciAssignmentNumber);
  }

  assertText(input);

  let segments;
  if (requestedMode !== "auto") {
    validateTextForMode(input, requestedMode);
    segments = [{ mode: requestedMode, text: input }];
  } else if (!optimizeSegments) {
    const selectedMode = selectEncodingMode(input, "auto");
    const mode = eciAssignmentNumber !== false && selectedMode === "kanji" ? "byte" : selectedMode;
    segments = [{ mode, text: input }];
  } else {
    segments = optimizeSegmentModes(input, version, eciAssignmentNumber === false);
  }

  return prependEciSegment(segments, eciAssignmentNumber);
}

export function normalizeManualSegments(segments) {
  if (!Array.isArray(segments)) {
    throw new InvalidInputError("manual segments must be an array");
  }

  return validateManualControlSegments(segments.map((segment, index) => normalizeManualSegment(segment, index)));
}

export { prependEciSegment, prependFnc1Segment, prependFnc1SecondSegment, prependStructuredAppendSegment };

export function getSegmentsBitLength(segments, version) {
  return segments.reduce((total, segment) => total + getSegmentBitLength(segment, version), 0);
}

export function getSegmentByteCount(segment) {
  validateSegment(segment);
  if (isControlSegment(segment)) {
    return 0;
  }
  if (segment.mode === "byte") {
    return getByteValues(segment).length;
  }
  if (segment.mode === "kanji") {
    return getKanjiModeByteCount(segment.text);
  }
  return encodeUtf8(segment.text).length;
}

export function getSegmentTextCharacterCount(segment) {
  validateSegment(segment);
  if (isControlSegment(segment) || segment.bytes !== undefined) {
    return 0;
  }
  return Array.from(segment.text).length;
}

export function encodeSegments(segments, version, errorCorrectionLevel) {
  for (const segment of segments) {
    validateSegment(segment);
  }

  const dataCodewords = getDataCodewordCount(version, errorCorrectionLevel);
  const capacityBits = dataCodewords * 8;
  const buffer = new BitBuffer();

  for (const segment of segments) {
    if (isControlSegment(segment)) {
      appendControlSegmentBits(buffer, segment);
      continue;
    }

    const count = getCharacterCount(segment);
    const countBitLength = getCharacterCountBitLength(version, segment.mode);

    if (count >= 2 ** countBitLength) {
      throw new DataTooLongError(`Input has ${count} ${segment.mode} characters, too many for version ${version}`);
    }

    buffer.append(MODE_INDICATORS[segment.mode], 4);
    buffer.append(count, countBitLength);
    appendPayloadBits(buffer, segment);
  }

  if (buffer.length > capacityBits) {
    throw new DataTooLongError(
      `Input requires ${buffer.length} bits, but version ${version}-${errorCorrectionLevel} has ${capacityBits} data bits`
    );
  }

  const terminatorLength = Math.min(4, capacityBits - buffer.length);
  buffer.append(0, terminatorLength);

  while (buffer.length % 8 !== 0) {
    buffer.append(0, 1);
  }

  for (let i = 0; buffer.length < capacityBits; i += 1) {
    buffer.append(PAD_CODEWORDS[i % 2], 8);
  }

  return buffer.toBytes(dataCodewords);
}

export function isNumeric(text) {
  return /^[0-9]*$/.test(text);
}

export function isAlphanumeric(text) {
  return /^[A-Z0-9 $%*+\-./:]*$/.test(text);
}

export function isKanji(text) {
  return Array.from(text).every((character) => canEncodeKanjiModeCharacter(character));
}

function getPayloadBitLength(segment) {
  switch (segment.mode) {
    case "numeric": {
      const text = getTextPayload(segment);
      const groups = Math.floor(text.length / 3);
      const remainder = text.length % 3;
      return groups * 10 + (remainder === 1 ? 4 : remainder === 2 ? 7 : 0);
    }
    case "alphanumeric": {
      const text = getTextPayload(segment);
      return Math.floor(text.length / 2) * 11 + (text.length % 2) * 6;
    }
    case "byte":
      return getByteValues(segment).length * 8;
    case "kanji":
      return Array.from(getTextPayload(segment)).length * 13;
    default:
      throw new InvalidModeError(`Unsupported mode: ${segment.mode}`);
  }
}

function getSegmentBitLength(segment, version) {
  if (isControlSegment(segment)) {
    return getControlSegmentBitLength(segment);
  }

  validateSegment(segment);
  return 4 +
    getCharacterCountBitLength(version, segment.mode) +
    getPayloadBitLength(segment);
}

function optimizeSegmentModes(text, version, allowKanji = true) {
  const characters = Array.from(text);
  if (characters.length === 0) {
    return [{ mode: "byte", text: "" }];
  }

  const modes = allowKanji ? MODES : MODES.filter((mode) => mode !== "kanji");
  const layers = Array.from({ length: characters.length + 1 }, () => new Map());
  layers[0].set("start", {
    cost: 0,
    segmentCount: 0,
    mode: null,
    mod: 0,
    prevKey: null
  });

  for (let index = 0; index < characters.length; index += 1) {
    for (const [key, state] of layers[index]) {
      for (const mode of modes) {
        const character = characters[index];
        if (!canEncodeCharacter(character, mode)) {
          continue;
        }

        const sameSegment = state.mode === mode;
        const payloadBits = sameSegment
          ? getIncrementalPayloadBits(character, mode, state.mod)
          : getIncrementalPayloadBits(character, mode, 0);
        const overheadBits = sameSegment ? 0 : 4 + getCharacterCountBitLength(version, mode);
        const nextMod = getNextMod(character, mode, sameSegment ? state.mod : 0);
        const nextKey = `${mode}:${nextMod}`;
        const candidate = {
          cost: state.cost + overheadBits + payloadBits,
          segmentCount: state.segmentCount + (sameSegment ? 0 : 1),
          mode,
          mod: nextMod,
          prevKey: key
        };

        const current = layers[index + 1].get(nextKey);
        if (!current || isBetterState(candidate, current)) {
          layers[index + 1].set(nextKey, candidate);
        }
      }
    }
  }

  let bestKey = null;
  let bestState = null;
  for (const [key, state] of layers[characters.length]) {
    if (!bestState || isBetterState(state, bestState)) {
      bestKey = key;
      bestState = state;
    }
  }

  if (!bestState) {
    throw new Error("Unable to encode input text");
  }

  const assignments = new Array(characters.length);
  for (let index = characters.length, key = bestKey; index > 0; index -= 1) {
    const state = layers[index].get(key);
    assignments[index - 1] = state.mode;
    key = state.prevKey;
  }

  return coalesceAssignments(characters, assignments);
}

function isBetterState(candidate, current) {
  return candidate.cost < current.cost ||
    (candidate.cost === current.cost && candidate.segmentCount < current.segmentCount);
}

function coalesceAssignments(characters, assignments) {
  const segments = [];
  for (let index = 0; index < characters.length; index += 1) {
    const mode = assignments[index];
    const character = characters[index];
    const last = segments.at(-1);
    if (last?.mode === mode) {
      last.text += character;
    } else {
      segments.push({ mode, text: character });
    }
  }
  return segments;
}

function canEncodeCharacter(character, mode) {
  switch (mode) {
    case "numeric":
      return /^[0-9]$/.test(character);
    case "alphanumeric":
      return ALPHANUMERIC_MAP.has(character);
    case "kanji":
      return canEncodeKanjiModeCharacter(character);
    case "byte":
      return true;
    default:
      throw new InvalidModeError(`Unsupported mode: ${mode}`);
  }
}

function getIncrementalPayloadBits(character, mode, currentMod) {
  switch (mode) {
    case "numeric":
      return currentMod === 0 ? 4 : 3;
    case "alphanumeric":
      return currentMod === 0 ? 6 : 5;
    case "kanji":
      return 13;
    case "byte":
      return encodeUtf8(character).length * 8;
    default:
      throw new InvalidModeError(`Unsupported mode: ${mode}`);
  }
}

function getNextMod(character, mode, currentMod) {
  switch (mode) {
    case "numeric":
      return (currentMod + 1) % 3;
    case "alphanumeric":
      return (currentMod + 1) % 2;
    case "kanji":
    case "byte":
      return 0;
    default:
      throw new InvalidModeError(`Unsupported mode: ${mode}`);
  }
}

function appendPayloadBits(buffer, segment) {
  switch (segment.mode) {
    case "numeric":
      appendNumericBits(buffer, getTextPayload(segment));
      break;
    case "alphanumeric":
      appendAlphanumericBits(buffer, getTextPayload(segment));
      break;
    case "byte":
      for (const byte of getByteValues(segment)) {
        buffer.append(byte, 8);
      }
      break;
    case "kanji":
      appendKanjiBits(buffer, getTextPayload(segment));
      break;
    default:
      throw new InvalidModeError(`Unsupported mode: ${segment.mode}`);
  }
}

function appendNumericBits(buffer, text) {
  for (let i = 0; i < text.length; i += 3) {
    const chunk = text.slice(i, i + 3);
    const value = Number.parseInt(chunk, 10);
    const bitLength = chunk.length === 3 ? 10 : chunk.length === 2 ? 7 : 4;
    buffer.append(value, bitLength);
  }
}

function appendAlphanumericBits(buffer, text) {
  let index = 0;
  for (; index + 1 < text.length; index += 2) {
    const value = ALPHANUMERIC_MAP.get(text[index]) * 45 + ALPHANUMERIC_MAP.get(text[index + 1]);
    buffer.append(value, 11);
  }

  if (index < text.length) {
    buffer.append(ALPHANUMERIC_MAP.get(text[index]), 6);
  }
}

function appendKanjiBits(buffer, text) {
  for (const character of Array.from(text)) {
    buffer.append(getKanjiModeValue(character), 13);
  }
}

function getCharacterCount(segment) {
  return segment.mode === "byte"
    ? getByteValues(segment).length
    : Array.from(getTextPayload(segment)).length;
}

function validateTextForMode(text, mode) {
  assertText(text);

  switch (mode) {
    case "numeric":
      if (!isNumeric(text)) {
        throw new InvalidModeError("numeric mode can only encode decimal digits 0-9");
      }
      break;
    case "alphanumeric":
      if (!isAlphanumeric(text)) {
        throw new InvalidModeError(`alphanumeric mode can only encode: ${ALPHANUMERIC_CHARSET}`);
      }
      break;
    case "byte":
      break;
    case "kanji":
      assertKanjiModeText(text);
      break;
    default:
      throw new InvalidModeError(`Unsupported mode: ${mode}`);
  }
}

function validateSegment(segment) {
  if (!segment || typeof segment !== "object") {
    throw new InvalidInputError("segment must be an object");
  }

  if (isControlSegment(segment)) {
    validateControlSegment(segment);
  } else if (segment.mode === "byte" && segment.bytes !== undefined) {
    validateByteValues(segment.bytes, "byte segment");
  } else {
    validateTextForMode(segment.text, segment.mode);
  }
}

function assertText(text) {
  if (typeof text !== "string") {
    throw new InvalidInputError(`QR input must be a string; got ${typeof text}`);
  }
}

function normalizeManualSegment(segment, index) {
  if (!segment || typeof segment !== "object") {
    throw new InvalidInputError(`segments[${index}] must be an object`);
  }

  switch (segment.mode) {
    case "fnc1":
      validateControlSegment(segment, `segments[${index}]`);
      return { mode: "fnc1" };
    case "fnc1-second":
      validateControlSegment(segment, `segments[${index}]`);
      return { mode: "fnc1-second", applicationIndicator: segment.applicationIndicator };
    case "structured-append":
      validateControlSegment(segment, `segments[${index}]`);
      return {
        mode: "structured-append",
        index: segment.index,
        total: segment.total,
        parity: segment.parity
      };
    case "eci":
      validateEciAssignmentNumber(segment.assignmentNumber);
      return { mode: "eci", assignmentNumber: segment.assignmentNumber };
    case "numeric":
    case "alphanumeric": {
      const text = getManualTextData(segment, index);
      validateTextForMode(text, segment.mode);
      return { mode: segment.mode, text };
    }
    case "kanji": {
      const text = getManualTextData(segment, index);
      validateTextForMode(text, "kanji");
      return { mode: "kanji", text };
    }
    case "byte": {
      const data = getManualData(segment, index);
      if (typeof data === "string") {
        return { mode: "byte", text: data };
      }
      return { mode: "byte", bytes: toByteArray(data, `segments[${index}].data`) };
    }
    default:
      throw new InvalidModeError(`segments[${index}].mode must be "structured-append", "fnc1", "fnc1-second", "eci", "numeric", "alphanumeric", "byte", or "kanji"`);
  }
}

function getManualTextData(segment, index) {
  const data = getManualData(segment, index);
  if (typeof data !== "string") {
    throw new InvalidInputError(`segments[${index}].data must be a string for ${segment.mode} mode`);
  }
  return data;
}

function getManualData(segment, index) {
  if (Object.hasOwn(segment, "data")) {
    return segment.data;
  }
  if (Object.hasOwn(segment, "text")) {
    return segment.text;
  }
  if (Object.hasOwn(segment, "bytes")) {
    return segment.bytes;
  }
  throw new InvalidInputError(`segments[${index}] must include data or text`);
}

function getTextPayload(segment) {
  if (typeof segment.text !== "string") {
    throw new InvalidInputError(`${segment.mode} segment requires text data`);
  }
  return segment.text;
}

function getByteValues(segment) {
  if (segment.bytes !== undefined) {
    return validateByteValues(segment.bytes, "byte segment");
  }
  return encodeUtf8(getTextPayload(segment));
}

function validateByteValues(bytes, label) {
  if (!Array.isArray(bytes)) {
    throw new InvalidInputError(`${label} must contain byte values`);
  }

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new InvalidInputError(`${label}[${index}] must be an integer from 0 to 255; got ${byte}`);
    }
  }

  return Array.from(bytes);
}
