import assert from "node:assert/strict";
import {
  DataTooLongError,
  GS1_FNC1_SEPARATOR,
  analyzeSegments,
  appendGtinCheckDigit,
  calculateStructuredAppendParity,
  calculateStructuredAppendSegmentsParity,
  createGs1DigitalLink,
  createGs1ElementString,
  estimate,
  generate,
  generateSegments,
  generateSegmentsStructuredAppend,
  generateStructuredAppend,
  getCapacity,
  mergeStructuredAppendParts,
  normalizeGs1DigitalLink,
  parseGs1DigitalLink,
  parseGs1ElementString,
  validateGs1ElementString
} from "../../src/index.js";
import {
  createPrng,
  deriveSeed,
  describeInput,
  minimizeFailingSequence
} from "./deterministic-conformance.js";

const ECC_LEVELS = ["L", "M", "Q", "H"];
const VERSION_BOUNDARIES = [1, 9, 10, 26, 27, 40];
const ALPHANUMERIC_CHARACTERS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";
const encoder = new TextEncoder();

export function runMetamorphicProperties({
  runner,
  seed,
  cases,
  caseFilter = null
}) {
  const suites = [
    ["determinism", runDeterminismCase],
    ["auto-version", runAutoVersionCase],
    ["auto-mask", runAutoMaskCase],
    ["planning-input", runPlanningInputCase],
    ["planning-segments", runPlanningSegmentsCase],
    ["manual-equivalence", runManualEquivalenceCase],
    ["gs1-digital-link", runGs1DigitalLinkCase],
    ["structured-append", runStructuredAppendCase]
  ];
  const counts = Object.fromEntries(suites.map(([name]) => [name, 0]));

  for (const [suite, executeCase] of suites) {
    for (let index = 0; index < cases; index += 1) {
      const id = `property:${suite}:${String(index).padStart(4, "0")}`;
      if (caseFilter !== null && caseFilter !== id) {
        continue;
      }

      const caseSeed = deriveSeed(seed, "property", suite, index);
      const testCase = executeCase.create(caseSeed, index);
      const executed = runner.run({
        id,
        suite,
        descriptor: {
          index,
          caseSeed,
          ...testCase.descriptor
        },
        execute() {
          executeCase.check(testCase);
        },
        minimize: testCase.minimize
          ? () => testCase.minimize(executeCase.check)
          : undefined
      });

      if (executed) {
        counts[suite] += 1;
      }
    }
  }

  return {
    total: Object.values(counts).reduce((sum, value) => sum + value, 0),
    byProperty: counts
  };
}

const runDeterminismCase = {
  create(caseSeed, index) {
    const random = createPrng(caseSeed);
    const generated = createGeneralInput(random, index);
    const options = {
      ...generated.options,
      minVersion: 1,
      maxVersion: VERSION_BOUNDARIES[index % VERSION_BOUNDARIES.length],
      errorCorrectionLevel: ECC_LEVELS[index % ECC_LEVELS.length],
      maskPattern: index % 3 === 0 ? index % 8 : "auto",
      output: "matrix",
      diagnostics: true
    };
    const testCase = {
      input: generated.input,
      options,
      descriptor: {
        input: describeInput(generated.input),
        options
      }
    };

    if (typeof generated.input === "string" || generated.input instanceof Uint8Array) {
      testCase.minimize = (check) => ({
        input: describeInput(minimizeFailingSequence(generated.input, (candidate) => {
          try {
            check({ ...testCase, input: candidate });
            return false;
          } catch {
            return true;
          }
        }))
      });
    }
    return testCase;
  },

  check({ input, options }) {
    const first = generate(input, options);
    const second = generate(input, options);
    assert.deepEqual(second, first);
  }
};

const runAutoVersionCase = {
  create(caseSeed, index) {
    const random = createPrng(caseSeed);
    const targetVersion = VERSION_BOUNDARIES[index % VERSION_BOUNDARIES.length];
    const errorCorrectionLevel = ECC_LEVELS[index % ECC_LEVELS.length];
    const mode = ["numeric", "alphanumeric", "byte"][index % 3];
    const capacity = getCapacity({
      version: targetVersion,
      errorCorrectionLevel,
      mode
    });
    const maximum = mode === "byte" ? capacity.maxBytes : capacity.maxCharacters;
    const length = Math.max(1, maximum - (Math.floor(index / VERSION_BOUNDARIES.length) % 3));
    const input = createCapacityInput(random, mode, length, index);
    const overflowInput = length === maximum ? extendCapacityInput(input, mode) : null;
    const options = {
      mode,
      version: "auto",
      minVersion: 1,
      maxVersion: targetVersion,
      errorCorrectionLevel,
      maskPattern: index % 8,
      output: "matrix",
      diagnostics: true
    };
    return {
      input,
      overflowInput,
      options,
      descriptor: {
        targetVersion,
        mode,
        maximum,
        length,
        input: describeInput(input),
        options
      }
    };
  },

  check({ input, overflowInput, options }) {
    const automatic = generate(input, options);
    const selectedVersion = automatic.diagnostics.version;
    assert.ok(selectedVersion >= options.minVersion);
    assert.ok(selectedVersion <= options.maxVersion);
    assert.equal(automatic.diagnostics.versionSelection, "auto-minimum");

    for (let version = options.minVersion; version < selectedVersion; version += 1) {
      assert.throws(
        () => generate(input, {
          ...options,
          version,
          diagnostics: false
        }),
        (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG",
        `version ${version} must overflow before selected version ${selectedVersion}`
      );
    }

    const fixed = generate(input, {
      ...options,
      version: selectedVersion
    });
    assert.deepEqual(fixed.matrix, automatic.matrix);
    assert.equal(fixed.diagnostics.dataBitLength, automatic.diagnostics.dataBitLength);
    assert.equal(fixed.diagnostics.capacityBits, automatic.diagnostics.capacityBits);
    assert.equal(fixed.diagnostics.remainingBits, automatic.diagnostics.remainingBits);

    if (overflowInput !== null) {
      assert.throws(
        () => generate(overflowInput, {
          ...options,
          version: options.maxVersion,
          diagnostics: false
        }),
        (error) => error instanceof DataTooLongError && error.code === "DATA_TOO_LONG",
        `one ${options.mode === "byte" ? "byte" : "character"} beyond maximum must overflow`
      );
    }
  }
};

const runAutoMaskCase = {
  create(caseSeed, index) {
    const random = createPrng(caseSeed);
    const version = VERSION_BOUNDARIES[index % VERSION_BOUNDARIES.length];
    const inputCase = createSmallFixedInput(random, index);
    const options = {
      ...inputCase.options,
      version,
      errorCorrectionLevel: ECC_LEVELS[index % ECC_LEVELS.length],
      maskPattern: "auto",
      output: "matrix",
      diagnostics: true
    };
    return {
      input: inputCase.input,
      options,
      descriptor: {
        input: describeInput(inputCase.input),
        options
      }
    };
  },

  check({ input, options }) {
    const automatic = generate(input, options);
    const penalties = [];
    let selectedMatrix = null;

    for (let maskPattern = 0; maskPattern < 8; maskPattern += 1) {
      const fixed = generate(input, {
        ...options,
        maskPattern
      });
      assert.deepEqual(fixed.diagnostics.maskPenalties, [
        { maskPattern, penalty: fixed.diagnostics.maskPenalty }
      ]);
      penalties.push({
        maskPattern,
        penalty: fixed.diagnostics.maskPenalty
      });
      if (maskPattern === automatic.diagnostics.maskPattern) {
        selectedMatrix = fixed.matrix;
      }
    }

    const minimum = penalties.reduce((best, item) =>
      item.penalty < best.penalty ? item : best
    );
    assert.deepEqual(automatic.diagnostics.maskPenalties, penalties);
    assert.equal(automatic.diagnostics.maskPattern, minimum.maskPattern);
    assert.equal(automatic.diagnostics.maskPenalty, minimum.penalty);
    assert.deepEqual(automatic.matrix, selectedMatrix);
  }
};

const runPlanningInputCase = {
  create(caseSeed, index) {
    const random = createPrng(caseSeed);
    const generated = createGeneralInput(random, index);
    const options = {
      ...generated.options,
      minVersion: 1,
      maxVersion: VERSION_BOUNDARIES[index % VERSION_BOUNDARIES.length],
      errorCorrectionLevel: ECC_LEVELS[index % ECC_LEVELS.length],
      margin: index % 5,
      printDpi: index % 2 === 0 ? 300 : null,
      boostErrorCorrection: index % 4 === 0,
      output: "matrix"
    };
    return {
      input: generated.input,
      options,
      descriptor: {
        input: describeInput(generated.input),
        options
      }
    };
  },

  check({ input, options }) {
    const planned = estimate(input, options);
    const generated = generate(input, {
      ...options,
      diagnostics: true
    });
    assertPlanningMatchesGenerated(planned, generated.diagnostics);
  }
};

const runPlanningSegmentsCase = {
  create(caseSeed, index) {
    const random = createPrng(caseSeed);
    const segments = createManualSegmentsCase(random, index);
    const options = {
      version: VERSION_BOUNDARIES[index % VERSION_BOUNDARIES.length],
      errorCorrectionLevel: ECC_LEVELS[index % ECC_LEVELS.length],
      maskPattern: index % 8,
      output: "matrix"
    };
    return {
      segments,
      options,
      descriptor: {
        segments: segments.map(describeSegment),
        options
      }
    };
  },

  check({ segments, options }) {
    const planned = analyzeSegments(segments, options);
    const generated = generateSegments(segments, {
      ...options,
      diagnostics: true
    });
    assertPlanningMatchesGenerated(planned, generated.diagnostics);
  }
};

const runManualEquivalenceCase = {
  create(caseSeed, index) {
    const random = createPrng(caseSeed);
    const generated = createEquivalentSingleSegment(random, index);
    const options = {
      mode: generated.mode,
      version: VERSION_BOUNDARIES[index % VERSION_BOUNDARIES.length],
      errorCorrectionLevel: ECC_LEVELS[index % ECC_LEVELS.length],
      maskPattern: index % 8,
      output: "matrix",
      diagnostics: true
    };
    return {
      input: generated.input,
      segment: { mode: generated.mode, data: generated.input },
      options,
      descriptor: {
        input: describeInput(generated.input),
        mode: generated.mode,
        options
      }
    };
  },

  check({ input, segment, options }) {
    const direct = generate(input, options);
    const manual = generateSegments([segment], options);
    assert.deepEqual(manual.matrix, direct.matrix);
    assert.equal(manual.diagnostics.version, direct.diagnostics.version);
    assert.equal(manual.diagnostics.maskPattern, direct.diagnostics.maskPattern);
    assert.equal(manual.diagnostics.dataBitLength, direct.diagnostics.dataBitLength);
    assert.equal(manual.diagnostics.capacityBits, direct.diagnostics.capacityBits);
    assert.deepEqual(manual.diagnostics.segments, direct.diagnostics.segments);
  }
};

const runGs1DigitalLinkCase = {
  create(caseSeed, index) {
    const random = createPrng(caseSeed);
    const gtinBody = randomText(random, "0123456789", 13);
    const elements = [
      { ai: "01", value: appendGtinCheckDigit(gtinBody) },
      { ai: "10", value: `LOT${randomText(random, "0123456789ABCDEF", 5)}` },
      { ai: "17", value: `${24 + (index % 6)}1231` }
    ];
    return {
      elements,
      unknownQuery: `trace=${index}&trace=${index + 1}`,
      descriptor: {
        elements,
        unknownQuery: `trace=${index}&trace=${index + 1}`
      }
    };
  },

  check({ elements, unknownQuery }) {
    const raw = createGs1ElementString(elements);
    assert.ok(raw.includes(GS1_FNC1_SEPARATOR));
    const parsedRaw = parseGs1ElementString(raw);
    assert.deepEqual(parsedRaw, {
      elements,
      hasSeparators: true
    });
    const validation = validateGs1ElementString(raw);
    assert.equal(validation.ok, true);
    assert.deepEqual(validation.elements, elements);

    const created = createGs1DigitalLink(elements, {
      baseUrl: "https://example.com/specqr"
    });
    const withUnknownQuery = `${created}&${unknownQuery}`;
    const normalized = normalizeGs1DigitalLink(withUnknownQuery);
    assert.equal(normalizeGs1DigitalLink(normalized), normalized);
    assert.deepEqual(
      parseGs1DigitalLink(normalized),
      parseGs1DigitalLink(withUnknownQuery)
    );
  }
};

const runStructuredAppendCase = {
  create(caseSeed, index) {
    const random = createPrng(caseSeed);
    const binary = index % 2 === 1;
    let input;
    let mode;
    if (binary) {
      const payload = random.bytes(random.int(31, 46));
      payload[0] = 0x00;
      payload[payload.length - 1] = 0xFF;
      const backing = Uint8Array.from([0xA5, ...payload, 0x5A]);
      input = new Uint8Array(backing.buffer, 1, payload.length);
      mode = "byte";
    } else {
      input = randomText(random, ALPHANUMERIC_CHARACTERS, random.int(31, 55));
      mode = "alphanumeric";
    }
    const options = {
      version: 1,
      errorCorrectionLevel: "L",
      mode,
      maskPattern: index % 8,
      output: "matrix",
      diagnostics: true
    };
    return {
      input,
      binary,
      options,
      shuffleSeed: deriveSeed(caseSeed, "shuffle"),
      descriptor: {
        input: describeInput(input),
        options
      }
    };
  },

  check({ input, binary, options, shuffleSeed }) {
    const generated = generateStructuredAppend(input, options);
    assert.equal(generated.parity, calculateStructuredAppendParity(input));
    assert.equal(generated.total, generated.symbols.length);
    assert.equal(generated.total, generated.diagnostics.symbols.length);

    const source = binary ? toByteArray(input) : Array.from(input);
    const parts = generated.diagnostics.symbols.map((symbol, position) => {
      const symbolDiagnostics = generated.symbols[position].diagnostics;
      assert.equal(symbol.index, position + 1);
      assert.equal(symbol.total, generated.total);
      assert.equal(symbol.parity, generated.parity);
      assert.equal(symbolDiagnostics.structuredAppend.index, symbol.index);
      assert.equal(symbolDiagnostics.structuredAppend.total, generated.total);
      assert.equal(symbolDiagnostics.structuredAppend.parity, generated.parity);

      const data = binary
        ? Uint8Array.from(source.slice(symbol.byteStart, symbol.byteStart + symbol.byteLength))
        : source.slice(symbol.inputStart, symbol.inputStart + symbol.inputLength).join("");
      return {
        index: symbol.index,
        total: symbol.total,
        parity: symbol.parity,
        data
      };
    });

    const shuffled = shuffle(parts, createPrng(shuffleSeed));
    const merged = mergeStructuredAppendParts(shuffled);
    if (binary) {
      assert.deepEqual(Array.from(merged.data), source);
    } else {
      assert.equal(merged.data, input);
    }
    assert.equal(merged.parity, generated.parity);
    assert.deepEqual(
      merged.parts.map((part) => part.index),
      Array.from({ length: generated.total }, (_, index) => index + 1)
    );

    const paritySegments = [
      { mode: "alphanumeric", data: "QR" },
      { mode: "numeric", data: String(generated.parity).padStart(3, "0") },
      { mode: "byte", data: Uint8Array.from([0x00, generated.parity, 0xFF]) }
    ];
    const logicalBytes = Uint8Array.from([
      ...encoder.encode("QR"),
      ...encoder.encode(String(generated.parity).padStart(3, "0")),
      0x00,
      generated.parity,
      0xFF
    ]);
    assert.equal(
      calculateStructuredAppendSegmentsParity(paritySegments),
      calculateStructuredAppendParity(logicalBytes)
    );

    const manualSegments = [{ mode: "byte", data: input }];
    const manualBaseOptions = {
      version: options.version,
      errorCorrectionLevel: options.errorCorrectionLevel,
      maskPattern: options.maskPattern,
      output: "matrix"
    };
    const standardOutput = generateSegmentsStructuredAppend(
      manualSegments,
      manualBaseOptions
    );
    const standardDiagnostics = generateSegmentsStructuredAppend(
      manualSegments,
      {
        ...manualBaseOptions,
        diagnostics: true
      }
    );
    const fullOutput = generateSegmentsStructuredAppend(
      manualSegments,
      {
        ...manualBaseOptions,
        diagnostics: {
          splitUnits: "full",
          symbolResults: "output"
        }
      }
    );
    const fullDiagnostics = generateSegmentsStructuredAppend(
      manualSegments,
      {
        ...manualBaseOptions,
        diagnostics: { splitUnits: "full" }
      }
    );
    const expectedSplitUnitCount = binary
      ? input.byteLength
      : Array.from(input).length;

    assert.equal(standardOutput.diagnostics.splitUnitsDetail, "summary");
    assert.equal(standardDiagnostics.diagnostics.splitUnitsDetail, "summary");
    assert.equal(Object.hasOwn(standardOutput.diagnostics, "splitUnits"), false);
    assert.equal(Object.hasOwn(standardDiagnostics.diagnostics, "splitUnits"), false);
    assert.equal(standardOutput.diagnostics.splitUnitCount, expectedSplitUnitCount);
    assert.equal(fullOutput.diagnostics.splitUnitsDetail, "full");
    assert.equal(fullDiagnostics.diagnostics.splitUnitsDetail, "full");
    assert.equal(fullOutput.diagnostics.splitUnitCount, expectedSplitUnitCount);
    assert.equal(fullOutput.diagnostics.splitUnits.length, expectedSplitUnitCount);
    assert.deepEqual(
      fullOutput.diagnostics.splitUnits,
      fullDiagnostics.diagnostics.splitUnits
    );
    assert.deepEqual(standardOutput.symbols, fullOutput.symbols);
    assert.deepEqual(
      standardDiagnostics.symbols.map((symbol) => symbol.matrix),
      fullDiagnostics.symbols.map((symbol) => symbol.matrix)
    );
    assert.deepEqual(
      standardDiagnostics.symbols.map((symbol) => symbol.matrix),
      standardOutput.symbols
    );
    assert.deepEqual(
      standardOutput.diagnostics.symbols,
      fullOutput.diagnostics.symbols
    );
    assert.deepEqual(
      standardDiagnostics.diagnostics.symbols,
      fullDiagnostics.diagnostics.symbols
    );
  }
};

function createGeneralInput(random, index) {
  switch (index % 8) {
    case 0:
      return {
        input: randomText(random, "0123456789", random.int(1, 14)),
        options: { mode: "numeric" }
      };
    case 1:
      return {
        input: randomText(random, ALPHANUMERIC_CHARACTERS, random.int(1, 12)),
        options: { mode: "alphanumeric" }
      };
    case 2:
      return {
        input: random.pick(["é", "雪", "A"]),
        options: { mode: "byte", eci: true }
      };
    case 3: {
      const input = random.bytes(random.int(2, 12));
      input[0] = 0x00;
      input[input.length - 1] = 0xFF;
      return { input, options: { mode: "byte" } };
    }
    case 4: {
      const payload = random.bytes(random.int(2, 12));
      const backing = Uint8Array.from([0xA5, ...payload, 0x5A]);
      return {
        input: new DataView(backing.buffer, 1, payload.length),
        options: { mode: "byte" }
      };
    }
    case 5:
      return {
        input: `a${randomText(random, "0123456789", 12)}雪`,
        options: { mode: "auto", optimizeSegments: true }
      };
    case 6:
      return {
        input: random.pick(["漢字", "日本語", "茗荷"]),
        options: { mode: "kanji" }
      };
    default: {
      const bytes = random.bytes(random.int(2, 12));
      return {
        input: bytes.buffer,
        options: { mode: "byte" }
      };
    }
  }
}

function createCapacityInput(random, mode, length, index) {
  if (mode === "numeric") {
    return randomText(random, "0123456789", length);
  }
  if (mode === "alphanumeric") {
    return randomText(random, ALPHANUMERIC_CHARACTERS, length);
  }

  const bytes = random.bytes(length);
  if (bytes.length > 0) {
    bytes[0] = 0x00;
    bytes[bytes.length - 1] = 0xFF;
  }
  if (index % 2 === 0) {
    return bytes;
  }
  const backing = Uint8Array.from([0xA5, ...bytes, 0x5A]);
  return new DataView(backing.buffer, 1, bytes.length);
}

function extendCapacityInput(input, mode) {
  if (mode === "numeric") {
    return `${input}0`;
  }
  if (mode === "alphanumeric") {
    return `${input}A`;
  }
  return Uint8Array.from([...toByteArray(input), 0x41]);
}

function createSmallFixedInput(random, index) {
  switch (index % 5) {
    case 0:
      return {
        input: randomText(random, "0123456789", 10),
        options: { mode: "numeric" }
      };
    case 1:
      return {
        input: randomText(random, ALPHANUMERIC_CHARACTERS, 8),
        options: { mode: "alphanumeric" }
      };
    case 2:
      return { input: "A雪9", options: { mode: "byte", eci: true } };
    case 3: {
      const input = random.bytes(6);
      input[0] = 0x00;
      input[5] = 0xFF;
      return { input, options: { mode: "byte" } };
    }
    default:
      return { input: "漢字", options: { mode: "kanji" } };
  }
}

function createManualSegmentsCase(random, index) {
  switch (index % 6) {
    case 0:
      return [
        { mode: "alphanumeric", data: "HELLO" },
        { mode: "numeric", data: randomText(random, "0123456789", 6) },
        { mode: "byte", data: "x" }
      ];
    case 1:
      return [
        { mode: "eci", assignmentNumber: 26 },
        { mode: "byte", data: random.pick(["é", "雪", "ECI"]) }
      ];
    case 2:
      return [
        { mode: "kanji", data: random.pick(["漢字", "日本語", "茗荷"]) }
      ];
    case 3: {
      const payload = random.bytes(5);
      const backing = Uint8Array.from([0xA5, ...payload, 0x5A]);
      return [
        { mode: "byte", data: new DataView(backing.buffer, 1, payload.length) }
      ];
    }
    case 4:
      return [
        { mode: "fnc1-second", applicationIndicator: "37" },
        { mode: "alphanumeric", data: "AA1234BBB112" }
      ];
    default:
      return [
        { mode: "structured-append", index: 2, total: 5, parity: 0xA7 },
        { mode: "alphanumeric", data: "HELLO" }
      ];
  }
}

function createEquivalentSingleSegment(random, index) {
  switch (index % 5) {
    case 0:
      return {
        mode: "numeric",
        input: randomText(random, "0123456789", random.int(1, 14))
      };
    case 1:
      return {
        mode: "alphanumeric",
        input: randomText(random, ALPHANUMERIC_CHARACTERS, random.int(1, 12))
      };
    case 2:
      return { mode: "byte", input: random.pick(["é", "雪", "byte"]) };
    case 3: {
      const payload = random.bytes(random.int(2, 8));
      const backing = Uint8Array.from([0xA5, ...payload, 0x5A]);
      return {
        mode: "byte",
        input: new DataView(backing.buffer, 1, payload.length)
      };
    }
    default:
      return { mode: "kanji", input: random.pick(["漢字", "日本語", "茗荷"]) };
  }
}

function assertPlanningMatchesGenerated(planned, diagnostics) {
  assert.equal(planned.ok, true);
  assert.equal(planned.selectedVersion, diagnostics.version);
  assert.equal(planned.diagnostics.version, diagnostics.version);
  assert.equal(planned.diagnostics.size, diagnostics.size);
  assert.equal(planned.errorCorrectionLevel, diagnostics.errorCorrectionLevel);
  assert.equal(planned.requestedErrorCorrectionLevel, diagnostics.requestedErrorCorrectionLevel);
  assert.equal(planned.boostedErrorCorrection, diagnostics.boostedErrorCorrection);
  assert.equal(planned.versionSelection, diagnostics.versionSelection);
  assert.equal(planned.versionSelectionReason, diagnostics.versionSelectionReason);
  assert.equal(planned.mode, diagnostics.mode);
  assert.deepEqual(planned.controlSegments, diagnostics.controlSegments);
  assert.equal(planned.diagnostics.eciAssignmentNumber, diagnostics.eciAssignmentNumber);
  assert.equal(planned.diagnostics.fnc1, diagnostics.fnc1);
  assert.deepEqual(planned.diagnostics.fnc1Second, diagnostics.fnc1Second);
  assert.deepEqual(planned.diagnostics.structuredAppend, diagnostics.structuredAppend);
  assert.equal(planned.diagnostics.gs1, diagnostics.gs1);
  assert.deepEqual(planned.diagnostics.gs1Validation, diagnostics.gs1Validation);
  assert.deepEqual(planned.segments, diagnostics.segments);
  assert.equal(planned.dataBitLength, diagnostics.dataBitLength);
  assert.equal(planned.capacityBits, diagnostics.capacityBits);
  assert.equal(planned.remainingBits, diagnostics.remainingBits);
  assert.equal(planned.usageRatio, diagnostics.capacityUtilization);
  assert.equal(planned.capacityUtilization, diagnostics.capacityUtilization);
  assert.equal(planned.inputBytes, diagnostics.inputBytes);
  assert.deepEqual(planned.diagnostics.quietZone, diagnostics.quietZone);
  assert.deepEqual(planned.diagnostics.colors, diagnostics.colors);
  assert.deepEqual(planned.diagnostics.print, diagnostics.print);
  assert.deepEqual(planned.warnings, diagnostics.warnings);
}

function describeSegment(segment) {
  const description = { mode: segment.mode };
  for (const key of [
    "assignmentNumber",
    "applicationIndicator",
    "index",
    "total",
    "parity"
  ]) {
    if (Object.hasOwn(segment, key)) {
      description[key] = segment[key];
    }
  }
  if (Object.hasOwn(segment, "data")) {
    description.data = describeInput(segment.data);
  }
  return description;
}

function randomText(random, alphabet, length) {
  return Array.from({ length }, () => alphabet[random.int(0, alphabet.length - 1)]).join("");
}

function toByteArray(input) {
  if (input instanceof Uint8Array) {
    return Array.from(input);
  }
  if (input instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(input));
  }
  return Array.from(new Uint8Array(input.buffer, input.byteOffset, input.byteLength));
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = random.int(0, index);
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}
