import { generate, generateSegments } from "./index.js";
import { InvalidInputError } from "./errors.js";
import { normalizeOptions } from "./options.js";
import { parseRgbaColor } from "./render/color.js";

export function toBlob(input, options = {}) {
  assertBlobSupport();
  const png = generate(input, {
    ...options,
    output: "png",
    diagnostics: false
  });
  return new Blob([png], { type: "image/png" });
}

export function toBlobFromSegments(segments, options = {}) {
  assertBlobSupport();
  const png = generateSegments(segments, {
    ...options,
    output: "png",
    diagnostics: false
  });
  return new Blob([png], { type: "image/png" });
}

export function toObjectURL(input, options = {}) {
  assertObjectUrlSupport();
  return URL.createObjectURL(toBlob(input, options));
}

export function toObjectURLFromSegments(segments, options = {}) {
  assertObjectUrlSupport();
  return URL.createObjectURL(toBlobFromSegments(segments, options));
}

export function toImageData(input, options = {}) {
  const normalized = normalizeOptions({
    ...options,
    output: "matrix",
    diagnostics: false
  });
  const matrix = generate(input, normalized);
  return matrixToImageData(matrix, normalized);
}

export function toImageDataFromSegments(segments, options = {}) {
  const normalized = normalizeOptions({
    ...options,
    output: "matrix",
    diagnostics: false
  });
  const matrix = generateSegments(segments, normalized);
  return matrixToImageData(matrix, normalized);
}

function matrixToImageData(matrix, options) {
  if (typeof ImageData !== "function") {
    throw new InvalidInputError("ImageData is not available in this environment");
  }

  const size = matrix.length;
  const dimension = (size + options.margin * 2) * options.scale;
  const foreground = parseRgbaColor(options.foreground, "foreground", true);
  const background = parseRgbaColor(options.background, "background", true);
  const data = new Uint8ClampedArray(dimension * dimension * 4);

  for (let y = 0; y < dimension; y += 1) {
    const moduleY = Math.floor(y / options.scale) - options.margin;
    for (let x = 0; x < dimension; x += 1) {
      const moduleX = Math.floor(x / options.scale) - options.margin;
      const dark =
        moduleX >= 0 &&
        moduleY >= 0 &&
        moduleX < size &&
        moduleY < size &&
        matrix[moduleY][moduleX];
      const color = dark ? foreground : background;
      const offset = (y * dimension + x) * 4;
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = color[3];
    }
  }

  return new ImageData(data, dimension, dimension);
}

function assertBlobSupport() {
  if (typeof Blob !== "function") {
    throw new InvalidInputError("Blob is not available in this environment");
  }
}

function assertObjectUrlSupport() {
  if (typeof URL !== "function" || typeof URL.createObjectURL !== "function") {
    throw new InvalidInputError("URL.createObjectURL is not available in this environment");
  }
}
