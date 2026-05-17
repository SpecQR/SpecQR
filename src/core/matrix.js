import { ERROR_CORRECTION_LEVELS, getAlignmentPatternPositions, getSize } from "./tables.js";
import { getPenaltyScore, maskCondition } from "./mask.js";

class QRMatrix {
  constructor(size) {
    this.size = size;
    this.modules = Array.from({ length: size }, () => new Array(size).fill(false));
    this.functionModules = Array.from({ length: size }, () => new Array(size).fill(false));
  }

  clone() {
    const copy = new QRMatrix(this.size);
    copy.modules = this.modules.map((row) => row.slice());
    copy.functionModules = this.functionModules.map((row) => row.slice());
    return copy;
  }

  isInside(x, y) {
    return x >= 0 && y >= 0 && x < this.size && y < this.size;
  }

  isFunctionAt(x, y) {
    return this.functionModules[y][x];
  }

  setFunction(x, y, dark) {
    if (!this.isInside(x, y)) {
      return;
    }
    this.modules[y][x] = Boolean(dark);
    this.functionModules[y][x] = true;
  }

  setData(x, y, dark) {
    if (this.functionModules[y][x]) {
      throw new Error(`Cannot write data over function module at ${x},${y}`);
    }
    this.modules[y][x] = Boolean(dark);
  }

  applyMask(maskPattern) {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        if (!this.functionModules[y][x] && maskCondition(maskPattern, x, y)) {
          this.modules[y][x] = !this.modules[y][x];
        }
      }
    }
  }

  toBooleans() {
    return this.modules.map((row) => row.slice());
  }
}

export function buildMatrix(codewords, version, errorCorrectionLevel, maskPatternOption = "auto") {
  const base = new QRMatrix(getSize(version));
  drawFunctionPatterns(base, version, errorCorrectionLevel);
  drawCodewords(base, codewords);

  const candidateMasks = maskPatternOption === "auto"
    ? [0, 1, 2, 3, 4, 5, 6, 7]
    : [maskPatternOption];

  let best = null;
  const maskPenalties = [];
  for (const maskPattern of candidateMasks) {
    const candidate = base.clone();
    candidate.applyMask(maskPattern);
    drawFormatBits(candidate, errorCorrectionLevel, maskPattern);

    const matrix = candidate.toBooleans();
    const penalty = getPenaltyScore(matrix);
    maskPenalties.push({ maskPattern, penalty });
    if (!best || penalty < best.penalty) {
      best = { matrix, maskPattern, penalty };
    }
  }

  return { ...best, maskPenalties };
}

function drawFunctionPatterns(matrix, version, errorCorrectionLevel) {
  const size = matrix.size;

  drawFinderPattern(matrix, 0, 0);
  drawFinderPattern(matrix, size - 7, 0);
  drawFinderPattern(matrix, 0, size - 7);
  drawTimingPatterns(matrix);
  drawAlignmentPatterns(matrix, version);
  drawFormatBits(matrix, errorCorrectionLevel, 0);
  drawDarkModule(matrix);
  drawVersionBits(matrix, version);
}

function drawFinderPattern(matrix, left, top) {
  for (let dy = -1; dy <= 7; dy += 1) {
    for (let dx = -1; dx <= 7; dx += 1) {
      const x = left + dx;
      const y = top + dy;
      if (!matrix.isInside(x, y)) {
        continue;
      }

      const inPattern = dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6;
      const dark = inPattern && (
        dx === 0 || dx === 6 || dy === 0 || dy === 6 ||
        (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4)
      );
      matrix.setFunction(x, y, dark);
    }
  }
}

function drawTimingPatterns(matrix) {
  const size = matrix.size;
  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    matrix.setFunction(i, 6, dark);
    matrix.setFunction(6, i, dark);
  }
}

function drawAlignmentPatterns(matrix, version) {
  const positions = getAlignmentPatternPositions(version);
  const last = positions.length - 1;

  for (let yIndex = 0; yIndex < positions.length; yIndex += 1) {
    for (let xIndex = 0; xIndex < positions.length; xIndex += 1) {
      const overlapsFinder =
        (xIndex === 0 && yIndex === 0) ||
        (xIndex === last && yIndex === 0) ||
        (xIndex === 0 && yIndex === last);

      if (!overlapsFinder) {
        drawAlignmentPattern(matrix, positions[xIndex], positions[yIndex]);
      }
    }
  }
}

function drawAlignmentPattern(matrix, centerX, centerY) {
  for (let dy = -2; dy <= 2; dy += 1) {
    for (let dx = -2; dx <= 2; dx += 1) {
      const distance = Math.max(Math.abs(dx), Math.abs(dy));
      matrix.setFunction(centerX + dx, centerY + dy, distance !== 1);
    }
  }
}

function drawFormatBits(matrix, errorCorrectionLevel, maskPattern) {
  const ecl = ERROR_CORRECTION_LEVELS[errorCorrectionLevel];
  let data = (ecl.formatBits << 3) | maskPattern;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) * 0x537);
  }

  const bits = ((data << 10) | remainder) ^ 0x5412;
  const size = matrix.size;

  for (let i = 0; i <= 5; i += 1) {
    matrix.setFunction(8, i, getBit(bits, i));
  }
  matrix.setFunction(8, 7, getBit(bits, 6));
  matrix.setFunction(8, 8, getBit(bits, 7));
  matrix.setFunction(7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i += 1) {
    matrix.setFunction(14 - i, 8, getBit(bits, i));
  }

  for (let i = 0; i < 8; i += 1) {
    matrix.setFunction(size - 1 - i, 8, getBit(bits, i));
  }
  for (let i = 8; i < 15; i += 1) {
    matrix.setFunction(8, size - 15 + i, getBit(bits, i));
  }
}

function drawDarkModule(matrix) {
  matrix.setFunction(8, matrix.size - 8, true);
}

function drawVersionBits(matrix, version) {
  if (version < 7) {
    return;
  }

  let remainder = version;
  for (let i = 0; i < 12; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 11) & 1) * 0x1F25);
  }

  const bits = (version << 12) | remainder;
  const size = matrix.size;
  for (let i = 0; i < 18; i += 1) {
    const bit = getBit(bits, i);
    const a = size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    matrix.setFunction(a, b, bit);
    matrix.setFunction(b, a, bit);
  }
}

function drawCodewords(matrix, codewords) {
  const size = matrix.size;
  let bitIndex = 0;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) {
      right = 5;
    }

    for (let vert = 0; vert < size; vert += 1) {
      const upward = ((right + 1) & 2) === 0;
      const y = upward ? size - 1 - vert : vert;

      for (let j = 0; j < 2; j += 1) {
        const x = right - j;
        if (!matrix.isFunctionAt(x, y)) {
          const dark = bitIndex < codewords.length * 8
            ? getCodewordBit(codewords, bitIndex)
            : false;
          matrix.setData(x, y, dark);
          bitIndex += 1;
        }
      }
    }
  }
}

function getCodewordBit(codewords, bitIndex) {
  const value = codewords[Math.floor(bitIndex / 8)];
  return ((value >>> (7 - (bitIndex % 8))) & 1) !== 0;
}

function getBit(value, index) {
  return ((value >>> index) & 1) !== 0;
}
