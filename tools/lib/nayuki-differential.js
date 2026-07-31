import assert from "node:assert/strict";
import qrcodegen from "nayuki-qr-code-generator";
import { generate, generateSegments } from "../../src/index.js";
import {
  createPrng,
  deriveSeed,
  describeInput
} from "./deterministic-conformance.js";

const ECC_LEVELS = ["L", "M", "Q", "H"];
const MASK_PATTERNS = [0, 1, 2, 3, 4, 5, 6, 7];
const CASE_KINDS = [
  "numeric",
  "alphanumeric",
  "byte",
  "binary",
  "manual-mixed",
  "eci"
];
const ALPHANUMERIC_CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const BYTE_TEXTS = ["abc", "a/b?c", "é", "雪", "x_y", "QR!"];
const encoder = new TextEncoder();

const NAYUKI_ECC = {
  L: qrcodegen.QrCode.Ecc.LOW,
  M: qrcodegen.QrCode.Ecc.MEDIUM,
  Q: qrcodegen.QrCode.Ecc.QUARTILE,
  H: qrcodegen.QrCode.Ecc.HIGH
};

export function runNayukiDifferential({ runner, seed, caseFilter = null }) {
  const byKind = Object.fromEntries(CASE_KINDS.map((kind) => [kind, 0]));
  const byRange = {
    "1-9": Object.fromEntries(CASE_KINDS.map((kind) => [kind, 0])),
    "10-26": Object.fromEntries(CASE_KINDS.map((kind) => [kind, 0])),
    "27-40": Object.fromEntries(CASE_KINDS.map((kind) => [kind, 0]))
  };
  let compared = 0;

  for (let version = 1; version <= 40; version += 1) {
    for (let eccIndex = 0; eccIndex < ECC_LEVELS.length; eccIndex += 1) {
      const errorCorrectionLevel = ECC_LEVELS[eccIndex];

      for (const maskPattern of MASK_PATTERNS) {
        const kindIndex = (
          version +
          eccIndex * 3 +
          maskPattern +
          (seed & 0xFFFF)
        ) % CASE_KINDS.length;
        const kind = CASE_KINDS[kindIndex];
        const id = [
          "nayuki",
          `v${String(version).padStart(2, "0")}`,
          errorCorrectionLevel.toLowerCase(),
          `m${maskPattern}`,
          kind
        ].join(":");

        if (caseFilter !== null && caseFilter !== id) {
          continue;
        }

        const testCase = createDifferentialCase({
          seed: deriveSeed(seed, "nayuki", version, errorCorrectionLevel, maskPattern, kind),
          version,
          errorCorrectionLevel,
          maskPattern,
          kind
        });

        const executed = runner.run({
          id,
          suite: "nayuki-fixed-condition",
          descriptor: testCase.descriptor,
          execute() {
            compareCaseWithNayuki(testCase);
          }
        });

        if (executed) {
          compared += 1;
          byKind[kind] += 1;
          byRange[getVersionRange(version)][kind] += 1;
        }
      }
    }
  }

  if (caseFilter === null) {
    assert.equal(compared, 40 * 4 * 8, "Nayuki differential combination count");
    for (const [range, counts] of Object.entries(byRange)) {
      for (const kind of CASE_KINDS) {
        assert.ok(
          counts[kind] > 0,
          `Nayuki differential must cover ${kind} in version range ${range}`
        );
      }
    }
  }

  return {
    compared,
    byKind,
    byVersionRange: byRange
  };
}

function createDifferentialCase({
  seed,
  version,
  errorCorrectionLevel,
  maskPattern,
  kind
}) {
  const random = createPrng(seed);
  const specqrOptions = {
    version,
    errorCorrectionLevel,
    maskPattern,
    output: "matrix",
    diagnostics: true
  };
  let input;
  let specqrSegments = null;
  let referenceSegments;

  switch (kind) {
    case "numeric": {
      input = randomText(random, "0123456789", random.int(1, 12));
      specqrOptions.mode = "numeric";
      referenceSegments = [qrcodegen.QrSegment.makeNumeric(input)];
      break;
    }
    case "alphanumeric": {
      input = randomText(random, ALPHANUMERIC_CHARACTERS, random.int(1, 9));
      specqrOptions.mode = "alphanumeric";
      referenceSegments = [qrcodegen.QrSegment.makeAlphanumeric(input)];
      break;
    }
    case "byte": {
      input = random.pick(BYTE_TEXTS);
      specqrOptions.mode = "byte";
      referenceSegments = [qrcodegen.QrSegment.makeBytes(toUtf8Bytes(input))];
      break;
    }
    case "binary": {
      const payload = random.bytes(random.int(3, 7));
      payload[0] = 0x00;
      payload[payload.length - 1] = 0xFF;
      if (random.boolean()) {
        const backing = Uint8Array.from([0xA5, ...payload, 0x5A]);
        input = new DataView(backing.buffer, 1, payload.length);
      } else {
        input = payload;
      }
      specqrOptions.mode = "byte";
      referenceSegments = [
        qrcodegen.QrSegment.makeBytes(toBytes(input))
      ];
      break;
    }
    case "manual-mixed": {
      const prefix = randomText(random, ALPHANUMERIC_CHARACTERS, random.int(1, 2));
      const digits = randomText(random, "0123456789", random.int(1, 3));
      const suffix = random.bytes(1);
      specqrSegments = [
        { mode: "alphanumeric", data: prefix },
        { mode: "numeric", data: digits },
        { mode: "byte", data: suffix }
      ];
      referenceSegments = [
        qrcodegen.QrSegment.makeAlphanumeric(prefix),
        qrcodegen.QrSegment.makeNumeric(digits),
        qrcodegen.QrSegment.makeBytes(Array.from(suffix))
      ];
      break;
    }
    case "eci": {
      input = random.pick(["é", "雪", "ECI"]);
      specqrSegments = [
        { mode: "eci", assignmentNumber: 26 },
        { mode: "byte", data: input }
      ];
      referenceSegments = [
        qrcodegen.QrSegment.makeEci(26),
        qrcodegen.QrSegment.makeBytes(toUtf8Bytes(input))
      ];
      break;
    }
    default:
      throw new RangeError(`Unsupported Nayuki differential case kind: ${kind}`);
  }

  return {
    version,
    errorCorrectionLevel,
    maskPattern,
    kind,
    input,
    specqrSegments,
    specqrOptions,
    referenceSegments,
    descriptor: {
      version,
      errorCorrectionLevel,
      maskPattern,
      kind,
      input: specqrSegments
        ? specqrSegments.map(describeSegment)
        : describeInput(input)
    }
  };
}

function compareCaseWithNayuki(testCase) {
  const specqr = testCase.specqrSegments === null
    ? generate(testCase.input, testCase.specqrOptions)
    : generateSegments(testCase.specqrSegments, testCase.specqrOptions);
  const reference = qrcodegen.QrCode.encodeSegments(
    testCase.referenceSegments,
    NAYUKI_ECC[testCase.errorCorrectionLevel],
    testCase.version,
    testCase.version,
    testCase.maskPattern,
    false
  );
  const referenceDataBits = qrcodegen.QrSegment.getTotalBits(
    testCase.referenceSegments,
    testCase.version
  );
  const referenceDataCodewords = qrcodegen.QrCode.getNumDataCodewords(
    testCase.version,
    NAYUKI_ECC[testCase.errorCorrectionLevel]
  );
  const referenceTotalCodewords = Math.floor(
    qrcodegen.QrCode.getNumRawDataModules(testCase.version) / 8
  );

  assert.equal(specqr.diagnostics.version, reference.version, "version");
  assert.equal(specqr.diagnostics.size, reference.size, "matrix size");
  assert.equal(
    specqr.diagnostics.errorCorrectionLevel,
    testCase.errorCorrectionLevel,
    "error correction level"
  );
  assert.equal(specqr.diagnostics.maskPattern, reference.mask, "mask pattern");
  assert.equal(specqr.diagnostics.dataBitLength, referenceDataBits, "data bit length");
  assert.equal(
    specqr.diagnostics.capacityBits,
    referenceDataCodewords * 8,
    "capacity bits"
  );
  assert.equal(
    specqr.diagnostics.remainingBits,
    referenceDataCodewords * 8 - referenceDataBits,
    "remaining bits"
  );
  assert.equal(
    specqr.diagnostics.dataCodewords,
    referenceDataCodewords,
    "data codewords"
  );
  assert.equal(
    specqr.diagnostics.totalCodewords,
    referenceTotalCodewords,
    "total codewords"
  );
  assert.equal(
    specqr.diagnostics.errorCorrectionCodewords,
    referenceTotalCodewords - referenceDataCodewords,
    "error correction codewords"
  );
  assert.equal(specqr.matrix.length, reference.size, "matrix row count");

  for (let y = 0; y < reference.size; y += 1) {
    assert.equal(specqr.matrix[y].length, reference.size, `matrix row ${y} width`);
    for (let x = 0; x < reference.size; x += 1) {
      assert.equal(
        specqr.matrix[y][x],
        reference.getModule(x, y),
        `matrix module (${x}, ${y})`
      );
    }
  }
}

function describeSegment(segment) {
  if (segment.mode === "eci") {
    return { mode: segment.mode, assignmentNumber: segment.assignmentNumber };
  }
  return { mode: segment.mode, data: describeInput(segment.data) };
}

function randomText(random, alphabet, length) {
  return Array.from({ length }, () => alphabet[random.int(0, alphabet.length - 1)]).join("");
}

function toUtf8Bytes(text) {
  return Array.from(encoder.encode(text));
}

function toBytes(input) {
  if (input instanceof Uint8Array) {
    return Array.from(input);
  }
  if (input instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(input));
  }
  if (ArrayBuffer.isView(input)) {
    return Array.from(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
  }
  return [...input];
}

function getVersionRange(version) {
  return version <= 9 ? "1-9" : version <= 26 ? "10-26" : "27-40";
}
