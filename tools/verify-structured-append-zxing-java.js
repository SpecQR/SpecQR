import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  generateSegmentsStructuredAppend,
  generateStructuredAppend
} from "../src/index.js";

const classpath = process.env.ZXING_CLASSPATH?.trim();
const javaCommand = process.env.JAVA?.trim() || "java";
const javacCommand = process.env.JAVAC?.trim() || "javac";

class SkipValidation extends Error {
  constructor(message) {
    super(message);
    this.name = "SkipValidation";
  }
}

let directory;

try {
  if (!classpath) {
    skip("set ZXING_CLASSPATH to a ZXing Java core jar/classes path");
  }

  if (!commandWorks(javaCommand, ["-version"])) {
    skip(`Java runtime command is unavailable: ${javaCommand}`);
  }

  if (!commandWorks(javacCommand, ["-version"])) {
    skip(`Java compiler command is unavailable: ${javacCommand}`);
  }

  directory = await mkdtemp(path.join(tmpdir(), "specqr-zxing-sa-"));
  const sourceDirectory = path.join(directory, "src");
  const classDirectory = path.join(directory, "classes");
  const imageDirectory = path.join(directory, "images");

  await mkdir(sourceDirectory);
  await mkdir(classDirectory);
  await mkdir(imageDirectory);

  const helperSource = path.join(sourceDirectory, "SpecQrStructuredAppendDecoder.java");
  await writeFile(helperSource, JAVA_HELPER_SOURCE);
  const compile = run(javacCommand, ["-cp", classpath, "-d", classDirectory, helperSource], {
    allowUnsupported: true
  });

  if (compile.unsupported) {
    skip(`ZXing Java classpath is unavailable or does not expose Structured Append metadata: ${compile.reason}`);
  }

  const fixtures = await createFixtures(imageDirectory);
  const runClasspath = [classDirectory, classpath].join(path.delimiter);
  const output = run(javaCommand, ["-cp", runClasspath, "SpecQrStructuredAppendDecoder", ...fixtures.map((fixture) => fixture.path)]);
  const decoded = output.stdout
    .trim()
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  assert.equal(decoded.length, fixtures.length);

  let missingMetadata = 0;

  for (const [index, actual] of decoded.entries()) {
    const expected = fixtures[index];
    assert.equal(actual.path, expected.path);
    assert.equal(actual.text, expected.expectedPayload, `${expected.id} decoded payload mismatch`);

    if (actual.sequence === null || actual.parity === null) {
      missingMetadata += 1;
      continue;
    }

    const parsed = parseSequenceIndicator(actual.sequence);
    assert.equal(actual.sequence, expected.sequenceIndicator, `${expected.id} sequence indicator mismatch`);
    assert.equal(parsed.index, expected.index, `${expected.id} decoded sequence index mismatch`);
    assert.equal(parsed.total, expected.total, `${expected.id} decoded sequence total mismatch`);
    assert.equal(actual.parity, expected.parity, `${expected.id} parity mismatch`);
    assert.deepEqual(expected.structuredAppend, expected.summaryStructuredAppend, `${expected.id} diagnostics structuredAppend mismatch`);
  }

  if (missingMetadata > 0) {
    skip(`ZXing Java decoded ${decoded.length} symbols but did not expose Structured Append metadata for ${missingMetadata} symbol(s)`);
  }

  const caseSummaries = summarizeCases(fixtures);
  console.log(`ok ZXing Java Structured Append metadata: ${decoded.length} symbols across ${caseSummaries.length} cases`);
  for (const summary of caseSummaries) {
    console.log(`ok ${summary.id}: total=${summary.total} parity=0x${hexByte(summary.parity)} payloads=${summary.payloads.join("|")}`);
  }
} catch (error) {
  if (error instanceof SkipValidation) {
    console.log(`skip ZXing Java Structured Append metadata validation: ${error.message}`);
  } else {
    throw error;
  }
} finally {
  if (directory) {
    await rm(directory, { recursive: true, force: true });
  }
}

async function createFixtures(outputDirectory) {
  const fixtures = [];

  for (const testCase of createCaseDefinitions()) {
    const diagnosticsSet = testCase.generate({
      output: "matrix",
      diagnostics: true
    });
    const pngSet = testCase.generate({
      output: "png"
    });
    const expectedPayloads = testCase.expectedPayloads(diagnosticsSet);

    assert.equal(diagnosticsSet.total, pngSet.total);
    assert.equal(expectedPayloads.length, diagnosticsSet.total, `${testCase.id} expected payload count mismatch`);

    for (const [index, png] of pngSet.symbols.entries()) {
      const symbol = diagnosticsSet.symbols[index].diagnostics.structuredAppend;
      const summary = diagnosticsSet.diagnostics.symbols[index];
      const imagePath = path.join(outputDirectory, `${testCase.id}-${index + 1}.png`);
      await writeFile(imagePath, Buffer.from(png));

      fixtures.push({
        id: `${testCase.id}-${index + 1}`,
        caseId: testCase.id,
        path: imagePath,
        expectedPayload: expectedPayloads[index],
        index: symbol.index,
        total: symbol.total,
        parity: symbol.parity,
        sequenceIndicator: symbol.sequenceIndicator,
        structuredAppend: symbol,
        summaryStructuredAppend: {
          enabled: true,
          index: summary.index,
          total: summary.total,
          parity: summary.parity,
          sequenceIndex: summary.sequenceIndex,
          sequenceTotal: summary.sequenceTotal,
          sequenceIndicator: summary.sequenceIndicator
        }
      });
    }
  }

  return fixtures;
}

function createCaseDefinitions() {
  const asciiBinaryText = "BINARY-INPUT-STRUCTURED-APPEND-123";
  const asciiBinaryInput = new TextEncoder().encode(asciiBinaryText);
  const boundarySegments = [
    { mode: "alphanumeric", data: "ABCDEFGHIJKLMNOPQRSTU" },
    { mode: "numeric", data: "12345678901234567890" },
    { mode: "byte", data: "XYZ" }
  ];
  const byteChunkText = "C".repeat(31);
  const byteChunkSegments = [
    { mode: "byte", data: byteChunkText }
  ];

  return [
    structuredAppendInputCase({
      id: "generate-structured-append-string-2-symbol",
      input: "A".repeat(31),
      options: {
        version: 1,
        errorCorrectionLevel: "L",
        mode: "alphanumeric",
        maxSymbols: 2,
        scale: 12,
        margin: 4
      },
      expectedPayloads: stringPayloads("A".repeat(31))
    }),
    structuredAppendInputCase({
      id: "generate-structured-append-string-3-symbol",
      input: "B".repeat(43),
      options: {
        version: 1,
        errorCorrectionLevel: "L",
        mode: "alphanumeric",
        maxSymbols: 3,
        scale: 12,
        margin: 4
      },
      expectedPayloads: stringPayloads("B".repeat(43))
    }),
    structuredAppendInputCase({
      id: "generate-structured-append-binary-input",
      input: asciiBinaryInput,
      options: {
        version: 1,
        errorCorrectionLevel: "L",
        mode: "byte",
        maxSymbols: 3,
        scale: 12,
        margin: 4
      },
      expectedPayloads: binaryPayloads(asciiBinaryInput)
    }),
    structuredAppendSegmentsCase({
      id: "generate-segments-structured-append-segment-boundary",
      segments: boundarySegments,
      options: {
        version: 1,
        errorCorrectionLevel: "L",
        scale: 12,
        margin: 4
      },
      expectedPayloads: () => [
        "ABCDEFGHIJKLMNOPQRSTU",
        "12345678901234567890XYZ"
      ]
    }),
    structuredAppendSegmentsCase({
      id: "generate-segments-structured-append-byte-chunk",
      segments: byteChunkSegments,
      options: {
        version: 1,
        errorCorrectionLevel: "L",
        scale: 12,
        margin: 4
      },
      expectedPayloads: () => [
        byteChunkText.slice(0, 15),
        byteChunkText.slice(15, 30),
        byteChunkText.slice(30)
      ]
    }),
    structuredAppendInputCase({
      id: "generate-structured-append-fixed-version-ecc-mask",
      input: "D".repeat(52),
      options: {
        version: 2,
        errorCorrectionLevel: "Q",
        maskPattern: 3,
        mode: "alphanumeric",
        maxSymbols: 2,
        scale: 12,
        margin: 4
      },
      expectedPayloads: stringPayloads("D".repeat(52))
    })
  ];
}

function structuredAppendInputCase({ id, input, options, expectedPayloads }) {
  return {
    id,
    generate(renderOptions) {
      return generateStructuredAppend(input, {
        ...options,
        ...renderOptions
      });
    },
    expectedPayloads
  };
}

function structuredAppendSegmentsCase({ id, segments, options, expectedPayloads }) {
  return {
    id,
    generate(renderOptions) {
      return generateSegmentsStructuredAppend(segments, {
        ...options,
        ...renderOptions
      });
    },
    expectedPayloads
  };
}

function stringPayloads(input) {
  return (diagnosticsSet) => diagnosticsSet.diagnostics.symbols.map((symbol) =>
    input.slice(symbol.inputStart, symbol.inputStart + symbol.inputLength)
  );
}

function binaryPayloads(bytes) {
  const decoder = new TextDecoder();
  return (diagnosticsSet) => diagnosticsSet.diagnostics.symbols.map((symbol) =>
    decoder.decode(bytes.subarray(symbol.byteStart, symbol.byteStart + symbol.byteLength))
  );
}

function commandWorks(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  return !result.error && result.status === 0;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const message = [
      `${command} ${args.join(" ")} failed with exit code ${result.status}`,
      result.stdout,
      result.stderr
    ].filter(Boolean).join("\n");

    if (options.allowUnsupported && looksLikeUnsupportedZxingClasspath(message)) {
      return {
        stdout: result.stdout ?? "",
        stderr: result.stderr ?? "",
        unsupported: true,
        reason: summarizeUnsupportedClasspath(message)
      };
    }

    throw new Error(message);
  }

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    unsupported: false
  };
}

function looksLikeUnsupportedZxingClasspath(message) {
  return /package com\.google\.zxing does not exist/u.test(message)
    || /cannot find symbol[\s\S]*(STRUCTURED_APPEND_SEQUENCE|STRUCTURED_APPEND_PARITY|ResultMetadataType)/u.test(message);
}

function summarizeUnsupportedClasspath(message) {
  if (/package com\.google\.zxing does not exist/u.test(message)) {
    return "ZXING_CLASSPATH does not contain ZXing Java core classes";
  }
  return "ZXing Java core classes are present but Structured Append metadata symbols are unavailable";
}

function parseSequenceIndicator(value) {
  assert.equal(Number.isInteger(value), true);
  assert.equal(value >= 0 && value <= 0xff, true);
  return {
    index: (value >> 4) + 1,
    total: (value & 0x0f) + 1
  };
}

function summarizeCases(fixtures) {
  const groups = new Map();
  for (const fixture of fixtures) {
    if (!groups.has(fixture.caseId)) {
      groups.set(fixture.caseId, {
        id: fixture.caseId,
        total: fixture.total,
        parity: fixture.parity,
        payloads: []
      });
    }
    groups.get(fixture.caseId).payloads.push(fixture.expectedPayload);
  }
  return Array.from(groups.values());
}

function hexByte(value) {
  return value.toString(16).padStart(2, "0");
}

function skip(reason) {
  throw new SkipValidation(reason);
}

const JAVA_HELPER_SOURCE = String.raw`
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.LuminanceSource;
import com.google.zxing.Result;
import com.google.zxing.ResultMetadataType;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;

import java.awt.image.BufferedImage;
import java.io.File;
import java.util.EnumMap;
import java.util.Map;
import javax.imageio.ImageIO;

public final class SpecQrStructuredAppendDecoder {
  public static void main(String[] args) throws Exception {
    QRCodeReader reader = new QRCodeReader();
    Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
    hints.put(DecodeHintType.PURE_BARCODE, Boolean.TRUE);

    for (String path : args) {
      BufferedImage image = ImageIO.read(new File(path));
      if (image == null) {
        throw new IllegalArgumentException("Could not read image: " + path);
      }

      BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(image)));
      Result result = reader.decode(bitmap, hints);
      Map<ResultMetadataType, Object> metadata = result.getResultMetadata();
      Integer sequence = getInteger(metadata, ResultMetadataType.STRUCTURED_APPEND_SEQUENCE);
      Integer parity = getInteger(metadata, ResultMetadataType.STRUCTURED_APPEND_PARITY);

      System.out.println("{"
        + "\"path\":" + jsonString(path) + ","
        + "\"text\":" + jsonString(result.getText()) + ","
        + "\"sequence\":" + jsonNullableInteger(sequence) + ","
        + "\"parity\":" + jsonNullableInteger(parity)
        + "}");
    }
  }

  private static Integer getInteger(Map<ResultMetadataType, Object> metadata, ResultMetadataType key) {
    if (metadata == null) {
      return null;
    }
    Object value = metadata.get(key);
    if (value instanceof Integer) {
      return (Integer) value;
    }
    return null;
  }

  private static String jsonNullableInteger(Integer value) {
    return value == null ? "null" : value.toString();
  }

  private static String jsonString(String value) {
    StringBuilder builder = new StringBuilder();
    builder.append('"');
    for (int index = 0; index < value.length(); index += 1) {
      char ch = value.charAt(index);
      switch (ch) {
        case '"':
          builder.append("\\\"");
          break;
        case '\\':
          builder.append("\\\\");
          break;
        case '\b':
          builder.append("\\b");
          break;
        case '\f':
          builder.append("\\f");
          break;
        case '\n':
          builder.append("\\n");
          break;
        case '\r':
          builder.append("\\r");
          break;
        case '\t':
          builder.append("\\t");
          break;
        default:
          if (ch < 0x20) {
            builder.append(String.format("\\u%04x", (int) ch));
          } else {
            builder.append(ch);
          }
      }
    }
    builder.append('"');
    return builder.toString();
  }

  private static final class BufferedImageLuminanceSource extends LuminanceSource {
    private final byte[] luminances;

    BufferedImageLuminanceSource(BufferedImage image) {
      super(image.getWidth(), image.getHeight());
      int width = image.getWidth();
      int height = image.getHeight();
      luminances = new byte[width * height];

      for (int y = 0; y < height; y += 1) {
        for (int x = 0; x < width; x += 1) {
          int argb = image.getRGB(x, y);
          int alpha = (argb >>> 24) & 0xff;
          int red = (argb >>> 16) & 0xff;
          int green = (argb >>> 8) & 0xff;
          int blue = argb & 0xff;

          if (alpha < 255) {
            red = ((red * alpha) + (255 * (255 - alpha))) / 255;
            green = ((green * alpha) + (255 * (255 - alpha))) / 255;
            blue = ((blue * alpha) + (255 * (255 - alpha))) / 255;
          }

          luminances[(y * width) + x] = (byte) ((red + (green * 2) + blue) / 4);
        }
      }
    }

    @Override
    public byte[] getRow(int y, byte[] row) {
      int width = getWidth();
      if (row == null || row.length < width) {
        row = new byte[width];
      }
      System.arraycopy(luminances, y * width, row, 0, width);
      return row;
    }

    @Override
    public byte[] getMatrix() {
      return luminances;
    }
  }
}
`;
