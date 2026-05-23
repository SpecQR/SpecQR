import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  generateStructuredAppend,
  InvalidInputError,
  mergeStructuredAppendParts
} from "specqr";

const outputPath = process.argv[2] ?? join(tmpdir(), "specqr-structured-append-merge.json");

const stringInput = "A".repeat(31);
const stringSet = generateStructuredAppend(stringInput, {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "alphanumeric",
  output: "matrix",
  diagnostics: true
});
const stringDecoderResults = createZxingJavaLikeStringResults(stringSet, stringInput);
const shuffledStringParts = [stringDecoderResults[1], stringDecoderResults[0]]
  .map((result) => zxingJavaResultToStructuredAppendPart(result));
const mergedString = mergeStructuredAppendParts(shuffledStringParts);

assert.equal(mergedString.data, stringInput);
assert.deepEqual(mergedString.parts.map((part) => part.index), [1, 2]);
assert.equal(mergedString.diagnostics.dataType, "string");
assert.equal(mergedString.diagnostics.parityCheck.matches, true);

const binaryInput = Uint8Array.from(Array.from({ length: 31 }, (_, index) => {
  if (index === 0) {
    return 0x00;
  }
  if (index === 30) {
    return 0xff;
  }
  return index;
}));
const binarySet = generateStructuredAppend(binaryInput, {
  version: 1,
  errorCorrectionLevel: "L",
  mode: "byte",
  output: "matrix",
  diagnostics: true
});
const binaryDecoderResults = createZxingJavaLikeBinaryResults(binarySet, binaryInput);
const shuffledBinaryParts = [binaryDecoderResults[2], binaryDecoderResults[0], binaryDecoderResults[1]]
  .map((result) => zxingJavaResultToStructuredAppendPart(result));
const mergedBinary = mergeStructuredAppendParts(shuffledBinaryParts);

assert.ok(mergedBinary.data instanceof Uint8Array);
assert.deepEqual(Array.from(mergedBinary.data), Array.from(binaryInput));
assert.deepEqual(mergedBinary.parts.map((part) => part.index), [1, 2, 3]);
assert.equal(mergedBinary.diagnostics.dataType, "binary");
assert.equal(mergedBinary.diagnostics.parityCheck.matches, true);

const negative = {
  missing: captureInvalidInput(() => mergeStructuredAppendParts(shuffledStringParts.slice(0, 1))),
  duplicate: captureInvalidInput(() => mergeStructuredAppendParts([shuffledStringParts[0], shuffledStringParts[0]])),
  parityMismatch: captureInvalidInput(() => mergeStructuredAppendParts([
    shuffledStringParts[0],
    { ...shuffledStringParts[1], parity: shuffledStringParts[1].parity ^ 1 }
  ])),
  metadataMissing: captureInvalidInput(() => zxingJavaResultToStructuredAppendPart({
    text: "payload",
    resultMetadata: {}
  }))
};

const summary = {
  string: {
    data: mergedString.data,
    total: mergedString.total,
    parity: mergedString.parity,
    inputOrder: shuffledStringParts.map((part) => part.index),
    mergedOrder: mergedString.parts.map((part) => part.index),
    dataType: mergedString.diagnostics.dataType,
    byteLength: mergedString.diagnostics.byteLength
  },
  binary: {
    dataHex: hexBytes(mergedBinary.data),
    total: mergedBinary.total,
    parity: mergedBinary.parity,
    inputOrder: shuffledBinaryParts.map((part) => part.index),
    mergedOrder: mergedBinary.parts.map((part) => part.index),
    dataType: mergedBinary.diagnostics.dataType,
    byteLength: mergedBinary.diagnostics.byteLength
  },
  adapter: {
    metadataNames: ["STRUCTURED_APPEND_SEQUENCE", "STRUCTURED_APPEND_PARITY"],
    sequenceMapping: "index = (sequence >> 4) + 1; total = (sequence & 0x0f) + 1",
    metadataRequired: true,
    metadataLessDecoders: "metadata がない decoder output からは順序、欠落、重複、parity を安全に復元できません。"
  },
  negative
};

await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(`Wrote Structured Append merge example to ${outputPath}`);
console.log(`Merged string set: ${mergedString.total} parts, parity 0x${hexByte(mergedString.parity)}`);
console.log(`Merged binary set: ${mergedBinary.total} parts, parity 0x${hexByte(mergedBinary.parity)}`);

function createZxingJavaLikeStringResults(set, input) {
  const characters = Array.from(input);
  return set.diagnostics.symbols.map((symbol) => ({
    text: characters.slice(symbol.inputStart, symbol.inputStart + symbol.inputLength).join(""),
    resultMetadata: {
      STRUCTURED_APPEND_SEQUENCE: symbol.sequenceIndicator,
      STRUCTURED_APPEND_PARITY: symbol.parity
    }
  }));
}

function createZxingJavaLikeBinaryResults(set, input) {
  return set.diagnostics.symbols.map((symbol) => ({
    rawBytes: input.subarray(symbol.byteStart, symbol.byteStart + symbol.byteLength),
    resultMetadata: {
      STRUCTURED_APPEND_SEQUENCE: symbol.sequenceIndicator,
      STRUCTURED_APPEND_PARITY: symbol.parity
    }
  }));
}

function zxingJavaResultToStructuredAppendPart(result) {
  const metadata = result.resultMetadata ?? {};
  const sequence = metadata.STRUCTURED_APPEND_SEQUENCE;
  const parity = metadata.STRUCTURED_APPEND_PARITY;
  if (!Number.isInteger(sequence) || !Number.isInteger(parity)) {
    throw new InvalidInputError("Structured Append metadata is required before merging decoded parts");
  }

  return {
    index: (sequence >> 4) + 1,
    total: (sequence & 0x0f) + 1,
    parity,
    data: result.rawBytes ?? result.text
  };
}

function captureInvalidInput(fn) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof InvalidInputError);
    return {
      name: error.name,
      code: error.code,
      message: error.message
    };
  }
  throw new Error("Expected InvalidInputError");
}

function hexBytes(bytes) {
  return Array.from(bytes, (byte) => hexByte(byte)).join(" ");
}

function hexByte(value) {
  return value.toString(16).padStart(2, "0");
}
