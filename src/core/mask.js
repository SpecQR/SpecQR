export function maskCondition(maskPattern, x, y) {
  switch (maskPattern) {
    case 0:
      return (x + y) % 2 === 0;
    case 1:
      return y % 2 === 0;
    case 2:
      return x % 3 === 0;
    case 3:
      return (x + y) % 3 === 0;
    case 4:
      return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5:
      return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6:
      return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    case 7:
      return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
    default:
      throw new RangeError(`Mask pattern must be from 0 to 7; got ${maskPattern}`);
  }
}

export function getPenaltyScore(matrix) {
  const size = matrix.length;
  let penalty = 0;

  penalty += getRunPenalty(matrix, true);
  penalty += getRunPenalty(matrix, false);
  penalty += getBlockPenalty(matrix);
  penalty += getFinderLikePenalty(matrix, true);
  penalty += getFinderLikePenalty(matrix, false);
  penalty += getBalancePenalty(matrix);

  return penalty;
}

function getRunPenalty(matrix, horizontal) {
  const size = matrix.length;
  let penalty = 0;

  for (let a = 0; a < size; a += 1) {
    let runColor = false;
    let runLength = 0;

    for (let b = 0; b < size; b += 1) {
      const value = horizontal ? matrix[a][b] : matrix[b][a];
      if (b === 0 || value !== runColor) {
        if (runLength >= 5) {
          penalty += runLength - 2;
        }
        runColor = value;
        runLength = 1;
      } else {
        runLength += 1;
      }
    }

    if (runLength >= 5) {
      penalty += runLength - 2;
    }
  }

  return penalty;
}

function getBlockPenalty(matrix) {
  const size = matrix.length;
  let penalty = 0;

  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const color = matrix[y][x];
      if (color === matrix[y][x + 1] && color === matrix[y + 1][x] && color === matrix[y + 1][x + 1]) {
        penalty += 3;
      }
    }
  }

  return penalty;
}

function getFinderLikePenalty(matrix, horizontal) {
  const size = matrix.length;
  const patternA = [true, false, true, true, true, false, true, false, false, false, false];
  const patternB = [false, false, false, false, true, false, true, true, true, false, true];
  let penalty = 0;

  for (let a = 0; a < size; a += 1) {
    for (let b = 0; b <= size - 11; b += 1) {
      let matchA = true;
      let matchB = true;

      for (let i = 0; i < 11; i += 1) {
        const value = horizontal ? matrix[a][b + i] : matrix[b + i][a];
        matchA &&= value === patternA[i];
        matchB &&= value === patternB[i];
      }

      if (matchA || matchB) {
        penalty += 40;
      }
    }
  }

  return penalty;
}

function getBalancePenalty(matrix) {
  const size = matrix.length;
  let dark = 0;

  for (const row of matrix) {
    for (const value of row) {
      if (value) {
        dark += 1;
      }
    }
  }

  const total = size * size;
  return Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
}
