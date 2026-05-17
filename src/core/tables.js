export const ERROR_CORRECTION_LEVELS = {
  L: { key: "L", ordinal: 0, formatBits: 0b01 },
  M: { key: "M", ordinal: 1, formatBits: 0b00 },
  Q: { key: "Q", ordinal: 2, formatBits: 0b11 },
  H: { key: "H", ordinal: 3, formatBits: 0b10 }
};

export const ERROR_CORRECTION_LEVEL_ORDER = ["L", "M", "Q", "H"];

export const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];

export const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];

export function getSize(version) {
  assertVersion(version);
  return version * 4 + 17;
}

export function getRawCodewordCount(version) {
  assertVersion(version);

  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) {
      result -= 36;
    }
  }

  return Math.floor(result / 8);
}

export function getDataCodewordCount(version, level) {
  assertVersion(version);
  const ecl = ERROR_CORRECTION_LEVELS[level];
  if (!ecl) {
    throw new RangeError(`Unsupported error correction level: ${level}`);
  }

  const raw = getRawCodewordCount(version);
  const blocks = NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][version];
  const eccPerBlock = ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][version];
  return raw - blocks * eccPerBlock;
}

export function getErrorCorrectionBlockInfo(version, level) {
  assertVersion(version);
  const ecl = ERROR_CORRECTION_LEVELS[level];
  if (!ecl) {
    throw new RangeError(`Unsupported error correction level: ${level}`);
  }

  return {
    blocks: NUM_ERROR_CORRECTION_BLOCKS[ecl.ordinal][version],
    eccPerBlock: ECC_CODEWORDS_PER_BLOCK[ecl.ordinal][version],
    rawCodewords: getRawCodewordCount(version),
    dataCodewords: getDataCodewordCount(version, level)
  };
}

export function getAlignmentPatternPositions(version) {
  assertVersion(version);
  if (version === 1) {
    return [];
  }

  const size = getSize(version);
  const numAlign = Math.floor(version / 7) + 2;
  const step = version === 32
    ? 26
    : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;

  const positions = [6];
  for (let pos = size - 7; positions.length < numAlign; pos -= step) {
    positions.splice(1, 0, pos);
  }
  return positions;
}

export function getCharacterCountBitLength(version, mode) {
  assertVersion(version);

  switch (mode) {
    case "numeric":
      return version <= 9 ? 10 : version <= 26 ? 12 : 14;
    case "alphanumeric":
      return version <= 9 ? 9 : version <= 26 ? 11 : 13;
    case "byte":
      return version <= 9 ? 8 : 16;
    case "kanji":
      return version <= 9 ? 8 : version <= 26 ? 10 : 12;
    default:
      throw new RangeError(`Unsupported mode: ${mode}`);
  }
}

function assertVersion(version) {
  if (!Number.isInteger(version) || version < 1 || version > 40) {
    throw new RangeError(`QR version must be an integer from 1 to 40; got ${version}`);
  }
}
