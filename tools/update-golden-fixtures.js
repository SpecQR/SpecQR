import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { interleaveCodewords } from "../src/core/codewords.js";
import {
  encodeSegments,
  normalizeManualSegments,
  createSegments,
  prependEciSegment,
  prependFnc1Segment,
  prependFnc1SecondSegment
} from "../src/encoding/modes.js";
import { generate, generateSegments } from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.join(root, "fixtures", "golden-cases.json");

const CASES = [
  {
    id: "numeric-v1-l-mask0",
    description: "Numeric mode, fixed version 1-L, mask 0.",
    coverage: ["numeric", "format"],
    input: "01234567",
    options: { version: 1, errorCorrectionLevel: "L", maskPattern: 0, mode: "numeric" }
  },
  {
    id: "alphanumeric-v1-m-mask1",
    description: "Alphanumeric mode, fixed version 1-M, mask 1.",
    coverage: ["alphanumeric", "format"],
    input: "HELLO WORLD",
    options: { version: 1, errorCorrectionLevel: "M", maskPattern: 1, mode: "alphanumeric" }
  },
  {
    id: "byte-url-v2-q-mask2",
    description: "Byte mode URL, fixed version 2-Q, mask 2.",
    coverage: ["byte", "format", "alignment"],
    input: "https://example.com",
    options: { version: 2, errorCorrectionLevel: "Q", maskPattern: 2, mode: "byte" }
  },
  {
    id: "utf8-byte-v2-m-mask3",
    description: "UTF-8 byte mode Japanese text, fixed version 2-M, mask 3.",
    coverage: ["utf8", "byte", "alignment"],
    input: "こんにちは",
    options: { version: 2, errorCorrectionLevel: "M", maskPattern: 3, mode: "byte" }
  },
  {
    id: "kanji-v1-m-mask4",
    description: "QR Kanji mode, fixed version 1-M, mask 4.",
    coverage: ["kanji", "format"],
    input: "漢字",
    options: { version: 1, errorCorrectionLevel: "M", maskPattern: 4, mode: "kanji" }
  },
  {
    id: "manual-mixed-v3-q-mask5",
    description: "Manual mixed segments with alphanumeric, numeric, byte, and Kanji data.",
    coverage: ["manual-segments", "alphanumeric", "numeric", "byte", "kanji", "alignment"],
    segments: [
      { mode: "alphanumeric", text: "HELLO " },
      { mode: "numeric", text: "1234567890" },
      { mode: "byte", text: "-web-" },
      { mode: "kanji", text: "漢字" }
    ],
    options: { version: 3, errorCorrectionLevel: "Q", maskPattern: 5 }
  },
  {
    id: "eci-utf8-v2-q-mask6",
    description: "UTF-8 ECI metadata with byte-mode Japanese text.",
    coverage: ["eci", "utf8", "byte", "alignment"],
    input: "こんにちは",
    options: { version: 2, errorCorrectionLevel: "Q", maskPattern: 6, mode: "byte", eci: true }
  },
  {
    id: "eci-auto-mixed-v1-q-exact-mask3",
    description: "ECI-prefixed auto mixed segments that exactly fill version 1-Q data capacity.",
    coverage: ["eci", "eci-mixed", "capacity-edge", "auto-segments", "numeric", "byte"],
    input: `a${"1".repeat(9)}bb`,
    options: { version: 1, errorCorrectionLevel: "Q", maskPattern: 3, eci: true }
  },
  {
    id: "gs1-fnc1-v1-h-exact-mask4",
    description: "FNC1 first position GS1 numeric payload that exactly fills version 1-H data capacity.",
    coverage: ["gs1", "fnc1", "capacity-edge", "numeric"],
    input: "0104912345678904",
    options: { version: 1, errorCorrectionLevel: "H", maskPattern: 4, mode: "numeric", gs1: true }
  },
  {
    id: "fnc1-second-v2-q-mask6",
    description: "FNC1 second position with AIM application indicator 37 and mixed alphanumeric/byte data.",
    coverage: ["fnc1-second", "manual-segments", "alphanumeric", "byte", "alignment"],
    segments: [
      { mode: "alphanumeric", text: "AA1234BBB112" },
      { mode: "byte", text: "text text" }
    ],
    options: { version: 2, errorCorrectionLevel: "Q", maskPattern: 6, fnc1Second: "37" }
  },
  {
    id: "binary-v1-q-mask7",
    description: "Binary byte payload including 0x00 and 0xff.",
    coverage: ["binary", "byte", "format"],
    inputBytes: [0x00, 0x41, 0xff, 0x42, 0x00],
    options: { version: 1, errorCorrectionLevel: "Q", maskPattern: 7, mode: "byte" }
  },
  {
    id: "version7-v7-h-mask0",
    description: "Version 7 symbol to exercise version information modules.",
    coverage: ["version-info", "format", "alignment"],
    input: "Version 7 conformance",
    options: { version: 7, errorCorrectionLevel: "H", maskPattern: 0, mode: "byte" }
  },
  {
    id: "boundary-v10-h-numeric-exact-mask1",
    description: "Version 10 numeric payload that exactly fills 10-H data capacity.",
    coverage: ["version-boundary-10", "capacity-edge", "numeric", "version-info"],
    input: "1".repeat(288),
    options: { version: 10, errorCorrectionLevel: "H", maskPattern: 1, mode: "numeric" }
  },
  {
    id: "boundary-v27-q-kanji-exact-mask2",
    description: "Version 27 Kanji payload that exactly fills 27-Q data capacity.",
    coverage: ["version-boundary-27", "capacity-edge", "kanji", "version-info", "alignment"],
    input: "漢".repeat(496),
    options: { version: 27, errorCorrectionLevel: "Q", maskPattern: 2, mode: "kanji" }
  }
];

const fixtures = CASES.map((testCase) => {
  const result = generateCase(testCase);
  const diagnostics = pickDiagnostics(result.diagnostics);
  const codewords = getCodewords(testCase, diagnostics.version, diagnostics.errorCorrectionLevel);
  const matrixRows = matrixToRows(result.matrix);
  const formatBits = computeFormatBits(diagnostics.errorCorrectionLevel, diagnostics.maskPattern);
  const versionBits = diagnostics.version >= 7 ? computeVersionBits(diagnostics.version) : null;
  const functionModuleCount = countFunctionModules(diagnostics.version);
  const dataModuleCount = diagnostics.size * diagnostics.size - functionModuleCount;
  const remainderBits = dataModuleCount - diagnostics.totalCodewords * 8;

  return {
    id: testCase.id,
    description: testCase.description,
    coverage: testCase.coverage,
    input: testCase.input,
    inputBytes: testCase.inputBytes,
    segments: testCase.segments,
    options: testCase.options,
    expected: {
      diagnostics,
      segments: result.diagnostics.segments,
      dataCodewords: codewords.dataCodewords,
      interleavedCodewords: codewords.interleavedCodewords,
      matrixRows,
      matrixSha256: hashRows(matrixRows),
      darkModules: countDarkModules(result.matrix),
      formatBits: {
        value: formatBits,
        bits: toBinary(formatBits, 15)
      },
      versionBits: versionBits === null
        ? null
        : {
            value: versionBits,
            bits: toBinary(versionBits, 18)
          },
      functionModuleCount,
      dataModuleCount,
      remainderBits
    }
  };
});

mkdirSync(path.dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(fixtures, null, 2)}\n`);
console.log(`Wrote ${fixtures.length} golden fixtures to ${path.relative(root, outputPath)}`);

function generateCase(testCase) {
  const options = {
    ...testCase.options,
    output: "matrix",
    diagnostics: true
  };
  if (testCase.segments) {
    return generateSegments(testCase.segments, options);
  }
  return generate(getInput(testCase), options);
}

function getCodewords(testCase, version, errorCorrectionLevel) {
  const segments = getSegments(testCase, version);
  const dataCodewords = encodeSegments(segments, version, errorCorrectionLevel);
  const interleaved = interleaveCodewords(dataCodewords, version, errorCorrectionLevel);
  return {
    dataCodewords,
    interleavedCodewords: interleaved.codewords
  };
}

function getSegments(testCase, version) {
  const eciAssignmentNumber = normalizeEciOption(testCase.options.eci ?? false);
  const fnc1Second = testCase.options.fnc1Second ?? false;
  if (testCase.segments) {
    return prependFnc1SecondSegment(
      prependFnc1Segment(
        prependEciSegment(normalizeManualSegments(testCase.segments), eciAssignmentNumber),
        testCase.options.gs1 ?? false
      ),
      fnc1Second
    );
  }
  return prependFnc1SecondSegment(
    prependFnc1Segment(
      createSegments(
        getInput(testCase),
        testCase.options.mode ?? "auto",
        version,
        testCase.options.optimizeSegments ?? true,
        eciAssignmentNumber
      ),
      testCase.options.gs1 ?? false
    ),
    fnc1Second
  );
}

function normalizeEciOption(value) {
  return value === true ? 26 : value;
}

function getInput(testCase) {
  return testCase.inputBytes ? Uint8Array.from(testCase.inputBytes) : testCase.input;
}

function pickDiagnostics(diagnostics) {
  return {
    version: diagnostics.version,
    size: diagnostics.size,
    errorCorrectionLevel: diagnostics.errorCorrectionLevel,
    requestedErrorCorrectionLevel: diagnostics.requestedErrorCorrectionLevel,
    boostedErrorCorrection: diagnostics.boostedErrorCorrection,
    versionSelection: diagnostics.versionSelection,
    maskPattern: diagnostics.maskPattern,
    maskPenalty: diagnostics.maskPenalty,
    maskPenalties: diagnostics.maskPenalties,
    mode: diagnostics.mode,
    controlSegments: diagnostics.controlSegments,
    eciAssignmentNumber: diagnostics.eciAssignmentNumber,
    fnc1: diagnostics.fnc1,
    fnc1Second: diagnostics.fnc1Second,
    gs1: diagnostics.gs1,
    dataBitLength: diagnostics.dataBitLength,
    capacityBits: diagnostics.capacityBits,
    remainingBits: diagnostics.remainingBits,
    inputBytes: diagnostics.inputBytes,
    dataCodewords: diagnostics.dataCodewords,
    errorCorrectionCodewords: diagnostics.errorCorrectionCodewords,
    totalCodewords: diagnostics.totalCodewords
  };
}

function matrixToRows(matrix) {
  return matrix.map((row) => row.map((module) => module ? "1" : "0").join(""));
}

function hashRows(rows) {
  return createHash("sha256").update(rows.join("\n")).digest("hex");
}

function countDarkModules(matrix) {
  return matrix.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

function computeFormatBits(errorCorrectionLevel, maskPattern) {
  const formatBitsByLevel = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
  const data = (formatBitsByLevel[errorCorrectionLevel] << 3) | maskPattern;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  }
  return ((data << 10) | remainder) ^ 0x5412;
}

function computeVersionBits(version) {
  let remainder = version;
  for (let i = 0; i < 12; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1f25);
  }
  return (version << 12) | remainder;
}

function countFunctionModules(version) {
  const mask = createFunctionModuleMask(version);
  return mask.reduce((total, row) => total + row.filter(Boolean).length, 0);
}

function createFunctionModuleMask(version) {
  const size = version * 4 + 17;
  const mask = Array.from({ length: size }, () => new Array(size).fill(false));
  drawFinder(mask, 0, 0);
  drawFinder(mask, size - 7, 0);
  drawFinder(mask, 0, size - 7);
  drawTiming(mask);
  drawAlignment(mask, version);
  drawFormat(mask);
  set(mask, 8, size - 8);
  drawVersion(mask, version);
  return mask;
}

function drawFinder(mask, left, top) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      set(mask, left + dx, top + dy);
    }
  }
}

function drawTiming(mask) {
  const size = mask.length;
  for (let i = 8; i < size - 8; i += 1) {
    set(mask, i, 6);
    set(mask, 6, i);
  }
}

function drawAlignment(mask, version) {
  const positions = alignmentPositions(version);
  const last = positions.length - 1;
  for (let yIndex = 0; yIndex < positions.length; yIndex += 1) {
    for (let xIndex = 0; xIndex < positions.length; xIndex += 1) {
      const overlapsFinder =
        (xIndex === 0 && yIndex === 0) ||
        (xIndex === last && yIndex === 0) ||
        (xIndex === 0 && yIndex === last);
      if (!overlapsFinder) {
        for (let dy = -2; dy <= 2; dy += 1) {
          for (let dx = -2; dx <= 2; dx += 1) {
            set(mask, positions[xIndex] + dx, positions[yIndex] + dy);
          }
        }
      }
    }
  }
}

function drawFormat(mask) {
  const size = mask.length;
  for (let i = 0; i <= 5; i += 1) {
    set(mask, 8, i);
  }
  set(mask, 8, 7);
  set(mask, 8, 8);
  set(mask, 7, 8);
  for (let i = 9; i < 15; i += 1) {
    set(mask, 14 - i, 8);
  }
  for (let i = 0; i < 8; i += 1) {
    set(mask, size - 1 - i, 8);
  }
  for (let i = 8; i < 15; i += 1) {
    set(mask, 8, size - 15 + i);
  }
}

function drawVersion(mask, version) {
  if (version < 7) {
    return;
  }
  const size = mask.length;
  for (let i = 0; i < 18; i += 1) {
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    set(mask, a, b);
    set(mask, b, a);
  }
}

function alignmentPositions(version) {
  switch (version) {
    case 1:
      return [];
    case 2:
      return [6, 18];
    case 3:
      return [6, 22];
    case 7:
      return [6, 22, 38];
    case 10:
      return [6, 28, 50];
    case 27:
      return [6, 34, 62, 90, 118];
    default:
      throw new Error(`Golden fixture helper does not define alignment positions for version ${version}`);
  }
}

function set(mask, x, y) {
  if (y >= 0 && y < mask.length && x >= 0 && x < mask.length) {
    mask[y][x] = true;
  }
}

function toBinary(value, width) {
  return value.toString(2).padStart(width, "0");
}
