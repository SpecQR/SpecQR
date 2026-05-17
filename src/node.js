import { writeFile } from "node:fs/promises";
import { generate, generateSegments } from "./index.js";

export function toPngBuffer(input, options = {}) {
  return Buffer.from(generate(input, {
    ...options,
    output: "png",
    diagnostics: false
  }));
}

export function toPngBufferFromSegments(segments, options = {}) {
  return Buffer.from(generateSegments(segments, {
    ...options,
    output: "png",
    diagnostics: false
  }));
}

export async function writePngFile(filePath, input, options = {}) {
  await writeFile(filePath, toPngBuffer(input, options));
}

export async function writePngFileFromSegments(filePath, segments, options = {}) {
  await writeFile(filePath, toPngBufferFromSegments(segments, options));
}
