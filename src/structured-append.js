import { encodeUtf8, toByteArray } from "./encoding/modes.js";
import { InvalidInputError, InvalidModeError } from "./errors.js";

export function calculateStructuredAppendParity(input) {
  return calculateStructuredAppendByteParity(normalizeStructuredAppendParityInputBytes(input));
}

export function normalizeStructuredAppendParityInputBytes(input) {
  if (typeof input === "string") {
    return encodeUtf8(input);
  }
  return toByteArray(input, "Structured Append parity input");
}

export function calculateStructuredAppendByteParity(bytes) {
  return bytes.reduce((parity, byte) => parity ^ byte, 0);
}

export function mergeStructuredAppendParts(parts, options = {}) {
  validateMergeOptions(options);

  if (!Array.isArray(parts)) {
    throw new InvalidInputError("Structured Append parts must be an array");
  }
  if (parts.length === 0) {
    throw new InvalidInputError("Structured Append parts must not be empty");
  }

  const normalized = [];
  const seenIndexes = new Set();
  let total = null;
  let parity = null;
  let dataType = null;

  parts.forEach((part, sourceIndex) => {
    if (!part || typeof part !== "object" || Array.isArray(part)) {
      throw new InvalidInputError(`Structured Append parts[${sourceIndex}] must be an object`);
    }

    const index = validateIntegerRange(part.index, `Structured Append parts[${sourceIndex}].index`, 1, 16);
    const partTotal = validateIntegerRange(part.total, `Structured Append parts[${sourceIndex}].total`, 2, 16);
    const partParity = validateIntegerRange(part.parity, `Structured Append parts[${sourceIndex}].parity`, 0, 255);
    const data = normalizePartData(part.data, `Structured Append parts[${sourceIndex}].data`);

    if (total === null) {
      total = partTotal;
    } else if (partTotal !== total) {
      throw new InvalidInputError(`Structured Append total mismatch: expected ${total}, got ${partTotal} at parts[${sourceIndex}]`);
    }

    if (parity === null) {
      parity = partParity;
    } else if (partParity !== parity) {
      throw new InvalidInputError(`Structured Append parity mismatch: expected ${parity}, got ${partParity} at parts[${sourceIndex}]`);
    }

    if (index > partTotal) {
      throw new InvalidInputError(`Structured Append parts[${sourceIndex}].index must be between 1 and total ${partTotal}; got ${index}`);
    }

    if (dataType === null) {
      dataType = data.type;
    } else if (data.type !== dataType) {
      throw new InvalidInputError("Structured Append parts must not mix string and binary data");
    }

    if (seenIndexes.has(index)) {
      throw new InvalidInputError(`Structured Append duplicate index ${index}`);
    }
    seenIndexes.add(index);

    normalized.push({
      index,
      total: partTotal,
      parity: partParity,
      dataType: data.type,
      data: data.value,
      bytes: data.bytes,
      byteLength: data.bytes.length
    });
  });

  const missing = [];
  for (let index = 1; index <= total; index += 1) {
    if (!seenIndexes.has(index)) {
      missing.push(index);
    }
  }
  if (missing.length > 0) {
    throw new InvalidInputError(`Structured Append parts are missing index(es): ${missing.join(", ")}`);
  }

  if (normalized.length !== total) {
    throw new InvalidInputError(`Structured Append part count ${normalized.length} does not match total ${total}`);
  }

  const sorted = [...normalized].sort((a, b) => a.index - b.index);
  const mergedBytes = sorted.flatMap((part) => part.bytes);
  const actualParity = calculateStructuredAppendByteParity(mergedBytes);
  if (actualParity !== parity) {
    throw new InvalidInputError(`Structured Append parity check failed: expected ${parity}, got ${actualParity}`);
  }

  const data = dataType === "string"
    ? sorted.map((part) => part.data).join("")
    : Uint8Array.from(mergedBytes);
  const partMetadata = sorted.map((part) => ({
    index: part.index,
    total: part.total,
    parity: part.parity,
    dataType: part.dataType,
    byteLength: part.byteLength
  }));

  return {
    data,
    total,
    parity,
    parts: partMetadata,
    diagnostics: {
      partCount: sorted.length,
      total,
      parity,
      dataType,
      byteLength: mergedBytes.length,
      missing: [],
      duplicate: [],
      parityCheck: {
        expected: parity,
        actual: actualParity,
        matches: true
      }
    }
  };
}

function validateMergeOptions(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) {
    throw new InvalidModeError("mergeStructuredAppendParts options must be an object when provided");
  }

  const [unsupported] = Object.keys(options);
  if (unsupported !== undefined) {
    throw new InvalidModeError(`Unsupported mergeStructuredAppendParts option: ${unsupported}`);
  }
}

function validateIntegerRange(value, label, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new InvalidInputError(`${label} must be an integer from ${min} to ${max}; got ${value}`);
  }
  return value;
}

function normalizePartData(value, label) {
  if (typeof value === "string") {
    return {
      type: "string",
      value,
      bytes: encodeUtf8(value)
    };
  }

  if (value instanceof Uint8Array) {
    const bytes = Array.from(value);
    return {
      type: "binary",
      value: Uint8Array.from(bytes),
      bytes
    };
  }

  if (value instanceof ArrayBuffer) {
    const bytes = Array.from(new Uint8Array(value));
    return {
      type: "binary",
      value: Uint8Array.from(bytes),
      bytes
    };
  }

  if (ArrayBuffer.isView(value)) {
    const bytes = Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    return {
      type: "binary",
      value: Uint8Array.from(bytes),
      bytes
    };
  }

  throw new InvalidInputError(`${label} must be a string, Uint8Array, ArrayBuffer, or ArrayBuffer view`);
}
