import { InvalidInputError } from "../errors.js";

export const RENDER_BUDGETS = Object.freeze({
  rasterPixels: 4 * 1024 * 1024,
  rgbaBytes: 16 * 1024 * 1024,
  pngRawBytes: 17 * 1024 * 1024,
  pngStreamBytes: 18 * 1024 * 1024,
  svgCharacters: 8 * 1024 * 1024,
  dataUrlCharacters: 32 * 1024 * 1024
});

const PNG_DATA_URL_PREFIX_LENGTH = "data:image/png;base64,".length;
const SVG_DATA_URL_PREFIX_LENGTH = "data:image/svg+xml;charset=utf-8,".length;
const PNG_CONTAINER_BYTES = 57;
const ZLIB_HEADER_AND_CHECKSUM_BYTES = 6;
const STORED_DEFLATE_BLOCK_BYTES = 5;
const MAX_STORED_DEFLATE_BLOCK_DATA = 0xFFFF;

export function getRasterGeometry(matrix, options, output) {
  const base = getBaseGeometry(matrix, options, output);
  const pixelCount = checkedMultiply(base.dimension, base.dimension, "pixelCount", output);
  assertBudget(pixelCount, RENDER_BUDGETS.rasterPixels, "pixelCount", output);

  const rgbaRowBytes = checkedMultiply(base.dimension, 4, "rgbaRowBytes", output);
  const rgbaBytes = checkedMultiply(pixelCount, 4, "rgbaBytes", output);
  assertBudget(rgbaBytes, RENDER_BUDGETS.rgbaBytes, "rgbaBytes", output);

  const pngRowBytes = checkedAdd(rgbaRowBytes, 1, "pngRowBytes", output);
  const pngRawBytes = checkedMultiply(pngRowBytes, base.dimension, "pngRawBytes", output);
  assertBudget(pngRawBytes, RENDER_BUDGETS.pngRawBytes, "pngRawBytes", output);

  const deflateBlocks = Math.ceil(pngRawBytes / MAX_STORED_DEFLATE_BLOCK_DATA);
  const deflateOverhead = checkedMultiply(
    deflateBlocks,
    STORED_DEFLATE_BLOCK_BYTES,
    "pngDeflateOverhead",
    output
  );
  const pngStreamBytes = checkedAdd(
    checkedAdd(pngRawBytes, deflateOverhead, "pngStreamBytes", output),
    ZLIB_HEADER_AND_CHECKSUM_BYTES,
    "pngStreamBytes",
    output
  );
  assertBudget(pngStreamBytes, RENDER_BUDGETS.pngStreamBytes, "pngStreamBytes", output);

  const pngBytes = checkedAdd(pngStreamBytes, PNG_CONTAINER_BYTES, "pngBytes", output);
  if (output === "png-data-url") {
    const base64Characters = checkedMultiply(
      Math.ceil(pngBytes / 3),
      4,
      "dataUrlCharacters",
      output
    );
    const dataUrlCharacters = checkedAdd(
      PNG_DATA_URL_PREFIX_LENGTH,
      base64Characters,
      "dataUrlCharacters",
      output
    );
    assertBudget(
      dataUrlCharacters,
      RENDER_BUDGETS.dataUrlCharacters,
      "dataUrlCharacters",
      output
    );
  }

  return {
    ...base,
    pixelCount,
    rgbaRowBytes,
    rgbaBytes,
    pngRowBytes,
    pngRawBytes,
    pngStreamBytes,
    pngBytes
  };
}

export function getSvgGeometry(matrix, options, output) {
  const base = getBaseGeometry(matrix, options, output);
  const coordinateDigits = decimalLength(base.dimension);
  const scaleDigits = decimalLength(options.scale);
  const pathCharactersPerModule = checkedAdd(
    7,
    checkedAdd(
      checkedMultiply(coordinateDigits, 2, "svgPathCharacters", output),
      checkedMultiply(scaleDigits, 3, "svgPathCharacters", output),
      "svgPathCharacters",
      output
    ),
    "svgPathCharacters",
    output
  );
  const darkModules = countDarkModules(matrix);
  const pathCharacters = checkedMultiply(
    darkModules,
    pathCharactersPerModule,
    "svgPathCharacters",
    output
  );
  const fixedCharacters = 512 +
    String(options.foreground).length * 6 +
    String(options.background).length * 6 +
    coordinateDigits * 4;
  const svgCharacters = checkedAdd(
    pathCharacters,
    fixedCharacters,
    "svgCharacters",
    output
  );
  assertBudget(svgCharacters, RENDER_BUDGETS.svgCharacters, "svgCharacters", output);

  if (output === "svg-data-url") {
    const encodedCharacters = checkedMultiply(
      svgCharacters,
      3,
      "dataUrlCharacters",
      output
    );
    const dataUrlCharacters = checkedAdd(
      SVG_DATA_URL_PREFIX_LENGTH,
      encodedCharacters,
      "dataUrlCharacters",
      output
    );
    assertBudget(
      dataUrlCharacters,
      RENDER_BUDGETS.dataUrlCharacters,
      "dataUrlCharacters",
      output
    );
  }

  return {
    ...base,
    darkModules,
    svgCharacters
  };
}

function getBaseGeometry(matrix, options, output) {
  const matrixSize = matrix.length;
  const doubleMargin = checkedMultiply(options.margin, 2, "moduleSpan", output);
  const moduleSpan = checkedAdd(matrixSize, doubleMargin, "moduleSpan", output);
  const dimension = checkedMultiply(moduleSpan, options.scale, "dimension", output);
  return { matrixSize, moduleSpan, dimension };
}

function checkedAdd(left, right, metric, output) {
  const value = left + right;
  assertSafeInteger(value, metric, output);
  return value;
}

function checkedMultiply(left, right, metric, output) {
  const value = left * right;
  assertSafeInteger(value, metric, output);
  return value;
}

function assertSafeInteger(value, metric, output) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new InvalidInputError(
      `Render geometry for ${output} is not a non-negative safe integer: ${metric}`
    );
  }
}

function assertBudget(value, limit, metric, output) {
  if (value > limit) {
    throw new InvalidInputError(
      `Render geometry for ${output} exceeds the deterministic budget: ${metric}=${value}, limit=${limit}`
    );
  }
}

function countDarkModules(matrix) {
  let count = 0;
  for (const row of matrix) {
    for (const dark of row) {
      if (dark) {
        count += 1;
      }
    }
  }
  return count;
}

function decimalLength(value) {
  return String(value).length;
}
