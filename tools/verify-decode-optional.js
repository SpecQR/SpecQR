import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { QRCode } from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesPath = path.join(root, "fixtures", "decode-cases.json");
const outputDir = path.join(root, "tmp", "verify-decode-optional");
const args = new Set(process.argv.slice(2));
const onlyJsQr = args.has("--only-jsqr");
const requireJsQr = args.has("--require-jsqr");

const cases = JSON.parse(readFileSync(fixturesPath, "utf8"));
mkdirSync(outputDir, { recursive: true });

const jsQrDecoder = await createJsQrDecoder();
const decoders = onlyJsQr
  ? [jsQrDecoder]
  : [
      jsQrDecoder,
      createZbarDecoder(),
      createZxingCliDecoder()
    ];

const runnableDecoders = [];

for (const decoder of decoders) {
  if (!decoder.available) {
    if (requireJsQr && decoder.name === "jsQR") {
      throw new Error(`jsQR decode validation is required but unavailable: ${decoder.reason}`);
    }
    console.log(`skip ${decoder.name}: ${decoder.reason}`);
    continue;
  }
  runnableDecoders.push(decoder);
}

if (runnableDecoders.length === 0) {
  console.log("skip optional decode validation: no optional decoders are available");
} else {
  const artifacts = prepareArtifacts(cases);
  let totalPassed = 0;

  for (const decoder of runnableDecoders) {
    let passed = 0;
    for (const artifact of artifacts) {
      const decoded = decoder.decode(artifact.path).trim();
      if (decoded !== artifact.expected) {
        throw new Error(
          `${decoder.name} mismatch for ${artifact.caseId} ${artifact.kind}: expected ${JSON.stringify(artifact.expected)}, got ${JSON.stringify(decoded)}`
        );
      }
      passed += 1;
    }

    totalPassed += passed;
    console.log(`ok ${decoder.name}: decoded ${passed}/${artifacts.length} artifacts`);
  }

  console.log(`Optional decode validation passed with ${runnableDecoders.length} decoder(s), ${totalPassed} artifact checks.`);
}

function prepareArtifacts(testCases) {
  const magickPath = findCommand("magick");
  const result = [];

  for (const testCase of testCases) {
    const expected = testCase.expected ?? testCase.text;
    const svgPath = path.join(outputDir, `${testCase.id}.svg`);
    const svgPngPath = path.join(outputDir, `${testCase.id}.from-svg.png`);
    const pngPath = path.join(outputDir, `${testCase.id}.png`);

    const png = generateFixture(testCase, {
      ...testCase.options,
      output: "png",
      scale: 12,
      margin: 4
    });
    writeFileSync(pngPath, png);
    result.push({
      caseId: testCase.id,
      kind: "png",
      path: pngPath,
      expected
    });

    if (magickPath) {
      const svg = generateFixture(testCase, {
        ...testCase.options,
        output: "svg",
        scale: 12,
        margin: 4
      });
      writeFileSync(svgPath, svg);
      execFileSync(magickPath, [svgPath, `PNG32:${svgPngPath}`], { encoding: "utf8" });
      result.push({
        caseId: testCase.id,
        kind: "svg-rendered-png",
        path: svgPngPath,
        expected
      });
    }
  }

  if (!magickPath) {
    console.log("skip svg-rendered artifacts: ImageMagick 'magick' is not available");
  }

  return result;
}

async function createJsQrDecoder() {
  let module;
  try {
    module = await import("jsqr");
  } catch {
    return {
      name: "jsQR",
      available: false,
      reason: "package 'jsqr' is not installed"
    };
  }

  const jsQR = module.default ?? module.jsQR ?? module;
  if (typeof jsQR !== "function") {
    return {
      name: "jsQR",
      available: false,
      reason: "package 'jsqr' did not export a decoder function"
    };
  }

  return {
    name: "jsQR",
    available: true,
    decode(filePath) {
      const image = readPngRgba(readFileSync(filePath));
      const decoded = jsQR(image.data, image.width, image.height, {
        inversionAttempts: "dontInvert"
      });
      if (!decoded) {
        throw new Error(`jsQR could not decode ${filePath}`);
      }
      return decoded.data;
    }
  };
}

function createZbarDecoder() {
  const command = findCommand("zbarimg");
  if (!command) {
    return {
      name: "zbarimg",
      available: false,
      reason: "command 'zbarimg' is not installed"
    };
  }

  return {
    name: "zbarimg",
    available: true,
    decode(filePath) {
      return execFileSync(command, ["--quiet", "--raw", filePath], { encoding: "utf8" });
    }
  };
}

function createZxingCliDecoder() {
  const candidates = [
    { name: "ZXingReader", args: (filePath) => [filePath] },
    { name: "zxing", args: (filePath) => [filePath] },
    { name: "zxing-cpp", args: (filePath) => [filePath] },
    { name: "zxingscan", args: (filePath) => [filePath] }
  ];

  for (const candidate of candidates) {
    const command = findCommand(candidate.name);
    if (command) {
      return {
        name: candidate.name,
        available: true,
        decode(filePath) {
          return extractCliPayload(execFileSync(command, candidate.args(filePath), { encoding: "utf8" }));
        }
      };
    }
  }

  return {
    name: "ZXing CLI",
    available: false,
    reason: `none of ${candidates.map((candidate) => candidate.name).join(", ")} are installed`
  };
}

function extractCliPayload(output) {
  const lines = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return "";
  }

  for (const line of lines) {
    const match = /(?:text|content|raw text|result)\s*[:=]\s*(.+)$/iu.exec(line);
    if (match) {
      return match[1];
    }
  }

  return lines.at(-1);
}

function readPngRgba(bytes) {
  assertPngSignature(bytes);
  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatParts = [];

  while (offset < bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const dataStart = offset + 8;
    const data = bytes.subarray(dataStart, dataStart + length);

    if (type === "IHDR") {
      width = readUint32(data, 0);
      height = readUint32(data, 4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idatParts.push(data);
    } else if (type === "IEND") {
      break;
    }

    offset = dataStart + length + 4;
  }

  if (bitDepth !== 8 || interlace !== 0 || ![0, 2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format for optional jsQR validation: bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`);
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const inflated = inflateSync(concatBytes(idatParts));
  const scanlineLength = width * channels;
  const rgba = new Uint8ClampedArray(width * height * 4);
  let inputOffset = 0;
  let previous = new Uint8Array(scanlineLength);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[inputOffset];
    inputOffset += 1;
    const row = Uint8Array.from(inflated.subarray(inputOffset, inputOffset + scanlineLength));
    inputOffset += scanlineLength;
    unfilter(row, previous, filter, channels);
    writeRgbaRow(rgba, row, y, width, channels);
    previous = row;
  }

  return { width, height, data: rgba };
}

function unfilter(row, previous, filter, bytesPerPixel) {
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const up = previous[index] ?? 0;
    const upLeft = index >= bytesPerPixel ? previous[index - bytesPerPixel] : 0;

    switch (filter) {
      case 0:
        break;
      case 1:
        row[index] = (row[index] + left) & 0xFF;
        break;
      case 2:
        row[index] = (row[index] + up) & 0xFF;
        break;
      case 3:
        row[index] = (row[index] + Math.floor((left + up) / 2)) & 0xFF;
        break;
      case 4:
        row[index] = (row[index] + paethPredictor(left, up, upLeft)) & 0xFF;
        break;
      default:
        throw new Error(`Unsupported PNG filter type: ${filter}`);
    }
  }
}

function writeRgbaRow(target, row, y, width, channels) {
  for (let x = 0; x < width; x += 1) {
    const source = x * channels;
    const destination = (y * width + x) * 4;
    if (channels === 4) {
      target[destination] = row[source];
      target[destination + 1] = row[source + 1];
      target[destination + 2] = row[source + 2];
      target[destination + 3] = row[source + 3];
    } else if (channels === 3) {
      target[destination] = row[source];
      target[destination + 1] = row[source + 1];
      target[destination + 2] = row[source + 2];
      target[destination + 3] = 255;
    } else {
      target[destination] = row[source];
      target[destination + 1] = row[source];
      target[destination + 2] = row[source];
      target[destination + 3] = 255;
    }
  }
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }
  if (upDistance <= upLeftDistance) {
    return up;
  }
  return upLeft;
}

function generateFixture(testCase, options) {
  if (testCase.segments) {
    return QRCode.generateSegments(testCase.segments, options);
  }
  if (testCase.binaryHex) {
    return QRCode.generate(hexToBytes(testCase.binaryHex), options);
  }
  return QRCode.generate(testCase.text, options);
}

function hexToBytes(hex) {
  if (hex.length % 2 !== 0) {
    throw new Error(`Invalid hex payload length for fixture: ${hex}`);
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function findCommand(name) {
  const result = spawnSync("which", [name], {
    encoding: "utf8"
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

function concatBytes(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function assertPngSignature(bytes) {
  const signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  for (let index = 0; index < signature.length; index += 1) {
    if (bytes[index] !== signature[index]) {
      throw new Error("Invalid PNG signature");
    }
  }
}

function readUint32(bytes, offset) {
  return (
    (bytes[offset] << 24) |
    (bytes[offset + 1] << 16) |
    (bytes[offset + 2] << 8) |
    bytes[offset + 3]
  ) >>> 0;
}
