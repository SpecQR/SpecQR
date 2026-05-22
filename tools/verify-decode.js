import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QRCode } from "../src/index.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixturesPath = path.join(root, "fixtures", "decode-cases.json");
const outputDir = path.join(root, "tmp", "verify-decode");
const decoderPath = path.join(root, "tools", "decode-vision.swift");
const swiftModuleCacheDir = path.join(outputDir, "swift-module-cache");

const cases = JSON.parse(readFileSync(fixturesPath, "utf8"));

if (!existsSync(decoderPath)) {
  throw new Error(`Missing Vision decoder script: ${decoderPath}`);
}

mkdirSync(outputDir, { recursive: true });
mkdirSync(swiftModuleCacheDir, { recursive: true });

const swiftEnv = {
  ...process.env,
  CLANG_MODULE_CACHE_PATH: swiftModuleCacheDir,
  SWIFT_MODULE_CACHE_PATH: swiftModuleCacheDir
};

let passed = 0;

for (const testCase of cases) {
  const svgPath = path.join(outputDir, `${testCase.id}.svg`);
  const svgPngPath = path.join(outputDir, `${testCase.id}.from-svg.png`);
  const pngPath = path.join(outputDir, `${testCase.id}.png`);
  const expected = testCase.expected ?? testCase.text;
  const svg = generateFixture(testCase, {
    ...testCase.options,
    output: "svg",
    scale: 12,
    margin: 4
  });

  writeFileSync(svgPath, svg);
  execFileSync("magick", [svgPath, svgPngPath], { encoding: "utf8" });
  const decodedFromSvg = execFileSync("swift", [decoderPath, svgPngPath], { encoding: "utf8", env: swiftEnv }).trim();
  const png = generateFixture(testCase, {
    ...testCase.options,
    output: "png",
    scale: 12,
    margin: 4
  });
  writeFileSync(pngPath, png);
  const decodedFromPng = execFileSync("swift", [decoderPath, pngPath], { encoding: "utf8", env: swiftEnv }).trim();

  if (decodedFromSvg !== expected) {
    throw new Error(
      `SVG decode mismatch for ${testCase.id}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(decodedFromSvg)}`
    );
  }

  if (decodedFromPng !== expected) {
    throw new Error(
      `PNG decode mismatch for ${testCase.id}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(decodedFromPng)}`
    );
  }

  passed += 1;
  console.log(`ok ${testCase.id}`);
}

console.log(`Decoded ${passed}/${cases.length} QR fixtures successfully.`);

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
